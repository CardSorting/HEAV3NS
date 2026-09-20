import { createHash } from "node:crypto"
import * as path from "node:path"
import type { IDbTable } from "@noorm/broccolidb"
import { BroccoliDatabaseKernel } from "@noorm/broccolidb"
import type {
	ContextCompactionCommitInput,
	ContextCompactionCommitResult,
	ContextCompactionCursor,
	ContextCompactionHydrateInput,
	ContextCompactionHydrateResult,
	ContextCompactionLoadInput,
	ContextCompactionLoadResult,
	ContextCompactionProjectionInput,
	ContextCompactionProjectionRecord,
	ContextCompactionRunInput,
} from "./ContextCompactionContracts"
import type { ContextCompactionStore } from "./ContextCompactionStore"

const MAX_RECORDS_PER_COMMIT = 64
const MAX_SOURCE_BYTES = 64 * 1024 * 1024
const MAX_PROJECTION_BYTES = 2 * 1024 * 1024
const MAX_SCOPE_PROJECTIONS = 4096

type SourceRecord = {
	id: string
	sourceSha256: string
	blobHash: string
	originalCharacters: number
	originalBytes: number
	originalLines: number
	storedBytes: number
	createdAt: number
	lastAccessedAt: number
} & Record<string, unknown>

type ProjectionRecord = ContextCompactionProjectionRecord & {
	id: string
	scopeKind: "task" | "subagent"
	workspaceId: string
} & Record<string, unknown>

type CursorRecord = ContextCompactionCursor & {
	id: string
	scopeId: string
	createdAt: number
} & Record<string, unknown>

type RunRecord = ContextCompactionRunInput & {
	id: string
	scopeId: string
	createdAt: number
} & Record<string, unknown>

interface SharedBroccoliState {
	kernel: BroccoliDatabaseKernel
	sources: IDbTable<SourceRecord>
	projections: IDbTable<ProjectionRecord>
	cursors: IDbTable<CursorRecord>
	runs: IDbTable<RunRecord>
}

const sharedStates = new Map<string, Promise<SharedBroccoliState>>()

function sha256(content: string | Buffer): string {
	return createHash("sha256").update(content).digest("hex")
}

function deterministicId(namespace: string, ...parts: string[]): string {
	return `${namespace}_${sha256(parts.join("\0")).slice(0, 40)}`
}

function lineCount(value: string): number {
	return value.length === 0 ? 0 : value.split("\n").length
}

function requireBoundedString(value: string, field: string, maximum: number): string {
	const trimmed = value?.trim()
	if (!trimmed) throw new Error(`${field} must be a non-empty string`)
	if (trimmed.length > maximum) throw new Error(`${field} exceeds ${maximum} characters`)
	return trimmed
}

function requireNonNegativeInteger(value: number, field: string): number {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new Error(`${field} must be a non-negative safe integer`)
	}
	return value
}

function requireTimestamp(value: number, field: string): number {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error(`${field} must be a positive timestamp`)
	}
	return value
}

/**
 * Context projections backed by the local BroccoliDB table kernel.
 *
 * Source text is addressed by SHA-256 and stored through BroccoliDB's CAS;
 * projection metadata, cursors, and run records live in reactive in-memory
 * tables and are WAL/checkpoint durable without a native database driver.
 */
export class BroccoliContextCompactionStore implements ContextCompactionStore {
	public readonly workspaceId: string
	private readonly workspacePath: string

	constructor(workspacePath: string) {
		this.workspacePath = path.resolve(workspacePath)
		this.workspaceId = deterministicId("lumi_ws", this.workspacePath)
	}

	getRecoverySource(scopeId: string): string {
		return `broccolidb://context/${encodeURIComponent(scopeId)}`
	}

