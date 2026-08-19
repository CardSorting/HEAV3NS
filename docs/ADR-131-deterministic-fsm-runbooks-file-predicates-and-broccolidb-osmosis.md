# ADR-131: Deterministic Finite State Machine (FSM) Runbooks, Zero-Subshell File Predicates & Hybrid BroccoliDB Osmosis (Pass 193)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-19
- **Technical Story**: Migrating LUMI from prompt-only ad-hoc autonomous loops to a deterministic, graph-theoretic Finite State Machine (FSM) execution model inspired by StateM (the Terminal-Bench 2.1 champion architecture). Deeply assimilating StateM's 10-step atomic transition transaction lifecycle, entry-scoped dynamic verification manifests, and zero-subshell file predicates into LUMI's zero-dependency TypeScript substrate, backed by Hybrid BroccoliDB (L1 in-memory + L2 WAL + L3 CAS + L4 double-buffered checkpoints), amnesia-proof context compaction synthesis, and human-centric world-class UX.

---

## 1. Context & Motivation (The Why)

### Forensic Architectural Scrutiny: The Amnesia & Hallucination Trap
Prior to Pass 193, autonomous multi-turn agents operated primarily via prompt-driven loops (e.g. "Plan your work, execute, verify, and complete"). While flexible, prompt-only autonomy exhibits severe structural failure modes in production and competitive benchmarks:

1. **Premature Completion & Verification Skipping**:
   When models face token pressure or difficult edge cases, they frequently hallucinate that tasks are complete or skip testing entirely, declaring success without verifying output files or test contracts.
2. **Context Compaction Amnesia**:
   During long-running sessions, context compaction (`/compact`) discards prior instructions and checklist items. The agent wakes up with amnesia, losing its position in the workflow and re-executing completed work or forgetting pending requirements.
3. **Infinite Rework Thrashing**:
   Without formal edge attempt limits, agents trapped by failing edge conditions enter unbounded retry loops, burning token budgets and exceeding SLA deadlines.
