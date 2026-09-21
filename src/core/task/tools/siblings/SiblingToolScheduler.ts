import type { SiblingToolDependencyNode } from "./SiblingToolDependency"

export const DEFAULT_SIBLING_TOOL_CONCURRENCY = 4
/**
 * A blocked admission loop should fail soft instead of waiting forever. This
 * only applies when no sibling is running; active work still gets as long as
 * it needs to settle or be cancelled cooperatively.
 */
export const DEFAULT_SIBLING_TOOL_STALL_TIMEOUT_MS = 15_000

export type SiblingExecutionStatus = "succeeded" | "failed" | "cancelled" | "skipped"

export interface SiblingExecutionEnvelope<T> {
	id: string
	sequence: number
	node: SiblingToolDependencyNode
	status: SiblingExecutionStatus
	value?: T
	error?: string
	queuedAtMs: number
	startedAtMs?: number
	completedAtMs: number
}

export interface SiblingSchedulerEvent {
	type: "queued" | "started" | "completed"
	node: SiblingToolDependencyNode
	atMs: number
	status?: SiblingExecutionStatus
}

export interface SiblingToolSchedulerOptions<T> {
	concurrency?: number
	/** Maximum time to wait for an externally released admission guard. */
	stallTimeoutMs?: number
	now?: () => number
	isCancelled?: () => boolean
	onEvent?: (event: SiblingSchedulerEvent) => void
	canStart?: (node: SiblingToolDependencyNode) => boolean
	classifyResult?: (value: T) => { status: "succeeded" | "failed"; error?: string }
	run: (node: SiblingToolDependencyNode, signal: AbortSignal) => Promise<T>
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function validateDependencyGraph(nodes: SiblingToolDependencyNode[]): void {
	const seen = new Set<number>()
	const duplicateSequences = new Set<number>()
	for (const node of nodes) {
		if (seen.has(node.sequence)) duplicateSequences.add(node.sequence)
		seen.add(node.sequence)
	}
	if (duplicateSequences.size > 0) {
		throw new Error(`Sibling dependency graph contains duplicate sequence(s): ${[...duplicateSequences].join(", ")}.`)
	}

	const nodesBySequence = new Map(nodes.map((node) => [node.sequence, node]))
	for (const node of nodes) {
		for (const edge of node.dependencyEdges) {
			if (edge.sequence === node.sequence) {
				throw new Error(`Sibling dependency graph contains a self-dependency at sequence ${node.sequence}.`)
			}
			if (!nodesBySequence.has(edge.sequence)) {
				throw new Error(
					`Sibling dependency graph references missing sequence ${edge.sequence} from ${node.sequence}.`,
				)
			}
		}
	}

	const state = new Map<number, "visiting" | "visited">()
	const stack: number[] = []
	const visit = (sequence: number): void => {
		if (state.get(sequence) === "visited") return
		if (state.get(sequence) === "visiting") {
			const cycleStart = stack.indexOf(sequence)
			const cycle = (cycleStart === -1 ? stack : stack.slice(cycleStart)).concat(sequence)
			throw new Error(`Sibling dependency graph contains a cycle: ${cycle.join(" -> ")}.`)
		}

		state.set(sequence, "visiting")
		stack.push(sequence)
		for (const edge of nodesBySequence.get(sequence)?.dependencyEdges ?? []) visit(edge.sequence)
		stack.pop()
		state.set(sequence, "visited")
	}

	for (const node of nodes) visit(node.sequence)
}

/** Bounded task-scoped scheduler with dependency-local failure propagation. */
export class SiblingToolScheduler<T> {
	private readonly controller = new AbortController()
	private wake?: () => void

	constructor(private readonly options: SiblingToolSchedulerOptions<T>) {}

	cancel(): void {
		this.controller.abort()
		this.signalReady()
	}

	/** Wake the task-local admission loop after an external prerequisite settles. */
	signalReady(): void {
		this.wake?.()
		this.wake = undefined
	}

