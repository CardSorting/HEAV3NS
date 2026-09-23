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
} from "../../../core/contracts/delegation.contracts.js"
import { SubagentLifecycleGuard } from "./subagent-lifecycle-guard.js"
import { SubagentBudgetGovernor } from "../../../sessions/extensions/delegation/subagent-budget-governor.js"
import { SubagentVfsBrancher } from "../../../sessions/extensions/delegation/subagent-vfs-brancher.js"
import { AnchoredWorktreeManager } from "../../../tooling/extensions/delegation/anchored-worktree-manager.js"
import { BroccoliSwarmSubstrate } from "../../../sessions/extensions/delegation/broccoli-swarm-substrate.js"
import type { SwarmDesktopNotificationDispatcher } from "../../../tooling/extensions/delegation/swarm-notification-dispatcher.js"

export interface SwarmChildRunResult {
	readonly result: string
	readonly toolCallsCount: number
	readonly tokenUsage: number
	readonly filesModified?: readonly string[]
}

export type SwarmChildRunner = (manifest: SwarmTaskManifest, signal: AbortSignal) => Promise<SwarmChildRunResult>

interface ChildRunWaiter {
	readonly signal: AbortSignal
	grant: () => void
	cancel: () => void
}

/**
 * MonolithSwarmDelegator.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Persists swarm task and outcome state for the CLI and delegates execution through an
 * injected child runner. Child concurrency is bounded so parent bursts cannot exhaust
 * provider or workspace resources.
 */
export class MonolithSwarmDelegator implements ISwarmDelegator {
	private static readonly MAX_CONCURRENT_CHILD_RUNS = 4
	private readonly lifecycleGuard: SubagentLifecycleGuard
	private readonly budgetGovernor: SubagentBudgetGovernor
	private readonly vfsBrancher: SubagentVfsBrancher
	private readonly worktreeManager: AnchoredWorktreeManager
	private readonly substrate: BroccoliSwarmSubstrate
	private currentTick = 0
	private childRunner?: SwarmChildRunner
	private childAllowedTools: readonly string[] = Object.freeze([])
	private activeChildRuns = 0
	private readonly childRunWaiters: ChildRunWaiter[] = []
	private readonly activeControllers = new Map<string, AbortController>()

	constructor(
		lifecycleGuard = new SubagentLifecycleGuard(),
		budgetGovernor = new SubagentBudgetGovernor(),
		vfsBrancher = new SubagentVfsBrancher(),
		worktreeManager = new AnchoredWorktreeManager(),
		substrate = new BroccoliSwarmSubstrate(),
	) {
		this.lifecycleGuard = lifecycleGuard
		this.budgetGovernor = budgetGovernor
		this.vfsBrancher = vfsBrancher
		this.worktreeManager = worktreeManager
		this.substrate = substrate
	}

	setCurrentTick(tick: number): void {
		this.currentTick = tick
	}

	setChildRunner(runner: SwarmChildRunner, allowedTools: readonly string[]): void {
		this.childRunner = runner
		this.childAllowedTools = Object.freeze([...allowedTools])
	}

	public getSubstrate(): BroccoliSwarmSubstrate {
		return this.substrate
	}

	public getNotificationDispatcher(): SwarmDesktopNotificationDispatcher {
		return this.substrate.getNotificationDispatcher()
	}

