# 🛡️ Policy: Contributor Security & Performance Guardrail Governance

**Document ID**: `POL-2026-08-09-SECURITY-01`  
**Target Scope**: All contributors, automated PR bots, and agent mutations in `LUMI-JOY`  

---

## 📌 Executive Statement

**LUMI-JOY** enforces strict automated repository protection rules around deterministic fast-path performance and architecture. The latest generated run passed **6/6 guardrails**, with a **$0.12\text{ ms}$** local fast-path mean, **$8506.11$ frames/second**, and **$0.029\text{ ms}$ warmed rewind p95** on Node.js `v23.5.0`/macOS ARM64. These observations are host-sensitive; the durable requirements are the thresholds below, and [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json) is the measurement authority.

---

## 🛡️ Mandated Contributor Guardrails

### Rule 1: Sub-Millisecond Fast-Path Latency SLA ($< 1.0\text{ ms}$)
- **Requirement**: Mean latency across the dedicated deterministic fast-path guardrail cases MUST remain under **$1.0\text{ ms}$**. The heterogeneous five-case benchmark intentionally includes compiler-heavy application synthesis and is not evaluated against this threshold.
- **Enforcement**: Measured automatically by `ArchitectureGuardrailGate` during `npm test`.

### Rule 2: Deterministic Fast-Path Throughput SLA ($\geq 1,000$ frames/second)
- **Requirement**: The dedicated local guardrail workload MUST sustain at least **$1,000$ frames/second**.
- **Enforcement**: Calculated from unrounded measured case time with warmup excluded.

### Rule 3: Zero-GC Contiguous Slab Memory Invariant
- **Requirement**: `PersistentSessionStore` slab allocation capacity MUST remain exactly **$16,777,216\text{ bytes}$** ($16\text{ MB}$).
- **Enforcement**: Verified via `slabSnapshot.capacityBytes` assertion. No standard Node.js heap garbage sweeping allowed during turn ticks.

### Rule 4: State Rewind Correctness and Latency
- **Requirement**: Snapshot rewind MUST restore frame and message state and remain below **$0.1\text{ ms}$ warmed p95** across 25 samples.
- **Enforcement**: No fixed or fallback measurement is accepted.

### Rule 5: Zero-Barrel Import Rule (`ADR-012`)
- **Requirement**: Intermediate `index.ts` re-export barrel files inside `src/*/extensions/` are strictly prohibited.
- **Enforcement**: Direct deep imports required (e.g. `import { ModelResolver } from "../resolution/model-resolver.js"`).

### Rule 6: Foundational Base Class Immutability (`ADR-012`)
- **Requirement**: Base parent classes in `src/*/base/` (`AgentConfig`, `SessionContext`, `Eyes`) are foundational and immutable.
- **Enforcement**: All feature mutations and evolutionary extensions MUST inherit downward (`class Child extends Parent`) in domain-scoped subdirectories inside `src/*/extensions/<domain>/`.

### Rule 7: Agent Activity Observability Boundary (`ADR-082`)
- **Requirement**: Progress events MUST use stable activity identity and explicit terminal lifecycle states. User/provider-derived status text MUST be sanitized and bounded.
- **Prohibited data**: Credentials, authorization material, raw command output, tool arguments/results, full model responses, and hidden reasoning MUST NOT enter `EngineProgressEvent`.
- **Transport boundary**: `AbortSignal` and progress callbacks are local controls and MUST NOT be serialized without an explicit remote cancellation/event protocol.
- **Verification**: Changes require repository validation plus authenticated completion, cancellation, terminal settlement, and representative redaction checks described in the [streaming strategy](../agent/streaming-activity-strategy.md).

---

## 🛠️ Contributor Verification Checklist

Before submitting a Pull Request, contributors MUST run:

```bash
# 1. Type-check TypeScript codebase
npm run check

# 2. Run repository protection audit & SLA verification
npm test

# 3. Compile the production build
npm run build

# 4. Verify the exact 142-component manifest and runtime contracts
npm run smoke

# 5. Run the five-case benchmark, including the 8-assertion Flappy project workload
npm run benchmark
```

Run `npm run baseline:update` when a change affects composition, benchmarks, guardrails, or generated reports. It replaces `docs/LIVE_BASELINE.json`, `docs/BENCHMARK_REPORT.md`, and `docs/GRAND_ARCHITECTURAL_AUDIT.md` from one run and exits nonzero on failure.
