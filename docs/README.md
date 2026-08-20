# Runtime Verification Reports

This directory contains the authoritative current-worktree runtime evidence.

## Source of truth

[`LIVE_BASELINE.json`](LIVE_BASELINE.json) is the machine-readable source. [`BENCHMARK_REPORT.md`](BENCHMARK_REPORT.md) and [`GRAND_ARCHITECTURAL_AUDIT.md`](GRAND_ARCHITECTURAL_AUDIT.md) are generated from the same in-memory run by `npm run baseline:update`.

For architectural deep-dives, see:
- [`adr/README.md`](adr/README.md) — Master Architecture Decision Record (ADR) Workspace cataloging 173 system architectural decisions.
- [`adr/ADR-135-zenith-tier-prompt-caching-telemetry-and-auto-tuning-substrate.md`](adr/ADR-135-zenith-tier-prompt-caching-telemetry-and-auto-tuning-substrate.md) — Zenith-Tier Deterministic Byte-Stable Prompt Caching, Telemetry Headers & Auto-Tuning Substrate (Pass 195).
- [`RUNTIME_ARCHITECTURE_GUIDE.md`](RUNTIME_ARCHITECTURE_GUIDE.md) — Comprehensive technical reference for memory layout, TUI rendering, and time-travel rewind.
- [`RUNTIME_OPTIMIZATION_RECORD.md`](RUNTIME_OPTIMIZATION_RECORD.md) — Exhaustive optimization and hardening changelog across all runtime subsystems.
- [`STATEM_RUNBOOK_FSM_EVALUATION.md`](STATEM_RUNBOOK_FSM_EVALUATION.md) — Empirical benchmark and evaluation report for the StateM Runbook FSM Strategy (Pass 193 / ADR-131).

Do not hand-edit measured values in those three files. The baseline command writes all three atomically, writes failure evidence as well as success evidence, and exits nonzero when smoke, benchmark, or guardrail verification fails.

## Current verification model

- **Composition:** exact typed Pass 192 + runtime-hardening manifest. Missing, uninitialized, unexpected, or duplicate entries fail verification.
- **Smoke:** nine cross-cutting runtime checks covering composition, abstract contracts, explicit frame outcomes, rewind, fail-closed completion, command safety, bounded output, strategic integrity, and aggregate health.
- **Heterogeneous benchmark:** five cases measured as case latency and cases/second. The complete Flappy Bird case generates 12 React + TypeScript + Vite files and reports eight independent assertions.
- **Guardrails:** dedicated local fast-path latency and throughput, warmed rewind p95 plus state restoration, 16MB slab capacity, zero-barrel imports, and foundational base-file presence.

The heterogeneous benchmark includes TypeScript compiler work and must not be interpreted as local frame latency. The performance SLA is enforced only by the dedicated guardrail workload.

## Reproduce

```bash
npm run baseline:update
npm run check
npm test
npm run build
git diff --check
```

`npm test` includes `scripts/validate-documentation.ts`. It fails when current summaries diverge from the live JSON, generated views no longer describe the same run, a relative Markdown link breaks, a phase ADR restores stale reproduction guidance, or a dated measurement loses its historical-provenance label.

Historical field notes, ADR acceptance measurements, research papers, and legal disclosures preserve the evidence available at their publication dates. They should link here for current results rather than replacing their original figures.
