/**
 * [LAYER: TOOLING EXTENSION]
 * stateful-compaction-synthesizer.ts
 *
 * Context Lifecycle & Amnesia-Proof Compaction Synthesis Engine (Phase 193 / ADR-123).
 * Generates structured /compact and post-clear reconstitution prompts embedding
 * active FSM runbook state, entry ID, passed evidence receipts, and durable project facts.
 */

import type {
  RunbookCurrentStateView,
  RunbookRuntimeState,
  RunbookSpec,
} from "../../../core/contracts/runbook.contracts.js";

export class StatefulCompactionSynthesizer {
  /**
   * Generates a safe, structured /compact prompt for cyclic agent runs.
   */
  synthesizeCompactionPrompt(
    state: RunbookRuntimeState,
    spec: RunbookSpec,
    options: { durableNotesPath?: string; command?: string } = {}
  ): string {
    const notesPath = options.durableNotesPath || "progress.md";
    const command = options.command || "lumi";
    const currentNode = spec.nodes[state.current];
    const nextStates = spec.edges.filter((e) => e.from === state.current).map((e) => e.to).join(", ") || "(none)";

    return `/compact Keep only the durable state needed to continue this LUMI runbook-managed run.

Run Identity:
- Run ID: ${state.runId}
- Runbook Spec: ${spec.name} (Hash: ${state.specHash})
- Current Active Node: ${state.current}
- Current Entry ID: ${state.currentEntryId}
- Allowed Next Transitions: ${nextStates}

Retain:
- Current active state obligations: "${currentNode?.prompt?.trim() || "Complete current task phase."}"
- Accepted implementation facts, architecture decisions, and remaining risks in ${notesPath}
- Verified evidence receipts and active goal milestone progression
- Explicit user design constraints and golden rules

Discard:
- Superseded failed tool executions, error traces, and redundant terminal logs
- Repetitive directory listings and noisy intermediate reasoning
- Old implementation plans that have already been executed and reviewed
- Irrelevant conversational chit-chat before the current loop

Post-Compaction Recovery Protocol:
1. Re-anchor attention from durable BroccoliDB state:
   ${command} runbook_cur
   ${command} runbook_history --tail 8

2. Follow the active state prompt and move strictly through allowed transitions:
   ${command} runbook_goto <next-state>`;
  }

  /**
   * Generates a post-clear reconstitution prompt.
   */
  synthesizeResumePrompt(
    stateView: RunbookCurrentStateView,
    options: { command?: string } = {}
  ): string {
    const command = options.command || "lumi";
    const allowed = stateView.next.map((n) => n.to).join(", ") || "(none)";

    return `You are resuming a LUMI runbook-managed agent run after a session reset.

Treat the BroccoliDB Runbook Substrate as the authoritative source of truth. Do not rely on prior conversational context.

1. Inspect durable runbook state:
   ${command} runbook_cur --run-id ${stateView.runId}
   ${command} runbook_history --run-id ${stateView.runId} --tail 8

2. Current State: ${stateView.current} (Entry: ${stateView.currentEntryId})
   Allowed Next States: ${allowed}

3. Execute the current node prompt:
   "${stateView.prompt.trim()}"

Move only when the current state's gates pass:
   ${command} runbook_goto <next-state> --run-id ${stateView.runId}`;
  }
}
