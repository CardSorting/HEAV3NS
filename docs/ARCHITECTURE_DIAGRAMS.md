# 📐 LUMI-JOY Architecture & Subsystem Diagrams

This document houses the visual diagrams, execution pipeline topologies, and interaction flows for the **LUMI-JOY Deterministic Agent Framework**.

---

## 1. 🕹️ Deterministic Game Engine Turn Loop

LUMI-JOY models the autonomous AI agent turn loop after high-performance video game engine kernels:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC GAME ENGINE TURN LOOP                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ User Input / CLI Trigger ]                                              │
│               │                                                             │
│               ▼                                                             │
│   ┌─────────────────────────┐                                               │
│   │ Frame Tick (tick())     │ ◄─── Input ───► DSL Context Projection        │
│   └───────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│   ┌─────────────────────────┐                                               │
│   │ Provider Dispatch       │ ◄─── Streaming Events & Activity Timeline     │
│   └───────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│   ┌─────────────────────────┐                                               │
│   │ Immutable State Snapshot│ ◄─── GameStateSnapshot (VFS Overlay + Memory) │
│   └───────────┬─────────────┘                                               │
│               │                                                             │
│               ▼                                                             │
│   [ O(1) Rewind / Subagent ] ◄─── rewindToSnapshot() (< 0.1ms p95)          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 🚀 Onboarding & Interface Topology

```mermaid
graph LR
    A[1. Install & Build] --> B[2. Authenticate Provider]
    B --> C{3. Choose Interface}
    C -->|Terminal UI| D[Interactive TUI Shell]
    C -->|Direct CLI| E[Single-Turn CLI Runner]
    C -->|Code SDK| F[TypeScript Monolith API]
    
    style A fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style B fill:#0f766e,stroke:#2dd4bf,stroke-width:2px,color:#f8fafc
    style C fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc
    style D fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style E fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc
    style F fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#f8fafc
```

---

## 3. 🛡️ Tool Execution Pipeline, Guardrails & BroccoliDB Time-Travel

The execution loop integrates parallel batch scheduling for idempotent reads, sequential barriers for mutations, escalating loop prevention, and in-memory BroccoliDB persistence:

```mermaid
graph TD
    subgraph "Execution Pipeline & Guardrails"
        A[Model Tool Batch Ingestion] --> B{DeterministicToolSegmenter}
        B -->|Idempotent Reads| C[Parallel Execution Segment]
        B -->|Mutating Operations| D[Sequential Barrier Boundary]
        C & D --> E{Anti-Loop Firewall}
        E -->|Canonical Hash Check| F[Policy Escalation Engine]
        F -->|Allow / Warn / Block / Abort| G[BroccoliExecutionGuardSubstrate]
    end

    subgraph "BroccoliDB Hybrid Kernel & Time-Travel"
        G --> H[(In-Memory Reactive Tables)]
        H --> I[Append-Only WAL Journal]
        H --> J[256-Way Sharded CAS Vault]
        G -->|Sub-millisecond Rollback| K[ExecutionGuardSnapshotManager]
    end

    subgraph "Presentation & Tool Surfaces"
        G --> L[ToolExecutionGuardDashboardModal]
        G --> M[ToolExecutionGuardToolSuite 30 Tools]
        G --> N[Multi-Format Exporters HTML/MD/CSV]
        G --> O[Reactive Notification Dispatchers]
    end

    style A fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style B fill:#0f766e,stroke:#2dd4bf,stroke-width:2px,color:#f8fafc
    style C fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style D fill:#881337,stroke:#fb7185,stroke-width:2px,color:#f8fafc
    style E fill:#7c2d12,stroke:#fb923c,stroke-width:2px,color:#f8fafc
    style F fill:#854d0e,stroke:#facc15,stroke-width:2px,color:#f8fafc
    style G fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc
    style H fill:#14532d,stroke:#4ade80,stroke-width:2px,color:#f8fafc
    style I fill:#164e63,stroke:#22d3ee,stroke-width:2px,color:#f8fafc
    style J fill:#3f3f46,stroke:#a1a1aa,stroke-width:2px,color:#f8fafc
    style K fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc
    style L fill:#312e81,stroke:#a78bfa,stroke-width:2px,color:#f8fafc
    style M fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style N fill:#0c4a6e,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style O fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#f8fafc
```

---

## 4. 🖥️ Interactive ANSI Terminal UI Layout