	async execute(nodes: SiblingToolDependencyNode[]): Promise<SiblingExecutionEnvelope<T>[]> {
		validateDependencyGraph(nodes)
		const capacity = this.options.concurrency ?? DEFAULT_SIBLING_TOOL_CONCURRENCY
		if (!Number.isInteger(capacity) || capacity < 1) {
			throw new Error(`Sibling concurrency must be a positive integer (received ${capacity}).`)
		}
		const stallTimeoutMs = this.options.stallTimeoutMs ?? DEFAULT_SIBLING_TOOL_STALL_TIMEOUT_MS
		if (!Number.isFinite(stallTimeoutMs) || stallTimeoutMs < 0) {
			throw new Error(`Sibling stall timeout must be a non-negative finite number (received ${stallTimeoutMs}).`)
		}
		const now = this.options.now ?? (() => performance.now())
		const queuedAt = new Map<number, number>()
		for (const node of nodes) {
			const atMs = now()
			queuedAt.set(node.sequence, atMs)
			this.emit({ type: "queued", node, atMs })
		}

		const pending = new Set(nodes.map((node) => node.sequence))
		const nodesBySequence = new Map(nodes.map((node) => [node.sequence, node]))
		const running = new Map<number, Promise<void>>()
		const results = new Map<number, SiblingExecutionEnvelope<T>>()
		const notify = () => {
			this.signalReady()
		}
		const waitForWake = (timeoutMs?: number) =>
			new Promise<boolean>((resolve) => {
				let settled = false
				let timer: ReturnType<typeof setTimeout> | undefined
				const finish = (woke: boolean) => {
					if (settled) return
					settled = true
					if (timer !== undefined) clearTimeout(timer)
					if (this.wake === wake) this.wake = undefined
					resolve(woke)
				}
				const wake = () => finish(true)
				this.wake = wake
				if (timeoutMs !== undefined) {
					timer = setTimeout(() => finish(false), timeoutMs)
				}
			})

		const completeWithoutRun = (node: SiblingToolDependencyNode, status: "cancelled" | "skipped", error: string) => {
			const completedAtMs = now()
			results.set(node.sequence, {
				id: node.id,
				sequence: node.sequence,
				node,
				status,
				error,
				queuedAtMs: queuedAt.get(node.sequence) ?? completedAtMs,
				completedAtMs,
			})
			pending.delete(node.sequence)
			this.emit({ type: "completed", node, atMs: completedAtMs, status })
		}

		while (pending.size > 0 || running.size > 0) {
			if (this.options.isCancelled?.()) this.cancel()
			let madeProgress = false

			for (const sequence of [...pending]) {
				const node = nodesBySequence.get(sequence)
				if (!node) continue
				if (this.controller.signal.aborted) {
					completeWithoutRun(node, "cancelled", "Task cancelled before sibling dispatch")
					madeProgress = true
					continue
				}
				if (this.options.canStart) {
					try {
						if (!this.options.canStart(node)) continue
					} catch (error) {
						completeWithoutRun(node, "skipped", `Sibling admission failed: ${errorMessage(error)}`)
						madeProgress = true
						continue
					}
				}
				const dependencyResults = node.dependencyEdges.map((edge) => ({ edge, result: results.get(edge.sequence) }))
				if (
					dependencyResults.some(
						({ edge, result }) => result && edge.kind !== "conflict" && result.status !== "succeeded",
					)
				) {
					completeWithoutRun(node, "skipped", "Prerequisite sibling did not succeed")
					madeProgress = true
					continue
				}
				if (!dependencyResults.every(({ result }) => Boolean(result)) || running.size >= capacity) continue

				pending.delete(sequence)
				const startedAtMs = now()
				this.emit({ type: "started", node, atMs: startedAtMs })
				let execution: Promise<T>
				try {
					if (this.controller.signal.aborted) throw new Error("Task cancelled before sibling execution")
					execution = this.options.run(node, this.controller.signal)
				} catch (error) {
					execution = Promise.reject(error)
				}
				const promise = execution
					.then((value) => {
						const completedAtMs = now()
						const classification = this.options.classifyResult?.(value) ?? { status: "succeeded" as const }
						results.set(sequence, {
							id: node.id,
							sequence,
							node,
							status: classification.status,
							value,
							error: classification.error,
							queuedAtMs: queuedAt.get(sequence) ?? startedAtMs,
							startedAtMs,
							completedAtMs,
						})
						this.emit({ type: "completed", node, atMs: completedAtMs, status: classification.status })
					})
					.catch((error) => {
						const completedAtMs = now()
						const status: SiblingExecutionStatus = this.controller.signal.aborted ? "cancelled" : "failed"
						results.set(sequence, {
							id: node.id,
							sequence,
							node,
							status,
							error: errorMessage(error),
							queuedAtMs: queuedAt.get(sequence) ?? startedAtMs,
							startedAtMs,
							completedAtMs,
						})
						this.emit({ type: "completed", node, atMs: completedAtMs, status })
					})
					.finally(() => {
						running.delete(sequence)
						notify()
					})
				running.set(sequence, promise)
				madeProgress = true
			}

			if (!madeProgress && (pending.size > 0 || running.size > 0)) {
				if (running.size > 0) {
					await waitForWake()
					continue
				}

				const woke = await waitForWake(stallTimeoutMs)
				if (!woke && pending.size > 0) {
					// Treat a stalled admission loop as a soft, dependency-local
					// skip. The parent can continue with useful completed work and
					// the error tells the caller which guard needs attention.
					const error =
						`Sibling scheduling stalled for ${stallTimeoutMs}ms; ` +
						"no runnable sibling became available. Check dependency edges or release the admission guard."
					for (const sequence of [...pending]) {
						const node = nodesBySequence.get(sequence)
						if (node) completeWithoutRun(node, "skipped", error)
					}
				}
			}
		}

		return nodes.flatMap((node) => {
			const result = results.get(node.sequence)
			return result ? [result] : []
		})
	}

	private emit(event: SiblingSchedulerEvent): void {
		try {
			this.options.onEvent?.(event)
		} catch {
			// Observability callbacks are advisory.
		}
	}
}
