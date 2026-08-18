/**
 * thread-context-tool-suite.ts
 *
 * Model tool surface for Async Context Propagation, Security Inheritance & Fail-Closed Approvals (Phase 133 / ADR-109 / Target #66):
 * 30 specialized model tools for spawning contexts, wrapping dispatches, requesting approvals,
 * evaluating security policies, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ContextPropagationConfig,
  ThreadContextGroupBy,
  ThreadContextSortBy,
  ThreadContextSortDirection,
} from "../../../core/contracts/thread-context.contracts.js";
import { ThreadContextSupervisor } from "../../../agents/extensions/thread_context/thread-context-supervisor.js";
import { ThreadContextSnapshotManager } from "../../../sessions/extensions/thread_context/thread-context-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class ThreadContextToolSuite {
  private readonly supervisor: ThreadContextSupervisor;
  private readonly snapshotManager: ThreadContextSnapshotManager;

  constructor(supervisor: ThreadContextSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new ThreadContextSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "thread_spawn_context",
        description: "Spawns and registers a new async turn context with security callbacks.",
        parameters: {
          parentSessionId: { type: "string", required: true, description: "Parent session ID" },
          platform: { type: "string", required: true, description: "Target platform" },
          hasApprovalCallback: { type: "boolean", description: "Whether approval callback is provided" },
          hasSudoCallback: { type: "boolean", description: "Whether sudo callback is provided" },
          isInteractive: { type: "boolean", description: "Whether context is interactive" },
          metadataJson: { type: "string", description: "Optional metadata JSON object" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_spawn_context", args);
        },
      },
      {
        name: "thread_get_context",
        description: "Retrieves context descriptor by context ID.",
        parameters: {
          contextId: { type: "string", required: true, description: "Context ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_get_context", args);
        },
      },
      {
        name: "thread_list_contexts",
        description: "Lists all registered active thread contexts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_list_contexts", args);
        },
      },
      {
        name: "thread_remove_context",
        description: "Removes and cleans up an async thread context.",
        parameters: {
          contextId: { type: "string", required: true, description: "Context ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_remove_context", args);
        },
      },
      {
        name: "thread_get_active_context",
        description: "Inspects currently active async context in execution stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_get_active_context", args);
        },
      },
      {
        name: "thread_request_approval",
        description: "Requests dangerous execution approval under fail-closed rules.",
        parameters: {
          command: { type: "string", required: true, description: "Command to execute" },
          reason: { type: "string", required: true, description: "Rationale" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_request_approval", args);
        },
      },
      {
        name: "thread_request_sudo",
        description: "Resolves sudo password from active context.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_request_sudo", args);
        },
      },
      {
        name: "thread_record_dispatch",
        description: "Records an execution dispatch event into the audit trail.",
        parameters: {
          contextId: { type: "string", required: true, description: "Context ID" },
          action: { type: "string", required: true, description: "Dispatch action" },
          commandOrTask: { type: "string", description: "Command or task name" },
          approved: { type: "boolean", description: "Whether approved" },
          details: { type: "string", description: "Details or rationale" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_record_dispatch", args);
        },
      },
      {
        name: "thread_list_dispatches",
        description: "Lists recorded execution dispatch events.",
        parameters: {
          contextId: { type: "string", description: "Optional context ID filter" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_list_dispatches", args);
        },
      },
      {
        name: "thread_get_config",
        description: "Retrieves context propagation configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_get_config", args);
        },
      },
      {
        name: "thread_set_config",
        description: "Configures fail-closed approval policies and context limits.",
        parameters: {
          failClosedOnMissingApproval: { type: "boolean", description: "Fail-closed on missing approval" },
          allowNonInteractiveAutoApprove: { type: "boolean", description: "Allow non-interactive auto approve" },
          maxActiveContexts: { type: "number", description: "Maximum active contexts" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_set_config", args);
        },
      },
      {
        name: "thread_audit_health",
        description: "Audits active contexts, capacity limits, and fail-closed block frequency.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_audit_health", args);
        },
      },
      {
        name: "thread_get_metrics",
        description: "Fetches context propagation metrics and block totals.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_get_metrics", args);
        },
      },
      {
        name: "thread_group_and_sort",
        description: "Organizes thread contexts into multi-criteria swimlanes (platform, interactive, security, parent).",
        parameters: {
          groupBy: { type: "string", description: "Group by: platform, interactive, security, parent" },
          sortBy: { type: "string", description: "Sort by: createdAt, contextId, platform" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_group_and_sort", args);
        },
      },
      {
        name: "thread_search_dsl",
        description: "Searches thread contexts using Natural Query DSL (e.g. 'platform:cli interactive:true').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_search_dsl", args);
        },
      },
      {
        name: "thread_render_dashboard",
        description: "Renders an ANSI CLI summary card with active contexts and security state.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_render_dashboard", args);
        },
      },
      {
        name: "thread_render_card",
        description: "Renders an interactive ANSI CLI thread context descriptor card.",
        parameters: {
          contextId: { type: "string", required: true, description: "Context ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_render_card", args);
        },
      },
      {
        name: "thread_export_html",
        description: "Exports thread contexts to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_export_html", args);
        },
      },
      {
        name: "thread_export_markdown",
        description: "Exports thread context diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_export_markdown", args);
        },
      },
      {
        name: "thread_export_csv",
        description: "Exports thread contexts to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_export_csv", args);
        },
      },
      {
        name: "thread_bulk_purge",
        description: "Atomically purges multiple thread contexts.",
        parameters: {
          contextIdsJson: { type: "string", required: true, description: "JSON array of context IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_bulk_purge", args);
        },
      },
      {
        name: "thread_undo",
        description: "Reverts the last context mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_undo", args);
        },
      },
      {
        name: "thread_redo",
        description: "Re-applies the last undone context mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_redo", args);
        },
      },
      {
        name: "thread_capture_snapshot",
        description: "Captures a frame-perfect snapshot of thread context workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_capture_snapshot", args);
        },
      },
      {
        name: "thread_restore_snapshot",
        description: "Restores thread context workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_restore_snapshot", args);
        },
      },
      {
        name: "thread_format_summary",
        description: "Formats a human-readable summary of context descriptor state.",
        parameters: {
          contextId: { type: "string", required: true, description: "Context ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_format_summary", args);
        },
      },
      {
        name: "thread_create_child_descriptor",
        description: "Spawns a child context descriptor inheriting parent platform and security metadata.",
        parameters: {
          parentContextId: { type: "string", required: true, description: "Parent context ID" },
          childId: { type: "string", required: true, description: "Child context ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_create_child_descriptor", args);
        },
      },
      {
        name: "thread_evaluate_fail_closed",
        description: "Evaluates fail-closed security policy on arbitrary command parameters.",
        parameters: {
          command: { type: "string", required: true, description: "Command line" },
          reason: { type: "string", required: true, description: "Rationale" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_evaluate_fail_closed", args);
        },
      },
      {
        name: "thread_check_active_security",
        description: "Checks whether active context contains valid approval and sudo callbacks.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_check_active_security", args);
        },
      },
      {
        name: "thread_clear_all_contexts",
        description: "Clears all registered active thread contexts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("thread_clear_all_contexts", args);
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
        case "thread_spawn_context": {
          const parentSessionId = String(args.parentSessionId || "root");
          const platform = String(args.platform || "cli");
          const hasApprovalCallback = typeof args.hasApprovalCallback === "boolean" ? args.hasApprovalCallback : false;
          const hasSudoCallback = typeof args.hasSudoCallback === "boolean" ? args.hasSudoCallback : false;
          const isInteractive = typeof args.isInteractive === "boolean" ? args.isInteractive : true;
          let metadata: Record<string, string> = {};
          if (typeof args.metadataJson === "string") {
            try {
              metadata = JSON.parse(args.metadataJson);
            } catch {
              // ignore invalid metadata json
            }
          }
          const descriptor = this.supervisor.spawnContext({
            parentSessionId,
            platform,
            hasApprovalCallback,
            hasSudoCallback,
            isInteractive,
            metadata,
          });
          return { success: true, descriptor };
        }

        case "thread_get_context": {
          const contextId = String(args.contextId || "");
          const descriptor = this.supervisor.getSubstrate().getContext(contextId);
          if (!descriptor) return { success: false, error: `Context '${contextId}' not found` };
          return { success: true, descriptor };
        }

        case "thread_list_contexts": {
          const contexts = this.supervisor.getAllContexts();
          return { success: true, count: contexts.length, contexts };
        }

        case "thread_remove_context": {
          const contextId = String(args.contextId || "");
          const ok = this.supervisor.getSubstrate().removeContext(contextId);
          return { success: ok, contextId };
        }

        case "thread_get_active_context": {
          const active = this.supervisor.getActiveContext();
          return { success: true, hasActiveContext: !!active, activeContext: active };
        }

        case "thread_request_approval": {
          const command = String(args.command || "");
          const reason = String(args.reason || "");
          const result = await this.supervisor.requestDangerousApproval(command, reason);
          return { success: true, ...result };
        }

        case "thread_request_sudo": {
          const pass = await this.supervisor.requestSudo();
          return { success: true, hasPassword: !!pass, password: pass };
        }

        case "thread_record_dispatch": {
          const contextId = String(args.contextId || "");
          const action = String(args.action || "dispatched") as any;
          const commandOrTask = typeof args.commandOrTask === "string" ? args.commandOrTask : undefined;
          const approved = typeof args.approved === "boolean" ? args.approved : undefined;
          const details = typeof args.details === "string" ? args.details : undefined;

          this.supervisor.getSubstrate().recordDispatch({
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            contextId,
            action,
            commandOrTask,
            approved,
            details,
          });
          return { success: true, contextId, action };
        }

        case "thread_list_dispatches": {
          const contextId = typeof args.contextId === "string" ? args.contextId : undefined;
          const dispatches = this.supervisor.getSubstrate().listDispatches(contextId);
          return { success: true, count: dispatches.length, dispatches };
        }

        case "thread_get_config": {
          const config = this.supervisor.getConfig();
          return { success: true, config };
        }

        case "thread_set_config": {
          const updates: Partial<ContextPropagationConfig> = {};
          if (typeof args.failClosedOnMissingApproval === "boolean") updates.failClosedOnMissingApproval = args.failClosedOnMissingApproval;
          if (typeof args.allowNonInteractiveAutoApprove === "boolean") updates.allowNonInteractiveAutoApprove = args.allowNonInteractiveAutoApprove;
          if (typeof args.maxActiveContexts === "number") updates.maxActiveContexts = args.maxActiveContexts;
          this.supervisor.configure(updates);
          return { success: true, updatedConfig: this.supervisor.getConfig() };
        }

        case "thread_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "thread_get_metrics": {
          const metrics = this.supervisor.getSubstrate().getMetrics();
          return { success: true, metrics };
        }

        case "thread_group_and_sort": {
          const groupBy = (args.groupBy as ThreadContextGroupBy) || "platform";
          const sortBy = (args.sortBy as ThreadContextSortBy) || "createdAt";
          const direction = (args.direction as ThreadContextSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedContexts(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "thread_search_dsl": {
          const query = String(args.query || "");
          const contexts = this.supervisor.queryDsl(query);
          return { success: true, count: contexts.length, contexts };
        }

        case "thread_render_dashboard": {
          const metrics = this.supervisor.getSubstrate().getMetrics();
          const rendered = BroccoliViewRenderer.renderThreadContextDashboard(metrics);
          return { success: true, rendered };
        }

        case "thread_render_card": {
          const contextId = String(args.contextId || "");
          const ctx = this.supervisor.getSubstrate().getContext(contextId);
          if (!ctx) return { success: false, error: `Context '${contextId}' not found` };
          const rendered = BroccoliViewRenderer.renderThreadContextCard(ctx);
          return { success: true, rendered };
        }

        case "thread_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "thread_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "thread_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "thread_bulk_purge": {
          const idsJson = String(args.contextIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "contextIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "thread_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "thread_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "thread_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "thread_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "thread_format_summary": {
          const contextId = String(args.contextId || "");
          const ctx = this.supervisor.getSubstrate().getContext(contextId);
          if (!ctx) return { success: false, error: `Context '${contextId}' not found` };
          const summary = (this.supervisor as any).engine?.formatContextSummary(ctx) || `Context: ${ctx.contextId}`;
          return { success: true, summary };
        }

        case "thread_create_child_descriptor": {
          const parentId = String(args.parentContextId || "");
          const childId = String(args.childId || `child-${Date.now()}`);
          const parent = this.supervisor.getSubstrate().getContext(parentId);
          if (!parent) return { success: false, error: `Parent context '${parentId}' not found` };
          const childDesc = (this.supervisor as any).engine?.createChildDescriptor(parent, childId) || { ...parent, contextId: childId };
          this.supervisor.getSubstrate().registerContext(childDesc);
          return { success: true, childDescriptor: childDesc };
        }

        case "thread_evaluate_fail_closed": {
          const command = String(args.command || "");
          const reason = String(args.reason || "");
          const result = await this.supervisor.requestDangerousApproval(command, reason);
          return { success: true, result };
        }

        case "thread_check_active_security": {
          const active = this.supervisor.getActiveContext();
          return {
            success: true,
            hasActiveContext: !!active,
            hasApprovalCallback: active?.hasApprovalCallback || false,
            hasSudoCallback: active?.hasSudoCallback || false,
          };
        }

        case "thread_clear_all_contexts": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
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
