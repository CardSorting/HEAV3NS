import assert from "node:assert/strict"
import sinon from "sinon"
import type { EngineTickInput, EngineTickResult } from "../../../../core/contracts/agent.contracts.js"
import type { SwarmTaskManifest } from "../../../../core/contracts/delegation.contracts.js"
import type { LumiMonolith } from "../../../../index.js"
import { SessionContext } from "../../../../sessions/base/session-context.js"
import { SessionMemoryStore } from "../../../../sessions/extensions/memory/session-memory-store.js"
import { Editor } from "../../../../tui/components/editor.js"
import { SwarmDashboardModal } from "../../../../tui/components/swarm-dashboard-modal.js"
import { ProcessTerminal } from "../../../../tui/terminal.js"
import { TuiAltScreen } from "../../../../tui/tui-alt-screen.js"
import type { OverlayHandle } from "../../../../tui/tui.js"
import { stripTerminalSequences } from "../../../../tui/utils.js"
import { AgentConfig } from "../../../base/agent-config.js"
import { MonolithSwarmDelegator } from "../../delegation/monolith-swarm-delegator.js"
import { InteractiveModeController } from "../interactive-mode-controller.js"

const flushInput = () => new Promise<void>((resolve) => setImmediate(resolve))

function task(id: string): SwarmTaskManifest {
	return {
		id,
		goal: `Inspect ${id}`,
		context: "Return evidence to the parent",
		depth: 1,
		parentTaskId: "parent-task",
		allowedTools: ["view_file"],
		blockedTools: [],
		budget: { maxIterations: 30, remainingIterations: 20, maxTokens: 10000, remainingTokens: 8000, maxWallClockMs: 60000 },
		status: "running",
		createdTick: 1,
		createdAtMs: 1,
		updatedAtMs: 1,
	}
}

async function startSession() {
	const sandbox = sinon.createSandbox()
	const ttyDescriptors = [process.stdin, process.stdout].map((stream) => ({
		stream,
		descriptor: Object.getOwnPropertyDescriptor(stream, "isTTY"),
	}))
	for (const { stream } of ttyDescriptors) Object.defineProperty(stream, "isTTY", { configurable: true, value: true })
	let input: ((data: string) => void) | undefined
	// Keep the real TUI and controller input routing; replace only terminal I/O.
	sandbox.stub(ProcessTerminal.prototype, "start").callsFake((onInput) => {
		input = onInput
	})
	for (const method of [
		"stop",
		"write",
		"hideCursor",
		"showCursor",
		"moveBy",
		"clearLine",
		"clearFromCursor",
		"clearScreen",
		"setTitle",
		"setProgress",
	] as const) {
		sandbox.stub(ProcessTerminal.prototype, method)
	}
	sandbox.stub(ProcessTerminal.prototype, "columns").get(() => 110)
	sandbox.stub(ProcessTerminal.prototype, "rows").get(() => 38)
	const focus = sandbox.spy(TuiAltScreen.prototype, "setFocus")
	const overlays = sandbox.spy(TuiAltScreen.prototype, "showOverlay")
	const delegator = new MonolithSwarmDelegator()
	delegator.getSubstrate().storeTask(task("worker-one"))
	delegator.getSubstrate().storeTask(task("worker-two"))
	let resolveTurn: (result: EngineTickResult) => void = () => undefined
	const turn = new Promise<EngineTickResult>((resolve) => {
		resolveTurn = resolve
	})
	const tick = sandbox.stub<[EngineTickInput], Promise<EngineTickResult>>().returns(turn)
	const config = AgentConfig.createDefault()
	const monolith = {
		config,
		sessionContext: new SessionContext({ sessionId: "interactive-monitor-test", cwd: process.cwd() }),
		sessionMemoryStore: new SessionMemoryStore(),
		setupWizard: { getWhoAmI: () => ({ authenticated: false, configuredProviders: [] }) },
		monolithSwarmDelegator: delegator,
		tick,
	} as unknown as LumiMonolith
	const session = new InteractiveModeController().startInteractiveSession(monolith)
	const send = async (data: string) => {
		assert.ok(input, "ProcessTerminal.start must install the real TUI input handler")
		input(data)
		await flushInput()
	}
	const submit = async (text: string) => {
		await send(`\x1b[200~${text}\x1b[201~`)
		await send("\r")
	}
	const finishTurn = async (outcome: EngineTickResult["outcome"] = "completed") => {
		resolveTurn({
			frameIndex: 1,
			outcome,
			activeModel: config.modelName,
			isFallbackModel: false,
			composedPrompt: "Inspect the project",
			response: outcome === "cancelled" ? "Turn cancelled." : "Requested result verified.",
			toolResults: [],
		})
		await flushInput()
	}
	const latestMonitor = () => {
		const call = overlays.lastCall
		assert.ok(call, "The monitor must open through the TUI overlay path")
		assert.ok(call.args[0] instanceof SwarmDashboardModal)
		return {
			modal: call.args[0],
			handle: call.returnValue as OverlayHandle,
			text: () => stripTerminalSequences(call.args[0].render(110).join("\n")),
		}
	}
	return {
		tick,
		focus,
		overlays,
		delegator,
		send,
		submit,
		finishTurn,
		latestMonitor,
		editor: focus.firstCall.args[0] as Editor,
		async close() {
			try {
				await finishTurn()
				for (let i = 0; i < 3; i++) await send("\x1b")
				await send("\x03")
				await send("\x03")
				await session
			} finally {
				sandbox.restore()
				for (const { stream, descriptor } of ttyDescriptors) {
					if (descriptor) Object.defineProperty(stream, "isTTY", descriptor)
					else Reflect.deleteProperty(stream, "isTTY")
				}
			}
		},
	}
}

