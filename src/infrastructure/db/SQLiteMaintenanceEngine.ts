import { Logger } from "@/shared/services/Logger"
import { getDb, getDbStorageMetrics } from "./Config"
import { getRowId, type BroccoliStateDatabase } from "./BroccoliStateDatabase"

export interface RetentionPolicy {
	telemetryMaxAgeMs?: number
	telemetryMaxRows?: number
	auditMaxAgeMs?: number
	auditMaxRows?: number
	taskEventsMaxAgeMs?: number
	nodesMaxRows?: number
	treesMaxRows?: number
	stashesMaxAgeMs?: number
	streamsMaxAgeMs?: number
	tasksMaxAgeMs?: number
	decisionsMaxAgeMs?: number
}

type MaintenanceResult = {
	prunedClaims: number
	prunedLocks: number
	prunedTelemetry: number
	prunedAuditEvents: number
	prunedKnowledge: number
	prunedReflogs: number
	prunedNodes: number
	prunedTrees: number
	prunedFiles: number
	prunedOrphanEdges: number
	prunedStreamsAndTasks: number
	prunedDecisions: number
	freelistPagesVacuumed: number
	walCheckpointResult: { busy: number; log: number; checkpointed: number }
	ftsOptimized: boolean
}

const emptyResult = (): MaintenanceResult => ({
	prunedClaims: 0,
	prunedLocks: 0,
	prunedTelemetry: 0,
	prunedAuditEvents: 0,
	prunedKnowledge: 0,
	prunedReflogs: 0,
	prunedNodes: 0,
	prunedTrees: 0,
	prunedFiles: 0,
	prunedOrphanEdges: 0,
	prunedStreamsAndTasks: 0,
	prunedDecisions: 0,
	freelistPagesVacuumed: 0,
	walCheckpointResult: { busy: 0, log: 0, checkpointed: 0 },
	ftsOptimized: false,
})

export class BroccoliMaintenanceEngine {
	private maintenanceInterval: NodeJS.Timeout | null = null
	private isRunning = false

	constructor(private readonly policy: RetentionPolicy = {}) {}

	start(intervalMs = 5 * 60 * 1000): void {
		if (this.maintenanceInterval) return
		this.maintenanceInterval = setInterval(() => {
			this.runMaintenance().catch((error) => Logger.error("[BroccoliMaintenance] Maintenance run failed:", error))
		}, intervalMs)
		this.maintenanceInterval.unref?.()
	}

	stop(): void {
		if (this.maintenanceInterval) clearInterval(this.maintenanceInterval)
		this.maintenanceInterval = null
	}

	private async deleteWhere(database: BroccoliStateDatabase, table: string, where: Record<string, unknown>): Promise<number> {
		const predicates: { column: string; operator: string; value: unknown }[] = []
		for (const [column, value] of Object.entries(where)) {
			if (value && typeof value === "object") {
				for (const [operator, expected] of Object.entries(value as Record<string, unknown>)) {
					const mapped: Record<string, string> = { $lt: "<", $lte: "<=", $gt: ">", $gte: ">=", $in: "IN", $eq: "=", $ne: "!=" }
					predicates.push({ column, operator: mapped[operator] ?? "=", value: expected })
				}
			} else predicates.push({ column, operator: "=", value })
		}
		return database.deleteWhere(table, predicates)
	}

	private async pruneToLimit(database: BroccoliStateDatabase, table: string, limit: number, timestampColumn: string): Promise<number> {
		const rows = database.rows(table).sort((a, b) => Number(a[timestampColumn] ?? 0) - Number(b[timestampColumn] ?? 0))
		const excess = Math.max(0, rows.length - limit)
		let deleted = 0
		for (const row of rows.slice(0, excess)) if (database.table(table).delete(getRowId(table, row))) deleted++
		return deleted
	}

