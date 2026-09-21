# 🛡️ Policy: Contributor Security & Performance Guardrail Governance

**Document ID**: `POL-2026-08-09-SECURITY-01`  
**Target Scope**: All contributors, automated PR bots, and agent mutations in `LUMI-JOY`  

---

## 📌 Executive Statement

**LUMI-JOY** enforces repository checks around selected architecture, security, and performance invariants. The latest generated run records host-sensitive observations in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json); that file is the measurement authority for its named workload. No number below is a general service level or performance warranty.

---

## 🛡️ Mandated Contributor Guardrails

### Rule 1: Fast-path latency measurement guardrail
- **Requirement**: The dedicated local workload is measured against its current baseline and configured regression threshold. The heterogeneous five-case benchmark intentionally includes compiler-heavy application synthesis and is not a universal latency target.
- **Enforcement**: Measured automatically by `ArchitectureGuardrailGate` during `npm test`.

### Rule 2: Fast-path throughput measurement guardrail
- **Requirement**: The dedicated local workload is measured against its current baseline and configured regression threshold; throughput is not promised across hosts or workloads.
- **Enforcement**: Calculated from unrounded measured case time with warmup excluded.

### Rule 3: Contiguous arena capacity invariant
- **Requirement**: `PersistentSessionStore` slab allocation capacity MUST remain exactly **$16,777,216\text{ bytes}$** ($16\text{ MB}$) where that contract is enabled.
- **Enforcement**: Verified via `slabSnapshot.capacityBytes` assertion. This invariant does not assert that Node.js performs no garbage collection elsewhere.

### Rule 4: State rewind correctness and measurement
- **Requirement**: Snapshot rewind MUST restore the supported frame and message state. Timing is recorded across the named sample set and must not be generalized beyond that workload.
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

# 2. Run repository protection and measurement checks
npm test

# 3. Compile the production build
npm run build

# 4. Verify the exact 142-component manifest and runtime contracts
npm run smoke

# 5. Run the five-case benchmark, including the 8-assertion Flappy project workload
npm run benchmark
```

Run `npm run baseline:update` when a change affects composition, benchmarks, guardrails, or generated reports. It replaces `docs/LIVE_BASELINE.json`, `docs/BENCHMARK_REPORT.md`, and `docs/GRAND_ARCHITECTURAL_AUDIT.md` from one run and exits nonzero on failure.
