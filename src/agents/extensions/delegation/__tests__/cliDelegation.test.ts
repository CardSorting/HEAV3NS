import { strict as assert } from "node:assert"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, describe, it } from "mocha"
import sinon from "sinon"
import type { EngineTickResult } from "../../../../core/contracts/agent.contracts"
import type { SwarmTaskManifest } from "../../../../core/contracts/delegation.contracts"
import type { ToolDefinition } from "../../../../core/contracts/tooling.contracts"
import { SubagentVfsBrancher } from "../../../../sessions/extensions/delegation/subagent-vfs-brancher"
import { SessionVfs } from "../../../../sessions/extensions/vfs/session-vfs"
import { SwarmToolSuite } from "../../../../tooling/extensions/delegation/swarm-tool-suite"
import type { ValidatingToolRegistry } from "../../../../tooling/extensions/registry/tool-registry"
import { AgentConfig } from "../../../base/agent-config"
import { ContextBudgetCalculator } from "../../compaction/context-budget-calculator"
import { TokenTruncator } from "../../compaction/token-truncator"
import { AgentEngine } from "../../execution/agent-engine"
import { ModelCatalog } from "../../resolution/model-catalog"
import { CliSubagentRunner } from "../cli-subagent-runner"
import { MonolithSwarmDelegator } from "../monolith-swarm-delegator"
import type { SwarmChildRunResult } from "../monolith-swarm-delegator"

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

async function settlesPromptly<T>(promise: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error("Parent flow did not settle after cancellation or timeout.")), 250)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

function task(id = "task-1"): SwarmTaskManifest {
	return {
		id,
		goal: "Implement the requested change",
		context: "Preserve unrelated work",
		depth: 0,
		allowedTools: ["*"],
		blockedTools: [],
		budget: {
			maxIterations: 100,
			remainingIterations: 100,
			maxTokens: 120_000,
			remainingTokens: 120_000,
			maxWallClockMs: 300_000,
		},
		status: "pending",
		createdTick: 0,
	}
}

function finished(): EngineTickResult {
	return {
		frameIndex: 1,
		outcome: "completed",
		activeModel: "test-model",
		isFallbackModel: false,
		composedPrompt: "test prompt",
		response: "Implemented the staged change; parent must apply it and run tests.",
		toolResults: [],
		durationMs: 1,
	}
}

