# LUMI Live Architectural Audit

> **Live Baseline Status**: `PASSED`
> **Generated At**: 2026-08-16T07:47:23.357Z
> **Evolution Baseline**: Pass 192 + runtime hardening (ADR-082)
> **Configured Model**: `gpt-5.6-terra`
> **Regenerate**: `npm run baseline:update`

This audit and [the benchmark report](BENCHMARK_REPORT.md) are generated atomically from the same live run. [`LIVE_BASELINE.json`](LIVE_BASELINE.json) is the machine-readable source of truth.

## Verification Summary

| Verification Lane | Live Result | Status |
|---|---:|---|
| Runtime smoke checks | 9/9 | PASS |
| Architecture and performance guardrails | 6/6 | PASS |
| Required current capabilities | 382/382 | PASS |
| Composed runtime components | 382 | observed |
| Benchmark cases | 5/5 | PASS |
| Mean heterogeneous case latency | 74.62 ms | observed |
| Workload throughput | 13.40 cases/sec | observed |

## Runtime Smoke Evidence

| Category | Capability | Duration | Status | Evidence |
|---|---|---:|---|---|
| composition | Current evolution capabilities are composed | 0.04 ms | PASS | 382 required capabilities across 382 components |
| architecture | Core abstract contracts remain connected | 0.13 ms | PASS | agent, session, hands, ears, and tool-registry contracts verified |
| execution | Local frame commits an explicit successful outcome | 0.92 ms | PASS | frame 1 completed in 0.6 ms |
| state | Snapshot rewind restores frame and message state | 0.29 ms | PASS | restored frame 1 with 2 messages |
| governance | Completion gate fails closed without evaluated evidence | 0.47 ms | PASS | 5 fail-closed states rejected; 2/2 evaluated required criteria accepted |
| safety | Modern command safety and diagnostics are active | 0.24 ms | PASS | interactive editor blocking and port-collision guidance verified |
| observability | Command output summaries remain bounded | 0.08 ms | PASS | head/tail output retention verified |
| governance | Strategic integrity audit contract is complete | 0.04 ms | PASS | architect, critic, and SRE review sections verified |
| health | Subsystem health aggregation remains optimal | 0.07 ms | PASS | 3/3 registered subsystems healthy |

## Architecture and Performance Guardrails

| Rule | Live Measurement | Required Threshold | Status |
|---|---:|---:|---|
| Zero-GC Contiguous Slab Memory Invariant | 16777216 bytes | 16777216 bytes | PASS |
| Performance SLA: Sub-Millisecond Turn Tick Latency | 0.14 ms | < 1 ms | PASS |
| Performance SLA: Execution Throughput | 6981.83 frames/sec | >= 1000 frames/sec | PASS |
| Performance SLA: State Rewind Latency | 0.042 ms p95 | < 0.1 ms p95 | PASS |
| Architecture Rule: Zero Barrel Imports (ADR-012) | 0 barrel files | 0 barrel files | PASS |
| Architecture Rule: Base Class Immutability (ADR-012) | 3 / 3 files intact | 3 files intact | PASS |

## Completion Semantics

- A completed provider item is not a completed logical turn.
- Retriable attempt failures remain activity-scoped while fallback is active.
- Public frame success requires `EngineTickResult.outcome === "completed"`.
- The first turn-scoped terminal is immutable.

## Reproduction

```bash
npm run baseline:update
npm run check
npm test
npm run build
git diff --check
```
