/**
 * turn-retry-tool-suite.ts
 *
 * Model tool surface for the Turn Retry State Machine, One-Shot Recovery Guards & Adaptive Payload Restart Subsystem:
 * 30 specialized model tools for retry state management, guard tripping, signal dispatch,
 * error classification, health audits, and multi-format exports (Phase 131 / ADR-107).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { TurnRetrySupervisor } from "../../../agents/extensions/turn_retry/turn-retry-supervisor.js";
import { BroccoliTurnRetrySubstrate } from "../../../sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";
import { DeterministicTurnRetryEngine } from "../../../agents/extensions/turn_retry/deterministic-turn-retry-engine.js";
import { TurnRetrySnapshotManager } from "../../../sessions/extensions/turn_retry/turn-retry-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  TurnRecoveryBranch,
  TurnRestartSignalKey,
  TurnRetryErrorCategory,
  TurnRetryGroupBy,
  TurnRetrySortBy,
  TurnRetrySortDirection,
  TurnRetryStateDescriptor,
} from "../../../core/contracts/turn-retry.contracts.js";

export class TurnRetryToolSuite {
  private readonly supervisor: TurnRetrySupervisor;
  private readonly substrate: BroccoliTurnRetrySubstrate;
  private readonly engine: DeterministicTurnRetryEngine;
  private readonly snapshotManager: TurnRetrySnapshotManager;

  constructor(
    supervisor?: TurnRetrySupervisor,
    substrate?: BroccoliTurnRetrySubstrate,
    engine?: DeterministicTurnRetryEngine
  ) {
    this.engine = engine ?? new DeterministicTurnRetryEngine();
    this.substrate = substrate ?? new BroccoliTurnRetrySubstrate();
    this.supervisor = supervisor ?? new TurnRetrySupervisor(this.substrate, this.engine);
    this.snapshotManager = new TurnRetrySnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "create_turn_retry_state",
        description: "Initializes a deterministic retry state for a specific turn.",
        parameters: {
          turnIndex: { type: "number", required: true, description: "Turn index number" },
          errorCategory: { type: "string", description: "Initial error category" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("create_turn_retry_state", args);
        },
      },
      {
        name: "trigger_turn_retry_guard",
        description: "Trips a one-shot recovery guard (codexAuth, 429, thinkingSig, compaction, etc.).",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
          branch: { type: "string", required: true, description: "Guard branch name" },
          details: { type: "string", description: "Reason for tripping guard" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("trigger_turn_retry_guard", args);
        },
      },
      {
        name: "set_turn_restart_signal",
        description: "Sets an adaptive payload restart signal (compressed, continuation, rebuilt, redirected).",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
          signalKey: { type: "string", required: true, description: "Signal key" },
          value: { type: "boolean", description: "Signal boolean value (default: true)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("set_turn_restart_signal", args);
        },
      },
      {
        name: "classify_and_recover_turn",
        description: "Automatically classifies an error message, trips the appropriate guard, and emits restart signal.",
        parameters: {
          turnIndex: { type: "number", required: true, description: "Turn index number" },
          errorMessage: { type: "string", required: true, description: "Error message text" },
          stateId: { type: "string", description: "Optional existing state ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("classify_and_recover_turn", args);
        },
      },
      {
        name: "get_turn_retry_state",
        description: "Retrieves details of a turn retry state.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_turn_retry_state", args);
        },
      },
      {
        name: "list_turn_retry_states",
        description: "Lists all active and archived turn retry states.",
        parameters: {
          limit: { type: "number", description: "Maximum states to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_turn_retry_states", args);
        },
      },
      {
        name: "list_turn_retry_attempts",
        description: "Lists recorded retry attempts for a state.",
        parameters: {
          stateId: { type: "string", description: "Optional state ID filter" },
          limit: { type: "number", description: "Maximum attempts to return (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_turn_retry_attempts", args);
        },
      },
      {
        name: "update_turn_retry_status",
        description: "Updates the status of a turn retry state (active, recovered, exhausted, cancelled).",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
          status: { type: "string", required: true, description: "Status value" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("update_turn_retry_status", args);
        },
      },
      {
        name: "turn_retry_audit_health",
        description: "Audits SLA turn recovery health, guard exhaustion index, and retry success rate.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_audit_health", args);
        },
      },
      {
        name: "turn_retry_get_metrics",
        description: "Fetches comprehensive telemetry on turn retry attempts, guard trips, and restart signals.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_get_metrics", args);
        },
      },
      {
        name: "turn_retry_group_and_sort",
        description: "Organizes retry states into multi-criteria swimlanes (status, errorCategory, turnIndex).",
        parameters: {
          groupBy: { type: "string", description: "Group by: status, errorCategory, turnIndex" },
          sortBy: { type: "string", description: "Sort by: timestamp, attemptIndex, turnIndex" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_group_and_sort", args);
        },
      },
      {
        name: "turn_retry_search_dsl",
        description: "Searches retry states using natural query DSL (e.g. 'status:recovered guard:hasRetried429 category:rate_limit_429').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_search_dsl", args);
        },
      },
      {
        name: "turn_retry_render_dashboard",
        description: "Renders an ANSI CLI dashboard summary card for turn retry operations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_render_dashboard", args);
        },
      },
      {
        name: "turn_retry_render_card",
        description: "Renders an interactive ANSI CLI state card with active guards.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_render_card", args);
        },
      },
      {
        name: "turn_retry_export_html",
        description: "Exports turn retry status to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_export_html", args);
        },
      },
      {
        name: "turn_retry_export_markdown",
        description: "Exports turn retry diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_export_markdown", args);
        },
      },
      {
        name: "turn_retry_export_csv",
        description: "Exports retry states to a CSV format string.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_export_csv", args);
        },
      },
      {
        name: "turn_retry_bulk_reset",
        description: "Atomically resets multiple turn retry states to initial clean conditions.",
        parameters: {
          stateIdsJson: { type: "string", required: true, description: "JSON array of state IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_bulk_reset", args);
        },
      },
      {
        name: "turn_retry_bulk_clear_guards",
        description: "Atomically resets one-shot guards across multiple states.",
        parameters: {
          stateIdsJson: { type: "string", required: true, description: "JSON array of state IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_bulk_clear_guards", args);
        },
      },
      {
        name: "turn_retry_undo",
        description: "Reverts the last retry state mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_undo", args);
        },
      },
      {
        name: "turn_retry_redo",
        description: "Re-applies the last undone retry state mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_redo", args);
        },
      },
      {
        name: "turn_retry_capture_snapshot",
        description: "Captures a frame-perfect snapshot of turn retry state in memory.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Execution frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_capture_snapshot", args);
        },
      },
      {
        name: "turn_retry_restore_snapshot",
        description: "Restores turn retry state to a previous frame snapshot in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Execution frame index to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_restore_snapshot", args);
        },
      },
      {
        name: "turn_retry_classify_error",
        description: "Inspects and classifies an error message string into error categories and recommendations.",
        parameters: {
          errorMessage: { type: "string", required: true, description: "Error message text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_classify_error", args);
        },
      },
      {
        name: "turn_retry_record_attempt",
        description: "Explicitly records a turn retry attempt result.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
          errorCategory: { type: "string", required: true, description: "Error category" },
          errorMessage: { type: "string", required: true, description: "Error message" },
          success: { type: "boolean", description: "Whether attempt succeeded" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_record_attempt", args);
        },
      },
      {
        name: "turn_retry_get_active_state",
        description: "Retrieves the currently active turn retry state.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_get_active_state", args);
        },
      },
      {
        name: "turn_retry_check_guard_status",
        description: "Checks if a specific one-shot guard has been tripped on a state.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
          guard: { type: "string", required: true, description: "Guard name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_check_guard_status", args);
        },
      },
      {
        name: "turn_retry_check_signal_status",
        description: "Checks if a restart signal has been emitted on a state.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
          signal: { type: "string", required: true, description: "Signal name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_check_signal_status", args);
        },
      },
      {
        name: "turn_retry_reset_state",
        description: "Resets a single turn retry state to zero attempts.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_reset_state", args);
        },
      },
      {
        name: "turn_retry_inspect_history",
        description: "Inspects full audit history for a turn retry state.",
        parameters: {
          stateId: { type: "string", required: true, description: "State ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("turn_retry_inspect_history", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "create_turn_retry_state": {
          const turnIndex = typeof args.turnIndex === "number" ? args.turnIndex : 1;
          const errorCategory = args.errorCategory as TurnRetryErrorCategory;
          const state = this.supervisor.createState(turnIndex, errorCategory);
          return { success: true, stateId: state.stateId, turnIndex: state.turnIndex };
        }

        case "trigger_turn_retry_guard": {
          const stateId = String(args.stateId || "").trim();
          const branch = args.branch as TurnRecoveryBranch;
          const details = typeof args.details === "string" ? args.details : undefined;
          const ok = this.supervisor.triggerGuard(stateId, branch, details);
          return { success: ok, stateId, branch };
        }

        case "set_turn_restart_signal": {
          const stateId = String(args.stateId || "").trim();
          const signalKey = args.signalKey as TurnRestartSignalKey;
          const value = typeof args.value === "boolean" ? args.value : true;
          this.supervisor.setRestartSignal(stateId, signalKey, value);
          return { success: true, stateId, signalKey, value };
        }

        case "classify_and_recover_turn": {
          const turnIndex = typeof args.turnIndex === "number" ? args.turnIndex : 1;
          const errorMessage = String(args.errorMessage || "").trim();
          const stateId = typeof args.stateId === "string" ? args.stateId : undefined;
          const result = this.supervisor.classifyAndRecover(turnIndex, errorMessage, stateId);
          return { success: true, ...result };
        }

        case "get_turn_retry_state": {
          const stateId = String(args.stateId || "").trim();
          const state = this.supervisor.getState(stateId);
          return { success: state !== undefined, state };
        }

        case "list_turn_retry_states": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const states = this.supervisor.listStates(limit);
          return { success: true, count: states.length, states };
        }

        case "list_turn_retry_attempts": {
          const stateId = typeof args.stateId === "string" ? args.stateId : undefined;
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const attempts = this.supervisor.listAttempts(stateId, limit);
          return { success: true, count: attempts.length, attempts };
        }

        case "update_turn_retry_status": {
          const stateId = String(args.stateId || "").trim();
          const status = args.status as TurnRetryStateDescriptor["status"];
          const ok = this.supervisor.updateStateStatus(stateId, status);
          return { success: ok, stateId, status };
        }

        case "turn_retry_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "turn_retry_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "turn_retry_group_and_sort": {
          const groupBy = (args.groupBy as TurnRetryGroupBy) || "status";
          const sortBy = (args.sortBy as TurnRetrySortBy) || "timestamp";
          const direction = (args.direction as TurnRetrySortDirection) || "desc";
          const lanes = this.supervisor.getGroupedStates(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "turn_retry_search_dsl": {
          const query = String(args.query || "");
          const states = this.supervisor.queryDsl(query);
          return { success: true, count: states.length, states };
        }

        case "turn_retry_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderTurnRetryDashboard(metrics);
          return { success: true, rendered };
        }

        case "turn_retry_render_card": {
          const stateId = String(args.stateId || "");
          const state = this.supervisor.getState(stateId);
          if (!state) return { success: false, error: `State ${stateId} not found` };
          const rendered = BroccoliViewRenderer.renderTurnRetryCard(state);
          return { success: true, rendered };
        }

        case "turn_retry_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "turn_retry_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "turn_retry_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "turn_retry_bulk_reset": {
          const idsJson = String(args.stateIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "stateIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkReset(ids);
          return { success: true, result };
        }

        case "turn_retry_bulk_clear_guards": {
          const idsJson = String(args.stateIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "stateIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkClearGuards(ids);
          return { success: true, result };
        }

        case "turn_retry_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "turn_retry_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "turn_retry_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "turn_retry_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreSnapshot(frame);
          return { ...res };
        }

        case "turn_retry_classify_error": {
          const errorMessage = String(args.errorMessage || "");
          const plan = this.engine.classifyAndPlanRecovery(errorMessage);
          return { success: true, ...plan };
        }

        case "turn_retry_record_attempt": {
          const stateId = String(args.stateId || "");
          const errorCategory = args.errorCategory as TurnRetryErrorCategory;
          const errorMessage = String(args.errorMessage || "");
          const success = Boolean(args.success);
          const attempt = this.engine.recordAttempt(stateId, errorCategory, errorMessage, undefined, undefined, success, 10);
          this.substrate.recordAttempt(attempt);
          return { success: true, attempt };
        }

        case "turn_retry_get_active_state": {
          const state = this.engine.getActiveState();
          return { success: state !== undefined, state };
        }

        case "turn_retry_check_guard_status": {
          const stateId = String(args.stateId || "");
          const guard = String(args.guard || "");
          const state = this.supervisor.getState(stateId);
          const isTripped = state ? Boolean((state.guards as any)[guard]) : false;
          return { success: state !== undefined, stateId, guard, isTripped };
        }

        case "turn_retry_check_signal_status": {
          const stateId = String(args.stateId || "");
          const signal = String(args.signal || "");
          const state = this.supervisor.getState(stateId);
          const isEmitted = state ? Boolean((state.restartSignals as any)[signal]) : false;
          return { success: state !== undefined, stateId, signal, isEmitted };
        }

        case "turn_retry_reset_state": {
          const stateId = String(args.stateId || "");
          const result = this.supervisor.bulkReset([stateId]);
          return { success: result.modifiedCount > 0, stateId };
        }

        case "turn_retry_inspect_history": {
          const stateId = String(args.stateId || "");
          const state = this.supervisor.getState(stateId);
          if (!state) return { success: false, error: `State ${stateId} not found` };
          return { success: true, history: state.history };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
