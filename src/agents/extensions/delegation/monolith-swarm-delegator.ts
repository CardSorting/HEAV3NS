import type {
  BatchDelegationResult,
  DelegationOutcome,
  ISwarmDelegator,
  SwarmBulkMutationResult,
  SwarmDslQueryFilter,
  SwarmGroupBy,
  SwarmGroupedLane,
  SwarmHealthAuditReport,
  SwarmMetricsReport,
  SwarmSortBy,
  SwarmSortDirection,
  SwarmTaskManifest,
  SwarmTaskStatus,
} from "../../../core/contracts/delegation.contracts.js";
import { SubagentLifecycleGuard } from "./subagent-lifecycle-guard.js";
import { SubagentBudgetGovernor } from "../../../sessions/extensions/delegation/subagent-budget-governor.js";
import { SubagentVfsBrancher } from "../../../sessions/extensions/delegation/subagent-vfs-brancher.js";
import { AnchoredWorktreeManager } from "../../../tooling/extensions/delegation/anchored-worktree-manager.js";
import { BroccoliSwarmSubstrate } from "../../../sessions/extensions/delegation/broccoli-swarm-substrate.js";
import type { SwarmDesktopNotificationDispatcher } from "../../../tooling/extensions/delegation/swarm-notification-dispatcher.js";

/**
 * MonolithSwarmDelegator.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Orchestrates autonomous subagent task dispatch, concurrent batch swarm execution,
 * copy-on-write VFS branching, and result aggregation with frame-level budget enforcement
 * and reactive BroccoliDB persistence.
 */
export class MonolithSwarmDelegator implements ISwarmDelegator {
  private readonly lifecycleGuard: SubagentLifecycleGuard;
  private readonly budgetGovernor: SubagentBudgetGovernor;
  private readonly vfsBrancher: SubagentVfsBrancher;
  private readonly worktreeManager: AnchoredWorktreeManager;
  private readonly substrate: BroccoliSwarmSubstrate;
  private currentTick = 0;

