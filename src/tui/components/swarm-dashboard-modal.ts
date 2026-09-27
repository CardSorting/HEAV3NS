import type { SwarmMetricsReport, SwarmTaskManifest, SwarmTaskStatus } from "../../core/contracts/delegation.contracts.js"
import { MonolithSwarmDelegator } from "../../agents/extensions/delegation/monolith-swarm-delegator.js"
import { BroccoliViewRenderer } from "../../sessions/extensions/substrate/broccolidb-view-renderer.js"
import type { Component } from "../tui.js"
import { matchesKey } from "../keys.js"
import { sliceByColumn, stripTerminalSequences, visibleWidth, wrapTextWithAnsi } from "../utils.js"
import { Input } from "./input.js"

export type SwarmDashboardViewMode = "tasks" | "dag" | "outcomes" | "worktrees" | "health" | "metrics"

const VIEW_MODES: Array<{ mode: SwarmDashboardViewMode; label: string }> = [
	{ mode: "tasks", label: "Tasks" },
	{ mode: "dag", label: "Flow" },
	{ mode: "outcomes", label: "Results" },
	{ mode: "worktrees", label: "Worktrees" },
	{ mode: "health", label: "Health" },
	{ mode: "metrics", label: "Metrics" },
]

const STATUS_FILTERS: Array<{ label: string; status?: SwarmTaskStatus }> = [
	{ label: "All" },
	{ label: "Running", status: "running" },
	{ label: "Queued", status: "pending" },
	{ label: "Completed", status: "completed" },
	{ label: "Failed", status: "failed" },
	{ label: "Cancelled", status: "aborted" },
]

/** Task text is data, never terminal instructions. Preserve newlines for evidence. */
function safeTaskText(value: string): string {
	return stripTerminalSequences(value.replace(/\r\n?/g, "\n")).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "")
}

/** Keyboard-first task monitor for the current swarm session. */
export class SwarmDashboardModal implements Component {
	focused = false

	private readonly delegator: MonolithSwarmDelegator
	private readonly onClose: () => void
	private selectedIndex = 0
	private selectedTaskId?: string
	private renderedWidth = 80
	private summaryRows = 2
	private navigationRows = 2
	private filterIndex = 0
	private viewMode: SwarmDashboardViewMode = "tasks"
	private viewScrollOffset = 0
	private detailTaskId?: string
	private detailScrollOffset = 0
	private abortConfirmationTaskId?: string
	private showHelp = false
	private statusMessage = ""
	private searchQuery = ""
	private readonly searchInput = new Input()
	private searchPreviousQuery = ""
	private searchActive = false

	constructor(
		delegator: MonolithSwarmDelegator,
		onClose: () => void,
		private readonly viewportRows: () => number = () => process.stdout.rows ?? 24,
	) {
		this.delegator = delegator
		this.onClose = onClose
		this.searchInput.onSubmit = (value) => {
			this.searchQuery = safeTaskText(value).trim()
			this.searchActive = false
			this.resetSelection()
			this.statusMessage = this.searchQuery ? "Search applied." : "Search cleared."
		}
		this.searchInput.onEscape = () => {
			this.searchQuery = this.searchPreviousQuery
			this.searchActive = false
			this.resetSelection()
			this.statusMessage = "Search cancelled."
		}
	}

	invalidate(): void {}

