/**
 * computer-use-tool-suite.ts
 *
 * Model tool surface for the Computer Use, Virtual Display & OS Automation Subsystem:
 * 30 specialized model tools for executing virtual display actions, Set-of-Marks inspection,
 * DSL queries, swimlanes, dashboards, and reports (Phase 88 / ADR-040).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { ComputerUseSupervisor } from "../../../agents/extensions/computer-use/computer-use-supervisor.js";
import { BroccoliDisplaySubstrate } from "../../../sessions/extensions/computer-use/broccoli-display-substrate.js";
import { DeterministicDisplayDriver } from "./deterministic-display-driver.js";
import { DisplaySnapshotManager } from "../../../sessions/extensions/computer-use/display-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  ComputerActionType,
  ComputerUseGroupBy,
  ComputerUseSortBy,
  ComputerUseSortDirection,
  VirtualWindow,
} from "../../../core/contracts/computer-use.contracts.js";

export class ComputerUseToolSuite {
  private readonly supervisor: ComputerUseSupervisor;
  private readonly substrate: BroccoliDisplaySubstrate;
  private readonly driver: DeterministicDisplayDriver;
  private readonly snapshotManager: DisplaySnapshotManager;

  constructor(
    supervisor?: ComputerUseSupervisor,
    substrate?: BroccoliDisplaySubstrate,
    driver?: DeterministicDisplayDriver
  ) {
    this.driver = driver ?? new DeterministicDisplayDriver();
    this.substrate = substrate ?? new BroccoliDisplaySubstrate();
    this.supervisor = supervisor ?? new ComputerUseSupervisor(this.driver, this.substrate);
    this.snapshotManager = new DisplaySnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "computer_action",
        description: "Executes a generic OS/GUI action on the virtual display buffer.",
        parameters: {
          action: { type: "string", required: true, description: "Action type: capture, click, type, drag, scroll, focus_window" },
          paramsJson: { type: "string", description: "JSON stringified parameters" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_action", args);
        },
      },
      {
        name: "computer_capture_frame",
        description: "Captures a frame snapshot from the virtual display with all visible Set-of-Marks UI elements.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_capture_frame", args);
        },
      },
      {
        name: "computer_click",
        description: "Clicks mouse cursor at coordinates or targeting an element ID.",
        parameters: {
          elementId: { type: "number", description: "Target element ID" },
          x: { type: "number", description: "X coordinate" },
          y: { type: "number", description: "Y coordinate" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_click", args);
        },
      },
      {
        name: "computer_double_click",
        description: "Double clicks at coordinates or element ID.",
        parameters: {
          elementId: { type: "number", description: "Target element ID" },
          x: { type: "number", description: "X coordinate" },
          y: { type: "number", description: "Y coordinate" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_double_click", args);
        },
      },
      {
        name: "computer_right_click",
        description: "Right clicks at coordinates or element ID.",
        parameters: {
          elementId: { type: "number", description: "Target element ID" },
          x: { type: "number", description: "X coordinate" },
          y: { type: "number", description: "Y coordinate" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_right_click", args);
        },
      },
      {
        name: "computer_type",
        description: "Types text into the active focused element.",
        parameters: {
          text: { type: "string", required: true, description: "Text to type" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_type", args);
        },
      },
      {
        name: "computer_drag",
        description: "Drags cursor from start coordinates to end coordinates.",
        parameters: {
          startX: { type: "number", required: true, description: "Start X" },
          startY: { type: "number", required: true, description: "Start Y" },
          endX: { type: "number", required: true, description: "End X" },
          endY: { type: "number", required: true, description: "End Y" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_drag", args);
        },
      },
      {
        name: "computer_scroll",
        description: "Scrolls the virtual display viewport.",
        parameters: {
          deltaX: { type: "number", description: "Horizontal scroll delta" },
          deltaY: { type: "number", description: "Vertical scroll delta" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_scroll", args);
        },
      },
      {
        name: "computer_set_value",
        description: "Sets the input value of a specific UI element directly.",
        parameters: {
          elementId: { type: "number", required: true, description: "Element ID" },
          value: { type: "string", required: true, description: "Value to set" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_set_value", args);
        },
      },
      {
        name: "computer_focus_window",
        description: "Focuses an open window by its window ID.",
        parameters: {
          windowId: { type: "string", required: true, description: "Window ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_focus_window", args);
        },
      },
      {
        name: "computer_list_windows",
        description: "Lists all active windows on the virtual display.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_list_windows", args);
        },
      },
      {
        name: "computer_list_elements",
        description: "Lists all indexed Set-of-Marks UI elements.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_list_elements", args);
        },
      },
      {
        name: "computer_get_action",
        description: "Retrieves a specific action record from history.",
        parameters: {
          actionId: { type: "string", required: true, description: "Action ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_get_action", args);
        },
      },
      {
        name: "computer_list_actions",
        description: "Lists recent virtual display actions.",
        parameters: {
          limit: { type: "number", description: "Maximum actions to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_list_actions", args);
        },
      },
      {
        name: "computer_audit_health",
        description: "Audits virtual display driver SLA health, latency percentiles, and element density.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_audit_health", args);
        },
      },
      {
        name: "computer_get_metrics",
        description: "Fetches telemetry report for virtual display actions.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_get_metrics", args);
        },
      },
      {
        name: "computer_group_and_sort",
        description: "Organizes actions into multi-criteria swimlanes (action, activeWindowId, success).",
        parameters: {
          groupBy: { type: "string", description: "Group by: action, activeWindowId, success" },
          sortBy: { type: "string", description: "Sort by: timestamp, durationMs, frameIndex" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_group_and_sort", args);
        },
      },
      {
        name: "computer_search_dsl",
        description: "Searches actions using natural query DSL (e.g. 'action:click window:win-main-1 duration<10').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_search_dsl", args);
        },
      },
      {
        name: "computer_render_dashboard",
        description: "Renders an ANSI CLI dashboard summary card for virtual display.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_render_dashboard", args);
        },
      },
      {
        name: "computer_render_card",
        description: "Renders an interactive ANSI CLI action frame card.",
        parameters: {
          actionId: { type: "string", required: true, description: "Action ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_render_card", args);
        },
      },
      {
        name: "computer_export_html",
        description: "Exports virtual display telemetry to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_export_html", args);
        },
      },
      {
        name: "computer_export_markdown",
        description: "Exports virtual display diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_export_markdown", args);
        },
      },
      {
        name: "computer_export_csv",
        description: "Exports virtual display actions to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_export_csv", args);
        },
      },
      {
        name: "computer_bulk_purge",
        description: "Atomically purges multiple action records.",
        parameters: {
          actionIdsJson: { type: "string", required: true, description: "JSON array of action IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_bulk_purge", args);
        },
      },
      {
        name: "computer_undo",
        description: "Reverts the last virtual display mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_undo", args);
        },
      },
      {
        name: "computer_redo",
        description: "Re-applies the last undone virtual display mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_redo", args);
        },
      },
      {
        name: "computer_capture_snapshot",
        description: "Captures a frame-perfect snapshot of virtual display state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_capture_snapshot", args);
        },
      },
      {
        name: "computer_restore_snapshot",
        description: "Restores virtual display state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_restore_snapshot", args);
        },
      },
      {
        name: "computer_register_window",
        description: "Registers a new window on the virtual display.",
        parameters: {
          windowJson: { type: "string", required: true, description: "JSON stringified VirtualWindow" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_register_window", args);
        },
      },
      {
        name: "computer_inspect_snapshot",
        description: "Inspects full workspace display snapshot.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("computer_inspect_snapshot", args);
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
        case "computer_action": {
          const action = (args.action as ComputerActionType) || "capture";
          let params: Record<string, unknown> = {};
          if (args.paramsJson) {
            try {
              params = JSON.parse(String(args.paramsJson));
            } catch {
              return { success: false, error: "paramsJson must be valid JSON" };
            }
          }
          const res = this.supervisor.executeAction(action, params);
          return { success: res.success, actionId: res.actionId, frameIndex: res.frame.frameIndex, result: res };
        }

        case "computer_capture_frame": {
          const res = this.supervisor.executeAction("capture");
          return { success: res.success, frame: res.frame };
        }

        case "computer_click": {
          const x = typeof args.x === "number" ? args.x : undefined;
          const y = typeof args.y === "number" ? args.y : undefined;
          const elementId = typeof args.elementId === "number" ? args.elementId : undefined;
          const res = this.supervisor.executeAction("click", { x, y, elementId });
          return { success: res.success, actionId: res.actionId, cursor: res.frame.cursor };
        }

        case "computer_double_click": {
          const x = typeof args.x === "number" ? args.x : undefined;
          const y = typeof args.y === "number" ? args.y : undefined;
          const elementId = typeof args.elementId === "number" ? args.elementId : undefined;
          const res = this.supervisor.executeAction("double_click", { x, y, elementId });
          return { success: res.success, actionId: res.actionId, cursor: res.frame.cursor };
        }

        case "computer_right_click": {
          const x = typeof args.x === "number" ? args.x : undefined;
          const y = typeof args.y === "number" ? args.y : undefined;
          const elementId = typeof args.elementId === "number" ? args.elementId : undefined;
          const res = this.supervisor.executeAction("right_click", { x, y, elementId });
          return { success: res.success, actionId: res.actionId, cursor: res.frame.cursor };
        }

        case "computer_type": {
          const text = String(args.text || "");
          const res = this.supervisor.executeAction("type", { text });
          return { success: res.success, actionId: res.actionId };
        }

        case "computer_drag": {
          const startX = Number(args.startX || 0);
          const startY = Number(args.startY || 0);
          const endX = Number(args.endX || 0);
          const endY = Number(args.endY || 0);
          const res = this.supervisor.executeAction("drag", { startX, startY, endX, endY });
          return { success: res.success, actionId: res.actionId, cursor: res.frame.cursor };
        }

        case "computer_scroll": {
          const deltaX = typeof args.deltaX === "number" ? args.deltaX : 0;
          const deltaY = typeof args.deltaY === "number" ? args.deltaY : 0;
          const res = this.supervisor.executeAction("scroll", { deltaX, deltaY });
          return { success: res.success, actionId: res.actionId, cursor: res.frame.cursor };
        }

        case "computer_set_value": {
          const elementId = Number(args.elementId || 1);
          const value = String(args.value || "");
          const res = this.supervisor.executeAction("set_value", { elementId, value });
          return { success: res.success, actionId: res.actionId };
        }

        case "computer_focus_window": {
          const windowId = String(args.windowId || "");
          const res = this.supervisor.executeAction("focus_window", { windowId });
          return { success: res.success, activeWindowId: res.frame.activeWindowId };
        }

        case "computer_list_windows": {
          const windows = this.supervisor.listWindows();
          return { success: true, count: windows.length, windows };
        }

        case "computer_list_elements": {
          const elements = this.supervisor.listElements();
          return { success: true, count: elements.length, elements };
        }

        case "computer_get_action": {
          const actionId = String(args.actionId || "");
          const action = this.supervisor.getAction(actionId);
          return { success: action !== undefined, action };
        }

        case "computer_list_actions": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const actions = this.supervisor.listActions(limit);
          return { success: true, count: actions.length, actions };
        }

        case "computer_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "computer_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "computer_group_and_sort": {
          const groupBy = (args.groupBy as ComputerUseGroupBy) || "action";
          const sortBy = (args.sortBy as ComputerUseSortBy) || "timestamp";
          const direction = (args.direction as ComputerUseSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedActions(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "computer_search_dsl": {
          const query = String(args.query || "");
          const actions = this.supervisor.queryDsl(query);
          return { success: true, count: actions.length, actions };
        }

        case "computer_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderComputerUseDashboard(metrics);
          return { success: true, rendered };
        }

        case "computer_render_card": {
          const actionId = String(args.actionId || "");
          const action = this.supervisor.getAction(actionId);
          if (!action) return { success: false, error: `Action ${actionId} not found` };
          const rendered = BroccoliViewRenderer.renderComputerUseCard(action);
          return { success: true, rendered };
        }

        case "computer_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "computer_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "computer_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "computer_bulk_purge": {
          const idsJson = String(args.actionIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "actionIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "computer_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "computer_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "computer_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "computer_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreSnapshot(frame);
          return { ...res };
        }

        case "computer_register_window": {
          const winJson = String(args.windowJson || "{}");
          let win: VirtualWindow;
          try {
            win = JSON.parse(winJson);
          } catch {
            return { success: false, error: "windowJson must be valid JSON" };
          }
          this.supervisor.registerWindow(win);
          return { success: true, windowId: win.id };
        }

        case "computer_inspect_snapshot": {
          const snap = this.supervisor.getStats();
          return { success: true, snapshot: snap };
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
