# ADR-017: Workspace Intelligence Engine (`codemarie`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing workspace topology, package identity, and cognitive model generation from teacher package `/Users/bozoegg/Downloads/pi-main/packages/codemarie/src/core/workspace-intelligence/WorkspaceIntelligenceEngine.ts` into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Pass 13).

---

## 1. Context & Motivation (The Why)

Understanding workspace structure, package identity, manifest locations, and architectural surfaces (`src/`, `.wiki/`, `.agents/`) is essential for contextual reasoning across agent turn loops.

---

## 2. Architectural Decision (The What)

### Non-Destructive Extension & Intelligence Mutation Subdirectory (`ADR-012`)

Following **ADR-012**:
1. Created `WorkspaceIntelligenceEngine` in `src/agents/extensions/intelligence/workspace-intelligence.ts`.
2. Implemented `buildCognitiveModel(cwd, eyes)` to construct a persistent cognitive model snapshot (`packageName`, `packageVersion`, `architecturalSurfaces`, `topologyNodeCount`).
3. Composed `WorkspaceIntelligenceEngine` inside `MonolithFactory` and `LumiMonolith`.

---

## 3. Technical Implementation (The How)

```typescript
export class WorkspaceIntelligenceEngine {
  async buildCognitiveModel(cwd: string, eyes: Eyes): Promise<WorkspaceCognitiveModel> { ... }
}
```

---

## 4. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean workspace package identity indexing (`lumi-new@0.1.0`) and architectural surface discovery during frame tick execution.
