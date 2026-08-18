/**
 * clarify.contracts.ts
 *
 * Core data contracts for the Deterministic Clarification, Interactive Inquiry &
 * Intent Disambiguation Subsystem (Phase 85 / ADR-037).
 */

export type ClarifyInputMode =
  | "single_select"
  | "multi_select"
  | "free_text"
  | "numeric_scale"
  | "boolean_confirmation"
  | "hierarchical_choice";

export type ClarifyCategory =
  | "architecture"
  | "requirements"
  | "scope"
  | "design"
  | "safety"
  | "configuration"
  | "budget"
  | "general";

export type ClarifyPriority = "low" | "medium" | "high" | "critical" | "blocker";

export type ClarifyStatus =
  | "pending"
  | "resolved"
  | "timed_out"
  | "cancelled"
  | "auto_resolved"
  | "escalated";

export interface ClarifyChoice {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly isRecommended?: boolean;
  readonly followUpInquiryId?: string;
  readonly payload?: Record<string, unknown>;
}

export interface ClarifyAutoPolicy {
  readonly mode: "recommended" | "first" | "timeout" | "custom_heuristic" | "manual_only";
  readonly maxWaitMs?: number;
  readonly fallbackChoiceId?: string;
  readonly heuristicKey?: string;
}

export interface ClarifyInquiry {
  readonly id: string;
  readonly question: string;
  readonly description?: string;
  readonly category: ClarifyCategory;
  readonly priority: ClarifyPriority;
  readonly status: ClarifyStatus;
  readonly mode: ClarifyInputMode;
  readonly choices: readonly ClarifyChoice[];
  readonly autoPolicy?: ClarifyAutoPolicy;
  readonly timeoutMs?: number;
  readonly defaultChoiceId?: string;
  readonly tags?: readonly string[];
  readonly dependencies?: readonly string[]; // inquiry IDs that must resolve first
  readonly metadata?: Record<string, unknown>;
  readonly createdFrame: number;
  readonly timestamp: number;
  readonly resolvedAt?: number;
}

export interface ClarifyResolution {
  readonly inquiryId: string;
  readonly selectedChoiceIds: readonly string[];
  readonly writeInResponse?: string;
  readonly resolvedBy: "user" | "timeout" | "default" | "auto_policy" | "system";
  readonly confidenceScore: number; // 0.0 - 1.0
  readonly resolutionDurationMs: number;
  readonly timestamp: number;
  readonly explanation?: string;
}

export interface ClarifyDecisionNode {
  readonly inquiryId: string;
  readonly selectedChoiceId?: string;
  readonly children: readonly ClarifyDecisionNode[];
}

export interface ClarifyDecisionTree {
  readonly treeId: string;
  readonly title: string;
  readonly rootInquiryId: string;
  readonly nodes: readonly ClarifyDecisionNode[];
  readonly activePath: readonly string[];
  readonly isComplete: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ClarifyWorkspaceSnapshot {
  readonly activeInquiryId?: string;
  readonly pendingCount: number;
  readonly resolvedCount: number;
  readonly totalInquiries: number;
  readonly activeTreeCount: number;
  readonly inquiries: readonly ClarifyInquiry[];
  readonly resolutions: readonly ClarifyResolution[];
  readonly decisionTrees: readonly ClarifyDecisionTree[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface ClarifyInquiryRow {
  readonly id: string;
  readonly question: string;
  readonly category: string;
  readonly priority: string;
  readonly status: string;
  readonly mode: string;
  readonly choicesCount: number;
  readonly timeoutMs?: number;
  readonly createdFrame: number;
  readonly timestamp: number;
  readonly resolvedAt?: number;
  readonly [key: string]: unknown;
}

export interface ClarifyResolutionRow {
  readonly id: string;
  readonly inquiryId: string;
  readonly selectedChoiceIds: string;
  readonly writeInResponse?: string;
  readonly resolvedBy: string;
  readonly confidenceScore: number;
  readonly resolutionDurationMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface ClarifyAuditRow {
  readonly id: string;
  readonly inquiryId: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Clarification Diagnostics
// ---------------------------------------------------------------------------

export type ClarifyHealthStatus =
  | "optimal"
  | "healthy"
  | "backlogged"
  | "blocker_warning";

export interface ClarifyHealthAuditReport {
  readonly totalInquiries: number;
  readonly pendingInquiries: number;
  readonly resolvedInquiries: number;
  readonly blockerCount: number;
  readonly autoResolvedRate: number; // 0.0 - 1.0
  readonly avgResolutionLatencyMs: number;
  readonly ambiguityIndex: number; // 0.0 - 1.0 (ratio of unclarified questions to total)
  readonly healthStatus: ClarifyHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ClarifyMetricsReport {
  readonly totalInquiries: number;
  readonly pendingInquiries: number;
  readonly resolvedInquiries: number;
  readonly autoResolvedInquiries: number;
  readonly timedOutInquiries: number;
  readonly blockerInquiries: number;
  readonly decisionTreeCount: number;
  readonly avgResolutionLatencyMs: number;
  readonly resolutionSuccessRate: number;
  readonly p50ResolutionMs: number;
  readonly p95ResolutionMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type ClarifyGroupBy = "category" | "priority" | "status" | "mode" | "frame";

export type ClarifySortBy = "timestamp" | "priority" | "createdFrame" | "status";

export type ClarifySortDirection = "asc" | "desc";

export interface ClarifyGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly inquiries: readonly ClarifyInquiry[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface ClarifyDslQueryFilter {
  readonly rawQuery: string;
  readonly status?: ClarifyStatus;
  readonly category?: ClarifyCategory;
  readonly priority?: ClarifyPriority;
  readonly mode?: ClarifyInputMode;
  readonly tags?: readonly string[];
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface ClarifyMutationUndoRecord {
  readonly mutationType: "create" | "resolve" | "cancel" | "auto_resolve" | "bulk" | "tree_step";
  readonly previousSnapshot: ClarifyWorkspaceSnapshot;
  readonly nextSnapshot: ClarifyWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ClarifyBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedInquiryIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliClarifySubstrate {
  recordInquiry(inquiry: ClarifyInquiry): void;
  recordResolution(resolution: ClarifyResolution): void;
  getInquiry(id: string): ClarifyInquiry | undefined;
  getResolution(inquiryId: string): ClarifyResolution | undefined;
  listInquiries(limit?: number): readonly ClarifyInquiry[];
  listResolutions(limit?: number): readonly ClarifyResolution[];
  updateInquiryStatus(id: string, status: ClarifyStatus): boolean;
  createDecisionTree(title: string, rootInquiryId: string): ClarifyDecisionTree;
  getDecisionTree(treeId: string): ClarifyDecisionTree | undefined;
  listDecisionTrees(): readonly ClarifyDecisionTree[];
  stepDecisionTree(treeId: string, inquiryId: string, selectedChoiceId: string): boolean;
  getClarifyMetrics(): ClarifyMetricsReport;
  auditClarifyHealth(): ClarifyHealthAuditReport;
  getGroupedInquiries(groupBy?: ClarifyGroupBy, sortBy?: ClarifySortBy, direction?: ClarifySortDirection): readonly ClarifyGroupedLane[];
  queryInquiriesDsl(query: ClarifyDslQueryFilter | string): readonly ClarifyInquiry[];
  bulkResolveInquiries(inquiryIds: readonly string[], defaultChoiceId?: string): ClarifyBulkMutationResult;
  bulkCancelInquiries(inquiryIds: readonly string[]): ClarifyBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ClarifyWorkspaceSnapshot;
  importSnapshot(snapshot: ClarifyWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
