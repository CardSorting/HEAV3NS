/**
 * deadline-tool-suite.ts
 *
 * Model tool surface for Unified Deadline, Bounded Wall-Clock Execution & Emergency Stop Governance
 * (Phase 125 / ADR-101 / Target #58).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  DeadlineConfig,
  DeadlineGroupBy,
  DeadlineLeaseStatus,
  DeadlineOutcome,
  DeadlineSortBy,
  DeadlineSortDirection,
} from "../../../core/contracts/deadline.contracts.js";
import { DeadlineSupervisor } from "../../../agents/extensions/deadline/deadline-supervisor.js";
import { BroccoliDeadlineSubstrate } from "../../../sessions/extensions/deadline/broccoli-deadline-substrate.js";
import { DeterministicDeadlineEngine } from "../../../agents/extensions/deadline/deterministic-deadline-engine.js";
import { DeadlineSnapshotManager } from "../../../sessions/extensions/deadline/deadline-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class DeadlineToolSuite {
  private readonly supervisor: DeadlineSupervisor;
  private readonly substrate: BroccoliDeadlineSubstrate;
  private readonly engine: DeterministicDeadlineEngine;
  private readonly snapshotManager: DeadlineSnapshotManager;

  constructor(
    supervisor?: DeadlineSupervisor,
    substrate?: BroccoliDeadlineSubstrate,
    engine?: DeterministicDeadlineEngine
  ) {
    this.engine = engine ?? new DeterministicDeadlineEngine();
    this.substrate = substrate ?? new BroccoliDeadlineSubstrate();
    this.supervisor = supervisor ?? new DeadlineSupervisor(this.substrate, this.engine);
    this.snapshotManager = new DeadlineSnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "deadline_run_bounded",
        description: "Executes an action within a strict wall-clock timeout lease, rejecting immediately on deadline expiry.",
        parameters: {
          actionName: { type: "string", description: "Name of the action being executed", required: true },
          timeoutMs: { type: "number", description: "Timeout in milliseconds" },
          simulatedDurationMs: { type: "number", description: "Simulated duration for verification" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_run_bounded", args);
        },
      },
      {
        name: "deadline_acquire_lease",
        description: "Acquires a new execution deadline lease with tracking and metadata.",
        parameters: {
          actionName: { type: "string", description: "Action identifier", required: true },
          timeoutMs: { type: "number", description: "Timeout in milliseconds", required: true },
          agentId: { type: "string", description: "Agent identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_acquire_lease", args);
        },
      },
      {
        name: "deadline_renew_lease",
        description: "Extends an active execution deadline lease with additional time.",
        parameters: {
          leaseId: { type: "string", description: "Lease ID to renew", required: true },
          extensionMs: { type: "number", description: "Milliseconds to add", required: true },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_renew_lease", args);
        },
      },
      {
        name: "deadline_release_lease",
        description: "Releases a completed execution lease and records its outcome and duration.",
        parameters: {
          leaseId: { type: "string", description: "Lease ID to release", required: true },
          outcome: { type: "string", description: "Outcome: completed, timed_out, aborted, estopped" },
          durationMs: { type: "number", description: "Actual duration in milliseconds" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_release_lease", args);
        },
      },
      {
        name: "deadline_abort_lease",
        description: "Aborts an active execution lease immediately with an audit reason.",
        parameters: {
          leaseId: { type: "string", description: "Lease ID to abort", required: true },
          reason: { type: "string", description: "Reason for aborting" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_abort_lease", args);
        },
      },
      {
        name: "estop_engage",
        description: "Engages the global Emergency Stop (ESTOP), preventing any new work from starting.",
        parameters: {
          reason: { type: "string", description: "Audit reason for engaging the emergency stop" },
          engagedBy: { type: "string", description: "Operator or agent identity" },
          baseDir: { type: "string", description: "Optional workspace root to write filesystem sentinel" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("estop_engage", args);
        },
      },
      {
        name: "estop_disengage",
        description: "Lifts the global Emergency Stop, restoring normal execution for new work.",
        parameters: {
          baseDir: { type: "string", description: "Optional workspace root to clear filesystem sentinel" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("estop_disengage", args);
        },
      },
      {
        name: "estop_get_status",
        description: "Inspects the active global Emergency Stop state, reason, and engagement timestamp.",
        parameters: {
          baseDir: { type: "string", description: "Optional workspace root for filesystem sentinel check" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("estop_get_status", args);
        },
      },
      {
        name: "deadline_get_metrics",
        description: "Retrieves aggregate statistics on bounded executions, timeouts, and ESTOP events.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_get_metrics", args);
        },
      },
      {
        name: "deadline_audit_health",
        description: "Audits SLA deadline health, breach counts, and generates diagnostic recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_audit_health", args);
        },
      },
      {
        name: "deadline_list_leases",
        description: "Lists tracked execution deadline leases with optional status filtering.",
        parameters: {
          status: { type: "string", description: "Filter by status: active, completed, timed_out, aborted, estopped" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_list_leases", args);
        },
      },
      {
        name: "deadline_get_lease",
        description: "Retrieves detailed information and metadata for a specific execution lease.",
        parameters: {
          leaseId: { type: "string", description: "Lease identifier", required: true },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_get_lease", args);
        },
      },
      {
        name: "deadline_group_and_sort",
        description: "Organizes execution leases into multi-criteria swimlanes (status, outcome, urgency, agent).",
        parameters: {
          groupBy: { type: "string", description: "Group by: status, outcome, urgency, agent" },
          sortBy: { type: "string", description: "Sort by: duration, timeout, timestamp" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_group_and_sort", args);
        },
      },
      {
        name: "deadline_search_dsl",
        description: "Searches execution leases using natural query DSL (e.g. 'status:active is:timed_out agent:bot timeout>5000').",
        parameters: {
          query: { type: "string", description: "DSL search query", required: true },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_search_dsl", args);
        },
      },
      {
        name: "deadline_render_dashboard",
        description: "Renders an ANSI CLI dashboard summary card for deadline metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_render_dashboard", args);
        },
      },
      {
        name: "deadline_render_estop",
        description: "Renders an ANSI CLI Emergency Stop status banner.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_render_estop", args);
        },
      },
      {
        name: "deadline_export_html",
        description: "Exports the entire deadline substrate and leases into an interactive single-page HTML application.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_export_html", args);
        },
      },
      {
        name: "deadline_export_markdown",
        description: "Exports deadline summary and lease ledgers as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_export_markdown", args);
        },
      },
      {
        name: "deadline_export_csv",
        description: "Exports execution leases as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_export_csv", args);
        },
      },
      {
        name: "deadline_bulk_release",
        description: "Bulk releases multiple active execution leases atomically.",
        parameters: {
          leaseIds: { type: "string", description: "Comma-separated lease IDs", required: true },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_bulk_release", args);
        },
      },
      {
        name: "deadline_undo",
        description: "Undo the last deadline or ESTOP state mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_undo", args);
        },
      },
      {
        name: "deadline_redo",
        description: "Redo the previously undone mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_redo", args);
        },
      },
      {
        name: "deadline_snapshot_create",
        description: "Captures an O(1) state snapshot of the deadline substrate.",
        parameters: {
          snapshotId: { type: "string", description: "Snapshot identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_snapshot_create", args);
        },
      },
      {
        name: "deadline_snapshot_restore",
        description: "Restores deadline substrate state from a previously captured snapshot.",
        parameters: {
          snapshotId: { type: "string", description: "Snapshot identifier to restore", required: true },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_snapshot_restore", args);
        },
      },
      {
        name: "deadline_check_fs_sentinel",
        description: "Checks filesystem sentinel file directly for external ESTOP engagement.",
        parameters: {
          baseDir: { type: "string", description: "Workspace directory root", required: true },
          sentinelFilename: { type: "string", description: "Sentinel file name (default: ESTOP)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_check_fs_sentinel", args);
        },
      },
      {
        name: "deadline_write_fs_sentinel",
        description: "Writes or unlinks filesystem ESTOP sentinel file.",
        parameters: {
          baseDir: { type: "string", description: "Workspace directory root", required: true },
          engaged: { type: "boolean", description: "Whether to engage or disengage", required: true },
          reason: { type: "string", description: "Reason if engaging" },
          sentinelFilename: { type: "string", description: "Sentinel file name (default: ESTOP)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_write_fs_sentinel", args);
        },
      },
      {
        name: "deadline_clear_history",
        description: "Clears all execution leases and resets substrate metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_clear_history", args);
        },
      },
      {
        name: "deadline_set_config",
        description: "Updates deadline engine configuration (default timeout, ESTOP gating).",
        parameters: {
          defaultTimeoutMs: { type: "number", description: "Default timeout in milliseconds" },
          enforceEstopOnNewWork: { type: "boolean", description: "Whether ESTOP gates new work" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_set_config", args);
        },
      },
      {
        name: "deadline_get_config",
        description: "Retrieves current deadline engine configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_get_config", args);
        },
      },
      {
        name: "deadline_audit_log",
        description: "Retrieves recent operator and ESTOP audit events.",
        parameters: {
          limit: { type: "number", description: "Maximum audit records (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("deadline_audit_log", args);
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
        case "deadline_run_bounded": {
          const actionName = typeof args.actionName === "string" ? args.actionName : "unnamed_action";
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 5000;
          const simDuration = typeof args.simulatedDurationMs === "number" ? args.simulatedDurationMs : 10;

          const result = await this.supervisor.runBounded(async () => {
            await new Promise((resolve) => setTimeout(resolve, simDuration));
            return { action: actionName, status: "completed" };
          }, timeoutMs);

          return {
            success: result.success,
            outcome: result.outcome,
            timedOut: result.timedOut,
            durationMs: result.durationMs,
            data: result.data,
            error: result.error,
          };
        }

        case "deadline_acquire_lease": {
          const actionName = String(args.actionName || "action");
          const timeoutMs = Number(args.timeoutMs) || 5000;
          const agentId = String(args.agentId || "agent");
          const lease = this.substrate.acquireLease(actionName, timeoutMs, agentId);
          return { success: true, lease };
        }

        case "deadline_renew_lease": {
          const leaseId = String(args.leaseId || "");
          const extensionMs = Number(args.extensionMs) || 1000;
          const updated = this.substrate.renewLease(leaseId, extensionMs);
          return { success: updated !== undefined, lease: updated };
        }

        case "deadline_release_lease": {
          const leaseId = String(args.leaseId || "");
          const outcome = (args.outcome as DeadlineOutcome) || "completed";
          const durationMs = args.durationMs !== undefined ? Number(args.durationMs) : undefined;
          const released = this.substrate.releaseLease(leaseId, outcome, durationMs);
          return { success: released, released };
        }

        case "deadline_abort_lease": {
          const leaseId = String(args.leaseId || "");
          const reason = String(args.reason || "Manual abort");
          const aborted = this.substrate.abortLease(leaseId, reason);
          return { success: aborted, aborted };
        }

        case "estop_engage": {
          const reason = typeof args.reason === "string" ? args.reason : "Operator manual stop";
          const engagedBy = typeof args.engagedBy === "string" ? args.engagedBy : "operator";
          const baseDir = typeof args.baseDir === "string" ? args.baseDir : undefined;
          const state = this.supervisor.engageEstop(reason, engagedBy, baseDir);
          return {
            success: true,
            engaged: state.engaged,
            reason: state.reason,
            engagedAt: state.engagedAt,
            engagedBy: state.engagedBy,
          };
        }

        case "estop_disengage": {
          const baseDir = typeof args.baseDir === "string" ? args.baseDir : undefined;
          this.supervisor.disengageEstop(baseDir);
          return {
            success: true,
            engaged: false,
            message: "Emergency Stop disengaged. System active.",
          };
        }

        case "estop_get_status": {
          const baseDir = typeof args.baseDir === "string" ? args.baseDir : undefined;
          const state = this.supervisor.getEstopState(baseDir);
          return {
            success: true,
            engaged: state.engaged,
            reason: state.reason,
            engagedAt: state.engagedAt,
            engagedBy: state.engagedBy,
          };
        }

        case "deadline_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "deadline_audit_health": {
          const audit = this.substrate.auditDeadlineHealth();
          return { success: true, audit };
        }

        case "deadline_list_leases": {
          const status = (args.status as DeadlineLeaseStatus) || undefined;
          const leases = this.substrate.listLeases(status);
          return { success: true, leases, count: leases.length };
        }

        case "deadline_get_lease": {
          const leaseId = String(args.leaseId || "");
          const lease = this.substrate.getLease(leaseId);
          return { success: lease !== undefined, lease };
        }

        case "deadline_group_and_sort": {
          const groupBy = (args.groupBy as DeadlineGroupBy) || "status";
          const sortBy = (args.sortBy as DeadlineSortBy) || "timestamp";
          const direction = (args.direction as DeadlineSortDirection) || "desc";
          const lanes = this.substrate.getGroupedDeadlines(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "deadline_search_dsl": {
          const query = String(args.query || "");
          const leases = this.substrate.queryDeadlinesDsl(query);
          return { success: true, leases, matchCount: leases.length };
        }

        case "deadline_render_dashboard": {
          const metrics = this.substrate.getMetrics();
          const rendered = BroccoliViewRenderer.renderDeadlineDashboard(metrics);
          return { success: true, rendered };
        }

        case "deadline_render_estop": {
          const state = this.substrate.getEstopState();
          const rendered = BroccoliViewRenderer.renderEstopStatus(state);
          return { success: true, rendered };
        }

        case "deadline_export_html": {
          const html = this.substrate.exportInteractiveHtmlView();
          return { success: true, html };
        }

        case "deadline_export_markdown": {
          const markdown = this.substrate.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "deadline_export_csv": {
          const csv = this.substrate.exportCsvReport();
          return { success: true, csv };
        }

        case "deadline_bulk_release": {
          const leaseIds = String(args.leaseIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const res = this.substrate.bulkReleaseLeases(leaseIds);
          return { success: res.modifiedCount > 0, result: res };
        }

        case "deadline_undo": {
          const success = this.substrate.undo();
          return { success };
        }

        case "deadline_redo": {
          const success = this.substrate.redo();
          return { success };
        }

        case "deadline_snapshot_create": {
          const id = String(args.snapshotId || `snap_${Date.now()}`);
          const snapshot = this.snapshotManager.takeSnapshot(id);
          return { success: true, snapshot };
        }

        case "deadline_snapshot_restore": {
          const id = String(args.snapshotId || "");
          const restored = this.snapshotManager.restoreSnapshot(id);
          return { success: restored, restored };
        }

        case "deadline_check_fs_sentinel": {
          const baseDir = String(args.baseDir || "");
          const filename = args.sentinelFilename ? String(args.sentinelFilename) : undefined;
          const state = this.engine.checkFsSentinel(baseDir, filename);
          return { success: true, state };
        }

        case "deadline_write_fs_sentinel": {
          const baseDir = String(args.baseDir || "");
          const engaged = Boolean(args.engaged);
          const reason = args.reason ? String(args.reason) : undefined;
          const filename = args.sentinelFilename ? String(args.sentinelFilename) : undefined;
          const ok = this.engine.writeFsSentinel(baseDir, engaged, reason, filename);
          return { success: ok, engaged };
        }

        case "deadline_clear_history": {
          this.substrate.clear();
          return { success: true, message: "Deadline history and leases cleared." };
        }

        case "deadline_set_config": {
          const updates: Partial<DeadlineConfig> = {};
          if (typeof args.defaultTimeoutMs === "number") updates.defaultTimeoutMs = args.defaultTimeoutMs;
          if (typeof args.enforceEstopOnNewWork === "boolean") updates.enforceEstopOnNewWork = args.enforceEstopOnNewWork;
          this.substrate.setConfig(updates);
          return { success: true, config: this.substrate.getConfig() };
        }

        case "deadline_get_config": {
          return { success: true, config: this.substrate.getConfig() };
        }

        case "deadline_audit_log": {
          const limit = Number(args.limit) || 50;
          const logs = this.substrate.getAuditLogs(limit);
          return { success: true, logs };
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