	render(maxWidth: number): string[] {
		const width = Math.max(1, Math.floor(maxWidth))
		this.renderedWidth = width
		if (width < 8) return [sliceByColumn("HEAV3NS agents", 0, width)]

		const border = "─".repeat(Math.max(0, width - 2))
		const tasks = this.getFilteredTasks()
		this.syncSelection(tasks)
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
				this.statusMessage = aborted ? `Stopped ${taskId}.` : `Could not stop ${taskId}; its state changed.`
			} else if (key === "n" || key === "N" || matchesKey(key, "escape")) {
				this.abortConfirmationTaskId = undefined
				this.statusMessage = "Stop cancelled."
			}
			return
		}

		if (this.detailTaskId) {
			const pageSize = Math.max(1, this.getVisibleRows(this.renderedWidth) - 1)
			if (matchesKey(key, "escape") || matchesKey(key, "backspace")) {
				this.detailTaskId = undefined
				this.detailScrollOffset = 0
				this.statusMessage = ""
			} else if (key === "a") {
				this.requestStop(this.delegator.getTask(this.detailTaskId))
			} else if (matchesKey(key, "end") || key === "G") {
				this.detailScrollOffset = Number.MAX_SAFE_INTEGER
			} else if (matchesKey(key, "home") || key === "g") {
				this.detailScrollOffset = 0
			} else if (matchesKey(key, "pageDown")) {
				this.detailScrollOffset += pageSize
			} else if (matchesKey(key, "pageUp")) {
				this.detailScrollOffset = Math.max(0, this.detailScrollOffset - pageSize)
			} else if (key === "j" || matchesKey(key, "down")) {
				this.detailScrollOffset++
			} else if (key === "k" || matchesKey(key, "up")) {
				this.detailScrollOffset = Math.max(0, this.detailScrollOffset - 1)
			}
			return
		}

		if (this.searchActive) {
			this.searchInput.handleInput(key)
			const safeValue = safeTaskText(this.searchInput.getValue()).replace(/\n/g, " ")
			if (safeValue !== this.searchInput.getValue()) this.searchInput.setValue(safeValue)
			if (this.searchActive) {
				this.searchQuery = safeValue.trim()
				this.resetSelection()
			}
			return
		}

		const tasks = this.getFilteredTasks()
		this.syncSelection(tasks)

		if (matchesKey(key, "tab") || matchesKey(key, "shift+tab")) {
			const index = VIEW_MODES.findIndex(({ mode }) => mode === this.viewMode)
			const direction = matchesKey(key, "shift+tab") ? -1 : 1
			this.viewMode = VIEW_MODES[(index + direction + VIEW_MODES.length) % VIEW_MODES.length]!.mode
			this.viewScrollOffset = 0
			this.statusMessage = ""
			return
		}
		if (matchesKey(key, "home") || matchesKey(key, "end") || key === "g" || key === "G") {
			const atEnd = matchesKey(key, "end") || key === "G"
			if (this.viewMode === "tasks") this.selectTask(tasks, atEnd ? tasks.length - 1 : 0)
			else this.viewScrollOffset = atEnd ? Number.MAX_SAFE_INTEGER : 0
			return
		}
		if (matchesKey(key, "pageDown") || matchesKey(key, "pageUp")) {
			const direction = matchesKey(key, "pageDown") ? 1 : -1
			const delta = direction * Math.max(1, this.getVisibleRows(this.renderedWidth) - 3)
			if (this.viewMode === "tasks") this.selectTask(tasks, this.selectedIndex + delta)
			else this.viewScrollOffset = Math.max(0, this.viewScrollOffset + delta)
			return
		}

		if (/^[1-6]$/.test(key)) {
			this.viewMode = VIEW_MODES[Number(key) - 1]!.mode
			this.viewScrollOffset = 0
			this.statusMessage = ""
			return
		}

		if (key === "j" || matchesKey(key, "down")) {
			if (this.viewMode === "tasks") {
				this.selectTask(tasks, this.selectedIndex + 1)
			} else {
				this.viewScrollOffset++
			}
			return
		}
		if (key === "k" || matchesKey(key, "up")) {
			if (this.viewMode === "tasks") {
				this.selectTask(tasks, this.selectedIndex - 1)
			} else {
				this.viewScrollOffset = Math.max(0, this.viewScrollOffset - 1)
			}
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
				this.searchInput.setValue("")
				this.searchQuery = ""
				this.searchActive = true
				this.resetSelection()
				this.viewScrollOffset = 0
				this.statusMessage = ""
				break
			case "f":
				this.filterIndex = (this.filterIndex + 1) % STATUS_FILTERS.length
				this.resetSelection()
				this.viewScrollOffset = 0
				this.statusMessage = ""
				break
			case "0":
				this.filterIndex = 0
				this.searchQuery = ""
				this.searchInput.setValue("")
				this.resetSelection()
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
				this.requestStop(selected)
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

	private resetSelection(): void {
		this.selectedIndex = 0
		this.selectedTaskId = undefined
	}

	private selectTask(tasks: readonly SwarmTaskManifest[], index: number): void {
		this.selectedIndex = Math.max(0, Math.min(index, tasks.length - 1))
		this.selectedTaskId = tasks[this.selectedIndex]?.id
	}

	private syncSelection(tasks: readonly SwarmTaskManifest[]): void {
		const index = this.selectedTaskId ? tasks.findIndex((task) => task.id === this.selectedTaskId) : -1
		this.selectTask(tasks, index >= 0 ? index : this.selectedIndex)
	}

	private requestStop(task: SwarmTaskManifest | undefined): void {
		if (!task) this.statusMessage = "Select a task in Tasks before stopping it."
		else if (task.status !== "running" && task.status !== "pending") {
			this.statusMessage = `Task already ${this.statusLabel(task.status).toLowerCase()}; no work to stop.`
		} else {
			this.abortConfirmationTaskId = task.id
			this.statusMessage = ""
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
					`${marker} ${icon} ${this.statusLabel(task.status).padEnd(9)} ${task.goal} · ${task.id}${branch}`,
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
			`Status: ${this.statusLabel(task.status)}${task.parentTaskId ? ` · Parent: ${task.parentTaskId}` : ""}`,
			`Created: ${this.formatTimestamp(task.createdAtMs)}`,
		]
		if (outcome) {
			content.push("", `Result: ${outcome.summary}`)
			if (outcome.error) content.push(`Failure: ${outcome.error}`)
			if (outcome.filesModified.length > 0) {
				content.push(
					`Staged files: ${outcome.filesModified.join(", ")}`,
					"Handoff: parent applies the diff and verifies it.",
				)
			}
			const fullResult =
				outcome.output && typeof outcome.output === "object" ? (outcome.output as { result?: unknown }).result : undefined
			if (typeof fullResult === "string" && fullResult !== outcome.summary) {
				content.push("", "Full result:", ...this.wrapText(fullResult, Math.max(1, width - 6)))
			}
			content.push(
				`Usage: ${outcome.toolCallsCount} tool calls · ${outcome.tokenUsage} tokens · ${outcome.durationMs.toFixed(0)} ms`,
			)
		}
		content.push("", "Goal:", task.goal)
		if (task.context) content.push("", "Context:", task.context)
		content.push(
			"",
			`Budget: ${task.budget.remainingIterations}/${task.budget.maxIterations} iterations · ${task.budget.remainingTokens}/${task.budget.maxTokens} tokens`,
			`Tools: ${task.allowedTools.join(", ") || "none"}`,
			`Blocked tools: ${task.blockedTools.join(", ") || "none"}`,
		)
		if (task.worktree) content.push(`Worktree: ${task.worktree.branchName} · ${task.worktree.worktreePath}`)

		const wrapped = content.flatMap((line) =>
			this.wrapText(line, Math.max(1, width - 6)).map((wrappedLine) => this.formatLine(` ${wrappedLine}`, width)),
		)
		const maxRows = Math.max(1, this.getVisibleRows(width) - 1)
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
		lines.push(
			this.formatLine(
				` Stop ${task?.status === "pending" ? "queued" : "running"} task ${this.abortConfirmationTaskId}?`,
				width,
			),
		)
		if (goal) lines.push(this.formatLine(` ${goal}`, width))
		lines.push(this.formatLine(" Its isolated child changes will be discarded; parent edits remain.", width))
	}

	private renderDag(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		const dagLines =
			tasks.length === 0 ? [" No task hierarchy to show yet."] : BroccoliViewRenderer.renderSwarmDagGraph(tasks).split("\n")
		this.renderPagedLines(lines, dagLines, width, false)
	}

	private renderOutcomes(lines: string[], width: number): void {
		const outcomes = this.delegator.getSubstrate().getOutcomes(undefined, Number.POSITIVE_INFINITY)
		if (outcomes.length === 0) {
			this.renderPagedLines(lines, [" No recorded task results yet."], width)
			return
		}
		const content = outcomes.flatMap((outcome) => {
			const icon = outcome.success ? "✓" : "✗"
			return [
				` ${icon} ${outcome.taskId} · ${outcome.summary} · ${outcome.durationMs.toFixed(0)} ms · ${outcome.tokenUsage} tokens`,
				...(outcome.error ? [`   Failure: ${outcome.error}`] : []),
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

	private renderPagedLines(lines: string[], content: readonly string[], width: number, wrap = true): void {
		if (wrap) content = content.flatMap((line) => this.wrapText(line, Math.max(1, width - 4)))
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
		const queued = this.delegator.listTasks("pending").length
		const rows = this.wrapItems(
			[
				`${metrics.activeTasks - queued} running`,
				`${queued} queued`,
				`${metrics.completedTasks} done`,
				`${metrics.failedTasks} failed`,
			],
			width - 4,
			" · ",
		)
		this.summaryRows = rows.length
		for (const row of rows) lines.push(this.formatLine(` ${row}`, width))
	}

	private renderViewNavigation(lines: string[], width: number): void {
		const tabs = VIEW_MODES.map(({ mode, label }, index) => {
			const entry = `${index + 1} ${label}`
			return mode === this.viewMode ? `[${entry}]` : entry
		})
		const rows = this.wrapItems(tabs, width - 4, "  ")
		this.navigationRows = rows.length
		for (const row of rows) lines.push(this.formatLine(` ${row}`, width))
	}

	private renderSearchStatus(lines: string[], tasks: readonly SwarmTaskManifest[], width: number): void {
		const label = this.searchActive ? "Search tasks" : `Search: ${this.searchQuery}`
		lines.push(this.formatLine(` ${label} · ${tasks.length} match${tasks.length === 1 ? "" : "es"}`, width))
		if (this.searchActive) {
			this.searchInput.focused = this.focused
			const [input] = this.searchInput.render(Math.max(1, width - 4))
			lines.push(this.formatLine(` ${input}`, width, true))
		}
	}

	private getFilteredTasks(): readonly SwarmTaskManifest[] {
		const filter = STATUS_FILTERS[this.filterIndex]!
		const terms = this.searchQuery.toLocaleLowerCase().split(/\s+/).filter(Boolean)
		const outcomesByTaskId = new Map<string, { summary: string; error?: string }>()
		for (const outcome of terms.length
			? this.delegator.getSubstrate().getOutcomes(undefined, Number.POSITIVE_INFINITY)
			: []) {
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
		const searchRows = this.searchActive ? 2 : this.searchQuery ? 1 : 0
		const footerRows = this.getFooter(width).length
		const chromeRows = 7 + this.summaryRows + this.navigationRows + searchRows + footerRows + (this.statusMessage ? 1 : 0)
		return Math.max(1, this.viewportRows() - chromeRows)
	}

	private getFooter(width: number): string[] {
		const isTasksView = this.viewMode === "tasks"
		const movementHint = isTasksView ? "[↑↓] Move" : "[↑↓] Scroll"
		if (this.abortConfirmationTaskId) {
			return [width < 40 ? " [y] Stop · [n/Esc] Back" : " [y/Enter] Stop · [n/Esc] Back"]
		}
		if (this.detailTaskId) {
			return this.footerLines(["[↑↓] Scroll · [PgUp/Dn] Page", "[Home/End] Jump · [a] Stop · [Esc] Back"], width)
		}
		if (this.searchActive) {
			return this.footerLines(["[Enter] Apply · [Esc] Cancel"], width)
		}
		if (this.showHelp) {
			return this.footerLines(
				[
					"[Tab/Shift+Tab] Views · [1–6] Jump to view",
					"[↑↓/j/k] Move · [PgUp/Dn] Page · [Home/End/g/G] First/last",
					"[/] Search · [f] Status filter · [0] Clear filters",
					"[Enter] Inspect · [a] Stop queued/running task",
					"[?] Hide keys · [q/Esc] Close",
				],
				width,
			)
		}
		return this.footerLines(
			width < 48
				? [`${movementHint} · [Enter] Open`, "[Tab] Views · [/] Find", "[a] Stop · [f] Filter", "[?] Keys · [Esc] Close"]
				: [
						`[Tab] Views · [/] Search · [f] Filter · [0] Clear`,
						`${movementHint}${isTasksView ? " · [Enter] Inspect · [a] Stop" : " · [PgUp/Dn] Page"} · [?] Keys · [Esc] Close`,
					],
			width,
		)
	}

	private footerLines(content: readonly string[], width: number): string[] {
		return content.flatMap((line) => this.wrapItems(line.split(" · "), width - 4, " · ").map((row) => ` ${row}`))
	}

	/** Keep each count/label, tab, and keyboard shortcut together when space allows. */
	private wrapItems(items: readonly string[], width: number, separator: string): string[] {
		const rows: string[] = []
		let row = ""
		for (const item of items) {
			const next = row ? `${row}${separator}${item}` : item
			if (row && visibleWidth(next) > width) {
				rows.push(...this.wrapText(row, width))
				row = item
			} else row = next
		}
		if (row) rows.push(...this.wrapText(row, width))
		return rows
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

	private statusLabel(status: SwarmTaskStatus): string {
		return status === "pending" ? "Queued" : status === "aborted" ? "Cancelled" : status[0]!.toUpperCase() + status.slice(1)
	}

	private formatTimestamp(timestamp?: number): string {
		if (!timestamp) return "unknown"
		return new Date(timestamp).toLocaleString()
	}

	private wrapText(value: string, width: number): string[] {
		return wrapTextWithAnsi(safeTaskText(value), Math.max(1, width))
	}

	private formatLine(content: string, width: number, trustedInput = false): string {
		if (!trustedInput) content = safeTaskText(content).replace(/\s/g, " ")
		const contentWidth = Math.max(0, width - 2)
		const clipped =
			visibleWidth(content) > contentWidth ? `${sliceByColumn(content, 0, Math.max(0, contentWidth - 1))}…` : content
		const padding = Math.max(0, contentWidth - visibleWidth(clipped))
		return `│${clipped}${" ".repeat(padding)}│`
	}
}
