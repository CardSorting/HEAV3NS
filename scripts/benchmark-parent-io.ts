import { strict as assert } from "node:assert"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { performance } from "node:perf_hooks"
import { parseArgs } from "node:util"
import { PARENT_IO_WORK_CLASSES, ParentIoBudgetPool, type ParentIoWorkClass } from "../src/core/task/tools/io/ParentIoBulkhead"

// Local fixture I/O through the production scheduler. No model, network, or workspace writes.
const { values } = parseArgs({ options: { output: { type: "string" }, help: { type: "boolean" } } })
if (values.help) {
	console.log(
		"Usage: npm run benchmark:parent-io -- [--output report.json]\nOne warmup and five measured bursts of 192 mixed local-file requests; timings are not an SLA.",
	)
	process.exit(0)
}
const root = await fs.mkdtemp(path.join(os.tmpdir(), "heav3ns-parent-io-"))
const samples: { workClass: ParentIoWorkClass; queueMs: number; serviceMs: number }[] = []
const runs: Record<string, unknown>[] = []
try {
	const files = Array.from({ length: 32 }, (_, i) => path.join(root, `fixture-${i}.txt`))
	await Promise.all(files.map((file, i) => fs.writeFile(file, `${i}: needle\n${"fixture data\n".repeat(320)}`)))
	for (let run = -1; run < 5; run++) {
		const pool = new ParentIoBudgetPool()
		let backendCalls = 0
		let peakActive = 0
		const started = performance.now()
		await Promise.all(
			Array.from({ length: 192 }, async (_, i) => {
				const workClass = PARENT_IO_WORK_CLASSES[i % PARENT_IO_WORK_CLASSES.length]
				const queued = performance.now()
				const release = await pool.acquire(workClass === "small-read" || workClass === "metadata" ? 2 : 0, true, {
					workClass,
				})
				const admitted = performance.now()
				peakActive = Math.max(peakActive, pool.getActiveCount())
				try {
					if (workClass === "metadata") {
						backendCalls++
						await fs.stat(files[i % files.length])
					} else if (workClass === "small-read") {
						backendCalls++
						await fs.readFile(files[i % files.length], "utf8")
					} else if (workClass === "traversal") {
						backendCalls++
						assert.equal((await fs.readdir(root, { withFileTypes: true })).length, files.length)
					} else {
						// A bounded sequential scan; not the production search backend.
						for (const file of files.slice(0, 8)) {
							backendCalls++
							assert.ok((await fs.readFile(file, "utf8")).includes("needle"))
						}
					}
					if (run >= 0) samples.push({ workClass, queueMs: admitted - queued, serviceMs: performance.now() - admitted })
				} finally {
					release()
				}
			}),
		)
		const stats = pool.getStats()
		assert.equal(stats.active, 0)
		assert.equal(stats.pending, 0)
		assert.ok(peakActive <= stats.capacity)
		for (const state of Object.values(stats.byClass)) {
			assert.ok(state.maxActive <= state.capacity)
			assert.equal(state.completed, state.started)
		}
		if (run >= 0) runs.push({ elapsedMs: performance.now() - started, requests: 192, backendCalls, peakActive, stats })
	}
	// Deterministic queued cancellation, measured separately from the latency workload.
	const cancellationPool = new ParentIoBudgetPool()
	const holds = await Promise.all(Array.from({ length: 4 }, () => cancellationPool.acquire()))
	const controllers = Array.from({ length: 32 }, () => new AbortController())
	const pending = controllers.map((controller) => cancellationPool.acquire(0, true, { signal: controller.signal }))
	const settled = Promise.allSettled(pending)
	for (const controller of controllers) controller.abort()
	const outcomes = await settled
	for (const release of holds) release()
	assert.ok(outcomes.every((outcome) => outcome.status === "rejected"))
	assert.equal(cancellationPool.getPendingCount(), 0)
	assert.equal(cancellationPool.getActiveCount(), 0)
	const recovery = await cancellationPool.acquire()
	recovery()
	const percentile = (numbers: number[], p: number) => {
		const sorted = numbers.toSorted((a, b) => a - b)
		return Number(sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)].toFixed(3))
	}
	const latency = Object.fromEntries(
		PARENT_IO_WORK_CLASSES.map((workClass) => {
			const rows = samples.filter((sample) => sample.workClass === workClass)
			return [
				workClass,
				{
					requests: rows.length,
					queueP50Ms: percentile(
						rows.map((row) => row.queueMs),
						0.5,
					),
					queueP95Ms: percentile(
						rows.map((row) => row.queueMs),
						0.95,
					),
					serviceP50Ms: percentile(
						rows.map((row) => row.serviceMs),
						0.5,
					),
					serviceP95Ms: percentile(
						rows.map((row) => row.serviceMs),
						0.95,
					),
				},
			]
		}),
	)
	const report = {
		schemaVersion: 1,
		timestamp: new Date().toISOString(),
		environment: { node: process.version, platform: process.platform, arch: process.arch },
		workload: {
			fixtureFiles: 32,
			bytesPerFile: Buffer.byteLength(await fs.readFile(files[0])),
			warmupRuns: 1,
			measuredRuns: 5,
			requestsPerRun: 192,
			priorities: "metadata/small-read=2; search/traversal=0",
			searchFilesPerRequest: 8,
			coalescing: false,
			scope: "local fixture filesystem calls; excludes tool admission, production search, roadmap persistence and model latency",
		},
		latency,
		runs,
		cancellation: { requested: 32, rejected: outcomes.length, recovered: true, stats: cancellationPool.getStats() },
		samples,
	}
	if (values.output) await fs.writeFile(values.output, `${JSON.stringify(report, null, 2)}\n`)
	console.log(
		JSON.stringify(
			{
				latency,
				backendCalls: runs.map((run) => run.backendCalls),
				peakActive: runs.map((run) => run.peakActive),
				cancellation: report.cancellation,
				output: values.output ?? null,
			},
			null,
			2,
		),
	)
} finally {
	await fs.rm(root, { recursive: true, force: true })
}