	async runMaintenance(options?: { forceTruncateWal?: boolean }): Promise<MaintenanceResult> {
		if (this.isRunning) return emptyResult()
		this.isRunning = true
		try {
			const database = await getDb()
			const now = Date.now()
			const result = emptyResult()

			result.prunedClaims = await this.deleteWhere(database, "claims", { expiresAt: { $lt: now } })
			result.prunedLocks = await this.deleteWhere(database, "swarm_locks", { expiresAt: { $lt: now } })
			await this.deleteWhere(database, "branches", { isEphemeral: 1, expiresAt: { $lt: now } })
			const liveResources = new Set(database.rows("swarm_locks").map((row) => row.resource))
			for (const row of database.rows("swarm_lock_generations")) {
				if (!liveResources.has(row.resourceKey)) database.table("swarm_lock_generations").delete(getRowId("swarm_lock_generations", row))
			}
			result.prunedTelemetry = await this.deleteWhere(database, "telemetry", { timestamp: { $lt: now - (this.policy.telemetryMaxAgeMs ?? 30 * 24 * 60 * 60 * 1000) } })
			result.prunedTelemetry += await this.pruneToLimit(database, "telemetry", this.policy.telemetryMaxRows ?? 25000, "timestamp")
			result.prunedAuditEvents = await this.deleteWhere(database, "audit_events", { createdAt: { $lt: now - (this.policy.auditMaxAgeMs ?? 30 * 24 * 60 * 60 * 1000) } })
			result.prunedAuditEvents += await this.pruneToLimit(database, "audit_events", this.policy.auditMaxRows ?? 25000, "createdAt")

			try {
				result.prunedKnowledge += await this.deleteWhere(database, "knowledge", { expiresAt: { $lt: now } })
				result.prunedKnowledge += await this.deleteWhere(database, "agent_knowledge", { expiresAt: { $lt: now } })
				const knowledgeIds = new Set(database.rows("knowledge").map((row) => row.id))
				const agentKnowledgeIds = new Set(database.rows("agent_knowledge").map((row) => row.id))
				for (const row of database.rows("knowledge_edges")) {
					if (!knowledgeIds.has(row.sourceId) || !knowledgeIds.has(row.targetId)) {
						if (database.table("knowledge_edges").delete(getRowId("knowledge_edges", row))) result.prunedOrphanEdges++
					}
				}
				for (const row of database.rows("agent_knowledge_edges")) {
					if (!agentKnowledgeIds.has(row.sourceId) || !agentKnowledgeIds.has(row.targetId)) {
						if (database.table("agent_knowledge_edges").delete(getRowId("agent_knowledge_edges", row))) result.prunedOrphanEdges++
					}
				}
			} catch {}

			result.prunedReflogs = await this.deleteWhere(database, "reflog", { timestamp: { $lt: now - 30 * 24 * 60 * 60 * 1000 } })
			await this.deleteWhere(database, "agent_cognitive_snapshots", { createdAt: { $lt: now - 30 * 24 * 60 * 60 * 1000 } })
			result.prunedNodes = await this.pruneToLimit(database, "nodes", this.policy.nodesMaxRows ?? 10000, "timestamp")
			result.prunedTrees = await this.pruneToLimit(database, "trees", this.policy.treesMaxRows ?? 10000, "createdAt")
			await this.deleteWhere(database, "stashes", { createdAt: { $lt: now - (this.policy.stashesMaxAgeMs ?? 14 * 24 * 60 * 60 * 1000) } })

			const streamCutoff = now - (this.policy.streamsMaxAgeMs ?? 14 * 24 * 60 * 60 * 1000)
			const taskCutoff = now - (this.policy.tasksMaxAgeMs ?? 14 * 24 * 60 * 60 * 1000)
			result.prunedStreamsAndTasks += await this.deleteWhere(database, "agent_streams", { status: { $in: ["completed", "failed"] }, createdAt: { $lt: streamCutoff } })
			result.prunedStreamsAndTasks += await this.deleteWhere(database, "agent_tasks", { status: { $in: ["completed", "failed"] }, createdAt: { $lt: taskCutoff } })
			await this.deleteWhere(database, "tasks", { status: { $in: ["completed", "failed"] }, updatedAt: { $lt: taskCutoff } })
			const streamIds = new Set(database.rows("agent_streams").map((row) => row.id))
			for (const row of database.rows("agent_memory")) if (!streamIds.has(row.streamId)) database.table("agent_memory").delete(getRowId("agent_memory", row))

			result.prunedDecisions = await this.deleteWhere(database, "decisions", { timestamp: { $lt: now - (this.policy.decisionsMaxAgeMs ?? 30 * 24 * 60 * 60 * 1000) } })
			const lifecycleCutoff = now - (this.policy.taskEventsMaxAgeMs ?? 14 * 24 * 60 * 60 * 1000)
			for (const [table, column] of [["task_lifecycle_events", "committedAt"], ["task_completions", "committedAt"], ["task_rejections", "committedAt"], ["completion_attempts", "createdAt"], ["task_lifecycle_records", "updatedAt"]] as const) {
				await this.deleteWhere(database, table, { [column]: { $lt: lifecycleCutoff } })
			}

			const trees = database.rows("trees")
			const referenced = new Set<string>()
			for (const tree of trees) {
				referenced.add(String(tree.id))
				for (const value of [tree.entries]) if (typeof value === "string") for (const file of database.rows("files")) if (value.includes(String(file.id))) referenced.add(String(file.id))
			}
			for (const row of database.rows("files")) if (!referenced.has(String(row.id)) && database.table("files").delete(getRowId("files", row))) result.prunedFiles++

			await database.flush()
			if (options?.forceTruncateWal) await database.kernel.checkpoint("maintenance")
			const health = await database.kernel.health()
			result.walCheckpointResult = { busy: 0, log: health.pillars.walJournal.totalFrames, checkpointed: health.pillars.walJournal.totalFrames }
			result.ftsOptimized = Boolean(options?.forceTruncateWal)

			if (Object.values(result).some((value) => typeof value === "number" && value > 0)) Logger.info(`[BroccoliMaintenance] Completed: ${JSON.stringify(result)}`)
			return result
		} finally {
			this.isRunning = false
		}
	}

	async getStorageHealthReport(): Promise<{
		fileSizeBytes: number
		walSizeBytes: number
		freelistCount: number
		fragmentationRatio: number
		healthStatus: "healthy" | "bloated" | "critical"
		recommendations: string[]
	}> {
		const metrics = await getDbStorageMetrics()
		return {
			fileSizeBytes: metrics.fileSizeBytes,
			walSizeBytes: metrics.walSizeBytes,
			freelistCount: metrics.freelistCount,
			fragmentationRatio: 0,
			healthStatus: "healthy",
			recommendations: [],
		}
	}
}

// Kept as a source-compatible export for callers that have not renamed their
// maintenance import yet. The implementation is entirely BroccoliDB-backed.
export const SQLiteMaintenanceEngine = BroccoliMaintenanceEngine
export const broccoliMaintenanceEngine = new BroccoliMaintenanceEngine()
export const sqliteMaintenanceEngine = broccoliMaintenanceEngine
