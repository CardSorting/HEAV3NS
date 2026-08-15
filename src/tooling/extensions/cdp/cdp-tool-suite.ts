import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ICdpSupervisor } from "../../../core/contracts/cdp.contracts.js";

/**
 * Model-facing tool suite for deterministic browser interaction & CDP operations.
 */
export class CdpToolSuite {
  private supervisor: ICdpSupervisor;

  constructor(supervisor: ICdpSupervisor) {
    this.supervisor = supervisor;
  }

  setSupervisor(supervisor: ICdpSupervisor): void {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "browser_navigate",
        description: "Navigate active or specified browser target to a URL.",
        parameters: {
          url: {
            type: "string",
            required: true,
            description: "The destination HTTP/HTTPS URL.",
          },
          targetId: {
            type: "string",
            required: false,
            description: "Optional specific target/tab ID (defaults to active target).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_navigate", args);
        },
      },
      {
        name: "browser_snapshot",
        description: "Inspect bounded semantic DOM tree, active URL, title, and pending native dialogs.",
        parameters: {
          targetId: {
            type: "string",
            required: false,
            description: "Optional target/tab ID to inspect.",
          },
          maxDepth: {
            type: "number",
            required: false,
            description: "Maximum depth for DOM tree traversal (default: 4).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_snapshot", args);
        },
      },
      {
        name: "browser_click",
        description: "Click an interactive DOM element by its nodeId or CSS selector.",
        parameters: {
          selectorOrId: {
            type: "string",
            required: true,
            description: "The CSS selector or numeric DOM nodeId to click.",
          },
          targetId: {
            type: "string",
            required: false,
            description: "Optional target/tab ID.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_click", args);
        },
      },
      {
        name: "browser_type",
        description: "Type text into a form input element identified by selector or nodeId.",
        parameters: {
          selectorOrId: {
            type: "string",
            required: true,
            description: "The CSS selector or numeric DOM nodeId.",
          },
          text: {
            type: "string",
            required: true,
            description: "The string text to type.",
          },
          targetId: {
            type: "string",
            required: false,
            description: "Optional target/tab ID.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_type", args);
        },
      },
      {
        name: "browser_dialog",
        description: "Respond to a native JavaScript dialog (alert, confirm, prompt, beforeunload).",
        parameters: {
          action: {
            type: "string",
            required: true,
            description: "Action to perform: 'accept' or 'dismiss'.",
          },
          promptText: {
            type: "string",
            required: false,
            description: "Response text string for prompt() dialogs.",
          },
          dialogId: {
            type: "string",
            required: false,
            description: "Specific dialog ID to respond to (if multiple are queued).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_dialog", args);
        },
      },
      {
        name: "browser_eval",
        description: "Evaluate a JavaScript expression in the context of the page.",
        parameters: {
          expression: {
            type: "string",
            required: true,
            description: "The JavaScript expression to evaluate.",
          },
          targetId: {
            type: "string",
            required: false,
            description: "Optional target/tab ID.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_eval", args);
        },
      },
      {
        name: "browser_cdp_send",
        description: "Send an arbitrary Chrome DevTools Protocol (CDP) method command.",
        parameters: {
          method: {
            type: "string",
            required: true,
            description: "The CDP method name (e.g. 'Page.reload', 'Network.getCookies').",
          },
          params: {
            type: "string",
            required: false,
            description: "JSON string containing method parameter object.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("browser_cdp_send", args);
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      switch (name) {
        case "browser_navigate": {
          const url = String(args.url || "");
          const targetId = args.targetId ? String(args.targetId) : undefined;
          const result = await this.supervisor.navigate(url, targetId);
          return { success: result.success, data: result, error: result.error };
        }
        case "browser_snapshot": {
          const targetId = args.targetId ? String(args.targetId) : undefined;
          const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : undefined;
          const snapshot = await this.supervisor.takeSnapshot(targetId, maxDepth);
          return { success: true, data: snapshot };
        }
        case "browser_click": {
          const selectorOrId = args.selectorOrId as string | number;
          const targetId = args.targetId ? String(args.targetId) : undefined;
          const result = await this.supervisor.clickElement(selectorOrId, targetId);
          return { success: result.success, data: result, error: result.error };
        }
        case "browser_type": {
          const selectorOrId = args.selectorOrId as string | number;
          const text = String(args.text || "");
          const targetId = args.targetId ? String(args.targetId) : undefined;
          const result = await this.supervisor.typeText(selectorOrId, text, targetId);
          return { success: result.success, data: result, error: result.error };
        }
        case "browser_dialog": {
          const action = String(args.action || "accept") as "accept" | "dismiss";
          const promptText = args.promptText ? String(args.promptText) : undefined;
          const dialogId = args.dialogId ? String(args.dialogId) : undefined;
          const result = await this.supervisor.handleDialog(action, promptText, dialogId);
          return { success: result.success, data: result, error: result.error };
        }
        case "browser_eval": {
          const expression = String(args.expression || "");
          const targetId = args.targetId ? String(args.targetId) : undefined;
          const result = await this.supervisor.evaluateScript(expression, targetId);
          return { success: result.success, data: result.result, error: result.error };
        }
        case "browser_cdp_send": {
          const method = String(args.method || "");
          let paramsObj: Record<string, unknown> = {};
          if (typeof args.params === "string" && args.params.trim().length > 0) {
            try {
              paramsObj = JSON.parse(args.params);
            } catch {
              return { success: false, error: "Invalid JSON params supplied" };
            }
          } else if (typeof args.params === "object" && args.params !== null) {
            paramsObj = args.params as Record<string, unknown>;
          }
          const result = await this.supervisor.sendRawCdpCommand(method, paramsObj);
          return { success: result.success, data: result.result, error: result.error };
        }
        default:
          return { success: false, error: `Unknown browser tool '${name}'` };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
