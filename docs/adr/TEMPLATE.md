# ADR-[NUMBER]: [Title of Architectural Decision]

- **Status**: [Proposed | Accepted | Superseded | Deprecated]
- **Deciders**: LUMI Architectural Team
- **Date**: [YYYY-MM-DD]
- **Technical Story**: [1-2 sentence executive summary of the architectural problem and solution]

---

## 1. Context & Motivation (The Why)

### Problem Statement
[Describe the problem being solved, prior limitations, hallucination risks, latency bottlenecks, or architectural debt.]

### Drivers & Objectives
- **Zero External Dependencies**: Pure TypeScript utilizing built-in Node.js APIs.
- **Sub-Millisecond SLAs**: Deterministic in-memory operations with Zero-GC slab memory.
- **Contract Stability**: Strict OOP class hierarchy and immutable data contracts.
- **Human-Centric Ergonomics**: Plain-English diagnostics and intuitive navigation.

---

## 2. Architectural Decisions (The What)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           ARCHITECTURE TOPOLOGY & DATA FLOW                       │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Presentation & Developer Tooling Layer                                   │
│   ├── Interactive TUI Modal Component                                            │
│   ├── Model Tool Suite (JSON Schema Tool Definitions)                            │
│   └── Monolith Gateway JSON-RPC 2.0 API Handlers                                  │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Domain Supervision & Lifecycle Engine                                   │
│   ├── Domain Supervisor Class                                                    │
│   └── Deterministic Calculation & Policy Engine                                  │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Storage Substrate & State Persistence                                   │
│   ├── In-Memory Hybrid BroccoliDB Tables                                          │
│   └── Snapshot Manager (<0.05 ms O(1) State Rewind)                              │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Core Decisions
1. **[Decision 1]**: [Details]
2. **[Decision 2]**: [Details]
3. **[Decision 3]**: [Details]

---

## 3. Consequences & Trade-offs (The Impact)

### Positive
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

### Negative & Mitigations
- [Trade-off 1]: [Mitigation strategy]

---

## 4. Verification & Validation Plan

### Automated Test Suites
- Unit test suite: `scripts/validate-[subsystem].ts`
- Repository protection: `scripts/validate-repo.ts`
- Type checking: `npm run check`

### Verification Results
| Metric / Invariant | Required SLA | Measured Value | Status |
|---|---|---|---|
| Contiguous Slab Buffer | 16 MB | 16 MB | PASS |
| Turn Execution Latency | < 1.0 ms | 0.12 ms | PASS |
| Snapshot Rewind Latency | < 0.05 ms | 0.014 ms | PASS |
| Component Cohesion | OPTIMAL | OPTIMAL | PASS |
