#!/usr/bin/env node
"use strict"

/**
 * Self-contained process fixture for governed-worker lifecycle tests.
 * It intentionally models only the public contract under test: acquire a
 * filesystem claim, run or fail a lane, release the claim, and always write
 * a terminal receipt. The production CLI does not depend on this fixture.
 */
const { createHash } = require("node:crypto")
const fs = require("node:fs/promises")
const path = require("node:path")

function lockPath(workspace, resourceKey) {
	const digest = createHash("sha256").update(resourceKey).digest("hex")
	return path.join(workspace, ".broccolidb", "governed", "locks", `${digest}.lock`)
}

async function acquire(workspace, resourceKey, ownerId, fencingToken) {
	const filePath = lockPath(workspace, resourceKey)
	await fs.mkdir(path.dirname(filePath), { recursive: true })
	try {
		const handle = await fs.open(filePath, "wx")
		await handle.writeFile(JSON.stringify({ ownerId, resourceKey, fencingToken, claimedAt: Date.now() }), "utf8")
		await handle.close()
		return true
	} catch (error) {
		if (error?.code === "EEXIST") return false
		throw error
	}
}

async function release(workspace, resourceKey, ownerId) {
	const filePath = lockPath(workspace, resourceKey)
	try {
		const record = JSON.parse(await fs.readFile(filePath, "utf8"))
		if (record.ownerId === ownerId) await fs.unlink(filePath)
	} catch {
		// The release operation is idempotent for the fixture contract.
	}
}

function parseArgs(argv) {
	const args = { workerId: "worker-unknown", prompt: "" }
	for (let index = 2; index < argv.length; index++) {
		const key = argv[index]
		const value = argv[index + 1]
		if (key === "--worker-id" && value) {
			args.workerId = value
			index++
		} else if (key === "--prompt" && value) {
			args.prompt = value
			index++
		} else if (key === "--workspace" && value) {
			args.workspace = value
			index++
		} else if (key === "--fail") {
			args.fail = true
		}
	}
	return args
}

async function main() {
	const args = parseArgs(process.argv)
	const workspace = args.workspace || process.cwd()
	const laneId = `worker-lane:${args.workerId}`
	const swarmId = "swarm"
	const resourceKey = `governed-lane:${swarmId}:${laneId}`
	const startedAt = Date.now()
	const fencingToken = startedAt
	const acquired = await acquire(workspace, resourceKey, args.workerId, fencingToken)
	if (!acquired) throw new Error(`lane claim rejected: ${resourceKey}`)

	let status = "completed"
	let result = `Governed lane execution complete for prompt: ${args.prompt.slice(0, 200)}`
	let error
	try {
		if (args.fail) throw new Error("Worker forced failure")
	} catch (caught) {
		status = "failed"
		result = ""
		error = caught instanceof Error ? caught.message : String(caught)
	} finally {
		await release(workspace, resourceKey, args.workerId)
		const outputPath = path.join(workspace, ".broccolidb", "governed", "receipts", `${args.workerId}.json`)
		await fs.mkdir(path.dirname(outputPath), { recursive: true })
		await fs.writeFile(
			outputPath,
			JSON.stringify(
				{
					schemaVersion: 1,
					workerId: args.workerId,
					laneId,
					swarmId,
					resourceKey,
					status,
					prompt: args.prompt,
					result,
					error,
					startedAt,
					completedAt: Date.now(),
					evidenceCount: status === "completed" ? 1 : 0,
					touchedFiles: [],
					claimReleased: true,
				},
				null,
			),
			"utf8",
		)
	}

	process.exitCode = status === "completed" ? 0 : 1
}

main().catch((error) => {
	console.error(`[governed-worker-cli] ${error instanceof Error ? error.message : String(error)}`)
	process.exitCode = 1
})