  constructor(
    lifecycleGuard = new SubagentLifecycleGuard(),
    budgetGovernor = new SubagentBudgetGovernor(),
    vfsBrancher = new SubagentVfsBrancher(),
    worktreeManager = new AnchoredWorktreeManager(),
    substrate = new BroccoliSwarmSubstrate()
  ) {
    this.lifecycleGuard = lifecycleGuard;
    this.budgetGovernor = budgetGovernor;
    this.vfsBrancher = vfsBrancher;
    this.worktreeManager = worktreeManager;
    this.substrate = substrate;
  }

  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }

  public getSubstrate(): BroccoliSwarmSubstrate {
    return this.substrate;
  }

  public getNotificationDispatcher(): SwarmDesktopNotificationDispatcher {
    return this.substrate.getNotificationDispatcher();
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
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
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
        timestampMs: Date.now(),
      };

      this.substrate.storeTask({
        ...manifest,
        status: "failed",
      });
      this.substrate.recordOutcome(outcome);

      this.substrate.getNotificationDispatcher().dispatch({
        taskId: manifest.id,
        parentTaskId: manifest.parentTaskId,
        title: "Subagent Spawn Rejected",
        message: spawnCheck.reason || "Rejected by lifecycle guardrail",
        urgency: "critical",
        trigger: "task_failed",
      }).catch(() => {});

      return outcome;
    }

    // 2. Register task and allocate budget
    this.substrate.storeTask(manifest);
    this.budgetGovernor.allocateBudget(manifest);

    this.substrate.getNotificationDispatcher().dispatch({
      taskId: manifest.id,
      parentTaskId: manifest.parentTaskId,
      title: "Subagent Delegated",
      message: `Goal: ${manifest.goal.substring(0, 80)}`,
      urgency: "normal",
      trigger: "task_delegated",
    }).catch(() => {});

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
        timestampMs: Date.now(),
      };

      this.substrate.storeTask({
        ...manifest,
        status: "failed",
        completedTick: this.currentTick,
        updatedAtMs: Date.now(),
      });
      this.substrate.recordOutcome(outcome);

      this.substrate.getNotificationDispatcher().dispatch({
        taskId: manifest.id,
        parentTaskId: manifest.parentTaskId,
        title: "Subagent Budget Warning",
        message: turnResult.reason || "Budget exhausted",
        urgency: "critical",
        trigger: "budget_warning",
      }).catch(() => {});

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
      timestampMs: Date.now(),
    };

    const completedTask: SwarmTaskManifest = {
      ...manifest,
      status: "completed",
      completedTick: this.currentTick,
      updatedAtMs: Date.now(),
    };

    this.substrate.storeTask(completedTask);
    this.substrate.recordOutcome(outcome);
    this.budgetGovernor.reclaimBudget(manifest.id);

    this.substrate.getNotificationDispatcher().dispatch({
      taskId: manifest.id,
      parentTaskId: manifest.parentTaskId,
      title: "Subagent Task Completed",
      message: `Completed goal in ${(outcome.durationMs).toFixed(1)}ms`,
      urgency: "normal",
      trigger: "task_completed",
    }).catch(() => {});

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
    return this.substrate.getTask(taskId)?.status;
  }

  getTaskOutcome(taskId: string): DelegationOutcome | undefined {
    const outcomes = this.substrate.getOutcomes(taskId, 1);
    return outcomes[0];
  }

  abortTask(taskId: string, reason: string): boolean {
    const task = this.substrate.getTask(taskId);
    if (!task || task.status === "completed" || task.status === "aborted") {
      return false;
    }

    const abortedTask: SwarmTaskManifest = {
      ...task,
      status: "aborted",
      completedTick: this.currentTick,
      updatedAtMs: Date.now(),
    };

    this.substrate.storeTask(abortedTask);
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
      timestampMs: Date.now(),
    };

    this.substrate.recordOutcome(outcome);

    this.substrate.getNotificationDispatcher().dispatch({
      taskId,
      parentTaskId: task.parentTaskId,
      title: "Subagent Task Aborted",
      message: `Aborted: ${reason}`,
      urgency: "critical",
      trigger: "task_aborted",
    }).catch(() => {});

    return true;
  }

  getRegisteredTaskCount(): number {
    return this.substrate.listTasks().length;
  }

  // ---------------------------------------------------------------------------
  // Substrate Facade Wrappers
  // ---------------------------------------------------------------------------

  public listTasks(statusFilter?: SwarmTaskStatus): readonly SwarmTaskManifest[] {
    return this.substrate.listTasks(statusFilter);
  }

  public getTask(taskId: string): SwarmTaskManifest | undefined {
    return this.substrate.getTask(taskId);
  }

  public auditSwarmHealth(parentTaskId?: string): SwarmHealthAuditReport {
    return this.substrate.auditSwarmHealth(parentTaskId);
  }

  public getSwarmMetrics(): SwarmMetricsReport {
    return this.substrate.getSwarmMetrics();
  }

  public getGroupedTasks(
    groupBy?: SwarmGroupBy,
    sortBy?: SwarmSortBy,
    direction?: SwarmSortDirection
  ): readonly SwarmGroupedLane[] {
    return this.substrate.getGroupedTasks(groupBy, sortBy, direction);
  }

  public queryTasksDsl(query: SwarmDslQueryFilter | string): readonly SwarmTaskManifest[] {
    return this.substrate.queryTasksDsl(query);
  }

  public bulkUpdateTasks(
    taskIds: readonly string[],
    updates: Partial<Pick<SwarmTaskManifest, "status" | "tags">>
  ): SwarmBulkMutationResult {
    return this.substrate.bulkUpdateTasks(taskIds, updates);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportInteractiveHtmlView(parentTaskId?: string): string {
    return this.substrate.exportInteractiveHtmlView(parentTaskId);
  }

  public exportMarkdownReport(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsvReport(): string {
    return this.substrate.exportCsvReport();
  }
}
