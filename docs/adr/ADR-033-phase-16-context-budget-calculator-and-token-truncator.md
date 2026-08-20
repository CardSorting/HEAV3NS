# ADR-033: Phase 16 Context Budget Calculator & Token Truncator (Passes 58–60)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing dynamic context token budget estimation (`ContextBudgetCalculator`), history truncation (`TokenTruncator`), and performing Phase 16 master subsystem synthesis (Passes 58–60) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 16 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 58**: Dynamic context window token budget calculator (`ContextBudgetCalculator`).
2. **Pass 59**: Middle turn history truncator preserving system prompts and recent context (`TokenTruncator`).
3. **Pass 60**: Phase 16 master subsystem synthesis verification.

---

## 2. Architectural Decision (The What)

Following **ADR-012**:
- `src/agents/extensions/compaction/context-budget-calculator.ts` (`ContextBudgetCalculator`)
- `src/agents/extensions/compaction/token-truncator.ts` (`TokenTruncator`)
- `src/index.ts` (`LumiMonolith` master composition root)
