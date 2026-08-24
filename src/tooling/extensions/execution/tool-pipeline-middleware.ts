/**
 * tool-pipeline-middleware.ts
 *
 * Composable Onion-Style Tool Execution Pipeline Middleware Stack.
 * Coordinates cross-cutting concerns (telemetry, security, circuit breakers,
 * loop detection, argument coercion, caching, output governance, and error healing)
 * through a strongly-typed composable middleware pipeline.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export interface ToolExecutionContext {
  readonly toolName: string;
  readonly toolDef: ToolDefinition;
  readonly rawArgs: Record<string, unknown>;
  args: Record<string, unknown>;
  readonly cwd: string;
  isDryRun?: boolean;
  metadata: Record<string, unknown>;
  startTime: number;
}

export interface ToolExecutionResponse {
  result: unknown;
  isCached?: boolean;
  durationMs: number;
  transformedOutput?: string;
}

export type NextMiddlewareFunction = () => Promise<ToolExecutionResponse>;

export interface ToolMiddleware {
  readonly name: string;
  execute(
    context: ToolExecutionContext,
    next: NextMiddlewareFunction
  ): Promise<ToolExecutionResponse>;
}

export class ToolPipelineMiddlewareChain {
  private middlewares: ToolMiddleware[] = [];

  /**
   * Appends one or more middleware handlers to the pipeline.
   */
  public use(...middlewares: ToolMiddleware[]): this {
    this.middlewares.push(...middlewares);
    return this;
  }

  /**
   * Executes the full middleware chain around the core executor.
   */
  public async executePipeline(
    context: ToolExecutionContext,
    coreExecutor: (ctx: ToolExecutionContext) => Promise<unknown>
  ): Promise<ToolExecutionResponse> {
    let index = -1;

    const dispatch = async (i: number): Promise<ToolExecutionResponse> => {
      if (i <= index) {
        throw new Error("next() called multiple times in ToolPipelineMiddleware");
      }
      index = i;

      if (i === this.middlewares.length) {
        // Reached the terminal core executor
        const start = Date.now();
        const rawResult = await coreExecutor(context);
        const durationMs = Date.now() - start;
        return {
          result: rawResult,
          durationMs,
        };
      }

      const middleware = this.middlewares[i];
      return middleware.execute(context, () => dispatch(i + 1));
    };

    return dispatch(0);
  }

  /**
   * Returns registered middleware names.
   */
  public getMiddlewareNames(): string[] {
    return this.middlewares.map((m) => m.name);
  }
}
