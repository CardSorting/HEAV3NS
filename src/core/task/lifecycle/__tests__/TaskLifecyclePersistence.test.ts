import assert from "node:assert/strict"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, it } from "mocha"
import { destroyDb, getCoordinationRawDb, setDbPath } from "@/infrastructure/db/Config"
import { TaskState } from "../../TaskState"
import { TaskLifecycleFunnel } from "../TaskLifecycleFunnel"
import { BroccoliTaskLifecyclePersistence } from "../TaskLifecyclePersistence"

describe("BroccoliTaskLifecyclePersistence", () => {
	let tempDirectory: string
	let persistence: BroccoliTaskLifecyclePersistence

	beforeEach(async () => {
		tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "task-lifecycle-persistence-"))
		setDbPath(path.join(tempDirectory, "state.db"))
		persistence = new BroccoliTaskLifecyclePersistence()
	})

	afterEach(async () => {
		await destroyDb()
		await fs.rm(tempDirectory, { recursive: true, force: true })
	})

	it("rebuilds a missing or stale sequence counter from committed journal history", async () => {
		const funnel = new TaskLifecycleFunnel(persistence)
		const firstTask = await activate(funnel, "task-sequence-first")
		const rawDb = await getCoordinationRawDb()

		rawDb.prepare("DELETE FROM task_lifecycle_sequence WHERE id = 1").run()
		const secondTask = await activate(funnel, "task-sequence-missing")
		assert.ok(secondTask.monotonicSequence > firstTask.monotonicSequence)

		rawDb.prepare("UPDATE task_lifecycle_sequence SET value = 0 WHERE id = 1").run()
		const thirdTask = await activate(funnel, "task-sequence-stale")
		assert.ok(thirdTask.monotonicSequence > secondTask.monotonicSequence)
	})

	it("repairs a record projection that was written without its matching event", async () => {
		const funnel = new TaskLifecycleFunnel(persistence)
		const committed = await activate(funnel, "task-torn-projection")
		const rawDb = await getCoordinationRawDb()
		const staleRecord = {
			...committed,
			lifecycleRevision: committed.lifecycleRevision + 1,
			state: "suspended" as const,
			cause: { source: "recovery" as const, reason: "simulated interrupted projection write" },
			lastEventId: "missing-event",
			committedAt: committed.committedAt + 1,
			monotonicSequence: committed.monotonicSequence + 1,
		}
		rawDb
			.prepare(
				`UPDATE task_lifecycle_records
				 SET lifecycleRevision = ?, recordJson = ?, updatedAt = ?
				 WHERE taskId = ? AND generationId = ?`,
			)
			.run(
				staleRecord.lifecycleRevision,
				JSON.stringify(staleRecord),
				staleRecord.committedAt,
				committed.taskId,
				committed.generationId,
			)

		const restored = await persistence.load(committed.taskId)
		assert.equal(restored?.lastEventId, committed.lastEventId)
		assert.equal(restored?.lifecycleRevision, committed.lifecycleRevision)
		assert.equal(restored?.state, "active")

		const restoredEvent = await persistence.loadEvent(committed.lastEventId)
		assert.ok(restoredEvent)
	})

	it("rebuilds a deleted projection from the committed event journal", async () => {
		const funnel = new TaskLifecycleFunnel(persistence)
		const committed = await activate(funnel, "task-missing-projection")
		const rawDb = await getCoordinationRawDb()
		rawDb.prepare("DELETE FROM task_lifecycle_records WHERE taskId = ?").run(committed.taskId)

		const restored = await persistence.load(committed.taskId)
		assert.equal(restored?.lastEventId, committed.lastEventId)
		assert.equal(restored?.state, "active")
	})

	it("discards a projection whose journal commit marker is missing", async () => {
		const funnel = new TaskLifecycleFunnel(persistence)
		const committed = await activate(funnel, "task-orphaned-projection")
		const rawDb = await getCoordinationRawDb()
		const deleted = rawDb.prepare("DELETE FROM task_lifecycle_events WHERE taskId = ?").run(committed.taskId)
		assert.equal(deleted.changes, 2)

		assert.equal(await persistence.load(committed.taskId), undefined)
		assert.equal(rawDb.prepare("SELECT taskId FROM task_lifecycle_records WHERE taskId = ?").get(committed.taskId), undefined)

		const retry = await activate(new TaskLifecycleFunnel(persistence), committed.taskId)
		assert.ok(retry.monotonicSequence > committed.monotonicSequence)
	})
})

async function activate(funnel: TaskLifecycleFunnel, taskId: string) {
	const result = await funnel.registerAndActivate(new TaskState(), taskId, {
		source: "test",
		reason: "exercise durable lifecycle persistence",
	})
	if (result.kind !== "committed") throw new Error(`Lifecycle fixture failed to activate: ${result.reason}`)
	return result.record
}