describe("Interactive agent monitor routing", () => {
	it("opens every monitor alias during a turn and preserves nested Escape navigation and focus through completion", async () => {
		const session = await startSession()
		try {
			await session.submit("Inspect the project")
			assert.equal(session.tick.callCount, 1)
			const parent = session.tick.firstCall.args[0]
			assert.ok(parent.signal)
			await session.submit("/agents")
			const monitor = session.latestMonitor()
			assert.equal(monitor.handle.isFocused(), true)
			assert.equal(session.editor.focused, false)
			assert.match(monitor.text(), /Inspect worker-one/)

			await session.send("/")
			await session.send("\x1b[200~not-a-task\x1b[201~")
			assert.match(monitor.text(), /No tasks match/)
			await session.send("\x1b")
			assert.match(monitor.text(), /Inspect worker-one/)
			assert.equal(monitor.handle.isFocused(), true)
			assert.equal(parent.signal.aborted, false)
			await session.send("\r")
			assert.match(monitor.text(), /Task: worker-one/)
			await session.send("\x1b")
			assert.doesNotMatch(monitor.text(), /Task: worker-one/)
			assert.equal(monitor.handle.isFocused(), true)
			assert.equal(parent.signal.aborted, false)
			await session.send("\x1b")
			assert.equal(monitor.handle.isFocused(), false)
			assert.equal(session.editor.focused, true)
			assert.equal(parent.signal.aborted, false)

			await session.submit("/subagents")
			assert.equal(session.latestMonitor().handle.isFocused(), true)
			await session.send("\x1b")
			await session.submit("/swarm")
			const finalMonitor = session.latestMonitor()
			assert.equal(session.overlays.callCount, 3)
			assert.equal(session.tick.callCount, 1, "Monitor aliases must not start another model turn")
			await session.send("\r")
			assert.match(finalMonitor.text(), /Task: worker-one/)
			await session.finishTurn()
			assert.equal(parent.signal.aborted, false)
			assert.equal(finalMonitor.handle.isFocused(), true, "Parent completion must not steal monitor focus")
			assert.equal(session.focus.lastCall.args[0], finalMonitor.modal)
			assert.match(finalMonitor.text(), /Task: worker-one/)
			await session.send("\x1b")
			assert.equal(finalMonitor.handle.isFocused(), true)
			await session.send("\x1b")
			assert.equal(finalMonitor.handle.isFocused(), false)
			assert.equal(session.editor.focused, true)
			assert.equal(session.focus.lastCall.args[0], session.editor)
		} finally {
			await session.close()
		}
	})

	it("keeps Ctrl+C as parent cancellation while the task monitor owns focus", async () => {
		const session = await startSession()
		try {
			await session.submit("Inspect the project")
			const parent = session.tick.firstCall.args[0]
			assert.ok(parent.signal)
			await session.submit("/agents")
			const monitor = session.latestMonitor()
			await session.send("\r")
			assert.equal(monitor.handle.isFocused(), true)
			await session.send("\x03")
			assert.equal(parent.signal.aborted, true)
			assert.match(String(parent.signal.reason), /Cancelled by user/)
			assert.equal(monitor.handle.isFocused(), true, "Cancellation must not dismiss the task evidence")
			assert.equal(session.tick.callCount, 1)
			await session.finishTurn("cancelled")
			assert.equal(monitor.handle.isFocused(), true)
			await session.send("\x1b")
			await session.send("\x1b")
			assert.equal(session.editor.focused, true)
		} finally {
			await session.close()
		}
	})
})
