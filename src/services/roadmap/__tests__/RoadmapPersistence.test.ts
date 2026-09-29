import { strict as assert } from "node:assert"
import { execFile } from "node:child_process"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { promisify } from "node:util"
import sinon from "sinon"
import { governedLockPath } from "../../../shared/governance/fileLock"
import { evaluateRoadmapCompletionBlock } from "../RoadmapCompletionGate"
import { DEFAULT_ROADMAP_CONFIG, setRoadmapConfigOverride } from "../RoadmapConfig"
import { withRoadmapMutation, writeRoadmapFileChecked } from "../RoadmapPersistence"
import { bootstrapSkeleton } from "../RoadmapSchema"
import { RoadmapService } from "../RoadmapService"
import { sessionBrief } from "../RoadmapSession"

describe("Roadmap persistence under contention", () => {
	let workspace: string
	const service = RoadmapService.getInstance()
	beforeEach(async () => {
		workspace = await fs.mkdtemp(path.join(os.tmpdir(), "roadmap-persistence-"))
		setRoadmapConfigOverride({ ...DEFAULT_ROADMAP_CONFIG, enabled: true })
	})
	afterEach(async () => {
		sinon.restore()
		setRoadmapConfigOverride(null)
		await fs.rm(workspace, { recursive: true, force: true })
	})
	for (const operationFails of [false, true]) {
		it(`reports lock-release failure without masking an operation error (operation fails: ${operationFails})`, async () => {
			await assert.rejects(
				withRoadmapMutation(workspace, async () => {
					const lockPath = governedLockPath(await fs.realpath(workspace), "roadmap:persistence")
					const lock = JSON.parse(await fs.readFile(lockPath, "utf8"))
					await fs.writeFile(lockPath, JSON.stringify({ ...lock, ownerId: "changed-owner" }))
					if (operationFails) throw new Error("original operation failed")
				}),
				operationFails ? /original operation failed/ : /could not be released/,
			)
		})
	}

	it("preserves independent patches during concurrent state writes", async () => {
		await Promise.all(Array.from({ length: 24 }, (_, i) => service.writeState(workspace, { [`field_${i}`]: i })))
		const state = await service.readState(workspace)
		for (let i = 0; i < 24; i++) assert.equal(state[`field_${i}`], i)
		assert.deepEqual(
			(await fs.readdir(path.join(workspace, ".dietcode"))).filter((name) => name.endsWith(".tmp")),
			[],
		)
	})

	it("preserves concurrent continuation anchors and admits only one lease owner", async () => {
		await fs.writeFile(path.join(workspace, "ROADMAP.md"), bootstrapSkeleton({ project_hint: "Concurrent workspace" }))
		await Promise.all(
			Array.from({ length: 12 }, (_, i) => service.recordContinuationAnchor(workspace, `agent_${i}`, `step_${i}`)),
		)
		const anchors = await service.getContinuationAnchors(workspace)
		assert.equal(Object.keys(anchors).length, 12)
		const leases = await Promise.all(
			["a", "b", "c"].map((agent) => service.acquireOrchestrationLease(workspace, agent, "same-task")),
		)
		assert.equal(leases.filter((lease) => lease.success).length, 1)
	})

	it("serializes state updates from separate processes", async function () {
		this.timeout(30_000)
		const script = `import { RoadmapService } from './src/services/roadmap/RoadmapService.ts';
const service = RoadmapService.getInstance();
for (let i = 0; i < 5; i++) await service.writeState(process.env.ROADMAP_TEST_WORKSPACE, { [process.env.ROADMAP_TEST_WRITER + i]: i });`
		await Promise.all(
			["a", "b"].map((writer) =>
				promisify(execFile)(
					process.execPath,
					["--import", "tsx", "--import", "./src/test/register-vscode-mock.mjs", "--input-type=module", "-e", script],
					{
						cwd: process.cwd(),
						env: { ...process.env, ROADMAP_TEST_WORKSPACE: workspace, ROADMAP_TEST_WRITER: writer },
					},
				),
			),
		)
		const state = await service.readState(workspace)
		for (const writer of ["a", "b"]) for (let i = 0; i < 5; i++) assert.equal(state[writer + i], i)
	})

	it("rejects corrupt state without overwriting recovery evidence", async () => {
		const statePath = service.getStatePath(workspace)
		await fs.mkdir(path.dirname(statePath), { recursive: true })
		await fs.writeFile(statePath, "{unfinished")
		await assert.rejects(service.writeState(workspace, { schema_valid: true }))
		assert.equal(await fs.readFile(statePath, "utf8"), "{unfinished")
		assert.equal((await evaluateRoadmapCompletionBlock(workspace)).blocked, true)
	})

	it("does not reuse gate snapshots after an external state or policy change", async () => {
		await fs.writeFile(path.join(workspace, "ROADMAP.md"), bootstrapSkeleton({ project_hint: "Snapshot freshness" }))
		setRoadmapConfigOverride({ ...DEFAULT_ROADMAP_CONFIG, block_kanban_on_bootstrap_incomplete: false })
		await service.validateRoadmap(workspace)
		const before = await service.getOperationalStatus(workspace, "", "light")
		assert.equal(before.kanban_complete_allowed, true)
		const state = await service.readState(workspace)
		await fs.writeFile(service.getStatePath(workspace), JSON.stringify({ ...state, validation_pending: true }))
		const after = await service.getOperationalStatus(workspace, "", "light")
		assert.equal(after.kanban_complete_allowed, false)
		setRoadmapConfigOverride({
			...DEFAULT_ROADMAP_CONFIG,
			block_kanban_on_bootstrap_incomplete: false,
			block_kanban_on_validation_pending: false,
		})
		assert.equal((await service.getOperationalStatus(workspace, "", "light")).kanban_complete_allowed, true)
	})

	it("detects same-mtime document edits through the public status API", async () => {
		const roadmapPath = path.join(workspace, "ROADMAP.md")
		await fs.writeFile(roadmapPath, bootstrapSkeleton({ project_hint: "Same timestamp" }))
		const fixed = new Date("2026-01-01T00:00:00Z")
		await fs.utimes(roadmapPath, fixed, fixed)
		assert.equal((await service.getOperationalStatus(workspace, "", "light")).schema_valid, true)
		await fs.writeFile(roadmapPath, "# Invalid replacement")
		await fs.utimes(roadmapPath, fixed, fixed)
		assert.equal((await service.getOperationalStatus(workspace, "", "light")).schema_valid, false)
	})

	it("protects retained validation results and operational state from caller mutation", async () => {
		await fs.writeFile(path.join(workspace, "ROADMAP.md"), bootstrapSkeleton({ project_hint: "Isolated consumers" }))
		const validation = await service.validateRoadmap(workspace)
		validation.validation.valid = false
		assert.equal((await service.validateRoadmap(workspace)).validation.valid, true)
		const cachedValidation = await service.validateRoadmap(workspace)
		cachedValidation.validation.valid = false
		assert.equal((await service.validateRoadmap(workspace)).validation.valid, true)
		const status = await service.getOperationalStatus(workspace, "", "light")
		const expected = structuredClone(status.runtime_state)
		status.runtime_state.tasks.now.items.push({ title: "Caller injection" })
		assert.deepEqual((await service.getOperationalStatus(workspace, "", "light")).runtime_state, expected)
	})

	it("keeps diagnostic reads free of state writes", async () => {
		await fs.writeFile(
			path.join(workspace, "ROADMAP.md"),
			bootstrapSkeleton({ project_hint: "Read-only preview", now_section: "### 1. Inspect current work\nDo it." }),
		)
		const first = await service.getOperationalStatus(workspace, "", "light")
		const cached = await service.getOperationalStatus(workspace, "", "light")
		assert.deepEqual(cached.runtime_state, first.runtime_state)
		assert.equal((cached.runtime_state as any).tasks.now.items.length, 1)
		await assert.rejects(fs.access(service.getStatePath(workspace)))
	})

	it("refreshes session readiness immediately after external state and policy changes", async () => {
		await fs.writeFile(path.join(workspace, "ROADMAP.md"), bootstrapSkeleton({ project_hint: "Session freshness" }))
		setRoadmapConfigOverride({ ...DEFAULT_ROADMAP_CONFIG, block_kanban_on_bootstrap_incomplete: false })
		await service.validateRoadmap(workspace)
		assert.equal((await sessionBrief(workspace))?.kanban_complete_allowed, true)
		const state = await service.readState(workspace)
		await fs.writeFile(service.getStatePath(workspace), JSON.stringify({ ...state, validation_pending: true }))
		assert.equal((await sessionBrief(workspace))?.kanban_complete_allowed, false)
		setRoadmapConfigOverride({
			...DEFAULT_ROADMAP_CONFIG,
			block_kanban_on_bootstrap_incomplete: false,
			block_kanban_on_validation_pending: false,
		})
		assert.equal((await sessionBrief(workspace))?.kanban_complete_allowed, true)
	})

	it("isolates nested session views from caller mutation and refreshes edited work", async () => {
		const roadmapPath = path.join(workspace, "ROADMAP.md")
		await fs.writeFile(
			roadmapPath,
			bootstrapSkeleton({ project_hint: "Session isolation", now_section: "### 1. Original task\nDo it." }),
		)
		const first = await sessionBrief(workspace)
		assert.ok(first)
		const expected = structuredClone(first.runtime_state)
		const runtime = first.runtime_state as { tasks: { now: { items: unknown[] } } }
		runtime.tasks.now.items.length = 0
		assert.deepEqual((await sessionBrief(workspace))?.runtime_state, expected)
		await fs.writeFile(
			roadmapPath,
			bootstrapSkeleton({ project_hint: "Session isolation", now_section: "### 1. Replacement task\nDo the replacement." }),
		)
		const future = new Date(Date.now() + 2000)
		await fs.utimes(roadmapPath, future, future)
		assert.match(JSON.stringify((await sessionBrief(workspace))?.runtime_state), /Replacement task/)
		await assert.rejects(fs.access(service.getStatePath(workspace)))
	})

	it("revalidates cached results after dependency changes", async () => {
		await fs.writeFile(path.join(workspace, "ROADMAP.md"), bootstrapSkeleton({ project_hint: "Dependency evidence" }))
		await fs.writeFile(path.join(workspace, "package.json"), '{"name":"before"}')
		await service.validateRoadmap(workspace)
		const before = (await service.readState(workspace)).dependency_manifests_hash
		await fs.writeFile(path.join(workspace, "package.json"), '{"name":"after"}')
		await service.validateRoadmap(workspace)
		assert.notEqual((await service.readState(workspace)).dependency_manifests_hash, before)
	})

	it("rejects failed persistence instead of returning a successful state", async () => {
		await fs.mkdir(service.getStatePath(workspace), { recursive: true })
		await assert.rejects(service.writeState(workspace, { schema_valid: true }))
	})

	it("does not swallow a failed autofill write during validation", async () => {
		await fs.writeFile(path.join(workspace, "ROADMAP.md"), bootstrapSkeleton({ project_hint: "Write failure" }))
		sinon.stub(service, "writeBootstrapAutofill").rejects(new Error("disk unavailable"))
		await assert.rejects(service.validateRoadmap(workspace), /disk unavailable/)
		assert.notEqual((await service.readState(workspace)).schema_valid, true)
	})

	it("rejects changed document bases and cleans only its own staging file", async () => {
		const file = path.join(workspace, "ROADMAP.md")
		await fs.writeFile(file, "new external content")
		await assert.rejects(writeRoadmapFileChecked(file, "old replacement", "old content"), /write conflict/)
		assert.equal(await fs.readFile(file, "utf8"), "new external content")
		assert.deepEqual(await fs.readdir(workspace), ["ROADMAP.md"])
	})

	it("never restores a stale backup over a newer edit after remediation conflict", async () => {
		const file = path.join(workspace, "ROADMAP.md")
		const original = bootstrapSkeleton({ project_hint: "Original project" })
		const external = original.replace("Original project", "New external project")
		await fs.writeFile(file, original)
		await service.writeState(workspace, { validation_pending: true })
		const commit = service.commitRoadmapText.bind(service)
		sinon.stub(service, "commitRoadmapText").callsFake(async (ws, content, expected) => {
			await fs.writeFile(file, external)
			await service.writeState(ws, { independent_update: "retained" })
			return commit(ws, content, expected)
		})
		const block = await evaluateRoadmapCompletionBlock(workspace)
		assert.equal(block.blocked, true)
		assert.match(block.message ?? "", /conflict/)
		assert.equal(await fs.readFile(file, "utf8"), external)
		assert.equal((await service.readState(workspace)).independent_update, "retained")
	})
})
