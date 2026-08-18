/**
 * tool-execution-guard-tool-suite.ts
 *
 * Model tool suite exposing 30 specialized tools for tool batch execution segmentation,
 * loop firewall inspection, BroccoliDB query DSL, snapshot time-travel, and telemetry (Phase 94 / ADR-046 / Phase 130 / ADR-106 / Target #85).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { ToolExecutionGuardSupervisor } from "../../../agents/extensions/execution_guard/tool-execution-guard-supervisor.js";
import type {
  ToolCallItem,
  ToolExecutionGuardConfig,
  ToolExecutionPlanGroupBy,
  ToolExecutionPlanSortBy,
  ToolExecutionPlanSortDirection,
  ToolExecutionPlanDslQueryFilter,
} from "../../../core/contracts/tool-execution-segment.contracts.js";

export class ToolExecutionGuardToolSuite {
  private supervisor: ToolExecutionGuardSupervisor;

  constructor(supervisor: ToolExecutionGuardSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "tool_plan_segments",
        description: "Plans safe sequential and parallel batch execution segments for requested tool calls.",
        parameters: {
          toolNames: {
            type: "string",
            description: "Comma-separated list of tool names to plan for batch execution",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const rawNames = typeof args.toolNames === "string" ? args.toolNames : "";
          const names = rawNames
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          const toolCalls: ToolCallItem[] = names.map((name, i) => ({
            callId: `call-${i}`,
            toolName: name,
            parameters: {},
          }));

          const segments = this.supervisor.planSegments(toolCalls);

          return {
            success: true,
            totalSegments: segments.length,
            segments,
          };
        },
      },
      {
        name: "tool_loop_check",
        description: "Evaluates if a proposed tool call violates loop guardrails or exhibits repetitive oscillation.",
        parameters: {
          toolName: {
            type: "string",
            description: "The name of the tool being called",
            required: true,
          },
          frameIndex: {
            type: "number",
            description: "The current frame tick index",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const toolName = typeof args.toolName === "string" ? args.toolName : "";
          const frameIndex = typeof args.frameIndex === "number" ? args.frameIndex : 1;

          const decision = this.supervisor.checkLoopGuardrail(frameIndex, toolName, {});

          return {
            success: true,
            action: decision.action,
            reason: decision.reason,
            repetitionCount: decision.repetitionCount,
          };
        },
      },
      {
        name: "tool_guard_status",
        description: "Queries current tool loop guardrail metrics and recorded violation logs.",
        parameters: {},
        execute: async () => {
          const violations = this.supervisor.getViolations();
          const latestSegments = this.supervisor.getLatestSegments();

          return {
            success: true,
            totalViolations: violations.length,
            violations,
            latestSegmentsCount: latestSegments.length,
          };
        },
      },
      {
        name: "tool_guard_metrics",
        description: "Retrieves comprehensive telemetry metrics report for the tool execution guard subsystem.",
        parameters: {},
        execute: async () => {
          const report = this.supervisor.getMetricsReport();
          return {
            success: true,
            report,
          };
        },
      },
      {
        name: "tool_guard_health_audit",
        description: "Performs SLA health audit of the execution guard and loop firewall substrate.",
        parameters: {},
        execute: async () => {
          const health = this.supervisor.auditHealth();
          return {
            success: true,
            health,
          };
        },
      },
      {
        name: "tool_guard_get_config",
        description: "Retrieves current active execution guard configuration and threshold policies.",
        parameters: {},
        execute: async () => {
          const config = this.supervisor.getConfig();
          return {
            success: true,
            config,
          };
        },
      },
      {
        name: "tool_guard_update_config",
        description: "Updates execution guard policy thresholds and configuration dynamically.",
        parameters: {
          maxDuplicateExecutions: { type: "number", description: "Max duplicate tool invocations before triggering policy action" },
          actionOnLimit: { type: "string", description: "Action to take ('warn', 'block_synthetic', 'abort_turn')" },
          maxParallelBatchSize: { type: "number", description: "Max concurrent tools in a single parallel batch segment" },
          defaultMutating: { type: "boolean", description: "Whether unknown tools default to mutating" },
        },
        execute: async (args: Record<string, unknown>) => {
          const updates: Partial<ToolExecutionGuardConfig> = {};
          if (typeof args.maxDuplicateExecutions === "number") updates.maxDuplicateExecutions = args.maxDuplicateExecutions;
          if (typeof args.actionOnLimit === "string") updates.actionOnLimit = args.actionOnLimit as any;
          if (typeof args.maxParallelBatchSize === "number") updates.maxParallelBatchSize = args.maxParallelBatchSize;
          if (typeof args.defaultMutating === "boolean") updates.defaultMutating = args.defaultMutating;

          this.supervisor.updateConfig(updates);
          return {
            success: true,
            updatedConfig: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "tool_guard_is_tool_mutating",
        description: "Checks whether a given tool name is classified as mutating (requiring sequential barrier).",
        parameters: {
          toolName: { type: "string", description: "Tool name to inspect", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const toolName = typeof args.toolName === "string" ? args.toolName : "";
          const isMutating = this.supervisor.isMutating(toolName);
          return {
            success: true,
            toolName,
            isMutating,
          };
        },
      },
      {
        name: "tool_guard_classify_tools",
        description: "Classifies an array of tool names into mutating vs read-only categories.",
        parameters: {
          toolNames: { type: "string", description: "Comma-separated list of tool names", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const rawNames = typeof args.toolNames === "string" ? args.toolNames : "";
          const names = rawNames.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
          const classification = names.map((name) => ({
            name,
            isMutating: this.supervisor.isMutating(name),
          }));
          return {
            success: true,
            classification,
          };
        },
      },
      {
        name: "tool_guard_get_plans",
        description: "Retrieves all recorded tool execution plans from BroccoliDB substrate.",
        parameters: {},
        execute: async () => {
          const plans = this.supervisor.getPlans();
          return {
            success: true,
            totalPlans: plans.length,
            plans,
          };
        },
      },
      {
        name: "tool_guard_get_plan_by_id",
        description: "Retrieves a specific tool execution plan by its plan ID.",
        parameters: {
          planId: { type: "string", description: "Plan ID to look up", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const planId = typeof args.planId === "string" ? args.planId : "";
          const plan = this.supervisor.getPlanById(planId);
          return {
            success: Boolean(plan),
            plan,
          };
        },
      },
      {
        name: "tool_guard_get_violations",
        description: "Retrieves all recorded loop firewall violations.",
        parameters: {},
        execute: async () => {
          const violations = this.supervisor.getViolations();
          return {
            success: true,
            totalViolations: violations.length,
            violations,
          };
        },
      },
      {
        name: "tool_guard_get_grouped_plans",
        description: "Retrieves execution plans grouped into swimlanes by dimension.",
        parameters: {
          groupBy: { type: "string", description: "Dimension to group by ('hasParallel', 'totalCalls', 'segmentCount')" },
          sortBy: { type: "string", description: "Sort field ('createdAt', 'totalCalls', 'segmentCount')" },
          sortDirection: { type: "string", description: "'asc' or 'desc'" },
        },
        execute: async (args: Record<string, unknown>) => {
          const groupBy = (typeof args.groupBy === "string" ? args.groupBy : "hasParallel") as ToolExecutionPlanGroupBy;
          const sortBy = (typeof args.sortBy === "string" ? args.sortBy : "createdAt") as ToolExecutionPlanSortBy;
          const sortDirection = (typeof args.sortDirection === "string" ? args.sortDirection : "desc") as ToolExecutionPlanSortDirection;

          const grouped = this.supervisor.getGroupedPlans(groupBy, sortBy, sortDirection);
          return {
            success: true,
            groupBy,
            lanes: grouped,
          };
        },
      },
      {
        name: "tool_guard_query_plans_dsl",
        description: "Performs natural language query filtering on execution plans via DSL filter.",
        parameters: {
          queryText: { type: "string", description: "DSL search string (e.g. 'is:parallel minCalls:3')" },
          hasParallel: { type: "boolean", description: "Filter by whether plan contains parallel segments" },
          minCalls: { type: "number", description: "Filter by minimum total calls" },
          maxCalls: { type: "number", description: "Filter by maximum total calls" },
        },
        execute: async (args: Record<string, unknown>) => {
          const filter: ToolExecutionPlanDslQueryFilter = {};
          if (typeof args.queryText === "string") filter.queryText = args.queryText;
          if (typeof args.hasParallel === "boolean") filter.hasParallel = args.hasParallel;
          if (typeof args.minCalls === "number") filter.minCalls = args.minCalls;
          if (typeof args.maxCalls === "number") filter.maxCalls = args.maxCalls;

          const matches = this.supervisor.queryPlansDsl(filter);
          return {
            success: true,
            totalMatches: matches.length,
            matches,
          };
        },
      },
      {
        name: "tool_guard_bulk_purge_plans",
        description: "Purges tool execution plans matching criteria with atomic undo/redo support.",
        parameters: {
          olderThanMs: { type: "number", description: "Age in milliseconds before which plans should be purged" },
        },
        execute: async (args: Record<string, unknown>) => {
          const olderThanMs = typeof args.olderThanMs === "number" ? args.olderThanMs : undefined;
          const result = this.supervisor.bulkPurgePlans(olderThanMs ? { olderThanMs } : undefined);
          return {
            success: result.purgedCount > 0,
            result,
          };
        },
      },
      {
        name: "tool_guard_bulk_purge_violations",
        description: "Purges loop violations matching criteria with atomic undo/redo support.",
        parameters: {
          olderThanMs: { type: "number", description: "Age in milliseconds before which violations should be purged" },
        },
        execute: async (args: Record<string, unknown>) => {
          const olderThanMs = typeof args.olderThanMs === "number" ? args.olderThanMs : undefined;
          const result = this.supervisor.bulkPurgeViolations(olderThanMs ? { olderThanMs } : undefined);
          return {
            success: result.purgedCount > 0,
            result,
          };
        },
      },
      {
        name: "tool_guard_undo",
        description: "Undoes the last execution guard mutation operation from the undo stack.",
        parameters: {},
        execute: async () => {
          const success = this.supervisor.undo();
          return {
            success,
            undoStackDepth: this.supervisor.getUndoStackDepth(),
            redoStackDepth: this.supervisor.getRedoStackDepth(),
          };
        },
      },
      {
        name: "tool_guard_redo",
        description: "Redoes the last undone execution guard mutation operation from the redo stack.",
        parameters: {},
        execute: async () => {
          const success = this.supervisor.redo();
          return {
            success,
            undoStackDepth: this.supervisor.getUndoStackDepth(),
            redoStackDepth: this.supervisor.getRedoStackDepth(),
          };
        },
      },
      {
        name: "tool_guard_create_snapshot",
        description: "Captures an in-memory frame snapshot for zero-latency time travel.",
        parameters: {
          reason: { type: "string", description: "Reason or description for snapshot" },
        },
        execute: async (args: Record<string, unknown>) => {
          const reason = typeof args.reason === "string" ? args.reason : "manual";
          const snapshotId = this.supervisor.createSnapshot(reason);
          return {
            success: true,
            snapshotId,
          };
        },
      },
      {
        name: "tool_guard_restore_snapshot",
        description: "Restores execution guard substrate to a previous frame snapshot.",
        parameters: {
          snapshotId: { type: "string", description: "Snapshot ID to restore", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const snapshotId = typeof args.snapshotId === "string" ? args.snapshotId : "";
          const success = this.supervisor.restoreSnapshot(snapshotId);
          return {
            success,
            snapshotId,
          };
        },
      },
      {
        name: "tool_guard_list_snapshots",
        description: "Lists all captured frame snapshots available in the ring buffer.",
        parameters: {},
        execute: async () => {
          const snapshots = this.supervisor.listSnapshots();
          return {
            success: true,
            totalSnapshots: snapshots.length,
            snapshots,
          };
        },
      },
      {
        name: "tool_guard_render_dashboard",
        description: "Renders rich ANSI terminal dashboard for execution guard metrics and policy state.",
        parameters: {},
        execute: async () => {
          const output = this.supervisor.renderDashboard();
          return {
            success: true,
            output,
          };
        },
      },
      {
        name: "tool_guard_render_plan_card",
        description: "Renders rich ANSI terminal card for a single execution plan.",
        parameters: {
          planId: { type: "string", description: "Plan ID to render", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const planId = typeof args.planId === "string" ? args.planId : "";
          const plan = this.supervisor.getPlanById(planId);
          if (!plan) {
            return { success: false, error: `Plan not found: ${planId}` };
          }
          const output = this.supervisor.renderPlanCard(plan);
          return {
            success: true,
            output,
          };
        },
      },
      {
        name: "tool_guard_render_violation_card",
        description: "Renders rich ANSI terminal card for a single loop violation.",
        parameters: {
          violationIndex: { type: "number", description: "Index of violation in list", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const idx = typeof args.violationIndex === "number" ? args.violationIndex : 0;
          const violations = this.supervisor.getViolations();
          const violation = violations[idx];
          if (!violation) {
            return { success: false, error: `Violation at index ${idx} not found` };
          }
          const output = this.supervisor.renderViolationCard(violation);
          return {
            success: true,
            output,
          };
        },
      },
      {
        name: "tool_guard_export_plans_markdown",
        description: "Exports recorded execution plans formatted as a Markdown document.",
        parameters: {},
        execute: async () => {
          const markdown = this.supervisor.exportPlansMarkdown();
          return {
            success: true,
            markdown,
          };
        },
      },
      {
        name: "tool_guard_export_plans_html",
        description: "Exports recorded execution plans formatted as an HTML table.",
        parameters: {},
        execute: async () => {
          const html = this.supervisor.exportPlansHtml();
          return {
            success: true,
            html,
          };
        },
      },
      {
        name: "tool_guard_export_plans_csv",
        description: "Exports recorded execution plans in CSV format.",
        parameters: {},
        execute: async () => {
          const csv = this.supervisor.exportPlansCsv();
          return {
            success: true,
            csv,
          };
        },
      },
      {
        name: "tool_guard_export_violations_markdown",
        description: "Exports recorded loop violations formatted as a Markdown document.",
        parameters: {},
        execute: async () => {
          const markdown = this.supervisor.exportViolationsMarkdown();
          return {
            success: true,
            markdown,
          };
        },
      },
      {
        name: "tool_guard_export_violations_html",
        description: "Exports recorded loop violations formatted as an HTML table.",
        parameters: {},
        execute: async () => {
          const html = this.supervisor.exportViolationsHtml();
          return {
            success: true,
            html,
          };
        },
      },
      {
        name: "tool_guard_export_violations_csv",
        description: "Exports recorded loop violations in CSV format.",
        parameters: {},
        execute: async () => {
          const csv = this.supervisor.exportViolationsCsv();
          return {
            success: true,
            csv,
          };
        },
      },
    ];
  }
}
