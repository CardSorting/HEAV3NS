import assert from "node:assert/strict"
import { describe, it } from "mocha"
import { MonolithSwarmDelegator } from "../../../agents/extensions/delegation/monolith-swarm-delegator"
import type { SwarmTaskManifest } from "../../../core/contracts/delegation.contracts"
import { stripTerminalSequences, visibleWidth } from "../../utils"
import { SwarmDashboardModal } from "../swarm-dashboard-modal"

function task(id: string, updatedAtMs: number, overrides: Partial<SwarmTaskManifest> = {}): SwarmTaskManifest {
	return {
		id,
		goal: `Investigate ${id}`,
		context: "",
		depth: 0,
		allowedTools: ["view_file"],
		blockedTools: [],
		budget: { maxIterations: 30, remainingIterations: 20, maxTokens: 10000, remainingTokens: 8000, maxWallClockMs: 60000 },
		status: "running",
		createdTick: 0,
		createdAtMs: 1,
		updatedAtMs,
		...overrides,
	}
}

function fixture(tasks: SwarmTaskManifest[]) {
	const delegator = new MonolithSwarmDelegator()
	for (const task of tasks) delegator.getSubstrate().storeTask(task)
	let closed = false
	const modal = new SwarmDashboardModal(delegator, () => {
		closed = true
	})
	const text = (width = 80) => stripTerminalSequences(modal.render(width).join("\n"))
	return { delegator, modal, text, isClosed: () => closed }
}

describe("Agent task browser ergonomics", () => {
	it("keeps selection on the same task when live updates reorder rows", () => {
		const { delegator, modal, text } = fixture([task("focused", 20), task("other", 10)])
		text()
		delegator.getSubstrate().storeTask(task("other", 30))
		modal.handleInput("\r")
		assert.match(text(), /Task: focused/)
	})

	it("can stop queued work without touching another running task", () => {
		const { delegator, modal, text } = fixture([task("queued", 20, { status: "pending" }), task("running", 10)])
		text()
		modal.handleInput("a")
		modal.handleInput("y")
		assert.equal(delegator.getTask("queued")?.status, "aborted")
		assert.equal(delegator.getTask("running")?.status, "running")
	})

	it("supports pasted Unicode search and deletes a complete grapheme", () => {
		const { modal, text, isClosed } = fixture([task("unicode", 20, { goal: "Inspect 東京 👩🏽‍💻" }), task("other", 10)])
		modal.handleInput("/")
		modal.handleInput("\x1b[200~東京 👩🏽‍💻\x1b[201~")
		assert.match(text(), /1 match/)
		assert.doesNotMatch(text(), /Investigate other/)
		modal.handleInput("\x7f")
		const searchLine =
			text()
				.split("\n")
				.find((line) => line.includes("> ")) ?? ""
		assert.match(searchLine, /東京/)
		assert.doesNotMatch(searchLine, /👩|🏽|💻|\u200d|�/)
		modal.handleInput("\x1b")
		assert.equal(isClosed(), false)
		assert.match(text(), /Investigate other/)
	})

	it("retains the tail of long unbroken evidence and supports End navigation", () => {
		const { delegator, modal, text } = fixture([task("evidence", 1)])
		delegator.getSubstrate().recordOutcome({
			taskId: "evidence",
			success: false,
			summary: "Verification failed",
			error: `${"path/".repeat(120)}IMPORTANT-TAIL`,
			toolCallsCount: 1,
			tokenUsage: 10,
			durationMs: 1,
			filesModified: [],
			auditedBy: "test",
		})
		modal.handleInput("\r")
		const pages = [text(48)]
		for (let i = 0; i < 40; i++) {
			modal.handleInput("\x1b[6~")
			pages.push(text(48))
		}
		assert.match(pages.join("\n"), /IMPORTANT-TAIL/)
		modal.handleInput("\x1b[F")
		assert.match(text(48), /Blocked tools: none/)
	})

	it("does not emit terminal control sequences supplied by a task", () => {
		const { modal } = fixture([task("unsafe", 1, { goal: "visible\x1b[2J\x1b]52;c;c2VjcmV0\x07\rrewritten" })])
		const output = modal.render(80).join("\n")
		assert.doesNotMatch(output, /\x1b\[2J|\x1b\]52|\r/)
		assert.match(output, /visible/)
	})

	it("pages through a large list with familiar keys without exceeding terminal width", () => {
		const { modal, text } = fixture(Array.from({ length: 100 }, (_, i) => task(`worker-${String(i).padStart(3, "0")}`, i)))
		text()
		modal.handleInput("\x1b[F")
		modal.handleInput("\r")
		assert.match(text(), /Task: worker-000/)
		for (const width of [24, 40, 80, 120]) {
			for (const line of modal.render(width)) assert.ok(visibleWidth(line) <= width, `${width}: ${line}`)
		}
	})

	it("keeps controls and content inside a 24-row viewport across views and narrow widths", () => {
		for (const width of [40, 80, 120]) {
			const { modal } = fixture(Array.from({ length: 100 }, (_, i) => task(`worker-${i}`, i)))
			const fits = () => {
				const lines = modal.render(width)
				assert.ok(lines.length <= 24, `${width} columns: ${lines.length} rows\n${lines.join("\n")}`)
				assert.ok(lines.every((line) => visibleWidth(line) <= width))
			}
			for (const view of ["1", "2", "3", "4", "5", "6"]) {
				modal.handleInput(view)
				fits()
			}
			for (const key of ["1", "?", "?", "/", "missing", "\x1b", "\r", "a", "n", "\x1b"]) {
				modal.handleInput(key)
				fits()
			}
		}
	})

	it("searches all retained outcomes instead of only the default recent page", () => {
		const { delegator, modal, text } = fixture([task("older", 1), task("newer", 2)])
		for (let i = 0; i < 200; i++) {
			delegator.getSubstrate().recordOutcome({
				taskId: i === 0 ? "older" : "newer",
				success: true,
				summary: i === 0 ? "needle-evidence" : "new result",
				toolCallsCount: 1,
				tokenUsage: 10,
				durationMs: 1,
				filesModified: [],
				auditedBy: "test",
			})
		}
		modal.handleInput("/")
		modal.handleInput("needle-evidence")
		assert.match(text(), /1 match/)
		assert.match(text(), /Investigate older/)
	})
})
