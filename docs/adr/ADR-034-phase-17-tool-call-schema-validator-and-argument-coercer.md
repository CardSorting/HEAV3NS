# ADR-034: Phase 17 Tool Call Schema Validator & Argument Coercer (Passes 61–63)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing tool call parameter schema validation (`ToolCallSchemaValidator`), argument type coercion (`ArgumentCoercer`), and performing Phase 17 master subsystem synthesis (Passes 61–63) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 17 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 61**: Tool parameter schema validator ensuring required argument presence (`ToolCallSchemaValidator`).
2. **Pass 62**: Argument coercion layer converting stringified numbers and boolean flags into native primitives (`ArgumentCoercer`).
3. **Pass 63**: Phase 17 master subsystem synthesis verification.

---

## 2. Architectural Decision (The What)

Following **ADR-012**:
- `src/tooling/extensions/registry/tool-call-schema-validator.ts` (`ToolCallSchemaValidator`)
- `src/tooling/extensions/registry/argument-coercer.ts` (`ArgumentCoercer`)
- `src/index.ts` (`LumiMonolith` master composition root)
