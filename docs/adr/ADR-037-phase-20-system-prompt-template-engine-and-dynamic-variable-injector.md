# ADR-037: Phase 20 System Prompt Template Engine & Dynamic Variable Injector (Passes 70–72)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing system prompt handlebar template compilation (`PromptTemplateEngine`), dynamic environment variable injection (`DynamicVariableInjector`), and performing Phase 20 master subsystem synthesis (Passes 70–72) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 20 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 70**: System prompt template placeholder compiler (`PromptTemplateEngine`).
2. **Pass 71**: Dynamic system variable provider (`DynamicVariableInjector`).
3. **Pass 72**: Phase 20 master subsystem synthesis verification.

---

## 2. Architectural Decision (The What)

Following **ADR-012**:
- `src/agents/extensions/compaction/prompt-template-engine.ts` (`PromptTemplateEngine`)
- `src/agents/extensions/compaction/dynamic-variable-injector.ts` (`DynamicVariableInjector`)
- `src/index.ts` (`LumiMonolith` master composition root)