The full-screen differential ANSI terminal interface maintains synchronized `\x1b[?2026h` flicker-free updates:

```text
┌─ 🌟 LUMI-JOY DETERMINISTIC ENGINE v0.1.0 ───────────────────────────────────────────┐
│  Provider: OpenAI Codex (OAuth)  │ Model: gpt-5-codex     │ Slab: 16.00 MB [ALLOCATED]│
│  Fast-Path Latency: 0.12 ms      │ Turn Speed: 8506 fps   │ Snapshots: 4 frames active│
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  👤 USER: Refactor user authentication in src/auth.ts to use PKCE device flow         │
│                                                                                       │
│  🤖 LUMI: [PLAN] Segmenting execution into 2 read passes and 1 sequential barrier     │
│  ├── ⚡ [PARALLEL] read_file("src/auth.ts") & search_files("auth", "*.ts")          │
│  ├── 🛡️ [GUARD] Tool Execution Segmenter: 0 loop violations detected (Status: OK)     │
│  ├── ✍️ [MUTATION] applyAnchoredEdit("src/auth.ts", lineHash="a7f92b") -> PASS        │
│  └── 🔍 [EVIDENCE] Verification Evidence: TypeScript compilation passed (0 errors)    │
│                                                                                       │
│  🤖 LUMI: ✅ PKCE device flow implemented successfully with POSIX 0600 token storage. │
│                                                                                       │
├───────────────────────────────────────────────────────────────────────────────────────┤
│  [Prompt] > Type your instructions or /help (Press Ctrl+M for models, ? for keys)     │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 🧠 Token-Aware Multi-Turn Context Lifecycle

Context admission is model-aware and token-aware, packing system policies, structured checkpoints, and fresh turns:

```text
model context window
├── reserved model output
├── safety margin
└── usable model input
    ├── pinned system + memory context
    └── active conversation projection
        ├── LUMI-CONTEXT/1 checkpoint
        └── recent complete turns
```

---

## 6. ⚡ Zenith-Tier Prompt Caching Subsystem & Execution Span Waterfall (ADR-135)

```mermaid
graph TD
    subgraph "1. Client Turn Request"
        A[User Turn Request] --> B[Dynamic Variable Sanitizer]
    end

    subgraph "2. 5-Tier Semantic Segmentation"
        B --> C[L0: Base Identity & System Kernel]
        C --> D[L1: Canonical Tool Declarations]
        D --> E[L2: Project Grounding & Rules]
        E --> F[L3: History Compaction Markers]
        F --> G[L4: Volatile User Message]
    end

    subgraph "3. Substrate & Telemetry Engine"
        C -->|SHA-256 Hash| H[Layered Fingerprint L0-L3]
        D -->|Canonical Sort| H
        E -->|Rule Cache| H
        H --> I[X-Lumi-Cache Headers]
        H --> J[Datadog APM Spans & Trace]
        H --> K[AWS Multi-Horizon Forecast]
    end

    subgraph "4. Execution & Savings"
        I --> L[Provider Dispatch: Cache HIT 75-90% Discount]
        J --> M[Prefill TTFT Reduction: 85-94% Faster]
        K --> N[Real-Time ROI Accounting & Scorecard]
    end

    style A fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    style C fill:#0f766e,stroke:#2dd4bf,stroke-width:2px,color:#f8fafc
    style D fill:#0f766e,stroke:#2dd4bf,stroke-width:2px,color:#f8fafc
    style E fill:#0f766e,stroke:#2dd4bf,stroke-width:2px,color:#f8fafc
    style F fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc
    style G fill:#7f1d1d,stroke:#f87171,stroke-width:2px,color:#f8fafc
    style H fill:#4c1d95,stroke:#c084fc,stroke-width:2px,color:#f8fafc
    style L fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc
    style M fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc
    style N fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
```

---

## Related Architectural Documentation

- [Master Architecture Decision Records (ADR) Workspace](adr/README.md)
- [ADR-135: Zenith-Tier Prompt Caching Subsystem](adr/ADR-135-zenith-tier-prompt-caching-telemetry-and-auto-tuning-substrate.md)
- [Runtime Architecture Guide](RUNTIME_ARCHITECTURE_GUIDE.md)
- [Grand Architectural Audit](GRAND_ARCHITECTURAL_AUDIT.md)
- [Benchmark Report](BENCHMARK_REPORT.md)
- [Current Live Baseline](LIVE_BASELINE.json)
