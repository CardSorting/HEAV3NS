# ADR-008: Deterministic Game Engine Architecture

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: August 9, 2026 (Updated August 13, 2026 UTC)
- **Technical Story**: Structuring `/Users/bozoegg/Desktop/LUMI-NEW` around the architectural design of a Deterministic Game Engine with frame ticks (`tick()`), immutable state snapshots (`GameStateSnapshot`), contiguous slab memory (`ArenaAllocator`), and frame-perfect state rewind/replay (`rewindToSnapshot()`).

---

## 1. Context & Motivation (The Why)

### Deterministic State Machine Isolation
Traditional agent loops treat LLM turns as loose async request/response callbacks or stateless REST calls, suffering from state drift, non-reproducible execution paths, race conditions during tool invocation, and V8 Garbage Collection (GC) latency spikes. 

Modeling an agent runtime like a **Deterministic Game Engine** establishes:
1. **Frame Ticks (`tick()`)**: Every user interaction or agent turn is an atomic, deterministic frame step executing `Input Perception -> Context Assembly -> Provider Dispatch -> State Mutation -> Telemetry & Snapshot`.
2. **Immutable State Snapshots (`GameStateSnapshot`)**: Frame-perfect snapshots capture session turns, VFS staged file overlays, long-term memory facts, model token metrics, and slab memory pointers at frame step $t$.
3. **Frame Rewind & Replay (`rewindToSnapshot()`)**: Enables instant $O(1)$ rollback ($<0.1\text{ ms}$ warmed p95) to any prior frame tick without transcript re-parsing or side-effect leaks.
4. **Zero-GC Arena Memory Substrate (`ArenaAllocator`)**: Pre-allocates a contiguous 16MB ArrayBuffer slab, mirroring high-performance game engine memory management to eliminate V8 heap fragmentation and GC pauses.
5. **Session Scene Duplication (`forkSession()`)**: Spawns isolated child engine instances pre-initialized from parent state snapshots for parallel subagent swarms (`AgentSwarmDispatcher`).

---

## 2. Architectural Decision (The What)

### Complete Tree Hierarchy

```
src/
├── core/                                # Contracts & Abstract Subsystems (DIP)
│   ├── contracts/                       # Interfaces & State Types
│   │   ├── agent.contracts.ts           # EngineTickInput, EngineTickResult, IAgentEngine
│   │   ├── session.contracts.ts         # GameStateSnapshot, SessionMessage, ISessionStore
│   │   └── tooling.contracts.ts         # IHands, IEars, IToolRegistry, AnchoredEditResult
│   └── abstracts/                       # Abstract Base Classes (Template Method)
│       ├── abstract-agent-engine.ts     # AbstractAgentEngine (preTick -> executeTick -> postTick)
│       ├── abstract-hands.ts            # AbstractHands
│       ├── abstract-ears.ts             # AbstractEars
│       └── abstract-tool-registry.ts    # AbstractToolRegistry
│
├── agents/                              # Tier 1: Agents Subsystem
│   ├── base/agent-config.ts             # AgentConfig
│   └── extensions/
│       ├── compaction/                  # PromptComposer, ContextDslEngine, TokenTruncator
│       ├── resolution/                  # ModelResolver, AgentSlashRouter, CodexProviderBridge
│       ├── execution/                   # AgentEngine extends AbstractAgentEngine, CodexProgressAdapter
│       └── swarm/                       # AgentSwarmDispatcher (Subagent Session Forking)
│
├── sessions/                            # Tier 2: Sessions Subsystem
│   ├── base/session-context.ts          # SessionContext
│   └── extensions/
│       ├── substrate/                   # ArenaAllocator (16MB Zero-GC Slab), FileLockManager
│       ├── compaction/                  # SessionCompactor, SnapcompactEngine
│       ├── vfs/                         # SessionVfs (In-Memory Staged Diff Overlay)
│       ├── memory/                      # SessionMemoryStore (Long-term Fact Store)
│       └── persistence/                 # PersistentSessionStore extends AbstractSessionStore
│
├── tooling/                             # Tier 3: Tooling Subsystem
│   ├── base/eyes.ts                     # Eyes (Input perception)
│   └── extensions/
│       ├── perception/                  # AstPerceptionEyes
│       ├── hashline/                    # AnchoredHands extends AbstractHands
│       ├── telemetry/                   # ProtocolEars extends AbstractEars, TelemetryTracer
│       └── registry/                    # ValidatingToolRegistry extends AbstractToolRegistry
│
├── factories/                           # Game Engine Bootstrapper
│   └── monolith-factory.ts              # MonolithFactory
│
└── index.ts                             # Game Engine Composition Root (LumiMonolith)
```

---

## 3. Technical Implementation (The How)

### Engine Tick, Snapshot, and Rewind APIs

```typescript
import { LumiMonolith } from "lumi-new";

// Initialize the Game Engine Monolith
const lumi = new LumiMonolith();

// Primary Game Engine Frame Step (tick)
const tickResult = await lumi.tick({
  prompt: "Analyze workspace topology and optimize tests",
  onProgress: (event) => {
    console.log(`[${event.phase}] ${event.message}`);
  },
});

// Immutable Frame Snapshot Capture (State at frame t)
const snapshot = lumi.createSnapshot();

// Frame-Perfect State Rewind (O(1) Time-Travel Rollback)
lumi.rewindToSnapshot(snapshot);

// Fork Session for Parallel Subagent Execution (Scene Duplication)
const subagentSession = lumi.forkSession("subagent-task-01");
```

### Game Engine State Transition Equation

The state transition of an agent session at frame index $t$ is governed by the deterministic operator $\mathcal{T}$:

$$S_{t+1} = \mathcal{T}(S_t, I_t, \mathcal{C}_t)$$

Where $S_t \in \text{GameStateSnapshot}$, $I_t \in \text{EngineTickInput}$, $\mathcal{C}_t \in \text{ContextBudgetInfo}$, and $\mathcal{T}$ is the tick template method (`preTick` $\to$ `executeTick` $\to$ `postTick`).

---

## 4. Verification & Baseline SLAs

- **Type Safety**: `npm run check` passed cleanly (`verbatimModuleSyntax` & erasable TS compliant).
- **Runtime Determinism**: `npm run smoke` verified 100% `instanceof` truthiness across all subsystem abstract base classes, frame tick execution, snapshot generation, and frame-perfect state rewind.
- **Architecture Performance Guardrails**:
  - **Zero-GC Contiguous Memory**: 16MB ArrayBuffer slab allocation verified (`16,777,216` bytes).
  - **Turn Tick Latency SLA**: Enforced $<1.0\text{ ms}$ local mean fast path.
  - **Execution Throughput SLA**: Enforced $\geq1,000$ frames/second local fast path.
  - **State Rewind Latency SLA**: Enforced $<0.1\text{ ms}$ warmed p95 snapshot restoration.
- **Live Baseline Evidence**: Current host-specific measurements are recorded in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).

