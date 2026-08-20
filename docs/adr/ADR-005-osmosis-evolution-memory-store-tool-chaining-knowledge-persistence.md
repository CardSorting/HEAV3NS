# ADR-005: Osmosis Evolution 4 - Long-Term Memory Store, Autonomous Tool Chaining & Knowledge Persistence

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing long-term memory persistence, Knowledge Items (KIs), and autonomous multi-step tool execution from teacher model (`/Users/bozoegg/Downloads/pi-main`) while maintaining strict <= 5 class caps per tier.

---

## 1. Context & Motivation (The Why)

### Production Strengths in Teacher Model
Inspection of `pi-main` revealed key long-term intelligence features:
1. **Durable Agent Memory & Knowledge Items (KIs)** (`memory/`): Storing facts, rules, learned patterns, and workspace context that persist across sessions.
2. **Autonomous Tool Chaining**: Executing multi-step tool sequences (e.g. searching memory -> reading files -> saving facts) within turn loops.
3. **Memory Inheritance**: Transferring persistent memory state when forking sessions or creating worktrees.

### Reinterpretation for LUMI-NEW Monolith
- `SessionMemoryStore` in Tier 2 (`sessions/`): Durable memory entry store supporting keyword search, JSON serialization, and memory inheritance.
- Built-in `search_memory` and `save_memory` tools inside [ToolRegistry](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/tool-registry.ts#L12) in Tier 3 (`tooling/`).
- System prompt memory injection inside [PromptComposer](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/prompt-composer.ts#L12) and `/memory` slash command handling in [AgentSlashRouter](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/agent-slash-router.ts#L23) in Tier 1 (`agents/`).

---

## 2. Architectural Decision (The What)

### Final Class Allocation & Tier Caps Audit

```
src/
├── agents/                   # 5 classes (MAX CAP)
│   ├── agent-engine.ts       # AgentEngine
│   ├── agent-config.ts       # AgentConfig
│   ├── prompt-composer.ts    # PromptComposer
│   ├── model-resolver.ts     # ModelResolver
│   └── agent-slash-router.ts # AgentSlashRouter
├── sessions/                 # 5 classes (MAX CAP)
│   ├── session-context.ts    # SessionContext
│   ├── session-store.ts      # SessionStore
│   ├── session-compactor.ts  # SessionCompactor
│   ├── session-vfs.ts        # SessionVfs
│   └── session-memory-store.ts # SessionMemoryStore [NEW]
└── tooling/                  # 5 classes (MAX CAP)
    ├── eyes.ts               # Eyes
    ├── hands.ts              # Hands
    ├── ears.ts               # Ears
    ├── tool-registry.ts      # ToolRegistry (Enhanced with memory tools)
    └── skills-ingestor.ts    # SkillsIngestor
```

---

## 3. Technical Implementation (The How)

### Key Added Capabilities

1. **Long-Term Memory Persistence**: [SessionMemoryStore](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-memory-store.ts#L8) stores key-value facts across categories (`fact`, `rule`, `troubleshooting`, `ki`) and exports/imports via JSON.
2. **Interactive Memory Querying**: [AgentSlashRouter](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/agent-slash-router.ts#L23) handles `/memory` and `/memory search <query>` commands.
3. **Memory Inheritance**: `LumiMonolith.forkSession()` copies persistent memory store state into forked sessions seamlessly.

---

## 4. Verification

- **Type Safety**: `npm run check` passed cleanly (`verbatimModuleSyntax` compliant).
- **Runtime Execution**: `npx tsx src/index.ts` verified memory persistence (`remember: architecture = 3-tier-monolith`), slash command `/memory` inspection, and forked session memory inheritance.
