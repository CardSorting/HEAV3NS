/**
 * In-memory BroccoliDB context-compaction contracts.
 *
 * These types intentionally live with the LUMI adapter instead of importing
 * the retired @noorm/broccolidb package. They describe the narrow durable
 * projection protocol used by ContextManager.
 */

export type ContextCompactionScopeKind = "task" | "subagent"

export interface ContextCompactionCursor {
	messageOffset: number
	blockOffset: number
	activeStart: number
}

export interface ContextCompactionProjectionInput {
	messageId: string
	blockId: string
	ref: string
	sourceLocator: string
	sourceText: string
	sourceSha256: string
	projectionText: string
	projectionSha256: string
	tier: string
	tierRank: number
	originalCharacters: number
	originalLines: number
	parentProjectionId?: string
}

export interface ContextCompactionRunInput {
	trigger: string
	tier: string
	scannedMessages: number
	scannedBlocks: number
	compactedBlocks: number
	originalCharacters: number
	projectedCharacters: number
	startedAt: number
	completedAt: number
}

export interface ContextCompactionCommitInput {
	scopeId: string
	scopeKind: ContextCompactionScopeKind
	workspaceId: string
	recoverySource: string
	records: ContextCompactionProjectionInput[]
	cursor: ContextCompactionCursor
	run: ContextCompactionRunInput
}

export interface CompactionTelemetry {
	originalBytes: number
	storedBytes: number
	compressionRatio: number
	compressionTimeMs: number
	deduplicationHitRate: number
}

export interface ContextCompactionCommitResult {
	committed: true
	recoverySource: string
	projectionIds: string[]
	deduplicatedSources: number
	storedBytes: number
	telemetry?: CompactionTelemetry
}

export interface ContextCompactionLoadInput {
	scopeId: string
	limit?: number
}

export interface ContextCompactionProjectionRecord {
	projectionId: string
	scopeId: string
	messageId: string
	blockId: string
	ref: string
	sourceLocator: string
	sourceSha256: string
	projectionText: string
	projectionSha256: string
	tier: string
	tierRank: number
	originalCharacters: number
	originalLines: number
	createdAt: number
	parentProjectionId?: string | null
}

export interface ContextCompactionLoadResult {
	projections: ContextCompactionProjectionRecord[]
	cursor: ContextCompactionCursor | null
}

export interface ContextCompactionHydrateInput {
	scopeId: string
	messageId: string
	blockId: string
	sourceSha256: string
}

export interface ContextCompactionHydrateResult {
	sourceSha256: string
	text: string
}
