# ADR-014: Zombie Symbol & Module Decomposition (`codemarie`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing zombie symbol auditing and module coupling analysis from teacher package `/Users/bozoegg/Downloads/pi-main/packages/codemarie/src/core/policy/ModuleDecomposer.ts` into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Pass 10).

---

## 1. Context & Motivation (The Why)

Over time, codebases accumulate orphan/zombie exported symbols (classes, functions, interfaces, types) that have zero active importers across the project. Additionally, monolithic files grow beyond sustainable complexity limits.

To maintain structural health and high architectural integrity:
1. **Module Decomposition Analysis**: Measure line count, symbol density, and import coupling score ($0\dots 100$).
2. **Zombie Symbol Auditing**: Scan workspace AST symbols to identify unimported orphan exports for cleanup.

---

## 2. Architectural Decision (The What)

### Non-Destructive Extension & Policy Mutation Subdirectory (`ADR-012`)

Following **ADR-012**:
1. Created `ModuleDecomposer` in `src/tooling/extensions/policy/module-decomposer.ts`.
2. Registered the `audit_symbols` tool in `ValidatingToolRegistry` (`src/tooling/extensions/registry/tool-registry.ts`).
3. Composed `ModuleDecomposer` inside `ValidatingToolRegistry` without mutating base tooling classes.

---

## 3. Technical Implementation (The How)

```typescript
export class ModuleDecomposer {
  analyzeModule(filePath: string, content: string): ModuleDecompositionReport { ... }
  async auditZombieSymbols(dirPath: string, eyes: Eyes): Promise<ZombieSymbolResult[]> { ... }
}
```

---

## 4. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean module decomposition audit metrics and tool registration during frame tick execution.
