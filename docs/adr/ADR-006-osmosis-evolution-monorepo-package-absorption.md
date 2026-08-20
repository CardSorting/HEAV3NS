# ADR-006: Osmosis Evolution 5 - Monorepo Package Absorption (`hashline`, `omptype`, `session-backends`, `protocol`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing core production packages from teacher monorepo (`/Users/bozoegg/Downloads/pi-main/packages/*`) including line anchor hashing (`hashline`), schema parameter validation (`omptype`), file session backends (`session-backends`), and protocol envelope encoding (`protocol`) while preserving the strict 5-class cap per tier.

---

## 1. Context & Motivation (The Why)

### Production Package Features in Teacher Monorepo
Deep investigation of `pi-main/packages/*` revealed 4 key architectural packages:
1. **`packages/hashline`**: Line-anchored hash delta verification ensuring code edits target the exact intended line contents regardless of line index shifts.
2. **`packages/omptype`**: Runtime parameter type validation enforcing schema constraints before tool execution.
3. **`packages/session-backends`**: File-system persistence backends for saving and loading session streams.
4. **`packages/protocol`**: Standardized JSON-RPC telemetry notification formatting for external UI and client connections.

### Reinterpretation for LUMI-NEW Monolith
Rather than adding extra micro-packages or breaking class caps, `LUMI-NEW` enriched existing monolithic classes:
- [Hands.applyAnchoredEdit()](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/hands.ts#L61) in `src/tooling/hands.ts` (`hashline`).
- [ToolRegistry.validateToolArgs()](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/tool-registry.ts#L44) in `src/tooling/tool-registry.ts` (`omptype`).
- [SessionStore.saveToFile() / .loadFromFile()](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-store.ts#L44) in `src/sessions/session-store.ts` (`session-backends`).
- [Ears.formatJsonRpcEvent()](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/ears.ts#L52) in `src/tooling/ears.ts` (`protocol`).

---

## 2. Architectural Decision (The What)

### Class Allocation & Tier Caps

```
src/
├── agents/                   # 5 classes (MAX CAPACITY)
│   ├── agent-engine.ts       # AgentEngine
│   ├── agent-config.ts       # AgentConfig
│   ├── prompt-composer.ts    # PromptComposer
│   ├── model-resolver.ts     # ModelResolver
│   └── agent-slash-router.ts # AgentSlashRouter
├── sessions/                 # 5 classes (MAX CAPACITY)
│   ├── session-context.ts    # SessionContext
│   ├── session-store.ts      # SessionStore (Enhanced with saveToFile / loadFromFile)
│   ├── session-compactor.ts  # SessionCompactor
│   ├── session-vfs.ts        # SessionVfs
│   └── session-memory-store.ts # SessionMemoryStore
└── tooling/                  # 5 classes (MAX CAPACITY)
    ├── eyes.ts               # Eyes
    ├── hands.ts              # Hands (Enhanced with applyAnchoredEdit)
    ├── ears.ts               # Ears (Enhanced with formatJsonRpcEvent)
    ├── tool-registry.ts      # ToolRegistry (Enhanced with validateToolArgs)
    └── skills-ingestor.ts    # SkillsIngestor
```

---

## 3. Technical Implementation (The How)

### Key Absorbed Capabilities

1. **Anchored Edit Verification (`hashline`)**: `Hands.computeLineHash()` computes string hashes for target lines. `Hands.applyAnchoredEdit()` verifies that line content hash matches expectations before executing edits.
2. **Schema Validation (`omptype`)**: `ToolRegistry.validateToolArgs()` validates argument type constraints (`string`, `number`, `boolean`, `required`) before tool invocation, preventing invalid argument crashes.
3. **Session Storage Backend (`session-backends`)**: `SessionStore.saveToFile()` and `loadFromFile()` serialize and restore JSONL session turns to/from disk.
4. **JSON-RPC Protocol Telemetry (`protocol`)**: `Ears.formatJsonRpcEvent()` formats events as standard JSON-RPC `2.0` notifications.

---

## 4. Verification

- **Type Safety**: `npm run check` passed cleanly (`verbatimModuleSyntax` compliant).
- **Runtime Execution**: `npx tsx src/index.ts` verified JSON-RPC protocol event streaming, anchored edit verification (`h78ee7324`), schema validation rejection of invalid types, and session file saving.
