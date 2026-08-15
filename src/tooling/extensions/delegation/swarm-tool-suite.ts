import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ISwarmDelegator } from "../../../core/contracts/delegation.contracts.js";

/**
 * SwarmToolSuite.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Model tool suite exposing single-task delegation, parallel swarm batching,
 * status inspection, and subagent abort controls.
 */
export class SwarmToolSuite {
  private delegator?: ISwarmDelegator;

  constructor(delegator?: ISwarmDelegator) {
    this.delegator = delegator;
  }

  setDelegator(delegator: ISwarmDelegator): void {
    this.delegator = delegator;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "delegate_task",
        description: "Spawn an autonomous subagent with isolated context, dedicated budget, and optional worktree isolation to execute a focused sub-goal.",
        parameters: {
          id: {
            type: "string",
            required: true,
            description: "Unique subagent task identifier.",
          },
          goal: {
            type: "string",
            required: true,
            description: "Primary technical goal for the delegated subagent.",
          },
          context: {
            type: "string",
            required: false,
            description: "Relevant background context, constraints, and instructions.",
          },
          maxIterations: {
            type: "number",
            required: false,
            description: "Maximum turn loop iterations (default 10).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("delegate_task", args);
        },
      },
      {
        name: "delegate_batch",
        description: "Execute multiple autonomous subagents in parallel and synthesize their combined outcomes.",
        parameters: {
          tasks: {
            type: "string",
            required: true,
            description: "JSON-encoded array of subagent task objects [{id, goal, context}].",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("delegate_batch", args);
        },
      },
      {
        name: "delegate_status",
        description: "Query the status, iteration progress, and outcome of a delegated subagent task.",
        parameters: {
          taskId: {
            type: "string",
            required: true,
            description: "Identifier of the subagent task to inspect.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("delegate_status", args);
        },
      },
      {
        name: "delegate_abort",
        description: "Gracefully abort an active subagent task and reclaim allocated budgets.",
        parameters: {
          taskId: {
            type: "string",
            required: true,
            description: "Identifier of the subagent task to abort.",
          },
          reason: {
            type: "string",
            required: false,
            description: "Justification for the abort.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("delegate_abort", args);
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.delegator) {
      return { success: false, error: "SwarmDelegator not attached to SwarmToolSuite" };
    }

    switch (name) {
      case "delegate_task": {
        const id = String(args.id ?? `subtask-${Date.now()}`);
        const goal = String(args.goal ?? "");
        const context = String(args.context ?? "");
        const maxIterations = typeof args.maxIterations === "number" ? args.maxIterations : 10;

        const outcome = await this.delegator.delegateTask({
          id,
          depth: 1,
          goal,
          context,
          allowedTools: ["read_file", "search_symbols"],
          blockedTools: ["delegate_task", "delegate_batch"],
          budget: {
            maxIterations,
            maxTokens: 50000,
            maxWallClockMs: 30000,
            remainingIterations: maxIterations,
            remainingTokens: 50000,
          },
        });

        return {
          success: outcome.success,
          data: outcome,
        };
      }

      case "delegate_batch": {
        let rawTasks: Array<Record<string, unknown>> = [];
        if (typeof args.tasks === "string") {
          try {
            rawTasks = JSON.parse(args.tasks) as Array<Record<string, unknown>>;
          } catch {
            return { success: false, error: "Failed to parse tasks parameter as JSON array" };
          }
        } else if (Array.isArray(args.tasks)) {
          rawTasks = args.tasks as Array<Record<string, unknown>>;
        }
        const tasks = rawTasks.map((t, idx) => ({
          id: String(t.id ?? `batch-subtask-${idx + 1}`),
          depth: 1,
          goal: String(t.goal ?? ""),
          context: String(t.context ?? ""),
          allowedTools: ["read_file", "search_symbols"],
          blockedTools: ["delegate_task", "delegate_batch"],
          budget: {
            maxIterations: 10,
            maxTokens: 50000,
            maxWallClockMs: 30000,
            remainingIterations: 10,
            remainingTokens: 50000,
          },
        }));

        const batchResult = await this.delegator.delegateBatch(tasks);
        return {
          success: batchResult.failedCount === 0,
          data: batchResult,
        };
      }

      case "delegate_status": {
        const taskId = String(args.taskId ?? "");
        const status = this.delegator.getTaskStatus(taskId);
        if (!status) {
          return { success: false, error: `Subagent task '${taskId}' not found` };
        }
        return {
          success: true,
          data: { taskId, status },
        };
      }

      case "delegate_abort": {
        const taskId = String(args.taskId ?? "");
        const reason = String(args.reason ?? "Manual abort");
        const aborted = this.delegator.abortTask(taskId, reason);
        return {
          success: aborted,
          data: { taskId, aborted, reason },
        };
      }

      default:
        return { success: false, error: `Unknown delegation tool: ${name}` };
    }
  }
}
