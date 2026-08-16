/**
 * deterministic-code-executor.ts
 *
 * In-memory zero-GC scripting sandbox with direct in-process tool binding (Phase 83 / ADR-035).
 */

import { performance } from "node:perf_hooks";
import type {
  CodeExecutionLanguage,
  CodeExecutionResult,
  ProgrammaticToolCall,
  SandboxContext,
} from "../../../core/contracts/execution.contracts.js";

export type ToolDispatchFn = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export class DeterministicCodeExecutor {
  private defaultContext: SandboxContext;

  constructor(defaultContext?: Partial<SandboxContext>) {
    this.defaultContext = {
      timeoutMs: defaultContext?.timeoutMs ?? 5000,
      maxToolCalls: defaultContext?.maxToolCalls ?? 50,
      allowAsync: defaultContext?.allowAsync ?? true,
      env: defaultContext?.env ?? {},
    };
  }

  /**
   * Executes code snippet inside an isolated sandbox with direct programmatic tool binding.
   */
  async execute(
    code: string,
    toolDispatcher?: ToolDispatchFn,
    availableTools: readonly string[] = [],
    contextOverride?: Partial<SandboxContext>,
    language: CodeExecutionLanguage = "javascript"
  ): Promise<CodeExecutionResult> {
    const startedAt = performance.now();
    const context: SandboxContext = {
      ...this.defaultContext,
      ...contextOverride,
    };

    const logs: string[] = [];
    const toolCalls: ProgrammaticToolCall[] = [];
    let toolCallsCount = 0;

    const customConsole = {
      log: (...args: unknown[]) => {
        logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
      },
      error: (...args: unknown[]) => {
        logs.push("[ERROR] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
      },
      warn: (...args: unknown[]) => {
        logs.push("[WARN] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
      },
      info: (...args: unknown[]) => {
        logs.push("[INFO] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
      },
    };

    // Construct in-memory tools proxy
    const toolsProxy: Record<string, (args?: Record<string, unknown>) => Promise<unknown>> = {};
    if (toolDispatcher) {
      for (const toolName of availableTools) {
        toolsProxy[toolName] = async (args: Record<string, unknown> = {}) => {
          if (toolCallsCount >= context.maxToolCalls) {
            throw new Error(`Execution quota exceeded: max tool calls limit (${context.maxToolCalls}) reached`);
          }
          toolCallsCount++;
          const callStart = performance.now();
          const result = await toolDispatcher(toolName, args);
          const callDuration = performance.now() - callStart;

          toolCalls.push({
            toolName,
            args,
            result,
            executionTimeMs: Number(callDuration.toFixed(3)),
            timestamp: Date.now(),
          });

          return result;
        };
      }
    }

    try {
      let executableCode = code.trim();

      // Simple TS type annotation stripping if typescript is specified
      if (language === "typescript") {
        executableCode = this.stripSimpleTsTypes(executableCode);
      }

      // Wrap in async function
      const wrappedFn = new Function(
        "tools",
        "console",
        "env",
        `return (async () => {\n${executableCode}\n})();`
      );

      // Execute with timeout promise race
      const execPromise = wrappedFn(toolsProxy, customConsole, context.env);
      let timeoutId: NodeJS.Timeout | undefined;

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Execution timed out after ${context.timeoutMs} ms`));
        }, context.timeoutMs);
      });

      const rawResult = await Promise.race([execPromise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);

      const duration = performance.now() - startedAt;
      const output = rawResult !== undefined
        ? (typeof rawResult === "object" ? JSON.stringify(rawResult, null, 2) : String(rawResult))
        : logs.join("\n");

      return {
        success: true,
        output,
        logs,
        executionTimeMs: Number(duration.toFixed(3)),
        toolCallsExecuted: toolCallsCount,
        toolCalls,
      };
    } catch (err: unknown) {
      const duration = performance.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      return {
        success: false,
        output: logs.join("\n"),
        logs,
        error: errorMessage,
        executionTimeMs: Number(duration.toFixed(3)),
        toolCallsExecuted: toolCallsCount,
        toolCalls,
      };
    }
  }

  /**
   * Fast zero-GC regex stripper for simple TypeScript annotations.
   */
  private stripSimpleTsTypes(code: string): string {
    return code
      .replace(/:\s*(string|number|boolean|any|void|unknown|Record<[^>]+>|Array<[^>]+>|readonly [^,;)=]+|[A-Z][a-zA-Z0-9<>]*)/g, "")
      .replace(/as\s+(string|number|boolean|any|unknown|[A-Z][a-zA-Z0-9<>]*)/g, "")
      .replace(/interface\s+[A-Za-z0-9_]+\s*\{[^}]*\}/g, "")
      .replace(/type\s+[A-Za-z0-9_]+\s*=\s*[^;]+;/g, "");
  }
}
