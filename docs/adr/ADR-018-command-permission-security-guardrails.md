# ADR-018: Command Permission & Security Guardrails (`codemarie`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing command permission validation, security guardrails, and dangerous shell operator detection from teacher package `/Users/bozoegg/Downloads/pi-main/packages/codemarie/src/core/permissions/CommandPermissionController.ts` into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Pass 14).

---

## 1. Context & Motivation (The Why)

Executing arbitrary shell commands poses severe security risks if dangerous commands (`sudo`, `rm -rf /`, `chmod 777`, `mkfs`) or unauthorized redirection operators are dispatched by an LLM turn.

---

## 2. Architectural Decision (The What)

### Non-Destructive Extension & Permissions Mutation Subdirectory (`ADR-012`)

Following **ADR-012**:
1. Created `CommandPermissionController` in `src/tooling/extensions/permissions/command-permission-controller.ts`.
2. Integrated `CommandPermissionController` into `AnchoredHands.runCommand()` in `src/tooling/extensions/hashline/hands.ts`.
3. Composed `CommandPermissionController` inside `MonolithFactory` and `LumiMonolith`.

---

## 3. Technical Implementation (The How)

```typescript
export class CommandPermissionController {
  validateCommand(command: string): PermissionValidationResult { ... }
}
```

---

## 4. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified that dangerous command `sudo rm -rf /` is automatically blocked with exit code `126` and descriptive security violation diagnostics.
