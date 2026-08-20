# ADR-003: Osmosis Evolution 2 - Model Resolution, Session Branching & Execution Guardrails

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing model resolution/fallbacks, session branching/forking, and execution stream guardrails from teacher model (`/Users/bozoegg/Downloads/pi-main`) while maintaining strict <= 5 class caps per tier.

---

## 1. Context & Motivation (The Why)

### Production Strengths in Teacher Model
Inspection of `pi-main` revealed critical production-grade requirements:
1. **Model Fallback Resiliency** (`model-resolver.ts`, `model-runtime.ts`): Handling model rate limits or endpoint failures gracefully by switching from primary to secondary models.
2. **Session Branching & Serialization** (`session-manager.ts`): Forking sessions mid-conversation to test alternative execution paths without corrupting original state.
3. **Execution Guardrails** (`output-guard.ts`): Truncating runaway stdout/stderr outputs to prevent memory overflow and token bloat.

### Reinterpretation for LUMI-NEW Monolith
Instead of introducing huge external session managers or complex multi-class guardrail hierarchies, `LUMI-NEW` absorbed these capabilities directly:
- `ModelResolver` in Tier 1 (`agents/`).
- `SessionStore.fork()` and `exportJsonl()` / `importJsonl()` in Tier 2 (`sessions/`).
- Stream guardrail methods directly inside [Hands](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/hands.ts#L13) and [Ears](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/ears.ts#L12) in Tier 3 (`tooling/`).

---

## 2. Architectural Decision (The What)

### Class Allocation & Tier Caps

```
src/
├── agents/                   # 4 classes (cap <= 5)
│   ├── agent-engine.ts       # AgentEngine
│   ├── agent-config.ts       # AgentConfig
│   ├── prompt-composer.ts    # PromptComposer
│   └── model-resolver.ts     # ModelResolver [NEW]
├── sessions/                 # 3 classes (cap <= 5)
│   ├── session-context.ts    # SessionContext
│   ├── session-store.ts      # SessionStore (Enhanced with fork & jsonl)
│   └── session-compactor.ts  # SessionCompactor
└── tooling/                  # 5 classes (cap <= 5)
    ├── eyes.ts               # Eyes
    ├── hands.ts              # Hands (Enhanced with stream guardrails)
    ├── ears.ts               # Ears
    ├── tool-registry.ts      # ToolRegistry
    └── skills-ingestor.ts    # SkillsIngestor
```

---

## 3. Technical Implementation (The How)

### Key Added Capabilities

1. **Model Fallback Chain**: [ModelResolver](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/model-resolver.ts#L13) tracks model health, switches to fallback models (`gemini-1.5-pro`, `gemini-1.5-flash`), and calculates token usage metrics.
2. **Session Branching**: [SessionStore.fork()](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-store.ts#L30) deep-copies turn state into isolated branches. `LumiMonolith.forkSession()` constructs a new composition root inheriting active session history.
3. **Execution Guardrails**: [Hands.runCommand()](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/hands.ts#L43) enforces line bounds (`maxOutputLines: 1000`) and byte size limits (`maxOutputBytes: 100KB`).

---

## 4. Verification

- **Type Safety**: `npm run check` passed cleanly (`verbatimModuleSyntax` compliant).
- **Runtime Execution**: `npx tsx src/index.ts` verified original turn execution, model fallback resolution, session forking into `forked-session-001`, and isolated forked turn execution.
