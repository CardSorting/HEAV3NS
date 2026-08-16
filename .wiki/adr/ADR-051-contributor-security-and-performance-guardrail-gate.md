# ADR-051: Contributor Security & Performance Guardrail Protection Gate

## Status
**Accepted**

## Context
The August 9 acceptance experiment demonstrated a sub-millisecond local turn path. Protecting the codebase against accidental performance regressions, microservice bloat, or architectural drift therefore became a priority. Decision-time figures are historical; current evidence comes from the generated live baseline. The latest recorded run measured **$0.12\text{ ms}$** mean local fast-path latency, **$8580.63$ frames/second**, and **$0.019\text{ ms}$ warmed rewind p95**, with all **6/6 guardrails** passing.

## Decision
We implemented an automated, multi-layer repository protection gate centered around `ArchitectureGuardrailGate` ([architecture-guardrail-gate.ts](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/policy/architecture-guardrail-gate.ts)), `scripts/validate-repo.ts` (`npm test`), and GitHub Actions CI workflow ([repo-protection-ci.yml](file:///Users/bozoegg/Desktop/LUMI-NEW/.github/workflows/repo-protection-ci.yml)).

## Baseline Values (as of 2026-08-16T07:30:22.192Z)
- Composition Manifest: **382/382** required components in OPTIMAL cohesion.
- Fast-Path Mean Turn Tick Latency: **$0.15\text{ ms}$** (SLA: $< 1.0\text{ ms}$).
- Local Frame Throughput: **$6603.41\text{ frames/second}$** (SLA: $\ge 1,000\text{ frames/second}$).
- State Snapshot Rewind Latency: **$0.023\text{ ms p95}$** (SLA: $< 0.1\text{ ms p95}$).
- Zero-GC Contiguous Slab Memory: **16,777,216 bytes** (Verified intact).
- Architectural Rules: **0 barrel files**, **3/3 immutable base classes**.

### Key Protection Rules Enforced

1. **Performance SLA Guardrail**: Dedicated local fast-path mean latency must remain $< 1.0\text{ ms}$ and throughput must remain $\geq1,000$ frames/second.
2. **State Rewind Guardrail**: Rewind must restore frame/message state and remain $< 0.1\text{ ms}$ warmed p95 across 25 samples.
3. **Zero-GC Contiguous Slab Invariant**: Pre-allocated 16MB ArrayBuffer slab capacity must remain intact (`16,777,216 bytes`).
4. **Zero-Barrel Import Enforcement**: Prohibition of intermediate `index.ts` re-export files (`ADR-012`).
5. **Base Class Immutability**: Prohibition of destructive mutations in `src/*/base/`.
6. **Agent Activity Security Boundary**: Stable lifecycle identity, explicit terminal settlement, bounded sanitization, secret/output exclusion, and process-local cancellation controls according to `ADR-082`.

## Consequences

### Positive
- Pull requests violating performance SLAs or architectural invariants are automatically blocked.
- Guarantees $100\%$ zero-drift state rewind and zero-GC slab invariants across all future PRs.
- `npm test` provides instant pre-commit verification.

### Negative
- PR authors must fix any latency regressions or forbidden barrel imports before code can be merged.

## Current Refinement: Streaming Regression Gate

Changes to provider dispatch, `EngineProgressEvent`, the Codex adapter, cancellation, or terminal activity rendering require interactive authenticated completion and cancellation coverage in addition to `npm run check`, `npm test`, and `npm run build`. See [ADR-082](ADR-082-structured-agent-activity-streaming.md) and the [streaming strategy](../agent/streaming-activity-strategy.md).

The five-case heterogeneous benchmark is intentionally separate from the sub-millisecond guardrail lane. It now includes a complete 12-file Flappy Bird React + TypeScript + Vite project with 8/8 deep assertions, so its compiler-heavy mean case latency is not a turn-tick SLA.
