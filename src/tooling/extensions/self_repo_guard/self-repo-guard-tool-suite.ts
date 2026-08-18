/**
 * self-repo-guard-tool-suite.ts
 *
 * Model tool surface for Deterministic Self-Repository Mutation Guard,
 * Shell Worktree Context Tracker & Module-Skew Firewall Subsystem (Phase 138 / ADR-114 / Target #78):
 * 30 specialized model tools for evaluating git commands, inspecting incidents,
 * querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SelfRepoGuardGroupBy,
  SelfRepoGuardSortBy,
  SelfRepoGuardSortDirection,
} from "../../../core/contracts/self-repo-guard.contracts.js";
import {
  RESET_WORKTREE_MODES,
  SAFE_GIT_BUILTINS,
  WORKTREE_MUTATING_GIT_COMMANDS,
} from "../../../core/contracts/self-repo-guard.contracts.js";
import { SelfRepoGuardSupervisor } from "../../../agents/extensions/self_repo_guard/self-repo-guard-supervisor.js";
import { SelfRepoGuardSnapshotManager } from "../../../sessions/extensions/self_repo_guard/self-repo-guard-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class SelfRepoGuardToolSuite {
  private readonly supervisor: SelfRepoGuardSupervisor;
  private readonly snapshotManager: SelfRepoGuardSnapshotManager;

  constructor(supervisor: SelfRepoGuardSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new SelfRepoGuardSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "self_repo_guard_inspect_command",
        description: "Inspects a shell command string to verify it will not destructively mutate the running agent source checkout.",
        parameters: {
          command: { type: "string", required: true, description: "Shell command string to inspect" },
          cwd: { type: "string", description: "Current working directory" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_inspect_command", args);
        },
      },
      {
        name: "self_repo_guard_get_running_root",
        description: "Returns the detected running source checkout root and repository status.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_get_running_root", args);
        },
      },
      {
        name: "self_repo_guard_classify_git_operation",
        description: "Classifies a Git subcommand and argument array as safe vs destructive.",
        parameters: {
          subcommand: { type: "string", required: true, description: "Git subcommand (e.g. checkout, status)" },
          argsJson: { type: "string", description: "JSON array of arguments" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_classify_git_operation", args);
        },
      },
      {
        name: "self_repo_guard_configure",
        description: "Configures self-repo guard strict root protection and sandbox policies.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable guard" },
          enforceStrictRootProtection: { type: "boolean", description: "Strict root protection" },
          allowWorktreeSandboxes: { type: "boolean", description: "Allow worktree sandboxes" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_configure", args);
        },
      },
      {
        name: "self_repo_guard_get_config",
        description: "Retrieves active self-repo guard configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_get_config", args);
        },
      },
      {
        name: "self_repo_guard_get_metrics",
        description: "Fetches aggregated guard metrics and blocked mutation counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_get_metrics", args);
        },
      },
      {
        name: "self_repo_guard_get_metrics_report",
        description: "Retrieves detailed metrics report with block rate percentages.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_get_metrics_report", args);
        },
      },
      {
        name: "self_repo_guard_audit_health",
        description: "Audits self-repo guard health posture and recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_audit_health", args);
        },
      },
      {
        name: "self_repo_guard_record_incident",
        description: "Manually records a mutation incident into the ledger.",
        parameters: {
          command: { type: "string", required: true, description: "Command executed" },
          operation: { type: "string", required: true, description: "Operation name" },
          reason: { type: "string", required: true, description: "Block reason" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_record_incident", args);
        },
      },
      {
        name: "self_repo_guard_get_incident",
        description: "Retrieves a mutation incident from the ledger by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Incident ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_get_incident", args);
        },
      },
      {
        name: "self_repo_guard_list_incidents",
        description: "Lists all recorded destructive mutation incidents.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_list_incidents", args);
        },
      },
      {
        name: "self_repo_guard_remove_incident",
        description: "Removes an incident from the ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Incident ID to delete" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_remove_incident", args);
        },
      },
      {
        name: "self_repo_guard_clear_incidents",
        description: "Clears all incidents and resets metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_clear_incidents", args);
        },
      },
      {
        name: "self_repo_guard_group_and_sort",
        description: "Organizes incidents into multi-criteria swimlanes (operation, targetPath, runningRoot).",
        parameters: {
          groupBy: { type: "string", description: "operation, targetPath, runningRoot" },
          sortBy: { type: "string", description: "timestamp, operation, command" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_group_and_sort", args);
        },
      },
      {
        name: "self_repo_guard_search_dsl",
        description: "Searches incidents using Natural Query DSL (e.g. 'op:checkout').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_search_dsl", args);
        },
      },
      {
        name: "self_repo_guard_render_dashboard",
        description: "Renders an ANSI CLI summary card with inspection statistics and health status.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_render_dashboard", args);
        },
      },
      {
        name: "self_repo_guard_render_incident_card",
        description: "Renders an interactive ANSI CLI incident card.",
        parameters: {
          incidentId: { type: "string", required: true, description: "Incident ID" },
          operation: { type: "string", description: "Operation" },
          command: { type: "string", description: "Command" },
          targetPath: { type: "string", description: "Target Path" },
          reason: { type: "string", description: "Reason" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_render_incident_card", args);
        },
      },
      {
        name: "self_repo_guard_export_html_view",
        description: "Exports self-repo guard ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_export_html_view", args);
        },
      },
      {
        name: "self_repo_guard_export_markdown_report",
        description: "Exports self-repo guard report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_export_markdown_report", args);
        },
      },
      {
        name: "self_repo_guard_export_csv_report",
        description: "Exports self-repo guard incidents ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_export_csv_report", args);
        },
      },
      {
        name: "self_repo_guard_bulk_purge",
        description: "Atomically purges multiple incidents from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of incident IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_bulk_purge", args);
        },
      },
      {
        name: "self_repo_guard_undo",
        description: "Reverts the last guard mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_undo", args);
        },
      },
      {
        name: "self_repo_guard_redo",
        description: "Re-applies the last undone guard mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_redo", args);
        },
      },
      {
        name: "self_repo_guard_capture_snapshot",
        description: "Captures a frame-perfect snapshot of guard state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_capture_snapshot", args);
        },
      },
      {
        name: "self_repo_guard_restore_snapshot",
        description: "Restores guard state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_restore_snapshot", args);
        },
      },
      {
        name: "self_repo_guard_format_verdict",
        description: "Formats an evaluation verdict into a standardized summary.",
        parameters: {
          allowed: { type: "boolean", required: true, description: "Allowed" },
          operation: { type: "string", description: "Operation" },
          reason: { type: "string", description: "Reason" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_format_verdict", args);
        },
      },
      {
        name: "self_repo_guard_format_incident",
        description: "Formats an incident object into a concise summary string.",
        parameters: {
          incidentId: { type: "string", required: true, description: "Incident ID" },
          command: { type: "string", required: true, description: "Command" },
          reason: { type: "string", required: true, description: "Reason" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_format_incident", args);
        },
      },
      {
        name: "self_repo_guard_is_safe_builtin",
        description: "Checks if a git subcommand is in the safe read-only builtin set.",
        parameters: {
          subcommand: { type: "string", required: true, description: "Subcommand e.g. status" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_is_safe_builtin", args);
        },
      },
      {
        name: "self_repo_guard_is_worktree_mutator",
        description: "Checks if a git subcommand is a worktree mutator (checkout, switch, rebase, etc.).",
        parameters: {
          subcommand: { type: "string", required: true, description: "Subcommand e.g. checkout" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_is_worktree_mutator", args);
        },
      },
      {
        name: "self_repo_guard_is_hard_reset",
        description: "Checks if reset flags constitute a destructive hard reset.",
        parameters: {
          flag: { type: "string", required: true, description: "Flag e.g. --hard" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("self_repo_guard_is_hard_reset", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "self_repo_guard_inspect_command": {
          const command = String(args.command || "");
          const cwd = typeof args.cwd === "string" ? args.cwd : undefined;
          const verdict = this.supervisor.inspectShellCommand(command, cwd);
          return { success: true, ...verdict };
        }

        case "self_repo_guard_get_running_root": {
          const runningRoot = this.supervisor.getRunningSourceRoot();
          const config = this.supervisor.getConfig();
          return { success: true, runningSourceRoot: runningRoot, protectionEnabled: config.enabled };
        }

        case "self_repo_guard_classify_git_operation": {
          const subcommand = String(args.subcommand || "");
          let argList: string[] = [];
          if (typeof args.argsJson === "string") {
            try {
              argList = JSON.parse(args.argsJson);
            } catch {
              argList = args.argsJson.split(/\s+/).filter(Boolean);
            }
          }
          const safety = this.supervisor.classifyGitOperation(subcommand, argList);
          return { success: true, subcommand, safety };
        }

        case "self_repo_guard_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "self_repo_guard_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "self_repo_guard_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "self_repo_guard_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "self_repo_guard_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "self_repo_guard_record_incident": {
          const command = String(args.command || "");
          const operation = String(args.operation || "git");
          const reason = String(args.reason || "Destructive mutation blocked");
          const incidentId = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.supervisor.getSubstrate().recordIncident({
            incidentId,
            command,
            operation,
            reason,
            targetPath: this.supervisor.getRunningSourceRoot(),
            runningRoot: this.supervisor.getRunningSourceRoot(),
            timestamp: Date.now(),
          });
          return { success: true, incidentId };
        }

        case "self_repo_guard_get_incident": {
          const id = String(args.id || "");
          const incident = this.supervisor.getSubstrate().getIncident(id);
          if (!incident) return { success: false, error: `Incident '${id}' not found` };
          return { success: true, incident };
        }

        case "self_repo_guard_list_incidents": {
          const incidents = this.supervisor.getSubstrate().listIncidents();
          return { success: true, count: incidents.length, incidents };
        }

        case "self_repo_guard_remove_incident": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeIncident(id);
          return { success: ok };
        }

        case "self_repo_guard_clear_incidents": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "self_repo_guard_group_and_sort": {
          const groupBy = (args.groupBy as SelfRepoGuardGroupBy) || "operation";
          const sortBy = (args.sortBy as SelfRepoGuardSortBy) || "timestamp";
          const direction = (args.direction as SelfRepoGuardSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedIncidents(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "self_repo_guard_search_dsl": {
          const query = String(args.query || "");
          const incidents = this.supervisor.queryDsl(query);
          return { success: true, count: incidents.length, incidents };
        }

        case "self_repo_guard_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderSelfRepoGuardDashboard({
            totalInspected: metrics.totalCommandsInspected,
            blockedMutations: metrics.destructiveGitMutationsBlocked,
            safePassed: metrics.safeGitOperationsPassed,
            foreignAllowed: metrics.foreignRepoMutationsAllowed,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "self_repo_guard_render_incident_card": {
          const incidentId = String(args.incidentId || "inc-1");
          const operation = String(args.operation || "checkout");
          const command = String(args.command || "git checkout main");
          const targetPath = String(args.targetPath || "/repo");
          const reason = String(args.reason || "Self-repository mutation rejected");
          const rendered = BroccoliViewRenderer.renderSelfRepoGuardIncidentCard({
            incidentId,
            operation,
            command,
            targetPath,
            reason,
          });
          return { success: true, rendered };
        }

        case "self_repo_guard_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "self_repo_guard_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "self_repo_guard_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "self_repo_guard_bulk_purge": {
          const idsJson = String(args.idsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "idsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "self_repo_guard_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "self_repo_guard_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "self_repo_guard_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "self_repo_guard_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "self_repo_guard_format_verdict": {
          const allowed = Boolean(args.allowed);
          const operation = args.operation as string;
          const reason = args.reason as string;
          const formatted = this.supervisor.getEngine().formatVerdict({ allowed, operation, reason });
          return { success: true, formatted };
        }

        case "self_repo_guard_format_incident": {
          const incidentId = String(args.incidentId || "inc-1");
          const command = String(args.command || "git reset --hard");
          const reason = String(args.reason || "Hard reset rejected");
          const formatted = this.supervisor.getEngine().formatIncident({ incidentId, command, reason });
          return { success: true, formatted };
        }

        case "self_repo_guard_is_safe_builtin": {
          const subcommand = String(args.subcommand || "").toLowerCase();
          return { success: true, subcommand, isSafe: SAFE_GIT_BUILTINS.has(subcommand) };
        }

        case "self_repo_guard_is_worktree_mutator": {
          const subcommand = String(args.subcommand || "").toLowerCase();
          return { success: true, subcommand, isMutator: WORKTREE_MUTATING_GIT_COMMANDS.has(subcommand) };
        }

        case "self_repo_guard_is_hard_reset": {
          const flag = String(args.flag || "").toLowerCase();
          return { success: true, flag, isHardReset: RESET_WORKTREE_MODES.has(flag) };
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
