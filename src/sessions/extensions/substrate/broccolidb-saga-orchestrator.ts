/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-saga-orchestrator.ts
 *
 * Distributed Transaction Saga Orchestrator for BroccoliDB (Pass 201 / ADR-139).
 * Coordinates multi-step distributed business workflows with forward actions and reverse compensating rollbacks.
 */

import type {
  BroccoliSagaExecutionResult,
  BroccoliSagaState,
  BroccoliSagaStep,
  IBroccoliSagaOrchestrator,
} from "../../../core/contracts/broccolidb.contracts.js";

export type { BroccoliSagaStep, BroccoliSagaExecutionResult, BroccoliSagaState };

export class BroccoliSagaOrchestrator implements IBroccoliSagaOrchestrator {
  private readonly sagaHistory = new Map<string, BroccoliSagaExecutionResult<any>>();

  public async executeSaga<TContext = any>(
    sagaId: string,
    context: TContext,
    steps: readonly BroccoliSagaStep<TContext, any>[]
  ): Promise<BroccoliSagaExecutionResult<TContext>> {
    const startTime = Date.now();
    const completedSteps: string[] = [];
    const stepResults = new Map<string, unknown>();
    let sagaState: BroccoliSagaState = "RUNNING";
    let failureError: Error | undefined = undefined;

    // 1. Forward execution phase
    for (const step of steps) {
      try {
        const result = await step.execute(context);
        completedSteps.push(step.stepName);
        stepResults.set(step.stepName, result);
      } catch (err) {
        failureError = err instanceof Error ? err : new Error(String(err));
        sagaState = "COMPENSATING";
        break;
      }
    }

    // 2. Success path
    if (sagaState === "RUNNING") {
      const finalResult: BroccoliSagaExecutionResult<TContext> = {
        sagaId,
        state: "COMPLETED",
        context,
        completedSteps,
        compensatedSteps: [],
        durationMs: Date.now() - startTime,
      };
      this.sagaHistory.set(sagaId, finalResult);
      return finalResult;
    }

    // 3. Compensation rollback phase
    const compensatedSteps: string[] = [];
    const stepsToCompensate = steps
      .filter((s) => completedSteps.includes(s.stepName))
      .reverse(); // Reverse execution order for rollbacks

    for (const step of stepsToCompensate) {
      try {
        const previousResult = stepResults.get(step.stepName);
        await step.compensate(context, previousResult);
        compensatedSteps.push(step.stepName);
      } catch (compErr) {
        // Log compensation error; continue rolling back other steps
      }
    }

    const finalResult: BroccoliSagaExecutionResult<TContext> = {
      sagaId,
      state: "COMPENSATED",
      context,
      completedSteps,
      compensatedSteps,
      error: failureError,
      durationMs: Date.now() - startTime,
    };

    this.sagaHistory.set(sagaId, finalResult);
    return finalResult;
  }

  public getSagaResult(sagaId: string): BroccoliSagaExecutionResult | undefined {
    return this.sagaHistory.get(sagaId);
  }

  public listSagas(): readonly BroccoliSagaExecutionResult[] {
    return Array.from(this.sagaHistory.values());
  }
}
