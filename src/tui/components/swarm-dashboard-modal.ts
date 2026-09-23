import type { SwarmMetricsReport, SwarmTaskManifest, SwarmTaskStatus } from "../../core/contracts/delegation.contracts.js"
import { MonolithSwarmDelegator } from "../../agents/extensions/delegation/monolith-swarm-delegator.js"
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js"
import type { Component } from "../tui.js"
import { matchesKey } from "../keys.js"
import { sliceByColumn, visibleWidth } from "../utils.js"

export type SwarmDashboardViewMode = "tasks" | "dag" | "outcomes" | "worktrees" | "health" | "metrics"

const VIEW_MODES: Array<{ mode: SwarmDashboardViewMode; label: string }> = [
	{ mode: "tasks", label: "Tasks" },
	{ mode: "dag", label: "DAG" },
	{ mode: "outcomes", label: "Results" },
	{ mode: "worktrees", label: "Worktrees" },
	{ mode: "health", label: "Health" },
	{ mode: "metrics", label: "Metrics" },
]

const VIEW_GROUPS: Array<{ label: string; modes: readonly SwarmDashboardViewMode[] }> = [
	{ label: "Tasks", modes: ["tasks"] },
	{ label: "Flow", modes: ["dag", "worktrees"] },
	{ label: "Results", modes: ["outcomes"] },
	{ label: "Insights", modes: ["health", "metrics"] },
]

const STATUS_FILTERS: Array<{ label: string; status?: SwarmTaskStatus }> = [
	{ label: "All" },
	{ label: "Running", status: "running" },
	{ label: "Pending", status: "pending" },
	{ label: "Completed", status: "completed" },
	{ label: "Failed", status: "failed" },
	{ label: "Aborted", status: "aborted" },
]

/** Keyboard-first task monitor for the current swarm session. */
export class SwarmDashboardModal implements Component {
	focused = false

	private readonly delegator: MonolithSwarmDelegator
	private readonly onClose: () => void
	private selectedIndex = 0
	private filterIndex = 0
	private viewMode: SwarmDashboardViewMode = "tasks"
	private viewScrollOffset = 0
	private detailTaskId?: string
	private detailScrollOffset = 0
	private abortConfirmationTaskId?: string
	private showHelp = false
	private statusMessage = ""
	private searchQuery = ""
	private searchBuffer = ""
	private searchPreviousQuery = ""
	private searchActive = false

	constructor(delegator: MonolithSwarmDelegator, onClose: () => void) {
		this.delegator = delegator
		this.onClose = onClose
	}

	invalidate(): void {}