	async commit(input: ContextCompactionCommitInput): Promise<ContextCompactionCommitResult> {
		const state = await this.getState()
		const validated = this.validateCommit(input)
		const uniqueRecords = this.uniqueSources(validated.records)
		const existingRows = state.sources.query({
			where: { sourceSha256: { $in: uniqueRecords.map((record) => record.sourceSha256) } },
		})
		const existingByHash = new Map(existingRows.map((row) => [row.sourceSha256, row]))

		let deduplicatedSources = 0
		const preparedSources: Array<{
			record: ContextCompactionProjectionInput
			row: SourceRecord
			newlyStored: boolean
		}> = []

		for (const record of uniqueRecords) {
			const existing = existingByHash.get(record.sourceSha256)
			if (existing && (await state.kernel.readBlob(existing.blobHash)) !== null) {
				deduplicatedSources += 1
				preparedSources.push({
					record,
					row: { ...existing, lastAccessedAt: Date.now() },
					newlyStored: false,
				})
				continue
			}

			const payload = Buffer.from(record.sourceText, "utf8")
			const blobHash = await state.kernel.storeBlob(payload)
			const now = Date.now()
			preparedSources.push({
				record,
				row: {
					id: record.sourceSha256,
					sourceSha256: record.sourceSha256,
					blobHash,
					originalCharacters: record.originalCharacters,
					originalBytes: payload.byteLength,
					originalLines: record.originalLines,
					storedBytes: payload.byteLength,
					createdAt: now,
					lastAccessedAt: now,
				},
				newlyStored: true,
			})
		}

		const now = Date.now()
		const projectionIds = validated.records.map((record) =>
			deterministicId("ctx_prj", validated.scopeId, record.messageId, record.blockId),
		)

		await state.kernel.transaction(async () => {
			for (const prepared of preparedSources) {
				state.sources.put(prepared.row.id, prepared.row)
			}

			for (let index = 0; index < validated.records.length; index += 1) {
				const record = validated.records[index]
				const projectionId = projectionIds[index]
				state.projections.put(projectionId, {
					id: projectionId,
					projectionId,
					scopeId: validated.scopeId,
					scopeKind: validated.scopeKind,
					workspaceId: validated.workspaceId,
					messageId: record.messageId,
					blockId: record.blockId,
					ref: record.ref,
					sourceLocator: record.sourceLocator,
					sourceSha256: record.sourceSha256,
					projectionText: record.projectionText,
					projectionSha256: record.projectionSha256,
					tier: record.tier,
					tierRank: record.tierRank,
					originalCharacters: record.originalCharacters,
					originalLines: record.originalLines,
					createdAt: now,
					parentProjectionId: record.parentProjectionId ?? null,
				})
			}

			const cursorId = deterministicId("ctx_cur", validated.scopeId)
			state.cursors.put(cursorId, {
				id: cursorId,
				scopeId: validated.scopeId,
				...validated.cursor,
				createdAt: now,
			})

			const runId = deterministicId(
				"ctx_run",
				validated.scopeId,
				String(validated.run.startedAt),
				String(validated.run.completedAt),
				validated.run.tier,
				String(validated.cursor.messageOffset),
				String(validated.cursor.blockOffset),
				projectionIds.join(","),
			)
			state.runs.put(runId, { id: runId, scopeId: validated.scopeId, createdAt: now, ...validated.run })
		})

		const totalOriginalBytes = preparedSources.reduce((total, source) => total + source.row.originalBytes, 0)
		const totalStoredBytes = preparedSources.reduce((total, source) => total + source.row.storedBytes, 0)
		return {
			committed: true,
			recoverySource: validated.recoverySource,
			projectionIds,
			deduplicatedSources,
			storedBytes: preparedSources
				.filter((source) => source.newlyStored)
				.reduce((total, source) => total + source.row.storedBytes, 0),
			telemetry: {
				originalBytes: totalOriginalBytes,
				storedBytes: totalStoredBytes,
				compressionRatio: totalOriginalBytes > 0 ? Number((totalStoredBytes / totalOriginalBytes).toFixed(4)) : 1,
				compressionTimeMs: 0,
				deduplicationHitRate:
					uniqueRecords.length > 0 ? Number((deduplicatedSources / uniqueRecords.length).toFixed(4)) : 0,
			},
		}
	}

