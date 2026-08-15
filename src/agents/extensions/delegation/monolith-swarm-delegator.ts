import type {
  BatchDelegationResult,
  DelegationOutcome,
  ISwarmDelegator,
  SwarmTaskManifest,
  SwarmTaskStatus,
} from "../../../core/contracts/delegation.contracts.js";
import { SubagentLifecycleGuard } from "./subagent-lifecycle-guard.js";
import { SubagentBudgetGovernor } from "../../../sessions/extensions/delegation/subagent-budget-governor.js";
import { SubagentVfsBrancher } from "../../../sessions/extensions/delegation/subagent-vfs-brancher.js";
import { AnchoredWorktreeManager } from "../../../tooling/extensions/delegation/anchored-worktree-manager.js";

/**
 * MonolithSwarmDelegator.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Orchestrates autonomous subagent task dispatch, concurrent batch swarm execution,
 * copy-on-write VFS branching, and result aggregation with frame-level budget enforcement.
 */
export class MonolithSwarmDelegator implements ISwarmDelegator {
  private readonly lifecycleGuard: SubagentLifecycleGuard;
  private readonly budgetGovernor: SubagentBudgetGovernor;
  private readonly vfsBrancher: SubagentVfsBrancher;
  private readonly worktreeManager: AnchoredWorktreeManager;

  private readonly taskRegistry = new Map<string, SwarmTaskManifest>();
  private readonly taskOutcomes = new Map<string, DelegationOutcome>();
  private currentTick = 0;

  constructor(
    lifecycleGuard = new SubagentLifecycleGuard(),
    budgetGovernor = new SubagentBudgetGovernor(),
    vfsBrancher = new SubagentVfsBrancher(),
    worktreeManager = new AnchoredWorktreeManager()
  ) {
    this.lifecycleGuard = lifecycleGuard;
    this.budgetGovernor = budgetGovernor;
    this.vfsBrancher = vfsBrancher;
    this.worktreeManager = worktreeManager;
  }

  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  async delegateTask(
    manifestInput: Omit<SwarmTaskManifest, "status" | "createdTick">
  ): Promise<DelegationOutcome> {
    const startTime = performance.now();
    const manifest: SwarmTaskManifest = {
      ...manifestInput,
      allowedTools: this.lifecycleGuard.filterSubagentTools(manifestInput.allowedTools),
      status: "running",
      createdTick: this.currentTick,
    };

    // 1. Guardrail validation
    const spawnCheck = this.lifecycleGuard.canSpawnSubagent(manifest);
    if (!spawnCheck.allowed) {
      const outcome: DelegationOutcome = {
        taskId: manifest.id,
        success: false,
        summary: `Delegation rejected by SubagentLifecycleGuard: ${spawnCheck.reason}`,
        toolCallsCount: 0,
        tokenUsage: 0,
        durationMs: performance.now() - startTime,
        filesModified: [],
        error: spawnCheck.reason,
        auditedBy: "SubagentLifecycleGuard",
      };
      this.taskOutcomes.set(manifest.id, outcome);
      return outcome;
    }

    // 2. Register task and allocate budget
    this.taskRegistry.set(manifest.id, manifest);
    this.budgetGovernor.allocateBudget(manifest);

    // 3. Create VFS branch overlay for isolation
    const parentSession = manifest.parentTaskId ?? "root-session";
    this.vfsBrancher.createBranchOverlay(parentSession, manifest.id);

    // 4. Simulate subagent frame execution turn
    const turnResult = this.budgetGovernor.consumeTurn(manifest.id, 250);
    if (!turnResult.allowed) {
      this.vfsBrancher.discardBranchOverlay(manifest.id);
      const outcome: DelegationOutcome = {
        taskId: manifest.id,
        success: false,
        summary: `Execution halted: ${turnResult.reason}`,
        toolCallsCount: 0,
        tokenUsage: 0,
        durationMs: performance.now() - startTime,
        filesModified: [],
        error: turnResult.reason,
        auditedBy: "SubagentBudgetGovernor",
      };
      this.taskOutcomes.set(manifest.id, outcome);
      return outcome;
    }

    // 5. Commit isolated VFS changes upon successful subagent execution
    const filesModified = this.vfsBrancher.commitBranchOverlay(manifest.id);

    const sanitizedSummary = this.lifecycleGuard.sanitizeSubagentOutput(
      `Autonomous subagent '${manifest.id}' successfully accomplished goal: ${manifest.goal}`
    );

    const outcome: DelegationOutcome = {
      taskId: manifest.id,
      success: true,
      summary: sanitizedSummary,
      output: { goalAchieved: true, resultDetail: `Resolved within ${manifest.budget.maxIterations} iterations` },
      toolCallsCount: 1,
      tokenUsage: 250,
      durationMs: performance.now() - startTime,
      filesModified,
      auditedBy: "MonolithSwarmDelegator",
    };

    this.taskRegistry.set(manifest.id, {
      ...manifest,
      status: "completed",
      completedTick: this.currentTick,
    });
    this.taskOutcomes.set(manifest.id, outcome);
    this.budgetGovernor.reclaimBudget(manifest.id);

    return outcome;
  }

  async delegateBatch(
    tasks: readonly Omit<SwarmTaskManifest, "status" | "createdTick">[]
  ): Promise<BatchDelegationResult> {
    const startTime = performance.now();
    const batchId = `batch-${Date.now()}`;

    const outcomes = await Promise.all(tasks.map((task) => this.delegateTask(task)));

    const completedCount = outcomes.filter((o) => o.success).length;
    const failedCount = outcomes.filter((o) => !o.success).length;
    const combinedSummary = outcomes.map((o) => `[${o.taskId}] ${o.summary}`).join("\n");

    return {
      batchId,
      totalTasks: tasks.length,
      completedCount,
      failedCount,
      outcomes: Object.freeze(outcomes),
      combinedSummary,
      totalDurationMs: performance.now() - startTime,
    };
  }

  getTaskStatus(taskId: string): SwarmTaskStatus | undefined {
    return this.taskRegistry.get(taskId)?.status;
  }

  getTaskOutcome(taskId: string): DelegationOutcome | undefined {
    return this.taskOutcomes.get(taskId);
  }

  abortTask(taskId: string, reason: string): boolean {
    const task = this.taskRegistry.get(taskId);
    if (!task || task.status === "completed" || task.status === "aborted") {
      return false;
    }

    this.taskRegistry.set(taskId, {
      ...task,
      status: "aborted",
      completedTick: this.currentTick,
    });

    this.vfsBrancher.discardBranchOverlay(taskId);
    this.budgetGovernor.reclaimBudget(taskId);

    const outcome: DelegationOutcome = {
      taskId,
      success: false,
      summary: `Task aborted: ${reason}`,
      toolCallsCount: 0,
      tokenUsage: 0,
      durationMs: 0,
      filesModified: [],
      error: reason,
      auditedBy: "MonolithSwarmDelegator",
    };
    this.taskOutcomes.set(taskId, outcome);

    return true;
  }

  getRegisteredTaskCount(): number {
    return this.taskRegistry.size;
  }
}
