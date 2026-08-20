# ADR-004: Osmosis Evolution 3 - Virtual File Overlay, Interactive Slash Router & Performance Telemetry

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing Virtual File System (VFS) router logic, interactive slash command dispatching, and microsecond telemetry benchmarking from teacher model (`/Users/bozoegg/Downloads/pi-main`) while maintaining strict <= 5 class caps per tier.

---

## 1. Context & Motivation (The Why)

### Production Strengths in Teacher Model
Inspection of `pi-main` revealed key interactive and staging capabilities:
1. **Virtual File System Routing** (`vfs-router.ts`): In-memory file buffer staging, diff generation, and snapshot commit/rollback before touching physical disk.
2. **Interactive Slash Commands** (`slash-commands.ts`): Bypassing LLM execution loops for operational requests (`/stats`, `/compact`, `/skills`, `/models`, `/clear`) to eliminate API latency and cost.
3. **Microsecond Telemetry & Timings** (`telemetry.ts`, `cache-stats.ts`): Microsecond execution timing and telemetry tracking across turn processing.

### Reinterpretation for LUMI-NEW Monolith
- `SessionVfs` in Tier 2 (`sessions/`): Staged file diff overlays and commit engine.
- `AgentSlashRouter` in Tier 1 (`agents/`): Instant slash command interceptor.
- Microsecond timing telemetry embedded directly in [Ears](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/ears.ts#L12) in Tier 3 (`tooling/`).

---

## 2. Architectural Decision (The What)

### Class Allocation & Tier Caps

```
src/
├── agents/                   # 5 classes (cap <= 5)
│   ├── agent-engine.ts       # AgentEngine
│   ├── agent-config.ts       # AgentConfig
│   ├── prompt-composer.ts    # PromptComposer
│   ├── model-resolver.ts     # ModelResolver
│   └── agent-slash-router.ts # AgentSlashRouter [NEW]
├── sessions/                 # 4 classes (cap <= 5)
│   ├── session-context.ts    # SessionContext
│   ├── session-store.ts      # SessionStore
│   ├── session-compactor.ts  # SessionCompactor
│   └── session-vfs.ts        # SessionVfs [NEW]
└── tooling/                  # 5 classes (cap <= 5)
    ├── eyes.ts               # Eyes
    ├── hands.ts              # Hands
    ├── ears.ts               # Ears (Enhanced with startTimer/endTimer)
    ├── tool-registry.ts      # ToolRegistry
    └── skills-ingestor.ts    # SkillsIngestor
```

---

## 3. Technical Implementation (The How)

### Key Added Capabilities

1. **Virtual File Overlay**: [SessionVfs](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-vfs.ts#L11) stages uncommitted buffer changes, computes unified diffs (`generateDiff`), and batch-commits through `Hands`.
2. **Interactive Slash Router**: [AgentSlashRouter](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/agent-slash-router.ts#L23) intercepts `/compact`, `/clear`, `/stats`, `/skills`, `/models`, and `/vfs` commands with sub-millisecond execution.
3. **Performance Telemetry**: [Ears](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/ears.ts#L12) tracks microsecond execution durations via `startTimer(label)` and `endTimer(label)`.

---

## 4. Verification

- **Type Safety**: `npm run check` passed cleanly (`verbatimModuleSyntax` compliant).
- **Runtime Execution**: `npx tsx src/index.ts` verified regular turn execution (0.77ms), `/stats` command execution, and VFS file staging/inspection (`/vfs`).