	async load(input: ContextCompactionLoadInput): Promise<ContextCompactionLoadResult> {
		const state = await this.getState()
		const scopeId = requireBoundedString(input.scopeId, "scopeId", 512)
		const requestedLimit = input.limit ?? MAX_SCOPE_PROJECTIONS
		if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
			throw new Error("limit must be a positive safe integer")
		}
		const limit = Math.min(requestedLimit, MAX_SCOPE_PROJECTIONS)
		const projections = state.projections.query({
			where: { scopeId },
			sortBy: "createdAt",
			sortOrder: "desc",
			limit,
		})
		const cursors = state.cursors.query({
			where: { scopeId },
			sortBy: "createdAt",
			sortOrder: "desc",
			limit: 1,
		})
		return {
			projections: projections.map(({ id: _id, ...projection }) => projection),
			cursor: cursors[0]
				? {
						messageOffset: cursors[0].messageOffset,
						blockOffset: cursors[0].blockOffset,
						activeStart: cursors[0].activeStart,
					}
				: null,
		}
	}

	async hydrate(input: ContextCompactionHydrateInput): Promise<ContextCompactionHydrateResult> {
		const state = await this.getState()
		const scopeId = requireBoundedString(input.scopeId, "scopeId", 512)
		const messageId = requireBoundedString(input.messageId, "messageId", 256)
		const blockId = requireBoundedString(input.blockId, "blockId", 256)
		const sourceSha256 = this.requireHash(input.sourceSha256, "sourceSha256")
		const projections = state.projections.query({
			where: { scopeId, messageId, blockId, sourceSha256 },
			sortBy: "createdAt",
			sortOrder: "desc",
			limit: 1,
		})
		if (projections.length === 0) {
			throw new Error(`No context projection matches ${scopeId}/${messageId}/${blockId}/${sourceSha256}`)
		}

		const source = state.sources.get(sourceSha256)
		if (!source) throw new Error(`Context source metadata is missing for ${sourceSha256}`)
		const stored = await state.kernel.readBlob(source.blobHash)
		if (!stored) throw new Error(`Context source blob is missing for ${sourceSha256}`)
		if (stored.byteLength !== source.originalBytes || sha256(stored) !== sourceSha256) {
			throw new Error(`Hydrated context source failed integrity verification for ${sourceSha256}`)
		}
		const text = stored.toString("utf8")
		if (text.length !== source.originalCharacters || lineCount(text) !== source.originalLines) {
			throw new Error(`Hydrated context source metadata mismatch for ${sourceSha256}`)
		}
		return { sourceSha256, text }
	}

	private async getState(): Promise<SharedBroccoliState> {
		let state = sharedStates.get(this.workspacePath)
		if (!state) {
			state = this.createState()
			sharedStates.set(this.workspacePath, state)
			state.catch(() => {
				if (sharedStates.get(this.workspacePath) === state) sharedStates.delete(this.workspacePath)
			})
		}
		return state
	}

	private async createState(): Promise<SharedBroccoliState> {
		const kernel = new BroccoliDatabaseKernel({ workspaceRoot: this.workspacePath })
		await kernel.start()
		return {
			kernel,
			sources: kernel.getTable<SourceRecord>("context_compaction_sources"),
			projections: kernel.getTable<ProjectionRecord>("context_compaction_projections"),
			cursors: kernel.getTable<CursorRecord>("context_compaction_cursors"),
			runs: kernel.getTable<RunRecord>("context_compaction_runs"),
		}
	}

	private validateCommit(input: ContextCompactionCommitInput): ContextCompactionCommitInput {
		const scopeId = requireBoundedString(input.scopeId, "scopeId", 512)
		const workspaceId = requireBoundedString(input.workspaceId, "workspaceId", 256)
		const recoverySource = requireBoundedString(input.recoverySource, "recoverySource", 1024)
		if (input.scopeKind !== "task" && input.scopeKind !== "subagent") {
			throw new Error("scopeKind must be task or subagent")
		}
		if (!Array.isArray(input.records) || input.records.length > MAX_RECORDS_PER_COMMIT) {
			throw new Error(`records must contain at most ${MAX_RECORDS_PER_COMMIT} items`)
		}
		const records = input.records.map((record, index) => this.validateProjection(record, `records[${index}]`))
		const cursor = {
			messageOffset: requireNonNegativeInteger(input.cursor.messageOffset, "cursor.messageOffset"),
			blockOffset: requireNonNegativeInteger(input.cursor.blockOffset, "cursor.blockOffset"),
			activeStart: requireNonNegativeInteger(input.cursor.activeStart, "cursor.activeStart"),
		}
		const run = this.validateRun(input.run)
		if (run.completedAt < run.startedAt) throw new Error("run.completedAt must not precede run.startedAt")
		return { ...input, scopeId, workspaceId, recoverySource, records, cursor, run }
	}

	private validateRun(run: ContextCompactionRunInput): ContextCompactionRunInput {
		return {
			trigger: requireBoundedString(run.trigger, "run.trigger", 128),
			tier: requireBoundedString(run.tier, "run.tier", 64),
			scannedMessages: requireNonNegativeInteger(run.scannedMessages, "run.scannedMessages"),
			scannedBlocks: requireNonNegativeInteger(run.scannedBlocks, "run.scannedBlocks"),
			compactedBlocks: requireNonNegativeInteger(run.compactedBlocks, "run.compactedBlocks"),
			originalCharacters: requireNonNegativeInteger(run.originalCharacters, "run.originalCharacters"),
			projectedCharacters: requireNonNegativeInteger(run.projectedCharacters, "run.projectedCharacters"),
			startedAt: requireTimestamp(run.startedAt, "run.startedAt"),
			completedAt: requireTimestamp(run.completedAt, "run.completedAt"),
		}
	}

	private validateProjection(record: ContextCompactionProjectionInput, field: string): ContextCompactionProjectionInput {
		const sourceBytes = Buffer.byteLength(record.sourceText, "utf8")
		const projectionBytes = Buffer.byteLength(record.projectionText, "utf8")
		if (sourceBytes > MAX_SOURCE_BYTES) throw new Error(`${field}.sourceText exceeds ${MAX_SOURCE_BYTES} bytes`)
		if (projectionBytes > MAX_PROJECTION_BYTES)
			throw new Error(`${field}.projectionText exceeds ${MAX_PROJECTION_BYTES} bytes`)
		const sourceSha256 = this.requireHash(record.sourceSha256, `${field}.sourceSha256`)
		const projectionSha256 = this.requireHash(record.projectionSha256, `${field}.projectionSha256`)
		if (sha256(record.sourceText) !== sourceSha256) throw new Error(`${field}.sourceSha256 does not match sourceText`)
		if (sha256(record.projectionText) !== projectionSha256)
			throw new Error(`${field}.projectionSha256 does not match projectionText`)
		if (record.originalCharacters !== record.sourceText.length)
			throw new Error(`${field}.originalCharacters does not match sourceText`)
		if (record.originalLines !== lineCount(record.sourceText))
			throw new Error(`${field}.originalLines does not match sourceText`)
		return {
			...record,
			messageId: requireBoundedString(record.messageId, `${field}.messageId`, 256),
			blockId: requireBoundedString(record.blockId, `${field}.blockId`, 256),
			ref: requireBoundedString(record.ref, `${field}.ref`, 1024),
			sourceLocator: requireBoundedString(record.sourceLocator, `${field}.sourceLocator`, 1024),
			sourceSha256,
			projectionSha256,
			tier: requireBoundedString(record.tier, `${field}.tier`, 64),
			tierRank: requireNonNegativeInteger(record.tierRank, `${field}.tierRank`),
			originalCharacters: requireNonNegativeInteger(record.originalCharacters, `${field}.originalCharacters`),
			originalLines: requireNonNegativeInteger(record.originalLines, `${field}.originalLines`),
			parentProjectionId: record.parentProjectionId
				? requireBoundedString(record.parentProjectionId, `${field}.parentProjectionId`, 512)
				: undefined,
		}
	}

	private requireHash(value: string, field: string): string {
		const hash = requireBoundedString(value, field, 64).toLowerCase()
		if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`${field} must be a valid SHA-256 hash`)
		return hash
	}

	private uniqueSources(records: readonly ContextCompactionProjectionInput[]): ContextCompactionProjectionInput[] {
		const unique = new Map<string, ContextCompactionProjectionInput>()
		for (const record of records) unique.set(record.sourceSha256, record)
		return [...unique.values()]
	}
}

export async function shutdownBroccoliContextCompactionStores(): Promise<void> {
	const pendingStates = [...sharedStates.values()]
	sharedStates.clear()
	const settled = await Promise.allSettled(pendingStates)
	const states = settled
		.filter((result): result is PromiseFulfilledResult<SharedBroccoliState> => result.status === "fulfilled")
		.map((result) => result.value)
	await Promise.allSettled(states.map((state) => state.kernel.stop()))
}
