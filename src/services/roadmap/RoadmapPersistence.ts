import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { acquireGovernedFileLock, releaseGovernedFileLock } from "../../shared/governance/fileLock"

const mutationQueues = new Map<string, Promise<void>>()
const mutationContext = new AsyncLocalStorage<{ workspace: string; active: boolean }>()
const RESOURCE_KEY = "roadmap:persistence"

/** Serialize read/modify/write operations, including nested service calls and cooperating processes. */
export async function withRoadmapMutation<T>(workspace: string, operation: () => Promise<T>): Promise<T> {
	const canonical = await fs.realpath(workspace)
	const current = mutationContext.getStore()
	if (current?.active && current.workspace === canonical) return operation()

	const previous = mutationQueues.get(canonical) ?? Promise.resolve()
	let releaseQueue!: () => void
	const queued = new Promise<void>((resolve) => {
		releaseQueue = resolve
	})
	mutationQueues.set(canonical, queued)
	await previous
	const owner = `roadmap-${process.pid}-${randomUUID()}`
	const token = String(Date.now())
	let acquired = false
	const context = { workspace: canonical, active: true }
	let outcome: { value: T } | { error: unknown }
	try {
		const deadline = Date.now() + 5_000
		for (;;) {
			const result = await acquireGovernedFileLock(canonical, RESOURCE_KEY, owner, token)
			if (result.ok) {
				acquired = true
				break
			}
			// A newly created lock may still be writing its JSON. Bounded retry also
			// lets another process finish without spinning or stealing live work.
			if (Date.now() >= deadline || result.reason === "authority_mode_mismatch") {
				throw new Error(`Roadmap is busy or its persistence lock needs recovery: ${result.error}`)
			}
			await delay(25)
		}
		outcome = { value: await mutationContext.run(context, operation) }
	} catch (error) {
		outcome = { error }
	} finally {
		context.active = false
		try {
			if (acquired) {
				const released = await releaseGovernedFileLock(canonical, RESOURCE_KEY, owner, "1", token)
				if (!released.released && !("error" in outcome!)) {
					outcome = { error: new Error(`Roadmap persistence lock could not be released: ${released.status}`) }
				}
			}
		} catch (error) {
			if (!("error" in outcome!)) outcome = { error }
		} finally {
			releaseQueue()
			if (mutationQueues.get(canonical) === queued) mutationQueues.delete(canonical)
		}
	}
	if ("error" in outcome) throw outcome.error
	return outcome.value
}

export async function readOptionalRoadmapFile(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf8")
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
		throw error
	}
}

/** Unique staging files prevent temp-file collisions; a changed base is a conflict, never a rollback target. */
export async function writeRoadmapFileChecked(filePath: string, content: string, expected: string | null): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	const tempPath = `${filePath}.${randomUUID()}.tmp`
	try {
		const handle = await fs.open(tempPath, "wx")
		try {
			await handle.writeFile(content, "utf8")
			await handle.sync()
		} finally {
			await handle.close()
		}
		if ((await readOptionalRoadmapFile(filePath)) !== expected) {
			throw new Error(`Roadmap write conflict: ${path.basename(filePath)} changed; reload before retrying.`)
		}
		await fs.rename(tempPath, filePath)
	} finally {
		await fs.unlink(tempPath).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error
		})
	}
}