	render(maxWidth: number): string[] {
		const width = Math.max(1, Math.floor(maxWidth))
		if (width < 8) return [sliceByColumn("HEAV3NS agents", 0, width)]

		const border = "─".repeat(Math.max(0, width - 2))
		const tasks = this.getFilteredTasks()
		this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, tasks.length - 1))
		const metrics = this.delegator.getSwarmMetrics()
		const lines = [`┌${border}┐`]

		lines.push(this.formatLine(" HEAV3NS · Agent tasks ", width))
		lines.push(`├${border}┤`)
		this.renderKpis(lines, metrics, width)
		lines.push(`├${border}┤`)
		this.renderViewNavigation(lines, width)
		lines.push(`├${border}┤`)
		if (this.searchActive || this.searchQuery) this.renderSearchStatus(lines, tasks, width)

		if (this.abortConfirmationTaskId) {
			this.renderAbortConfirmation(lines, tasks, width)
		} else if (this.detailTaskId) {
			this.renderTaskDetails(lines, width)
		} else {
			switch (this.viewMode) {
				case "tasks":
					this.renderTasks(lines, tasks, width)
					break
				case "dag":
					this.renderDag(lines, tasks, width)
					break
				case "outcomes":
					this.renderOutcomes(lines, width)
					break
				case "worktrees":
					this.renderWorktrees(lines, tasks, width)
					break
				case "health":
					this.renderHealth(lines, width)
					break
				case "metrics":
					this.renderMetrics(lines, metrics, width)
					break
			}
		}

		if (this.statusMessage) lines.push(this.formatLine(` ${this.statusMessage}`, width))
		lines.push(`├${border}┤`)
		for (const footerLine of this.getFooter(width)) lines.push(this.formatLine(footerLine, width))
		lines.push(`└${border}┘`)
		return lines
	}

	handleInput(key: string): void {
		if (this.abortConfirmationTaskId) {
			if (key === "y" || key === "Y" || matchesKey(key, "return")) {
				const taskId = this.abortConfirmationTaskId
				this.abortConfirmationTaskId = undefined
				const aborted = this.delegator.abortTask(taskId, "Aborted from /agents")
				this.statusMessage = aborted ? `Marked ${taskId} aborted.` : `Could not abort ${taskId}; its state changed.`
			} else if (key === "n" || key === "N" || matchesKey(key, "escape")) {
				this.abortConfirmationTaskId = undefined
				this.statusMessage = "Stop cancelled."
			}
			return
		}

		if (this.detailTaskId) {
			if (matchesKey(key, "escape") || matchesKey(key, "backspace")) {
				this.detailTaskId = undefined
				this.detailScrollOffset = 0
				this.statusMessage = ""
			} else if (key === "j" || matchesKey(key, "down") || matchesKey(key, "pageDown")) {
				this.detailScrollOffset++
			} else if (key === "k" || matchesKey(key, "up") || matchesKey(key, "pageUp")) {
				this.detailScrollOffset = Math.max(0, this.detailScrollOffset - 1)
			}
			return
		}

		if (this.searchActive) {
			if (matchesKey(key, "escape")) {
				this.searchQuery = this.searchPreviousQuery
				this.searchBuffer = this.searchQuery
				this.searchActive = false
				this.selectedIndex = 0
				this.statusMessage = "Search cancelled."
				return
			}
			if (matchesKey(key, "return")) {
				this.searchQuery = this.searchBuffer.trim()
				this.searchActive = false
				this.selectedIndex = 0
				this.statusMessage = this.searchQuery ? "Search applied." : "Search cleared."
				return
			}
			if (matchesKey(key, "backspace")) {
				this.searchBuffer = this.searchBuffer.slice(0, -1)
				this.searchQuery = this.searchBuffer.trim()
				this.selectedIndex = 0
				return
			}
			if (key.length === 1 && key >= " ") {
				this.searchBuffer += key
				this.searchQuery = this.searchBuffer.trim()
				this.selectedIndex = 0
			}
			return
		}

		const tasks = this.getFilteredTasks()
		this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, tasks.length - 1))

		if (/^[1-6]$/.test(key)) {
			this.viewMode = VIEW_MODES[Number(key) - 1]!.mode
			this.viewScrollOffset = 0
			this.statusMessage = ""
			return
		}

		if (key === "j" || matchesKey(key, "down")) {
			if (this.viewMode === "tasks") {
				if (tasks.length > 0 && this.selectedIndex < tasks.length - 1) this.selectedIndex++
			} else {
				this.viewScrollOffset++
			}
			return
		}
		if (key === "k" || matchesKey(key, "up")) {
			if (this.viewMode === "tasks") {
				if (this.selectedIndex > 0) this.selectedIndex--
			} else {
				this.viewScrollOffset = Math.max(0, this.viewScrollOffset - 1)
			}
			return
		}
		if (this.viewMode !== "tasks" && matchesKey(key, "pageDown")) {
			this.viewScrollOffset += Math.max(1, this.getVisibleRows(process.stdout.columns ?? 80) - 4)
			return
		}
		if (this.viewMode !== "tasks" && matchesKey(key, "pageUp")) {
			this.viewScrollOffset = Math.max(
				0,
				this.viewScrollOffset - Math.max(1, this.getVisibleRows(process.stdout.columns ?? 80) - 4),
			)
			return
		}
		if (matchesKey(key, "return")) {
			if (this.viewMode !== "tasks") {
				this.statusMessage = "Choose Tasks to inspect a task."
				return
			}
			const selected = tasks[this.selectedIndex]
			if (selected) {
				this.detailTaskId = selected.id
				this.detailScrollOffset = 0
				this.statusMessage = ""
			}
			return
		}

		switch (key) {
			case "/":
				this.viewMode = "tasks"
				this.searchPreviousQuery = this.searchQuery
				this.searchBuffer = ""
				this.searchQuery = ""
				this.searchActive = true
				this.selectedIndex = 0
				this.viewScrollOffset = 0
				this.statusMessage = ""
				break
			case "f":
				this.filterIndex = (this.filterIndex + 1) % STATUS_FILTERS.length
				this.selectedIndex = 0
				this.viewScrollOffset = 0
				this.statusMessage = ""
				break
			case "0":
				this.filterIndex = 0
				this.searchQuery = ""
				this.searchBuffer = ""
				this.selectedIndex = 0
				this.viewScrollOffset = 0
				this.statusMessage = "Filter cleared."
				break
			case "v": {
				const index = VIEW_MODES.findIndex(({ mode }) => mode === this.viewMode)
				this.viewMode = VIEW_MODES[(index + 1) % VIEW_MODES.length]!.mode
				this.viewScrollOffset = 0
				break
			}
			case "a": {
				const selected = this.viewMode === "tasks" ? tasks[this.selectedIndex] : undefined
				if (!selected) {
					this.statusMessage = "Select a task in Tasks before aborting it."
				} else if (selected.status !== "running") {
					this.statusMessage = `Only running tasks can be marked aborted (${selected.status}).`
				} else {
					this.abortConfirmationTaskId = selected.id
					this.statusMessage = ""
				}
				break
			}
			case "?":
				this.showHelp = !this.showHelp
				break
			case "q":
				this.onClose()
				break
			default:
				if (matchesKey(key, "escape")) this.onClose()
				break
		}
	}

	private renderTasks(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		if (tasks.length === 0) {
			const filter = STATUS_FILTERS[this.filterIndex]!.label
			if (this.searchQuery) {
				lines.push(this.formatLine(` No tasks match “${this.searchQuery}”. Press / to edit or 0 to clear.`, width))
			} else if (this.delegator.getRegisteredTaskCount() === 0) {
				lines.push(this.formatLine(" No agent tasks yet.", width))
				lines.push(this.formatLine(" Delegate a task to start an isolated child agent.", width))
			} else {
				lines.push(this.formatLine(` No ${filter.toLowerCase()} tasks. Press f to change the status filter.`, width))
			}
			return
		}

		const visibleRows = Math.max(1, this.getVisibleRows(width) - 3)
		const start = Math.min(
			Math.max(0, this.selectedIndex - Math.floor(visibleRows / 2)),
			Math.max(0, tasks.length - visibleRows),
		)
		const end = Math.min(tasks.length, start + visibleRows)
		if (start > 0) lines.push(this.formatLine(` ↑ ${start} earlier task(s)`, width))
		for (let index = start; index < end; index++) {
			const task = tasks[index]!
			const selected = index === this.selectedIndex
			const marker = selected ? "▶" : " "
			const icon = this.statusIcon(task.status)
			const branch = task.worktree ? ` · ${task.worktree.branchName}` : ""
			lines.push(
				this.formatLine(
					`${marker} ${icon} ${task.status.padEnd(9)} ${task.id.slice(0, 12)} · D${task.depth} · ${task.goal}${branch}`,
					width,
				),
			)
		}
		if (end < tasks.length) lines.push(this.formatLine(` ↓ ${tasks.length - end} later task(s)`, width))
		lines.push(
			this.formatLine(
				` Showing ${start + 1}–${end} of ${tasks.length} · Filter: ${STATUS_FILTERS[this.filterIndex]!.label}`,
				width,
			),
		)
	}

	private renderTaskDetails(lines: string[], width: number): void {
		const task = this.delegator.getTask(this.detailTaskId!)
		if (!task) {
			lines.push(this.formatLine(" Task no longer exists. Press Esc to return to the list.", width))
			return
		}

		const outcome = this.delegator.getTaskOutcome(task.id)
		const content = [
			`Task: ${task.id}`,
			`Status: ${task.status} · Depth: ${task.depth}${task.parentTaskId ? ` · Parent: ${task.parentTaskId}` : ""}`,
			`Created: ${this.formatTimestamp(task.createdAtMs)}`,
			"",
			"Goal:",
			...this.wrapText(task.goal, Math.max(1, width - 6)).map((line) => `  ${line}`),
		]
		if (task.context)
			content.push("", "Context:", ...this.wrapText(task.context, Math.max(1, width - 6)).map((line) => `  ${line}`))
		content.push(
			"",
			`Budget: ${task.budget.remainingIterations}/${task.budget.maxIterations} iterations · ${task.budget.remainingTokens}/${task.budget.maxTokens} tokens`,
			`Tools: ${task.allowedTools.join(", ") || "none"}`,
			`Blocked tools: ${task.blockedTools.join(", ") || "none"}`,
		)
		if (task.worktree) content.push(`Worktree: ${task.worktree.branchName} · ${task.worktree.worktreePath}`)
		if (outcome) {
			content.push("", `Result: ${outcome.summary}`)
			const fullResult =
				outcome.output && typeof outcome.output === "object" ? (outcome.output as { result?: unknown }).result : undefined
			if (typeof fullResult === "string" && fullResult !== outcome.summary) {
				content.push("", "Full result:", ...this.wrapText(fullResult, Math.max(1, width - 6)))
			}
			if (outcome.error) content.push(`Blocker: ${outcome.error}`)
			if (outcome.filesModified.length > 0) content.push(`Staged files: ${outcome.filesModified.join(", ")}`)
			content.push(
				`Usage: ${outcome.toolCallsCount} tool calls · ${outcome.tokenUsage} tokens · ${outcome.durationMs.toFixed(0)} ms`,
			)
		}

		const wrapped = content.flatMap((line) =>
			this.wrapText(line, Math.max(1, width - 6)).map((wrappedLine) => this.formatLine(` ${wrappedLine}`, width)),
		)
		const maxRows = this.getVisibleRows(width)
		this.detailScrollOffset = Math.min(this.detailScrollOffset, Math.max(0, wrapped.length - maxRows))
		for (const line of wrapped.slice(this.detailScrollOffset, this.detailScrollOffset + maxRows)) lines.push(line)
		if (this.detailScrollOffset > 0 || this.detailScrollOffset + maxRows < wrapped.length) {
			lines.push(
				this.formatLine(
					` Details ${this.detailScrollOffset + 1}–${Math.min(wrapped.length, this.detailScrollOffset + maxRows)} of ${wrapped.length}`,
					width,
				),
			)
		}
	}

	private renderAbortConfirmation(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		const task = this.delegator.getTask(this.abortConfirmationTaskId!)
		const goal = task?.goal ?? tasks.find(({ id }) => id === this.abortConfirmationTaskId)?.goal ?? ""
		lines.push(this.formatLine(` Mark running task ${this.abortConfirmationTaskId} as aborted?`, width))
		if (goal) lines.push(this.formatLine(` ${goal}`, width))
		lines.push(this.formatLine(" Its isolated staged changes will be discarded.", width))
	}

	private renderDag(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		const dagLines =
			tasks.length === 0 ? [" No task hierarchy to show yet."] : BroccoliViewRenderer.renderSwarmDagGraph(tasks).split("\n")
		this.renderPagedLines(lines, dagLines, width)
	}

	private renderOutcomes(lines: string[], width: number): void {
		const outcomes = this.delegator.getSubstrate().getOutcomes(undefined, 100)
		if (outcomes.length === 0) {
			this.renderPagedLines(lines, [" No recorded task results yet."], width)
			return
		}
		const content = outcomes.flatMap((outcome) => {
			const icon = outcome.success ? "✓" : "✗"
			return [
				` ${icon} ${outcome.taskId} · ${outcome.summary} · ${outcome.durationMs.toFixed(0)} ms · ${outcome.tokenUsage} tokens`,
				...(outcome.error ? [`   Blocker: ${outcome.error}`] : []),
			]
		})
		this.renderPagedLines(lines, content, width)
	}

	private renderWorktrees(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		const worktrees = tasks.filter((task) => Boolean(task.worktree))
		if (worktrees.length === 0) {
			this.renderPagedLines(lines, [" No worktrees for the current filter."], width)
			return
		}
		const content = worktrees.map((task) => {
			const worktree = task.worktree!
			return ` ${task.id} · ${worktree.branchName} · ${worktree.worktreePath}`
		})
		this.renderPagedLines(lines, content, width)
	}

	private renderHealth(lines: string[], width: number): void {
		const audit = this.delegator.auditSwarmHealth()
		const content = [
			` Health: ${audit.healthStatus} · Success: ${audit.overallSuccessRatePercent}%`,
			` Active: ${audit.activeTasks} · Max depth: ${audit.maxDepthReached} · Budget exhausted: ${audit.budgetExhaustedTasks}`,
			...(audit.recommendations.length === 0
				? [" No recovery recommendations."]
				: audit.recommendations.map((recommendation) => ` Recommendation: ${recommendation}`)),
		]
		this.renderPagedLines(lines, content, width)
	}

	private renderMetrics(lines: string[], metrics: SwarmMetricsReport, width: number): void {
		this.renderPagedLines(
			lines,
			[
				` Tasks: ${metrics.totalTasks} · Active: ${metrics.activeTasks} · Completed: ${metrics.completedTasks} · Failed: ${metrics.failedTasks} · Aborted: ${metrics.abortedTasks}`,
				` Tokens: ${metrics.totalTokensUsed} · Tool calls: ${metrics.totalToolCalls} · Worktrees: ${metrics.activeWorktreesCount}`,
				` Duration: p50 ${metrics.p50DurationMs} ms · p95 ${metrics.p95DurationMs} ms · p99 ${metrics.p99DurationMs} ms`,
				` Success rate: ${metrics.overallSuccessRatePercent}%`,
			],
			width,
		)
	}

	private renderPagedLines(lines: string[], content: readonly string[], width: number): void {
		const maxContentRows = Math.max(1, this.getVisibleRows(width) - 3)
		const start = Math.min(this.viewScrollOffset, Math.max(0, content.length - maxContentRows))
		const end = Math.min(content.length, start + maxContentRows)
		this.viewScrollOffset = start

		if (start > 0) lines.push(this.formatLine(` ↑ ${start} earlier · j/k scroll`, width))
		for (const line of content.slice(start, end)) lines.push(this.formatLine(line, width))
		if (end < content.length) lines.push(this.formatLine(` ↓ ${content.length - end} later · j/k scroll`, width))
		if (content.length > maxContentRows) {
			lines.push(this.formatLine(` Showing ${start + 1}–${end} of ${content.length}`, width))
		}
	}

	private renderKpis(lines: string[], metrics: SwarmMetricsReport, width: number): void {
		if (width >= 112) {
			lines.push(
				this.formatLine(
					` ${metrics.totalTasks} tasks · ${metrics.activeTasks} active · ${metrics.overallSuccessRatePercent}% success · ${metrics.totalTokensUsed} tokens · ${metrics.activeWorktreesCount} worktrees`,
					width,
				),
			)
			return
		}
		lines.push(
			this.formatLine(
				` ${metrics.totalTasks} tasks · ${metrics.activeTasks} active · ${metrics.overallSuccessRatePercent}% success`,
				width,
			),
		)
		lines.push(this.formatLine(` ${metrics.totalTokensUsed} tokens · ${metrics.activeWorktreesCount} worktrees`, width))
	}

	private renderViewNavigation(lines: string[], width: number): void {
		if (width >= 112) {
			const groups = VIEW_GROUPS.map(({ label, modes }) => {
				const entries = modes.map((mode) => {
					const index = VIEW_MODES.findIndex((entry) => entry.mode === mode)
					const entry = `${index + 1} ${VIEW_MODES[index]!.label}`
					return mode === this.viewMode ? `[${entry}]` : entry
				})
				return `${label} ${entries.join(" / ")}`
			})
			lines.push(this.formatLine(` ${groups.join("  ·  ")}`, width))
			return
		}

		const currentIndex = VIEW_MODES.findIndex(({ mode }) => mode === this.viewMode)
		const currentGroupIndex = VIEW_GROUPS.findIndex(({ modes }) => modes.includes(this.viewMode))
		lines.push(
			this.formatLine(
				` Group ${currentGroupIndex + 1}/4 ${VIEW_GROUPS[currentGroupIndex]!.label} · ${VIEW_MODES[currentIndex]!.label}`,
				width,
			),
		)
		lines.push(this.formatLine(" 1 Tasks · Flow: 2 DAG / 4 Trees", width))
		lines.push(this.formatLine(" 3 Results · Insights: 5 Health / 6 Metrics", width))
	}

	private renderSearchStatus(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		const query = this.searchActive ? this.searchBuffer : this.searchQuery
		const searchLabel = query
			? `Search ${this.searchActive ? ">" : ""}${query}`
			: "Search: ID, goal, context, result, or status"
		lines.push(this.formatLine(` ${searchLabel} · ${tasks.length} match${tasks.length === 1 ? "" : "es"}`, width))
	}

	private getFilteredTasks(): readonly SwarmTaskManifest[] {
		const filter = STATUS_FILTERS[this.filterIndex]!
		const terms = this.searchQuery.toLocaleLowerCase().split(/\s+/).filter(Boolean)
		const outcomesByTaskId = new Map<string, { summary: string; error?: string }>()
		for (const outcome of this.delegator.getSubstrate().getOutcomes(undefined, 500)) {
			if (!outcomesByTaskId.has(outcome.taskId)) {
				outcomesByTaskId.set(outcome.taskId, { summary: outcome.summary, error: outcome.error })
			}
		}
		return [...this.delegator.listTasks(filter.status)]
			.filter((task) => {
				if (terms.length === 0) return true
				const outcome = outcomesByTaskId.get(task.id)
				const searchable = [
					task.id,
					task.goal,
					task.context,
					task.parentTaskId ?? "",
					task.status,
					task.worktree?.branchName ?? "",
					outcome?.summary ?? "",
					outcome?.error ?? "",
					...(task.tags ?? []),
				]
					.join(" ")
					.toLocaleLowerCase()
				return terms.every((term) => searchable.includes(term))
			})
			.sort((a, b) => {
				const recencyDifference =
					(b.updatedAtMs ?? b.createdAtMs ?? b.createdTick) - (a.updatedAtMs ?? a.createdAtMs ?? a.createdTick)
				return recencyDifference || a.id.localeCompare(b.id)
			})
	}

	private getVisibleRows(width: number): number {
		const metricsRows = width >= 112 ? 1 : 2
		const navigationRows = width >= 112 ? 1 : 3
		const searchRows = this.searchActive || this.searchQuery ? 1 : 0
		const footerRows = this.getFooter(width).length
		const chromeRows = 9 + metricsRows + navigationRows + searchRows + footerRows
		return Math.max(1, (process.stdout.rows ?? 24) - chromeRows)
	}

	private getFooter(width: number): string[] {
		const isTasksView = this.viewMode === "tasks"
		const movementHint = isTasksView ? "[j/k] Move" : "[j/k] Scroll"
		const pageHint = isTasksView ? "" : " · [PgUp/Dn] Page"
		const taskActionHint = isTasksView ? " · [Enter] Inspect · [a] Abort" : ""
		if (this.abortConfirmationTaskId) {
			return [width < 40 ? " [y] Abort · [n/Esc] Cancel" : " [y/Enter] Abort · [n/Esc] Cancel"]
		}
		if (this.detailTaskId) {
			return [width < 48 ? " [j/k] Scroll · [Esc] Back" : " [j/k] Scroll · [Esc/Backspace] Back"]
		}
		if (this.searchActive) {
			return [" Type to search · [Enter] Apply · [Esc] Cancel"]
		}
		if (width < 48) {
			return [
				" [1–6] Views · [/] Search",
				" [f] Filter · [0] Clear",
				` ${movementHint}`,
				isTasksView ? " [Enter] Inspect · [a] Abort" : " [PageUp/Dn] Page",
				this.showHelp ? " [?] Hide help · [q/Esc] Close" : " [?] Help · [q/Esc] Close",
			]
		}
		if (width < 72) {
			return [
				" [1–6] Views · [/] Search · [f] Filter · [0] Clear",
				isTasksView ? " [j/k] Move · [Enter] Inspect · [a] Abort" : " [j/k] Scroll · [PgUp/Dn] Page",
				this.showHelp ? " [?] Hide help · [q/Esc] Close" : " [?] Help · [q/Esc] Close",
			]
		}
		if (width < 120) {
			return [
				` [1–6] Views · [/] Search · [f] Filter: ${STATUS_FILTERS[this.filterIndex]!.label} · [0] Clear`,
				this.showHelp
					? ` ${movementHint}${pageHint}${taskActionHint} · [?] Hide help · [q] Close`
					: ` ${movementHint}${pageHint}${taskActionHint} · [?] Help · [q] Close`,
			]
		}
		if (this.showHelp) {
			return [
				` [1–6] Views · [/] Search · [f] Cycle filter · [0] Clear · ${movementHint}${pageHint}${taskActionHint} · [?] Hide help · [q] Close`,
			]
		}
		return [
			` [1–6] Views · [/] Search · [f] Filter: ${STATUS_FILTERS[this.filterIndex]!.label} · [0] Clear · ${movementHint}${pageHint}${taskActionHint} · [?] Help · [q] Close`,
		]
	}

	private statusIcon(status: SwarmTaskStatus): string {
		switch (status) {
			case "running":
				return "●"
			case "completed":
				return "✓"
			case "failed":
				return "✗"
			case "aborted":
				return "⊘"
			case "pending":
				return "○"
		}
	}

	private formatTimestamp(timestamp?: number): string {
		if (!timestamp) return "unknown"
		return new Date(timestamp).toLocaleString()
	}

	private wrapText(value: string, width: number): string[] {
		if (!value) return [""]
		const lines: string[] = []
		let line = ""
		for (const word of value.split(/\s+/)) {
			const candidate = line ? `${line} ${word}` : word
			if (visibleWidth(candidate) <= width) {
				line = candidate
				continue
			}
			if (line) lines.push(line)
			line = visibleWidth(word) > width ? sliceByColumn(word, 0, width) : word
		}
		if (line) lines.push(line)
		return lines
	}

	private formatLine(content: string, width: number): string {
		const contentWidth = Math.max(0, width - 2)
		const clipped = visibleWidth(content) > contentWidth ? sliceByColumn(content, 0, contentWidth) : content
		const padding = Math.max(0, contentWidth - visibleWidth(clipped))
		return `│${clipped}${" ".repeat(padding)}│`
	}
}
