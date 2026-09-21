# ADR-007: Explicit OOP Class Extension Hierarchy

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Refactoring `repository root` to use explicit object-oriented class inheritance (`class Child extends Parent`) for feature additions instead of rewriting base class files.

---

## 1. Context & Motivation (The Why)

### Preventing Base Class Churn
Rewriting base class files to append features creates code churn and obscures core foundations. Establishing minimal, pure base classes (`BaseHands`, `BaseEars`, `BaseToolRegistry`, `BaseSessionStore`, `BaseAgentEngine`) allows advanced functionality to be added via clean class extensions (`extends`).

---

## 2. Architectural Decision (The What)

### Class Extension Hierarchy

| Tier | Base Class | Extended Child Class | Additional Capabilities |
|---|---|---|---|
| **Tier 1 (Agents)** | [BaseAgentEngine](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/agents/agent-engine.ts#L30) | [AgentEngine](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/agents/agent-engine.ts#L61) `extends BaseAgentEngine` | Slash routing, fallback model resolution, memory injection |
| **Tier 2 (Sessions)** | [BaseSessionStore](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/sessions/session-store.ts#L12) | [PersistentSessionStore](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/sessions/session-store.ts#L39) `extends BaseSessionStore` | `fork()`, `saveToFile()`, `loadFromFile()`, `exportJsonl()` |
| **Tier 3 (Tooling)** | [BaseHands](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/tooling/hands.ts#L22) | [AnchoredHands](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/tooling/hands.ts#L57) `extends BaseHands` | `applyAnchoredEdit()` (hashline) & output stream guardrails |
| **Tier 3 (Tooling)** | [BaseEars](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/tooling/ears.ts#L22) | [ProtocolEars](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/tooling/ears.ts#L57) `extends BaseEars` | Microsecond performance timers & JSON-RPC protocol formatting |
| **Tier 3 (Tooling)** | [BaseToolRegistry](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/tooling/tool-registry.ts#L22) | [ValidatingToolRegistry](https://github.com/CardSorting/LUMI-VSIX/blob/main/src/tooling/tool-registry.ts#L173) `extends BaseToolRegistry` | Runtime schema parameter validation (`validateToolArgs`) |

---

## 3. Technical Implementation (The How)

### TypeScript `instanceof` Runtime Verification

```typescript
console.log(lumi.hands instanceof BaseHands);           // true
console.log(lumi.hands instanceof AnchoredHands);        // true
console.log(lumi.ears instanceof BaseEars);             // true
console.log(lumi.ears instanceof ProtocolEars);          // true
console.log(lumi.toolRegistry instanceof BaseToolRegistry); // true
console.log(lumi.toolRegistry instanceof ValidatingToolRegistry); // true
```

---

## 4. Verification

- **Type Safety**: `npm run check` passed with zero errors (`tsc --noEmit`).
- **Runtime Inheritance**: `npx tsx src/index.ts` verified 100% `instanceof` truthiness across all base and extended child classes.