	async delegateTask(
		manifestInput: Omit<SwarmTaskManifest, "status" | "createdTick">,
		parentSignal?: AbortSignal,
	): Promise<DelegationOutcome> {
		const startTime = performance.now()
		const now = Date.now()
		const taskId = manifestInput.id.trim()
		if (!taskId) {
			return {
				taskId: "",
				success: false,
				summary: "Delegation rejected: provide a task ID.",
				error: "Task IDs cannot be empty.",
				toolCallsCount: 0,
				tokenUsage: 0,
				durationMs: performance.now() - startTime,
				filesModified: [],
				auditedBy: "MonolithSwarmDelegator",
				timestampMs: now,
			}
		}
		if (this.substrate.getTask(taskId)) {
			return {
				taskId,
				success: false,
				summary: `Delegation rejected: task ID '${taskId}' already exists.`,
				error: `Choose a unique task ID; '${taskId}' is already registered.`,
				toolCallsCount: 0,
				tokenUsage: 0,
				durationMs: performance.now() - startTime,
				filesModified: [],
				auditedBy: "MonolithSwarmDelegator",
				timestampMs: now,
			}
		}

		const maxIterations = this.clampBudget(manifestInput.budget.maxIterations, 10, 1, 50)
		const maxTokens = this.clampBudget(manifestInput.budget.maxTokens, 10_000, 1_000, 50_000)
		const maxWallClockMs = this.clampBudget(manifestInput.budget.maxWallClockMs, 60_000, 1_000, 120_000)
		const manifest: SwarmTaskManifest = {
			...manifestInput,
			id: taskId,
			allowedTools: this.childRunner
				? (() => {
						const requestedTools = this.lifecycleGuard.filterSubagentTools(manifestInput.allowedTools)
						const candidates = requestedTools.includes("*") ? this.childAllowedTools : requestedTools
						return Object.freeze(
							candidates
								.filter((tool) => this.childAllowedTools.includes("*") || this.childAllowedTools.includes(tool))
								.filter((tool, index, tools) => tools.indexOf(tool) === index),
						)
					})()
				: this.lifecycleGuard.filterSubagentTools(manifestInput.allowedTools),
			budget: {
				maxIterations,
				maxTokens,
				maxWallClockMs,
				remainingIterations: this.clampBudget(manifestInput.budget.remainingIterations, maxIterations, 0, maxIterations),
				remainingTokens: this.clampBudget(manifestInput.budget.remainingTokens, maxTokens, 0, maxTokens),
			},
			status: "pending",
			createdTick: this.currentTick,
			createdAtMs: manifestInput.createdAtMs ?? now,
			updatedAtMs: now,
		}
		this.substrate.storeTask(manifest)

		const spawnCheck = this.lifecycleGuard.canSpawnSubagent(manifest)
		if (!spawnCheck.allowed) {
			return this.finishWithoutRun(manifest, startTime, spawnCheck.reason ?? "Delegation rejected.")
		}
		if (!this.childRunner) {
			return this.finishWithoutRun(
				manifest,
				startTime,
				"No model-backed child runner is connected to this CLI runtime. The request was recorded, but no child agent executed it.",
			)
		}
		if (manifest.allowedTools.length === 0) {
			return this.finishWithoutRun(
				manifest,
				startTime,
				"No supported workspace tools were allowed for this child task. Add file inspection or staged-edit tools and retry.",
			)
		}

		const controller = new AbortController()
		this.activeControllers.set(manifest.id, controller)
		const cancelFromParent = () => {
			this.abortTask(manifest.id, "Parent agent turn cancelled.")
		}
		if (parentSignal?.aborted) cancelFromParent()
		else parentSignal?.addEventListener("abort", cancelFromParent, { once: true })
		let releaseSlot: (() => void) | undefined
		try {
			releaseSlot = await this.acquireChildSlot(controller.signal)
			controller.signal.throwIfAborted()

			const allocatedBudget = this.budgetGovernor.allocateBudget(manifest)
			if (allocatedBudget.remainingIterations <= 0 || allocatedBudget.remainingTokens <= 0) {
				throw new Error("Delegated task budget is empty before execution.")
			}

			const runningManifest: SwarmTaskManifest = {
				...manifest,
				status: "running",
				budget: allocatedBudget,
				updatedAtMs: Date.now(),
			}
			this.substrate.storeTask(runningManifest)

			const timeoutSignal = AbortSignal.timeout(runningManifest.budget.maxWallClockMs)
			const runSignal = AbortSignal.any([controller.signal, timeoutSignal])
			const result = await this.childRunner(runningManifest, runSignal)

			if (controller.signal.aborted || this.substrate.getTask(manifest.id)?.status === "aborted") {
				return this.getTaskOutcome(manifest.id) ?? this.makeAbortedOutcome(manifest.id, "Task aborted.", startTime)
			}

			const usage = Math.max(0, Math.floor(result.tokenUsage))
			const budgetCheck = this.budgetGovernor.consumeTurn(manifest.id, usage)
			if (!budgetCheck.allowed) throw new Error(budgetCheck.reason ?? "Delegated task budget exhausted.")

			const completedAt = Date.now()
			const completedManifest: SwarmTaskManifest = {
				...runningManifest,
				status: "completed",
				completedTick: this.currentTick,
				budget: budgetCheck.remainingBudget,
				updatedAtMs: completedAt,
			}
			const sanitizedResult = this.lifecycleGuard.sanitizeSubagentOutput(result.result).slice(0, 20_000)
			const outcome: DelegationOutcome = {
				taskId: manifest.id,
				success: true,
				summary: sanitizedResult.slice(0, 500) || "Child completed without a text summary.",
				output: { result: sanitizedResult },
				toolCallsCount: Math.max(0, Math.floor(result.toolCallsCount)),
				tokenUsage: usage,
				durationMs: performance.now() - startTime,
				filesModified: Object.freeze([...(result.filesModified ?? [])]),
				auditedBy: "MonolithSwarmDelegator",
				timestampMs: completedAt,
			}
			this.substrate.storeTask(completedManifest)
			this.substrate.recordOutcome(outcome)
			return outcome
		} catch (error) {
			if (controller.signal.aborted || this.substrate.getTask(manifest.id)?.status === "aborted") {
				return this.getTaskOutcome(manifest.id) ?? this.makeAbortedOutcome(manifest.id, "Task aborted.", startTime)
			}
			const message = error instanceof Error ? error.message : String(error)
			return this.finishWithoutRun(manifest, startTime, message, "failed")
		} finally {
			parentSignal?.removeEventListener("abort", cancelFromParent)
			this.activeControllers.delete(manifest.id)
			this.budgetGovernor.reclaimBudget(manifest.id)
			releaseSlot?.()
		}
	}

