/**
 * code-execution-tool-suite.ts
 *
 * Model tool surface for Programmatic Tool Execution & Scripting Sandbox (Phase 83 / ADR-035).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { CodeExecutionLanguage } from "../../../core/contracts/execution.contracts.js";
import { CodeExecutionSupervisor } from "../../../agents/extensions/execution/code-execution-supervisor.js";

export class CodeExecutionToolSuite {
  private readonly supervisor: CodeExecutionSupervisor;

  constructor(supervisor: CodeExecutionSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "execute_code",
        description: "Executes a JavaScript or TypeScript snippet inside an isolated sandbox with direct programmatic access to agent tools via `await tools.<tool_name>(args)`.",
        parameters: {
          code: { type: "string", required: true, description: "The JavaScript/TypeScript code string to execute" },
          language: { type: "string", description: "Language: 'javascript' | 'typescript' (default: 'javascript')" },
          timeoutMs: { type: "number", description: "Maximum execution time in milliseconds (default: 5000)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const code = String(args.code || "").trim();
          if (!code) return { success: false, error: "code parameter is required" };

          const language = (typeof args.language === "string" ? args.language : "javascript") as CodeExecutionLanguage;
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

          const result = await this.supervisor.executeScript(code, language, { timeoutMs });

          return {
            success: result.success,
            output: result.output,
            logs: result.logs,
            error: result.error,
            executionTimeMs: result.executionTimeMs,
            toolCallsExecuted: result.toolCallsExecuted,
            toolCalls: result.toolCalls,
          };
        },
      },
      {
        name: "code_execution_status",
        description: "Queries the code execution sandbox telemetry, statistics, and recent execution history.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const stats = this.supervisor.getStats();
          const history = this.supervisor.listHistory(10);
          return {
            success: true,
            stats,
            history: history.map((h) => ({
              id: h.id,
              language: h.language,
              success: h.result.success,
              toolCallsExecuted: h.result.toolCallsExecuted,
              executionTimeMs: h.result.executionTimeMs,
              timestamp: h.timestamp,
            })),
          };
        },
      },
    ];
  }
}
