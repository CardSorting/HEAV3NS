# ADR-016: Environment Integrity & Forensic Healing (`codemarie`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing machine-anchored environmental lease gatekeeping and stability auditing from teacher package `/Users/bozoegg/Downloads/pi-main/packages/codemarie/src/core/integrity/EnvironmentIntegrity.ts` into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Pass 12).

---

## 1. Context & Motivation (The Why)

Environment drift, missing dependencies (`node_modules`), or unreadable package manifests can cause silent agent execution failures during frame ticks.

To guarantee environmental stability and gatekeep execution safely:
1. **Machine-Anchored Leases**: Generates a cryptographic SHA-256 fingerprint (`os.hostname()`, `process.platform`, `process.arch`, `cwd`).
2. **Forensic Self-Healing**: Detects missing workspace assets and logs automated remediation steps.

---

## 2. Architectural Decision (The What)

### Non-Destructive Extension & Integrity Mutation Subdirectory (`ADR-012`)

Following **ADR-012**:
1. Created `StabilityDoctor` in `src/sessions/extensions/integrity/stability-doctor.ts`.
2. Registered the `audit_integrity` tool in `ValidatingToolRegistry` (`src/tooling/extensions/registry/tool-registry.ts`).
3. Composed `StabilityDoctor` inside `MonolithFactory` and `LumiMonolith`.

---

## 3. Technical Implementation (The How)

```typescript
export class StabilityDoctor {
  getFingerprint(cwd: string): string { ... }
  async auditEnvironment(cwd: string, eyes?: Eyes): Promise<EnvironmentIntegrityReport> { ... }
}
```

---

## 4. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean environmental fingerprint calculation, project type detection, and tool registration during frame tick execution.
