export type FinalizationStatus = "pending" | "running" | "passed" | "failed" | "idempotent_replay"

export interface FinalizationEvidence {
	finalizationRunId: string
	status: FinalizationStatus
	docsUpdated: string[]
	ledgerStamped: boolean
	roadmapValidated: boolean
	schemaValidationPassed: boolean
	artifactPaths: string[]
	changelogEntryPreview?: string
	workspaceIntelligenceUpdated?: boolean
	workspaceIntelligenceArtifacts?: string[]
	workspaceKnowledgeCategories?: Record<string, number>
	handoffSummaryHash?: string
	projectKnowledgeValidated?: boolean
	projectKnowledgeImpactSummary?: string
	projectKnowledgeDiagnostics?: string[]
	projectKnowledgeMutationHash?: string
	completedAt?: number
	accessDeniedReason?: string
}
