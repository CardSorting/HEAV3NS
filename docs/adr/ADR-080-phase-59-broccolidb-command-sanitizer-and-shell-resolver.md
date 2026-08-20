# ADR-080: Phase 59 Osmosis Evolution — Broccoli Command Sanitizer & Shell Environment Resolver

- **Status**: Accepted & Implemented
- **Date**: 2026-08-12
- **Author**: William Andrew Cruz & Antigravity
- **Scope**: Phase 59 Osmosis Distillation (`codemarie` $\longrightarrow$ `LUMI-NEW`)

---

## Executive Summary

Phase 59 completes the zero-dependency Osmosis distillation of command boundary parsing, interactive editor/REPL blocking, and platform-aware shell resolution from `/Users/bozoegg/Downloads/codemarie-new/src/integrations/terminal` and `/src/utils/shell.ts` into `/Users/bozoegg/Desktop/LUMI-NEW/src`.

This architectural pass introduces:
1. **Broccoli Command Sanitizer (`BroccoliCommandSanitizer`)**: Command boundary splitting (`splitCommand`), interactive editor/REPL block detection (`validateCommand`), and shell variable assignment parsing without third-party dependencies. Directly embedded inside `CommandPathResolver`.
2. **Broccoli Shell Environment Resolver (`BroccoliShellEnvironmentResolver`)**: Platform-aware shell path detection (`detectDefaultShell`), system shell profile map generator (`getSystemShellProfiles`), and terminal execution argument composition without third-party libraries. Directly embedded inside `CommandPathResolver`.

---

## Architectural Changes

### 1. Permissions Subsystem (`src/tooling/extensions/permissions/broccolidb-command-sanitizer.ts`, `broccolidb-shell-resolver.ts`, `command-path-resolver.ts`)
- **Command Boundary Sanitization**: Parses shell boundaries (`;`, `&&`, `||`, `\n`) and blocks interactive process loops (`vim`, `nano`, `node REPL`, `gdb`).
- **Shell Resolution**: Resolves default shell paths (`zsh`, `bash`, `powershell`, `cmd`) across macOS, Linux, and Windows.

### 2. Composition Root & Factory (`src/factories/monolith-factory.ts` & `src/index.ts`)
- Integrated `BroccoliCommandSanitizer` and `BroccoliShellEnvironmentResolver` into `MonolithFactory.createEngine()` and exported in `src/index.ts`.

---

## Conformance & Verification

- Typecheck verification passed via `npm run check` with zero strict TypeScript errors.
- Acceptance-time execution was verified with the benchmark command then in use. Current verification uses `npm run benchmark`; exact results are generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json).
