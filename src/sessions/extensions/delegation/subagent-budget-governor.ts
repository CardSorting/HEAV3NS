import type {
  ISubagentBudgetGovernor,
  SubagentBudget,
  SwarmTaskManifest,
} from "../../../core/contracts/delegation.contracts.js";

/**
 * SubagentBudgetGovernor.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Enforces frame-level turn, token, and wall-clock budgets for autonomous subagents,
 * failing closed whenever resource thresholds are exceeded.
 */
export class SubagentBudgetGovernor implements ISubagentBudgetGovernor {
  private readonly budgets = new Map<string, { budget: SubagentBudget; startTimeMs: number }>();

  allocateBudget(taskManifest: SwarmTaskManifest): SubagentBudget {
    const maxIterations = taskManifest.budget.maxIterations ?? 10;
    const maxTokens = taskManifest.budget.maxTokens ?? 50000;
    const maxWallClockMs = taskManifest.budget.maxWallClockMs ?? 60000;
    const remainingIterations = taskManifest.budget.remainingIterations ?? maxIterations;
    const remainingTokens = taskManifest.budget.remainingTokens ?? maxTokens;

    const budget: SubagentBudget = {
      maxIterations,
      maxTokens,
      maxWallClockMs,
      remainingIterations,
      remainingTokens,
    };

    this.budgets.set(taskManifest.id, {
      budget: Object.freeze(budget),
      startTimeMs: Date.now(),
    });

    return budget;
  }

  consumeTurn(
    taskId: string,
    tokensUsed = 100
  ): { allowed: boolean; remainingBudget: SubagentBudget; reason?: string } {
    const entry = this.budgets.get(taskId);
    if (!entry) {
      const fallbackBudget: SubagentBudget = {
        maxIterations: 0,
        maxTokens: 0,
        maxWallClockMs: 0,
        remainingIterations: 0,
        remainingTokens: 0,
      };
      return { allowed: false, remainingBudget: fallbackBudget, reason: `No active budget allocated for task '${taskId}'` };
    }

    const { budget, startTimeMs } = entry;
    const elapsedMs = Date.now() - startTimeMs;

    if (elapsedMs > budget.maxWallClockMs) {
      return {
        allowed: false,
        remainingBudget: budget,
        reason: `Wall-clock budget exceeded: ${elapsedMs}ms > ${budget.maxWallClockMs}ms`,
      };
    }

    if (budget.remainingIterations <= 0) {
      return {
        allowed: false,
        remainingBudget: budget,
        reason: "Iteration budget exhausted (0 remaining)",
      };
    }

    if (budget.remainingTokens < tokensUsed) {
      return {
        allowed: false,
        remainingBudget: budget,
        reason: `Token budget exhausted (${budget.remainingTokens} remaining < ${tokensUsed} requested)`,
      };
    }

    const updatedBudget: SubagentBudget = Object.freeze({
      ...budget,
      remainingIterations: budget.remainingIterations - 1,
      remainingTokens: budget.remainingTokens - tokensUsed,
    });

    this.budgets.set(taskId, {
      budget: updatedBudget,
      startTimeMs,
    });

    return {
      allowed: true,
      remainingBudget: updatedBudget,
    };
  }

  getBudget(taskId: string): SubagentBudget | undefined {
    return this.budgets.get(taskId)?.budget;
  }

  reclaimBudget(taskId: string): void {
    this.budgets.delete(taskId);
  }
}
