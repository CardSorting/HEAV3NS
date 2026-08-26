# ADR-140: Sentinel-Tier Tool Confirmation Gatekeeper, Recursive Loop Breaker, Atomic Journal Rollbacks, and Safety Policies

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-24
- **Technical Story**: Implements human-in-the-loop and programmable confirmation gatekeepers, sliding ring buffer loop breakers, multi-tier threat scoring safety policies, dry-run simulation mode, and atomic mutation rollback journals to safeguard workspace integrity.

---

## 1. Context & Motivation (The Why)

### Problem Statement
Unconstrained tool execution poses critical risks to developer workspaces:
1. **Destructive Command Execution**: Accidental execution of `rm -rf /`, `git reset --hard`, database drops, or edits to `.git/config` can permanently destroy workspace state.
2. **Infinite Tool Loops**: Hallucinating or failing models can get trapped in repetitive retry loops calling identical tools without making progress.
3. **Irreversible Partial Mutations**: A multi-step refactoring that errors halfway through leaves the workspace in a corrupted intermediate state.
4. **Wire Format Fragmentation**: Normalizing tool call objects and candidate responses across multiple model providers requires custom conversion layers.

### Drivers & Objectives
- **Fail-Safe Gatekeeping**: Require explicit user confirmation or automated policy validation for high-risk and mutating tools.
- **Loop Interception**: Detect repetitive identical call cycles and break them with actionable self-correcting advisories.
- **Atomic Undo / Rollback**: Record inverse file deltas before every disk mutation, enabling one-shot rollbacks via `rollback_last_mutation`.
- **Dry-Run Simulation**: Allow models to test mutations safely with `isDryRun: true` without touching disk.

---

## 2. Architectural Decisions (The What)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│              SENTINEL RUNTIME SAFETY, GATEKEEPING & JOURNAL ARCHITECTURE          │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Threat Scoring & Safety Policy Engine                                    │
│   ├── ToolSafetyPolicyManager (SAFE vs. MUTATING vs. CRITICAL Classification)     │
│   └── Dry-Run Simulation Engine (Calculates Diffs Without Committing to Disk)     │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Confirmation Gatekeeper & Human-in-the-Loop                              │
│   ├── ToolConfirmationGatekeeper (Allow, Deny, Allow-All-Session Hooks)           │
│   └── Model-Facing Rejection Feedback Propagation                                 │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Loop Breaker & Deduplication Sentinel                                    │
│   ├── ToolLoopBreaker (Sliding Ring Buffer of (toolName, sha256(args)))           │
│   └── Autonomous Loop Abort with Self-Correcting Prompt Advisories                │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Transaction Journal & Atomic Rollback Substrate                          │
│   ├── ToolTransactionJournal (Reverse Checkpoints, Created/Deleted File Tracking) │
│   └── rollback_last_mutation & rollbackTurn() Inverse Execution Engines           │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Core Decisions
1. **Tool Safety Policy & Dry-Run Mode (`ToolSafetyPolicyManager`)**: Evaluates operations for risk tiers (`SAFE`, `MUTATING`, `CRITICAL`), detects destructive commands and protected paths (`.git`, `.env.production`), and simulates execution when `isDryRun: true` is supplied.
2. **Confirmation Gatekeeper (`ToolConfirmationGatekeeper`)**: Prompts user (or calls programmable confirmation handlers) for approval on critical operations, supporting `allow_all_session` caching and propagating user rejection feedback back to the LLM.
3. **Recursive Loop Breaker (`ToolLoopBreaker`)**: Tracks recent tool calls in a sliding ring buffer, detects 3x identical signature repeats, pauses execution, and feeds a self-correcting prompt advisory to the model.
4. **Atomic Mutation Journal & Rollback (`ToolTransactionJournal`)**: Automatically records previous file contents before writes/edits, tracks created files, and snapshots deleted files. Exposes `rollback_last_mutation` for instant atomic undos.
5. **Multi-File Atomic Patch Orchestrator (`MultiFileAtomicPatchOrchestrator`)**: Validates all search-and-replace chunks across multiple files prior to disk mutation. If any chunk mismatches, zero files are modified on disk.

---

## 3. Consequences & Trade-offs (The Impact)

### Positive
- **Guaranteed Workspace Safety**: Destructive commands and unauthorized mutations are gated or simulated.
- **Infinite Loop Elimination**: Repetitive hallucinations are broken autonomously.
- **Zero Broken Intermediate States**: Atomic multi-file patching and rollback ensure workspace consistency.

### Negative & Mitigations
- **Disk Journal Overhead**: Temporary backups consume ephemeral storage; cleaned automatically upon session completion.

---

## 4. Verification Evidence

- Automated Test Suite 1: [`scripts/validate-apex-tool-ecosystem-zenith.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/scripts/validate-apex-tool-ecosystem-zenith.ts) (8/8 tests passing).
- Automated Test Suite 2: [`scripts/validate-apex-tool-runtime-sentinel.ts`](file:///Users/bozoegg/Desktop/LUMI-NEW/scripts/validate-apex-tool-runtime-sentinel.ts) (7/7 tests passing).
