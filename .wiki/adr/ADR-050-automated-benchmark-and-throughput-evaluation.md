# ADR-050: Automated Engine Benchmark & Throughput Evaluation Suite

## Status
**Accepted**

## Context
Validating execution performance, turn tick latency, and system throughput across 105 monolithic passes required an automated, reproducible benchmark evaluation suite embedded into the CLI. Legacy monorepos suffered from loose async handler latency ($14.20\text{ ms}$) and re-parsing rewind delays ($285.00\text{ ms}$). `LUMI-NEW` needed empirical telemetry verifying sub-millisecond game loop efficiency.

## Decision
We integrated `MasterBenchmarkOrchestrator` & `MonolithBenchmarkEvaluator` directly into the `LUMI` CLI via `lumi --benchmark` (`-b`).

The current implementation also exposes `lumi --baseline`. It runs the capability smoke suite, hermetic benchmark cases, and architecture guardrails as separate gates, then atomically writes `docs/LIVE_BASELINE.json`, `docs/BENCHMARK_REPORT.md`, and `docs/GRAND_ARCHITECTURAL_AUDIT.md`. The JSON artifact is the machine-readable source of truth; measured Markdown values are generated rather than maintained manually.

### Key Architectural Invariants

1. **Automated Suite Evaluation**:
   - Executes 5 multi-subsystem domain test cases covering memory storage, VFS perception, interactive application generation, slash command routing, and state snapshot rewinding.
   - Replaced the shallow Frogger response-keyword case with a temp-isolated 12-file Flappy Bird React + TypeScript + Vite synthesis workload.
   - The Flappy workload checks the exact project manifest, pinned package/build contract, strict compiler configuration, zero semantic TypeScript/TSX diagnostics, executable gameplay state transitions, seeded determinism, React animation cleanup, keyboard/pointer controls, responsive styling, accessibility, materialization, and temp-root containment.
   - Measures each heterogeneous case via `performance.now()`. Aggregate case latency and cases/second are reported separately from the engine fast-path latency and frames/second guardrails.

2. **Acceptance-Time Empirical Performance Achievements**:
   - **Mean Turn Tick Latency**: **$0.22\text{ ms}$** ($64.5\times$ speedup vs legacy).
   - **Execution Throughput**: **$4,132.23\text{ turns/sec}$** ($247,934\text{ turns/min}$).
   - **State Snapshot Rewind**: **$0.04\text{ ms}$** ($O(1)$ pointer rewind).
   - **Suite Pass Rate**: **$100\%\text{ (5/5 PASS)}$**.

   These are August 9 acceptance-time measurements. They are retained as historical evidence rather than copied forward as the current baseline.

3. **Field Note Documentation**:
   - Published field note report ([BENCHMARK-PERFORMANCE-FIELD-NOTE.md](file:///Users/bozoegg/Desktop/LUMI-NEW/.wiki/field-notes/BENCHMARK-PERFORMANCE-FIELD-NOTE.md)) detailing throughput mathematical equations, zero-GC slab memory allocation, and reproducibility steps.

## Consequences

### Positive
- One-command performance validation (`lumi --benchmark`).
- One-command live baseline publication (`npm run baseline:update`) with nonzero failure semantics and synchronized machine-readable and human-readable artifacts.
- Empirical proof of $O(1)$ zero-drift snapshot state rewinding and zero-GC ArrayBuffer slab memory allocation.
- Continuous throughput monitoring prevents performance regression.

## Current Verification (August 13, 2026 UTC)

- Pinned benchmark contract:
  - **Total Evaluated Tests**: 5
  - **Pass Rate**: 100%
  - **Throughput Enforced**: $\ge 1,000\text{ frames/second}$ (latest host run: **$6749.16\text{ frames/second}$** across **377/377 components**)
  - **Turn Tick Latency SLA**: $< 1.0\text{ ms}$ (latest host run: **$0.15\text{ ms}$**)
  - **State Rewind Latency SLA**: $< 0.1\text{ ms p95}$ (latest host run: **$0.018\text{ ms p95}$**)
  - **Flappy Bird React Synthesis**: 12/12 files synthesized in memory, 8/8 assertions passing, verified at **$355.45\text{ ms}$**.

The heterogeneous suite reports mean case latency and cases/second because it includes strict compiler work. It must not be compared directly with the dedicated frame-performance guardrail. See [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json) and the generated [benchmark report](../../docs/BENCHMARK_REPORT.md).
