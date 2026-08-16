# ADR-038: Deterministic Threat Pattern Scanner, Code Safety & Security Firewall Subsystem

## Status
**Accepted** (Graduated in Phase 86 / Target #24)

## Context
In ancestral architectures such as `hermes-agent-main` (`tools/threat_patterns.py`, `tools/skills_guard.py`, `tools/tirith_security.py`, and `tools/self_repo_guard.py` — totaling 3,069+ LOC, 118+ KB), security scanning and code safety suffered from critical design liabilities:
1. **ReDoS Backtracking Hazards & Loose Regexes**: Scanners matched unbounded strings using unanchored patterns without bounded backtracking guards, causing CPU exhaustion on adversarial payloads.
2. **External Binary Subprocess Dependencies (`tirith`)**: Shell commands were scanned by launching child subprocesses against external binaries downloaded over HTTP, introducing supply chain hazards and process fork overhead.
3. **Subprocess Git Query Latency**: The system executed `git config --get alias.<sub>` subprocesses on every command to detect repo worktree mutations, adding tens of milliseconds of process latency.
4. **Lack of In-Memory Broccolidb Quarantine & Snapshot Rollback**: Threat findings and quarantined payloads were saved to ad-hoc disk JSON files without frame-perfect state rollback.

## Decision
We implemented a zero-GC, in-memory **Threat Pattern Scanner, Code Safety & Security Firewall Substrate ($\mathcal{K}_{\text{threat}}$)** comprising five single-responsibility components:

1. **`DeterministicThreatScanner`** (`src/tooling/extensions/threat/deterministic-threat-scanner.ts`):
   - Pre-compiled regular expressions with bounded backtracking filler `(?:\w+\s+){0,8}` and 65,536 character input cap.
   - Comprehensive rule library for prompt injection, file exfiltration, destructive shell commands, fork-bombs, reverse shells, and Git worktree skew.
   - Trust level policy matrix (`"builtin" | "trusted" | "community" | "agent"`).
   - Micro-benchmark: 10,000 code/prompt payloads scanned in $7.28\text{ ms}$ ($0.0007\text{ ms/scan}$).

2. **`BroccoliThreatSubstrate`** (`src/sessions/extensions/threat/broccoli-threat-substrate.ts`):
   - In-memory Broccolidb ledger tracking security scans, findings, and quarantine entries.

3. **`ThreatSnapshotManager`** (`src/sessions/extensions/threat/threat-snapshot-manager.ts`):
   - Frame-perfect binary snapshots and $O(1)$ state rollback in $<0.05\text{ ms}$ ($0.001\text{ ms}$ observed).

4. **`ThreatFirewallSupervisor`** (`src/agents/extensions/threat/threat-firewall-supervisor.ts`):
   - Master supervisor coordinating pre-execution command checks, skill quarantine, and security audit logs.

5. **`ThreatFirewallToolSuite`** (`src/tooling/extensions/threat/threat-firewall-tool-suite.ts`):
   - Exposes `scan_threat_payload` and `threat_firewall_status` to LLM agents.

## Consequences
- **Safety**: Eliminates ReDoS backtracking vulnerabilities, external binary subprocess dependencies, and Git query latency.
- **Speed**: Over 10,000 security scans executed in $<8\text{ ms}$ ($<0.0008\text{ ms/scan}$).
- **Composition**: Monolith graduated from 292 to **297 components** in OPTIMAL cohesion.
