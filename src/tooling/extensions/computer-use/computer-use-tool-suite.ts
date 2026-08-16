/**
 * computer-use-tool-suite.ts
 *
 * Model tool surface for Computer Use & OS Automation Subsystem (Phase 88 / ADR-040).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ComputerActionType } from "../../../core/contracts/computer-use.contracts.js";
import { ComputerUseSupervisor } from "../../../agents/extensions/computer-use/computer-use-supervisor.js";

export class ComputerUseToolSuite {
  private readonly supervisor: ComputerUseSupervisor;

  constructor(supervisor: ComputerUseSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "computer_action",
        description: "Executes an OS/GUI action (capture, click, drag, type, scroll, focus_window) on the deterministic virtual display.",
        parameters: {
          action: { type: "string", required: true, description: "Action type: capture | click | double_click | right_click | drag | scroll | type | focus_window" },
          paramsJson: { type: "string", description: "JSON encoded action arguments (e.g. {elementId: 1} or {x: 100, y: 200} or {text: 'abc'})" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const actionStr = String(args.action || "capture").trim() as ComputerActionType;
          let params: Record<string, unknown> = {};

          if (args.paramsJson) {
            try {
              params = JSON.parse(String(args.paramsJson)) as Record<string, unknown>;
            } catch (err: unknown) {
              return { success: false, error: `Invalid paramsJson: ${err instanceof Error ? err.message : String(err)}` };
            }
          }

          const result = this.supervisor.executeAction(actionStr, params);

          return {
            success: result.success,
            action: result.action,
            frameIndex: result.frame.frameIndex,
            cursor: result.frame.cursor,
            activeWindowId: result.frame.activeWindowId,
            elementsCount: result.frame.elements.length,
            elements: result.frame.elements,
            durationMs: result.durationMs,
          };
        },
      },
      {
        name: "computer_display_status",
        description: "Queries virtual screen resolution, window list, Set-of-Marks UI element tree, and action history.",
        parameters: {
          limit: { type: "number", description: "Maximum number of recent actions to return (default: 10)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const limit = typeof args.limit === "number" ? args.limit : 10;
          const stats = this.supervisor.getStats();
          const history = this.supervisor.listActions(limit);
          const currentFrame = this.supervisor.capture().frame;

          return {
            success: true,
            stats,
            currentFrame,
            history,
          };
        },
      },
    ];
  }
}