4. **The StateM Breakthrough**:
   **StateM** proved that constraining LLM execution with a formal, graph-theoretic state machine achieves state-of-the-art benchmark results (e.g. #1 rank on Terminal-Bench 2.1). In StateM, an agent cannot advance simply by claiming it is finished; transitions must pass mechanical, deterministic verification gates before state mutation is committed.

### The Need for Native Osmosis into LUMI
Rather than wrapping StateM as a foreign Python CLI or spawning subshell processes, LUMI required a deep **Osmosis Assimilation**:
- **Zero External Dependencies**: Implemented in 100% pure TypeScript using Node.js built-ins.
- **Zero Subshell Overhead**: Zero-subshell file predicates and JSONPath inspection executing directly in memory ($<0.05\text{ ms}$).
- **Hybrid BroccoliDB Backing**: Persisting runbook specs, nodes, edges, dynamic manifests, and WAL transition events in LUMI's 4-tier database kernel.
- **World-Class Humanized Ergonomics**: Translating low-level predicate errors into empathetic plain-English diagnostics and interactive visual TUI dashboards for technical and non-technical users alike.

---

## 2. Architectural Decisions (The What)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       LUMI RUNBOOK FSM OSMOSIS TOPOLOGY                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Human-Centric Presentation & Tooling Layer                                                             │
│   ├── RunbookDashboardModal (Above-the-Fold KPI Ribbon, 5-View Mode Switcher, Keyboard Nav)                     │
│   ├── RunbookHumanizer (Plain-English Diagnostics, Actionable Fixes, Visual ASCII Pipeline Breadcrumbs)         │
│   ├── RunbookCatalog (5 Curated Presets: coding_loop, bugfix_patch, feature_delivery, benchmark_solve, security)│
│   ├── RunbookToolSuite (runbook_start, runbook_cur, runbook_goto, runbook_save, runbook_dynamic_write, etc.)    │
│   └── AgentSlashRouter (/runbook, /runbook presets, /runbook start, /runbook goto, /runbook story)             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Execution Supervision & Lifecycle Layer                                                                 │
│   ├── RunbookSupervisor (10-Step Symmetrical Atomic Transition Transaction Engine)                              │
│   ├── StatefulCompactionSynthesizer (Amnesia-Proof /compact Prompt Synthesis & Reconstitution Directives)       │
│   ├── MiniYamlParser (In-Tree Zero-Dependency YAML Parser for Agent Runbook Authoring)                         │
│   └── FilePredicateEvaluator (Zero-Subshell In-Memory Inspection: exists, nonEmpty, regex, JSONPath, oneOf)    │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Hybrid BroccoliDB Substrate & Multi-Modal Indexing                                                      │
│   ├── runbook_specs (CAS Indexed Specs)                 ├── runbook_nodes (Composite [specId, nodeName])        │
│   ├── runbook_edges (Composite [specId, fromNode])      ├── runbook_runs (Active Execution Runs)                │
│   ├── runbook_dynamic_checks (Entry-Scoped Manifests)   ├── runbook_transitions (WAL Event Journal)            │
│   └── runbook_evidence_receipts (Verification Receipts) └── ReentrantAsyncMutex (Concurrency & Race Guards)    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### The 6 Core Pillars of the StateM Integration

#### 1. Graph-Theoretic Runbook Finite State Machine (FSM)
Workflows are defined as directed graphs $G = (V, E)$ where:
- Vertices $V$ are execution nodes (`plan`, `execute`, `review`, `handoff`), each with an operational prompt, optional entry hooks (`inHook`), pre-transfer static gates (`beforeTransfer`), and dynamic gate configurations (`dynamicBeforeTransfer`).
- Edges $E$ define valid transition pathways with condition strings, edge hooks (`edgeHook`), and max attempt limits (`maxAttempts`).
- Each node entry generates a unique, monotonic `currentEntryId` (e.g. `entry_1724049281000_abc123`) that scopes dynamic verification items and prevents cross-stage contamination.

#### 2. The 10-Step Symmetrical Atomic Transition Transaction Lifecycle
When an agent or user invokes `runbook_goto(target)`, the supervisor executes an atomic 10-step transaction:
1. **Edge Attempt Budget Check**: Increments and validates `edgeAttempts[currentEntryId][source][target] <= maxAttempts`. If exceeded, transitions to terminal failure or triggers graceful deadline handoff.
2. **Static Pre-Transfer Gates**: Evaluates all `sourceNode.beforeTransfer` check items (file predicates, checklists).
3. **Dynamic Micro-Manifest Gates**: Evaluates `dynamic_before_transfer` scoped strictly to `currentEntryId`.
4. **Edge Condition Evaluation**: Evaluates edge-specific requirements.
5. **Source Node Out-Hook**: Executes `sourceNode.outHook` side-effects.
6. **Edge Hook**: Executes `edge.edgeHook` side-effects.
7. **Atomic Rollback & Failure Logging**: If any gate or hook in steps 1–6 fails, state mutation is aborted, current `entry_id` is preserved, and a `goto_blocked` event is recorded in the BroccoliDB WAL.
8. **State Mutation Commit**: Commits `current = target` and generates a fresh `targetEntryId`.
9. **Target Node In-Hook**: Executes `targetNode.inHook` side-effects.
10. **WAL Transition Journaling**: Commits a successful `goto` transition event with microsecond timing into BroccoliDB.

#### 3. Zero-Subshell File Predicate & JSONPath Evaluator
Eliminates shell subprocess execution (`test -f`, `grep`, `jq`, `cat`) by performing zero-subshell file inspection:
- `exists` & `nonEmpty`: File existence and positive byte length.
- `contains` & `notContains`: Substring assertions.
- `matchesPattern`: Compiled regular expression matching.
- `jsonPath`: Nested dot-notation and array index resolution (`stats.coverage`, `tags.0`), asserting `equals` or `oneOf` values in pure JavaScript.

#### 4. Entry-Scoped Dynamic Verification Manifests
Allows agents and tools to register runtime verification items during the current stage using `runbook_dynamic_write`:
- Scoped to `runId` and `currentEntryId`.
- Includes producer metadata (agent ID, role, timestamp) and task basis contract.
- Automatically cleaned up on stage transition, ensuring dynamic checks from stage $N$ do not leak into stage $N+1$.

#### 5. Amnesia-Proof Context Compaction Synthesis
Addresses context window exhaustion by synthesizing `/compact` prompts that retain durable references:
- Documents active run ID, spec name, and active node ID.
- Captures uncompacted durable notes from `progress.md`.
- Injects reconstitution instructions (`lumi runbook_cur`) so the agent immediately regains full awareness of active gates upon post-compaction initialization.

#### 6. World-Class Non-Technical Ergonomics & Interactive Visual TUI
- **`RunbookHumanizer`**: Translates technical predicate failures into clear, supportive guidance (e.g. *"Missing File: progress.md — The workflow requires progress.md to be created before moving to the next stage"*).
- **Visual ASCII Pipeline Breadcrumbs**: Renders high-contrast progress trails (`[✔ 1. Plan] ──► [● 2. Execute (ACTIVE)] ──► [○ 3. Review] ──► [○ 4. Handoff]`).
- **`RunbookDashboardModal`**: Above-the-fold executive KPI ribbon (`Progress: 60%`, `Gates: 3/3`, `Dynamic: 2 active`), 5 instant view modes, and full keyboard navigation.
- **Slash Command Suite**: Quick CLI access via `/runbook`, `/runbook presets`, `/runbook start <preset>`, `/runbook goto <target>`, and `/runbook story`.

---

## 3. Concrete Code Surfaces (The How)

| Subsystem Component | File Path | Primary Responsibility |
| :--- | :--- | :--- |
| **FSM Core Contracts** | [`runbook.contracts.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/core/contracts/runbook.contracts.ts) | Declares `RunbookSpec`, nodes, edges, predicates, dynamic check manifests, and runtime states. |
| **BroccoliDB Row Schemas** | [`broccolidb-runbook.contracts.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/core/contracts/broccolidb-runbook.contracts.ts) | Declares typed row interfaces for the 7 BroccoliDB runbook tables. |
| **Predicate Evaluator** | [`file-predicate-evaluator.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/runbooks/file-predicate-evaluator.ts) | In-memory zero-subshell file, regex, and JSONPath inspection engine. |
| **MiniYAML Parser** | [`mini-yaml-parser.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/runbooks/mini-yaml-parser.ts) | Zero-dependency in-tree YAML parser supporting block scalars (`>`, `|`), mappings, and lists. |
| **BroccoliDB Substrate** | [`broccoli-runbook-substrate.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/runbooks/broccoli-runbook-substrate.ts) | Multi-modal indexed persistence, entry-scoped manifests, and WAL event logging. |
| **FSM Supervisor** | [`runbook-supervisor.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/runbooks/runbook-supervisor.ts) | 10-step atomic transition manager with attempt limits, hook execution, and re-entrant mutexes. |
| **Compaction Synthesizer** | [`stateful-compaction-synthesizer.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/compaction/stateful-compaction-synthesizer.ts) | Amnesia-proof `/compact` prompt generator and post-clear reconstitution directives. |
| **Model Tool Suite** | [`runbook-tool-suite.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/runbooks/runbook-tool-suite.ts) | Exposes 9 model tools (`runbook_start`, `runbook_cur`, `runbook_goto`, `runbook_save`, etc.). |
| **Diagnostic Humanizer** | [`runbook-humanizer.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/runbooks/runbook-humanizer.ts) | Plain-English gate diagnostics, executive storytelling, and visual ASCII pipeline rendering. |
| **Workflow Catalog** | [`runbook-catalog.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/runbooks/runbook-catalog.ts) | 5 battle-tested out-of-the-box runbook templates. |
| **TUI Dashboard Modal** | [`runbook-dashboard-modal.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tui/components/runbook-dashboard-modal.ts) | Interactive TUI dashboard with above-the-fold KPI ribbon, 5 view modes, and keyboard navigation. |
| **Slash Router** | [`agent-slash-router.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/resolution/agent-slash-router.ts) | Interactive `/runbook` command router for CLI and TUI sessions. |
| **Monolith Factory** | [`monolith-factory.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/factories/monolith-factory.ts) | Dependency injection and component assembly root. |
| **Baseline Synthesizer** | [`grand-monolith-synthesizer.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/src/factories/grand-monolith-synthesizer.ts) | Registered in `CURRENT_REQUIRED_COMPONENTS` (Pass 193 / ADR-123). |

---

## 4. Consequences & Verification

### Positive Consequences
1. **Deterministic Quality Enforcement**: Agents cannot skip tests, ignore requirements, or exit prematurely. Transitions strictly require verified proof.
2. **Context Amnesia Immunity**: Full recovery after `/compact` using BroccoliDB durable state pointers.
3. **Sub-Millisecond Gate Latency**: Pure TypeScript zero-subshell predicates execute in $<0.05\text{ ms}$, eliminating OS process spawning overhead.
4. **Approachable Operational Visibility**: Non-technical users receive friendly, actionable plain-English feedback rather than cryptic stack traces.

### Automated Validation Battery
1. **FSM & Database Substrate**: [`scripts/validate-runbook-fsm.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/scripts/validate-runbook-fsm.ts) (7/7 tests passed, 100% green).
2. **UX & Humanizer Suite**: [`scripts/validate-runbook-ux.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/scripts/validate-runbook-ux.ts) (5/5 tests passed, 100% green).
3. **Monolith Composition**: `GrandMonolithSynthesizer.verifyComposition()` confirmed **589 components** intact with status `OPTIMAL`.
4. **TypeScript Safety**: `npm run check` and `npm run build` completed with zero type errors.
