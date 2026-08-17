# LUMI Live Benchmark Baseline

> **Live Baseline Status**: `PASSED`
> **Generated At**: 2026-08-17T04:06:43.562Z
> **Evolution Baseline**: Pass 192 + runtime hardening
> **Repository Version**: `0.1.0`
> **Runtime**: v23.5.0 · darwin/arm64
> **Regenerate**: `npm run baseline:update`

This report is generated from the current worktree by `lumi --baseline`. Do not edit measured values manually; the machine-readable source is [`LIVE_BASELINE.json`](LIVE_BASELINE.json).

## Live Performance Summary

| Metric | Live Measurement | Status |
|---|---:|---|
| Benchmark cases | 5/5 | PASSED |
| Pass rate | 100.0% | PASS |
| Mean heterogeneous case latency | 72.37 ms | observed |
| Total suite duration | 361.85 ms | observed |
| Workload throughput | 13.82 cases/sec | observed |
| Per-minute throughput | 829 cases/min | observed |

## Test Cases

| ID | Case | Outcome | Latency | Assertions | Status |
|---|---|---|---:|---:|---|
| TC-01 | Turn Tick Latency & Fact Storage | completed | 0.07 ms | — | PASS |
| TC-02 | VFS File Perception & Reading | completed | 0.13 ms | — | PASS |
| TC-03 | Complete Flappy Bird React + TypeScript + Vite Synthesis | completed | 361.50 ms | 8/8 | PASS |
| TC-04 | Slash Command Router Latency | completed | 0.08 ms | — | PASS |
| TC-05 | Snapshot State Rewind Latency | completed | 0.07 ms | — | PASS |

## Deep Case Evidence

### Complete Flappy Bird React + TypeScript + Vite Synthesis

| Assertion | Evidence | Status |
|---|---|---|
| complete project manifest | 12/12 required files are unique and non-empty | PASS |
| pinned React, TypeScript, and Vite contract | install, dev, typecheck, production build, and preview dependencies are pinned | PASS |
| strict Vite and TypeScript configuration | strict project references, bundler resolution, React JSX, and deterministic Vite ports verified | PASS |
| semantic TypeScript/TSX compilation | 4 application/configuration modules compiled with zero strict diagnostics | PASS |
| gameplay state-machine simulation | ready, flap, scoring, pause/resume, collision, game-over, and restart transitions passed | PASS |
| deterministic seeded simulation | two seeded 20-frame simulations remained byte-for-byte identical | PASS |
| React animation, controls, and accessibility | animation cleanup, keyboard/pointer input, pause/restart, canvas rendering, and accessibility verified | PASS |
| temp-root isolation and materialization | 12 files and 16068 bytes remained inside an isolated temporary root | PASS |

## Baseline Policy

- A case passes only when its assertion matches and `EngineTickResult.outcome` is `completed`.
- Aggregate case latency includes heterogeneous workloads such as strict TypeScript compilation; engine fast-path SLAs are measured separately by the architecture guardrails.
- Throughput and latency are environment-sensitive live observations, not permanent guarantees.
- The baseline command writes reports even on failure, then exits nonzero so the repository cannot silently bless a failing run.
