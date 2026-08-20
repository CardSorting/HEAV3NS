# ADR-007: Explicit OOP Class Extension Hierarchy

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Refactoring `/Users/bozoegg/Desktop/LUMI-NEW` to use explicit object-oriented class inheritance (`class Child extends Parent`) for feature additions instead of rewriting base class files.

---

## 1. Context & Motivation (The Why)

### Preventing Base Class Churn
Rewriting base class files to append features creates code churn and obscures core foundations. Establishing minimal, pure base classes (`BaseHands`, `BaseEars`, `BaseToolRegistry`, `BaseSessionStore`, `BaseAgentEngine`) allows advanced functionality to be added via clean class extensions (`extends`).

---

## 2. Architectural Decision (The What)

### Class Extension Hierarchy

| Tier | Base Class | Extended Child Class | Additional Capabilities |
|---|---|---|---|
| **Tier 1 (Agents)** | [BaseAgentEngine](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/agent-engine.ts#L30) | [AgentEngine](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/agent-engine.ts#L61) `extends BaseAgentEngine` | Slash routing, fallback model resolution, memory injection |
| **Tier 2 (Sessions)** | [BaseSessionStore](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-store.ts#L12) | [PersistentSessionStore](file:///Users/bozoegg/Desktop/LUMI-NEW/src/sessions/session-store.ts#L39) `extends BaseSessionStore` | `fork()`, `saveToFile()`, `loadFromFile()`, `exportJsonl()` |
| **Tier 3 (Tooling)** | [BaseHands](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/hands.ts#L22) | [AnchoredHands](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/hands.ts#L57) `extends BaseHands` | `applyAnchoredEdit()` (hashline) & output stream guardrails |
| **Tier 3 (Tooling)** | [BaseEars](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/ears.ts#L22) | [ProtocolEars](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/ears.ts#L57) `extends BaseEars` | Microsecond performance timers & JSON-RPC protocol formatting |
| **Tier 3 (Tooling)** | [BaseToolRegistry](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/tool-registry.ts#L22) | [ValidatingToolRegistry](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/tool-registry.ts#L173) `extends BaseToolRegistry` | Runtime schema parameter validation (`validateToolArgs`) |

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