	private clampBudget(value: number | undefined, fallback: number, min: number, max: number): number {
		return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value!))) : fallback
	}

	private finishWithoutRun(
		manifest: SwarmTaskManifest,
		startTime: number,
		reason: string,
		status: "failed" = "failed",
	): DelegationOutcome {
		const now = Date.now()
		const currentManifest = this.substrate.getTask(manifest.id) ?? manifest
		const finalManifest: SwarmTaskManifest = {
			...currentManifest,
			status,
			completedTick: this.currentTick,
			updatedAtMs: now,
		}
		const outcome: DelegationOutcome = {
			taskId: manifest.id,
			success: false,
			summary: `Delegated task ${status}: ${reason}`,
			error: reason,
			output: { blocked: true, reason },
			toolCallsCount: 0,
			tokenUsage: 0,
			durationMs: performance.now() - startTime,
			filesModified: [],
			auditedBy: "MonolithSwarmDelegator",
			timestampMs: now,
		}
		this.substrate.storeTask(finalManifest)
		this.substrate.recordOutcome(outcome)
		return outcome
	}

	private makeAbortedOutcome(taskId: string, reason: string, startTime: number): DelegationOutcome {
		const outcome: DelegationOutcome = {
			taskId,
			success: false,
			summary: `Task aborted: ${reason}`,
			error: reason,
			toolCallsCount: 0,
			tokenUsage: 0,
			durationMs: performance.now() - startTime,
			filesModified: [],
			auditedBy: "MonolithSwarmDelegator",
			timestampMs: Date.now(),
		}
		this.substrate.recordOutcome(outcome)
		return outcome
	}

	private acquireChildSlot(signal: AbortSignal): Promise<() => void> {
		return new Promise((resolve, reject) => {
			if (signal.aborted) {
				reject(signal.reason ?? new Error("Delegated task cancelled."))
				return
			}

			let waiter: ChildRunWaiter | undefined
			const grant = () => {
				if (signal.aborted) {
					reject(signal.reason ?? new Error("Delegated task cancelled."))
					return
				}
				signal.removeEventListener("abort", cancel)
				this.activeChildRuns++
				let released = false
				resolve(() => {
					if (released) return
					released = true
					this.activeChildRuns--
					while (this.childRunWaiters.length > 0) {
						const next = this.childRunWaiters.shift()!
						if (!next.signal.aborted) {
							next.grant()
							break
						}
					}
				})
			}
			const cancel = () => {
				if (waiter) {
					const index = this.childRunWaiters.indexOf(waiter)
					if (index >= 0) this.childRunWaiters.splice(index, 1)
				}
				reject(signal.reason ?? new Error("Delegated task cancelled."))
			}
			waiter = { signal, grant, cancel }
			signal.addEventListener("abort", cancel, { once: true })
			if (this.activeChildRuns < MonolithSwarmDelegator.MAX_CONCURRENT_CHILD_RUNS) grant()
			else this.childRunWaiters.push(waiter)
		})
	}

	async delegateBatch(
		tasks: readonly Omit<SwarmTaskManifest, "status" | "createdTick">[],
		parentSignal?: AbortSignal,
	): Promise<BatchDelegationResult> {
		const startTime = performance.now()
		const batchId = `batch-${Date.now()}`

		const outcomes = await Promise.all(tasks.map((task) => this.delegateTask(task, parentSignal)))

		const completedCount = outcomes.filter((o) => o.success).length
		const failedCount = outcomes.filter((o) => !o.success).length
		const combinedSummary = outcomes.map((o) => `[${o.taskId}] ${o.summary}`).join("\n")

		return {
			batchId,
			totalTasks: tasks.length,
			completedCount,
			failedCount,
			outcomes: Object.freeze(outcomes),
			combinedSummary,
			totalDurationMs: performance.now() - startTime,
		}
	}

	getTaskStatus(taskId: string): SwarmTaskStatus | undefined {
		return this.substrate.getTask(taskId)?.status
	}

	getTaskOutcome(taskId: string): DelegationOutcome | undefined {
		const outcomes = this.substrate.getOutcomes(taskId, 1)
		return outcomes[0]
	}

	abortTask(taskId: string, reason: string): boolean {
		const task = this.substrate.getTask(taskId)
		if (!task || (task.status !== "pending" && task.status !== "running")) {
			return false
		}

		const abortedTask: SwarmTaskManifest = {
			...task,
			status: "aborted",
			completedTick: this.currentTick,
			updatedAtMs: Date.now(),
		}

		this.substrate.storeTask(abortedTask)
		this.activeControllers.get(taskId)?.abort(new Error(reason))
		this.vfsBrancher.discardBranchOverlay(`subagent:${taskId}`)
		this.budgetGovernor.reclaimBudget(taskId)

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
		}

		this.substrate.recordOutcome(outcome)

		this.substrate
			.getNotificationDispatcher()
			.dispatch({
				taskId,
				parentTaskId: task.parentTaskId,
				title: "Subagent Task Aborted",
				message: `Aborted: ${reason}`,
				urgency: "critical",
				trigger: "task_aborted",
			})
			.catch(() => {})

		return true
	}

	getRegisteredTaskCount(): number {
		return this.substrate.listTasks().length
	}

	// ---------------------------------------------------------------------------
	// Substrate Facade Wrappers
	// ---------------------------------------------------------------------------

	public listTasks(statusFilter?: SwarmTaskStatus): readonly SwarmTaskManifest[] {
		return this.substrate.listTasks(statusFilter)
	}

	public getTask(taskId: string): SwarmTaskManifest | undefined {
		return this.substrate.getTask(taskId)
	}

	public auditSwarmHealth(parentTaskId?: string): SwarmHealthAuditReport {
		return this.substrate.auditSwarmHealth(parentTaskId)
	}

	public getSwarmMetrics(): SwarmMetricsReport {
		return this.substrate.getSwarmMetrics()
	}

	public getGroupedTasks(
		groupBy?: SwarmGroupBy,
		sortBy?: SwarmSortBy,
		direction?: SwarmSortDirection,
	): readonly SwarmGroupedLane[] {
		return this.substrate.getGroupedTasks(groupBy, sortBy, direction)
	}

	public queryTasksDsl(query: SwarmDslQueryFilter | string): readonly SwarmTaskManifest[] {
		return this.substrate.queryTasksDsl(query)
	}

	public bulkUpdateTasks(
		taskIds: readonly string[],
		updates: Partial<Pick<SwarmTaskManifest, "status" | "tags">>,
	): SwarmBulkMutationResult {
		return this.substrate.bulkUpdateTasks(taskIds, updates)
	}

	public undo(): boolean {
		return this.substrate.undo()
	}

	public redo(): boolean {
		return this.substrate.redo()
	}

	public exportInteractiveHtmlView(parentTaskId?: string): string {
		return this.substrate.exportInteractiveHtmlView(parentTaskId)
	}

	public exportMarkdownReport(): string {
		return this.substrate.exportMarkdownReport()
	}

	public exportCsvReport(): string {
		return this.substrate.exportCsvReport()
	}
}
