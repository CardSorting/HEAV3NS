# ADR-029: Phase 12 System Directory Resolver & Command Path Resolver (Passes 46–48)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing system directory resolution (`packages/utils/src/dirs.ts`), executable PATH lookup (`packages/utils/src/which.ts`), and performing Phase 12 master subsystem synthesis (Passes 46–48) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 12 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 46 (`dirs.ts`)**: Cross-platform system directory resolver for app data, configuration, cache, and state paths (`SystemDirectoryResolver`).
2. **Pass 47 (`which.ts`)**: Cross-platform system executable `PATH` binary lookup (`CommandPathResolver`).
3. **Pass 48 (Phase 12 Master Orchestrator)**: Complete 48-pass master verification suite confirming zero-barrel OOP class extension and 100% subsystem cohesion.

---

## 2. Architectural Decision (The What)

### Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)

Following **ADR-012**:
- `src/sessions/extensions/substrate/system-directory-resolver.ts` (`SystemDirectoryResolver`)
- `src/tooling/extensions/permissions/command-path-resolver.ts` (`CommandPathResolver`)
- `src/index.ts` (`LumiMonolith` master composition root)

---

## 3. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean execution of all 48 passes in the deterministic monolith composition root.
