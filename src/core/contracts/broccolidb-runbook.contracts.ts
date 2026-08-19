/**
 * broccolidb-runbook.contracts.ts
 *
 * Typed Table Row Schemas for BroccoliDB-Backed Runbook Substrate (Phase 193 / ADR-123).
 */

// Table: runbook_specs
export interface RunbookSpecRow {
  readonly id: string; // specHash
  readonly name: string;
  readonly initialNode: string;
  readonly rawYamlCasHash: string; // L3 CAS pointer
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

// Table: runbook_nodes
export interface RunbookNodeRow {
  readonly id: string; // `${specId}:${nodeName}`
  readonly specId: string;
  readonly nodeName: string;
  readonly prompt: string;
  readonly inHooksJson: string; // JSON serialized RunbookCheckItem[]
  readonly beforeTransferJson: string; // JSON serialized RunbookCheckItem[]
  readonly dynamicConfigJson?: string; // JSON serialized DynamicBeforeTransferConfig
  readonly outHooksJson: string; // JSON serialized RunbookCheckItem[]
  readonly [key: string]: unknown;
}

// Table: runbook_edges
export interface RunbookEdgeRow {
  readonly id: string; // `${specId}:${fromNode}->${toNode}`
  readonly specId: string;
  readonly fromNode: string;
  readonly toNode: string;
  readonly conditionJson?: string;
  readonly hookJson?: string;
  readonly maxAttempts?: number;
  readonly [key: string]: unknown;
}

// Table: runbook_runs (L1 Hot State)
export interface RunbookRunRow {
  readonly id: string; // runId
  readonly specId: string;
  readonly specName: string;
  readonly currentNode: string;
  readonly currentEntryId: string;
  readonly activeAgentId: string;
  readonly activeAgentRole: string;
  readonly status: "active" | "blocked" | "completed" | "paused";
  readonly edgeAttemptsJson: string; // Record<entryId, Record<from, Record<to, number>>>
  readonly startedAt: number;
  readonly updatedAt: number;
  readonly [key: string]: unknown;
}

// Table: runbook_dynamic_checks (Entry-Scoped)
export interface RunbookDynamicCheckRow {
  readonly id: string; // `${runId}:${entryId}:${agentId}`
  readonly runId: string;
  readonly nodeName: string;
  readonly entryId: string;
  readonly agentId: string;
  readonly agentRole: string;
  readonly basisJson: string; // { taskContract, implementationSummary }
  readonly checksJson: string; // RunbookCheckItem[]
  readonly checksCount: number;
  readonly registeredAt: number;
  readonly ttlMs?: number;
  readonly [key: string]: unknown;
}

// Table: runbook_transitions (L2 Append-Only WAL Log)
export interface RunbookTransitionRow {
  readonly id: string; // `${runId}:${sequence}`
  readonly sequence: number;
  readonly runId: string;
  readonly event: "start" | "goto" | "goto_blocked" | "save" | "save_blocked" | "dynamic_check";
  readonly fromNode?: string;
  readonly toNode?: string;
  readonly entryId: string;
  readonly stage?: string; // "before_transfer" | "dynamic_before_transfer" | "condition" | "out_hook" | "in_hook"
  readonly success: boolean;
  readonly resultsJson: string; // Evaluation receipts
  readonly durationMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// Table: runbook_evidence_receipts (L3 CAS-Backed)
export interface RunbookEvidenceReceiptRow {
  readonly id: string; // receiptId
  readonly runId: string;
  readonly entryId: string;
  readonly kind: string; // "test" | "build" | "predicate" | "llm_review"
  readonly command?: string;
  readonly exitCode: number;
  readonly passed: boolean;
  readonly outputCasHash: string; // L3 CAS pointer to large stdout/stderr
  readonly artifactSha256: string; // Invalidation anchor
  readonly timestamp: number;
  readonly [key: string]: unknown;
}