describe("CLI delegation autonomy", () => {
	let tempDir: string | undefined

	afterEach(async () => {
		sinon.restore()
		if (tempDir) await fs.rm(tempDir, { recursive: true, force: true })
		tempDir = undefined
	})

	it("preserves the parent's larger explicit budgets and complete reconciliation evidence", async () => {
		const delegator = new MonolithSwarmDelegator()
		const evidence = `${"Observed evidence. ".repeat(1500)}FINAL RECONCILIATION FINDING`
		let received: SwarmTaskManifest | undefined
		delegator.setChildRunner(
			async (manifest) => {
				received = manifest
				return { result: evidence, tokenUsage: 500, toolCallsCount: 70 }
			},
			["view_file", "write_file"],
		)

		const manifest = task()
		const outcome = await delegator.delegateTask(manifest)

		assert.equal(outcome.success, true)
		assert.deepEqual(received?.budget, manifest.budget)
		assert.deepEqual(outcome.output, { result: evidence })
	})

	it("retains explicit tool denials while reconciling the allowed child toolset", async () => {
		const delegator = new MonolithSwarmDelegator()
		let receivedTools: readonly string[] = []
		delegator.setChildRunner(
			async (manifest) => {
				receivedTools = manifest.allowedTools
				return { result: "Read-only evidence", tokenUsage: 20, toolCallsCount: 1 }
			},
			["view_file", "write_file"],
		)

		const outcome = await delegator.delegateTask({ ...task(), blockedTools: ["write_file"] })

		assert.equal(outcome.success, true)
		assert.deepEqual(receivedTools, ["view_file"])
	})

	it("passes explicit single and batch time, iteration, and token budgets through the tool", async () => {
		const delegator = new MonolithSwarmDelegator()
		const received: SwarmTaskManifest[] = []
		delegator.setChildRunner(
			async (manifest) => {
				received.push(manifest)
				return { result: "Done", tokenUsage: 20, toolCallsCount: 1 }
			},
			["view_file"],
		)
		const suite = new SwarmToolSuite(delegator)
		const budgets = { maxIterations: 75, maxTokens: 90_000, maxWallClockMs: 600_000 }

		assert.equal((await suite.executeTool("delegate_task", { id: "single", goal: "Inspect", ...budgets })).success, true)
		assert.equal(
			(await suite.executeTool("delegate_batch", { tasks: JSON.stringify([{ id: "batch", goal: "Inspect", ...budgets }]) }))
				.success,
			true,
		)
		assert.equal(received.length, 2)
		for (const manifest of received) {
			assert.deepEqual(manifest.budget, {
				...budgets,
				remainingIterations: budgets.maxIterations,
				remainingTokens: budgets.maxTokens,
			})
		}
		assert.ok(suite.getTools().find((tool) => tool.name === "delegate_task")?.parameters?.maxWallClockMs)
	})

	it("does not replace an explicitly exhausted budget with a default grant", async () => {
		const delegator = new MonolithSwarmDelegator()
		const runner = sinon.stub().resolves({ result: "Should not run", tokenUsage: 0, toolCallsCount: 0 })
		delegator.setChildRunner(runner, ["view_file"])
		const result = await new SwarmToolSuite(delegator).executeTool("delegate_task", {
			id: "empty-budget",
			goal: "Inspect",
			maxTokens: 0,
		})

		assert.equal(result.success, false)
		assert.equal(runner.callCount, 0)
	})

	it("releases saturated child slots on parent cancellation even if children ignore their signal", async () => {
		const delegator = new MonolithSwarmDelegator()
		const late = deferred<SwarmChildRunResult>()
		const started = Array.from({ length: 4 }, () => deferred<void>())
		const controller = new AbortController()
		delegator.setChildRunner(
			async (manifest) => {
				if (manifest.id.startsWith("stalled-")) {
					started[Number(manifest.id.slice("stalled-".length))].resolve()
					return late.promise
				}
				return { result: "Queued child completed", tokenUsage: 1, toolCallsCount: 1 }
			},
			["view_file"],
		)
		const stalled = started.map((_entry, index) => delegator.delegateTask(task(`stalled-${index}`), controller.signal))
		await Promise.all(started.map((entry) => entry.promise))
		const queued = delegator.delegateTask(task("queued"))
		assert.equal(delegator.getTaskStatus("queued"), "pending")
		controller.abort()
		try {
			const outcomes = await settlesPromptly(Promise.all([...stalled, queued]))
			assert.ok(outcomes.slice(0, 4).every((outcome) => !outcome.success))
			assert.equal(outcomes[4].success, true)
			late.resolve({ result: "Too late", tokenUsage: 1, toolCallsCount: 1, filesModified: ["late.ts"] })
			await new Promise((resolve) => setImmediate(resolve))
			assert.equal(delegator.getTaskStatus("stalled-0"), "aborted")
			assert.equal(delegator.getTaskOutcome("stalled-0")?.success, false)
			assert.deepEqual(delegator.getTaskOutcome("stalled-0")?.filesModified, [])
		} finally {
			late.resolve({ result: "cleanup", tokenUsage: 0, toolCallsCount: 0 })
			await Promise.all([...stalled, queued])
		}
	})

	it("settles a timed-out signal-ignoring child and ignores its late rejection", async () => {
		const delegator = new MonolithSwarmDelegator()
		const late = deferred<SwarmChildRunResult>()
		delegator.setChildRunner(() => late.promise, ["view_file"])
		const manifest = task("timeout")
		const pending = delegator.delegateTask({ ...manifest, budget: { ...manifest.budget, maxWallClockMs: 15 } })
		try {
			const outcome = await settlesPromptly(pending)
			assert.equal(outcome.success, false)
			assert.match(outcome.error ?? "", /timed out|timeout|wall.clock/i)
			assert.equal(delegator.getTaskStatus("timeout"), "failed")
			late.reject(new Error("Late provider rejection"))
			await new Promise((resolve) => setImmediate(resolve))
			assert.deepEqual(delegator.getTaskOutcome("timeout"), outcome)
		} finally {
			late.resolve({ result: "cleanup", tokenUsage: 0, toolCallsCount: 0 })
			await pending
		}
	})

	async function childFixture() {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "heav3ns-cli-delegation-"))
		const parentVfs = new SessionVfs()
		const brancher = new SubagentVfsBrancher()
		brancher.registerParentVfs("parent", parentVfs)
		const write: ToolDefinition = {
			name: "write_file",
			description: "Write a file",
			isMutating: true,
			parameters: { path: { type: "string" }, content: { type: "string" } },
			execute: async () => {
				throw new Error("Child writes must use the staged VFS")
			},
		}
		const registry = {
			listTools: () => [write],
			getTool: (name: string) => (name === write.name ? write : undefined),
			normalizeToolArgs: (args: Record<string, unknown>) => args,
			validateToolArgs: () => ({ valid: true, errors: [] }),
		} as unknown as ValidatingToolRegistry
		const config = AgentConfig.createDefault()
		const runner = new CliSubagentRunner({
			config,
			workspaceRoot: tempDir,
			toolRegistry: registry,
			modelCatalog: new ModelCatalog(),
			budgetCalculator: new ContextBudgetCalculator(),
			tokenTruncator: new TokenTruncator(),
			parentSessionId: "parent",
			vfsBrancher: brancher,
		})
		return { runner, brancher, parentVfs, config, workspaceRoot: tempDir }
	}

	it("runs implementation guidance and automatically reconciles staged changes without reaching disk", async () => {
		const fixture = await childFixture()
		const goalTail = "IMPORTANT GOAL TAIL"
		const manifest = { ...task(), goal: `${"requested scope ".repeat(1000)}${goalTail}` }
		sinon.stub(AgentEngine.prototype, "tick").callsFake(async function (this: AgentEngine, input) {
			const runtime = this as unknown as {
				toolRegistry: ValidatingToolRegistry
				runtimeMaxOutputTokens: number
				runtimeMaxToolRounds: number
			}
			const prompt = this.promptComposer.composeSystemPrompt(fixture.config)
			assert.match(prompt, /delegated analysis and implementation agent/)
			assert.match(prompt, /not a request for human approval/)
			assert.match(prompt, /never repeat an identical failed action blindly/)
			assert.ok(input.prompt?.includes(goalTail))
			assert.equal(runtime.runtimeMaxOutputTokens, 120_000)
			assert.equal(runtime.runtimeMaxToolRounds, 100)
			await runtime.toolRegistry.executeTool(
				"write_file",
				{ path: "main.ts", content: "export const implemented = true" },
				"",
			)
			return finished()
		})

		const result = await fixture.runner.run(manifest, new AbortController().signal)

		assert.deepEqual(result.filesModified, ["main.ts"])
		assert.equal(
			fixture.parentVfs.getFile(path.join(fixture.workspaceRoot, "main.ts"))?.content,
			"export const implemented = true",
		)
		await assert.rejects(fs.stat(path.join(fixture.workspaceRoot, "main.ts")), { code: "ENOENT" })
		assert.equal(fixture.brancher.getActiveOverlayCount(), 0)
	})

	it("returns a conflicting staged edit for parent repair without overwriting a newer parent change", async () => {
		const fixture = await childFixture()
		const targetPath = path.join(fixture.workspaceRoot, "main.ts")
		sinon.stub(AgentEngine.prototype, "tick").callsFake(async function (this: AgentEngine) {
			const runtime = this as unknown as { toolRegistry: ValidatingToolRegistry }
			await runtime.toolRegistry.executeTool("write_file", { path: "main.ts", content: "child version" }, "")
			fixture.parentVfs.stageWrite(targetPath, "newer parent version")
			return finished()
		})

		await assert.rejects(
			fixture.runner.run(task(), new AbortController().signal),
			/parent must reconcile.*child edits were not applied/,
		)
		assert.equal(fixture.parentVfs.getFile(targetPath)?.content, "newer parent version")
		assert.equal(fixture.brancher.getActiveOverlayCount(), 0)
	})

	it("honors cancellation before staged edits reach the parent", async () => {
		const fixture = await childFixture()
		const controller = new AbortController()
		sinon.stub(AgentEngine.prototype, "tick").callsFake(async function (this: AgentEngine) {
			const runtime = this as unknown as { toolRegistry: ValidatingToolRegistry }
			await runtime.toolRegistry.executeTool("write_file", { path: "main.ts", content: "cancelled version" }, "")
			controller.abort()
			return finished()
		})

		await assert.rejects(fixture.runner.run(task(), controller.signal), { name: "AbortError" })
		assert.equal(fixture.parentVfs.exportStaged().length, 0)
		assert.equal(fixture.brancher.getActiveOverlayCount(), 0)
	})

	it("discards a cancelled child overlay promptly and revokes late provider tool calls", async () => {
		const fixture = await childFixture()
		const controller = new AbortController()
		const started = deferred<ValidatingToolRegistry>()
		const late = deferred<EngineTickResult>()
		sinon.stub(AgentEngine.prototype, "tick").callsFake(async function (this: AgentEngine) {
			const runtime = this as unknown as { toolRegistry: ValidatingToolRegistry }
			await runtime.toolRegistry.executeTool("write_file", { path: "main.ts", content: "staged before cancel" }, "")
			started.resolve(runtime.toolRegistry)
			return late.promise
		})
		const pending = fixture.runner.run(task(), controller.signal)
		const registry = await started.promise
		controller.abort()
		try {
			await assert.rejects(settlesPromptly(pending), { name: "AbortError" })
			assert.equal(fixture.brancher.getActiveOverlayCount(), 0)
			await assert.rejects(registry.executeTool("write_file", { path: "main.ts", content: "late write" }, ""), {
				name: "AbortError",
			})
			late.resolve(finished())
			await new Promise((resolve) => setImmediate(resolve))
			assert.equal(fixture.parentVfs.exportStaged().length, 0)
		} finally {
			late.resolve(finished())
			await pending.catch(() => undefined)
		}
	})

	it("returns failed child diagnostics to the parent instead of replacing them with a generic failure", async () => {
		const fixture = await childFixture()
		sinon.stub(AgentEngine.prototype, "tick").resolves({
			...finished(),
			outcome: "failed",
			response: "Provider-round budget exhausted after inspecting src/auth.ts; staged edits were not verified.",
		})

		await assert.rejects(
			fixture.runner.run(task(), new AbortController().signal),
			/budget exhausted after inspecting src\/auth.ts/,
		)
		assert.equal(fixture.parentVfs.exportStaged().length, 0)
		assert.equal(fixture.brancher.getActiveOverlayCount(), 0)
	})
})
