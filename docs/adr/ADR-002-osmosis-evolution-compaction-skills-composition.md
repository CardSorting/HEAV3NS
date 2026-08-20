# ADR-002: Osmosis Evolution 1 - Context Compaction, Skill Ingestion & Prompt Composition

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing architectural strengths from teacher model (`/Users/bozoegg/Downloads/pi-main`) and re-interpreting them into `/Users/bozoegg/Desktop/LUMI-NEW`'s 3-tier monolithic structure while preserving the <= 5 class cap per tier.

---

## 1. Context & Motivation (The Why)

### Teacher Model Insights
Inspection of `/Users/bozoegg/Downloads/pi-main` revealed key production capabilities:
1. **Context Window Trimming**: Handling long agent sessions without overflowing context bounds (`compaction/`).
2. **Skill Discovery & Manifest Loading**: Dynamically discovering `.agents/skills/*/SKILL.md` instruction files (`skills.ts`).
3. **Structured System Prompt Assembly**: Formatting system prompt, tool capabilities, session context, and skills into clean LLM prompts (`system-prompt.ts`).

### Reinterpretation Strategy
Rather than copying `pi-main`'s multi-package overhead, heavy AST parsers, and multi-file compactor engines, `LUMI-NEW` absorbed the core concepts into 3 monolithic classes:
- `SessionCompactor` (Tier 2: `sessions/`)
- `SkillsIngestor` (Tier 3: `tooling/`)
- `PromptComposer` (Tier 1: `agents/`)

---

## 2. Architectural Decision (The What)

### Class Allocation & Tier Caps

```
src/
├── agents/                   # 3 classes (cap <= 5)
│   ├── agent-engine.ts       # AgentEngine
│   ├── agent-config.ts       # AgentConfig
│   └── prompt-composer.ts    # PromptComposer [NEW]
├── sessions/                 # 3 classes (cap <= 5)
│   ├── session-context.ts    # SessionContext
│   ├── session-store.ts      # SessionStore
│   └── session-compactor.ts  # SessionCompactor [NEW]
└── tooling/                  # 5 classes (cap <= 5)
    ├── eyes.ts               # Eyes
    ├── hands.ts              # Hands
    ├── ears.ts               # Ears
    ├── tool-registry.ts      # ToolRegistry
    └── skills-ingestor.ts    # SkillsIngestor [NEW]
```

---

## 3. Technical Implementation (The How)

### Implemented Files
1. [SessionCompactor](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-compactor.ts#L7) in `src/sessions/session-compactor.ts`: Sliding window history summarizer & truncator.
2. [SkillsIngestor](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/skills-ingestor.ts#L11) in `src/tooling/skills-ingestor.ts`: Skill manifest discoverer and frontmatter parser using `Eyes`.
3. [PromptComposer](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/prompt-composer.ts#L12) in `src/agents/prompt-composer.ts`: Assembles system context, session state, tool schemas, and skill manifests.

---

## 4. Verification

- **Type Check**: `npm run check` passed with zero errors (`verbatimModuleSyntax` compliant).
- **Runtime Execution**: `npx tsx src/index.ts` verified prompt assembly, skill scanning, turn compaction, and telemetry emission.
