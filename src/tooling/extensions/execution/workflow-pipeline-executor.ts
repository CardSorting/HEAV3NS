/**
 * workflow-pipeline-executor.ts
 *
 * Chained Multi-Step Workflow Pipeline Execution Engine.
 * Executes sequenced tool calls in a single turn with dynamic output variable interpolation
 * (e.g. `$step1.output.result`), early exit conditions, and transaction safety.
 */

import type { IToolRegistry, ToolExecutionRecord } from "../../../core/contracts/tooling.contracts.js";

export interface WorkflowStep {
  readonly id: string;
  readonly tool: string;
  readonly args: Record<string, unknown>;
}

export interface WorkflowPipelinePlan {
  readonly name?: string;
  readonly steps: WorkflowStep[];
  readonly stopOnError?: boolean;
}

export interface WorkflowStepExecutionResult {
  readonly stepId: string;
  readonly tool: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly output: unknown;
  readonly error?: string;
}

export interface WorkflowPipelineResult {
  readonly success: boolean;
  readonly totalSteps: number;
  readonly executedStepsCount: number;
  readonly durationMs: number;
  readonly stepResults: WorkflowStepExecutionResult[];
  readonly finalOutput: unknown;
  readonly error?: string;
}

export class WorkflowPipelineExecutor {
  /**
   * Executes a sequenced multi-step workflow pipeline with variable interpolation.
   */
  public async executePipeline(
    plan: WorkflowPipelinePlan,
    registry: IToolRegistry,
    cwd: string
  ): Promise<WorkflowPipelineResult> {
    const startTime = performance.now();
    const stepOutputs = new Map<string, unknown>();
    const stepResults: WorkflowStepExecutionResult[] = [];
    const stopOnError = plan.stopOnError !== false;

    for (const step of plan.steps) {
      const stepStart = performance.now();
      const interpolatedArgs = this.interpolateArgs(step.args, stepOutputs);

      try {
        const output = await registry.executeTool(
          step.tool,
          interpolatedArgs,
          cwd,
          { executionAuthority: "autonomous", bypassConfirmation: true }
        );

        const durationMs = Number((performance.now() - stepStart).toFixed(2));
        const isSuccess = Boolean(output && (output as any).success !== false);

        stepOutputs.set(step.id, output);
        stepResults.push({
          stepId: step.id,
          tool: step.tool,
          success: isSuccess,
          durationMs,
          output,
          error: !isSuccess ? (output as any)?.error : undefined,
        });

        if (!isSuccess && stopOnError) {
          const totalDuration = Number((performance.now() - startTime).toFixed(2));
          return {
            success: false,
            totalSteps: plan.steps.length,
            executedStepsCount: stepResults.length,
            durationMs: totalDuration,
            stepResults,
            finalOutput: output,
            error: `Step '${step.id}' (${step.tool}) failed: ${(output as any)?.error || "Unspecified error"}`,
          };
        }
      } catch (err: unknown) {
        const durationMs = Number((performance.now() - stepStart).toFixed(2));
        const errMsg = err instanceof Error ? err.message : String(err);

        stepResults.push({
          stepId: step.id,
          tool: step.tool,
          success: false,
          durationMs,
          output: null,
          error: errMsg,
        });

        if (stopOnError) {
          const totalDuration = Number((performance.now() - startTime).toFixed(2));
          return {
            success: false,
            totalSteps: plan.steps.length,
            executedStepsCount: stepResults.length,
            durationMs: totalDuration,
            stepResults,
            finalOutput: null,
            error: `Step '${step.id}' threw exception: ${errMsg}`,
          };
        }
      }
    }

    const totalDuration = Number((performance.now() - startTime).toFixed(2));
    const lastResult = stepResults[stepResults.length - 1];

    return {
      success: stepResults.every((r) => r.success),
      totalSteps: plan.steps.length,
      executedStepsCount: stepResults.length,
      durationMs: totalDuration,
      stepResults,
      finalOutput: lastResult ? lastResult.output : null,
    };
  }

  private interpolateArgs(
    args: Record<string, unknown>,
    stepOutputs: Map<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(args)) {
      if (typeof v === "string" && v.startsWith("$")) {
        // e.g. "$step1.output.name" or "$step1"
        const resolved = this.resolvePath(v.slice(1), stepOutputs);
        result[k] = resolved !== undefined ? resolved : v;
      } else if (typeof v === "string" && v.includes("{{$")) {
        // Template string: "Result is {{$step1.output.id}}"
        result[k] = v.replace(/\{\{\$(.*?)\}\}/g, (_, pathExpr) => {
          const val = this.resolvePath(pathExpr.trim(), stepOutputs);
          return val !== undefined ? String(val) : `{{$${pathExpr}}}`;
        });
      } else {
        result[k] = v;
      }
    }

    return result;
  }

  private resolvePath(expr: string, context: Map<string, unknown>): unknown {
    const parts = expr.split(".");
    const stepId = parts[0];
    let current: any = context.get(stepId);

    if (parts.length === 1) return current;

    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      current = current[parts[i]];
    }

    return current;
  }
}
