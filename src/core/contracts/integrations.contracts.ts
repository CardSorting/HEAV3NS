/**
 * integrations.contracts.ts
 *
 * Core data contracts for the Deterministic Native Enterprise Integrations Hub Subsystem (Phase 96 / ADR-126).
 * Provides unified cross-service schemas (Merge.dev/Segment style), 1-click workflow recipes (Zapier style),
 * deterministic mock data generation, token bucket rate limiting, and zero-GC memory snapshotting.
 */

export type IntegrationProviderType =
  | "github"
  | "linear"
  | "notion"
  | "stripe"
  | "supabase"
  | "sentry"
  | "vercel"
  | "google_workspace";

export type IntegrationCategory =
  | "developer_tools"
  | "productivity"
  | "finance_commerce"
  | "database_backend"
  | "devops_monitoring"
  | "cloud_infrastructure";

export type IntegrationAuthType = "api_key" | "bearer_token" | "oauth2" | "webhook_secret";

export type IssuePriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type IssueStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELED";
export type CustomerPaymentStatus = "ACTIVE" | "PAST_DUE" | "UNPAID" | "TRIALING" | "CANCELED";
export type AlertLevel = "FATAL" | "ERROR" | "WARNING" | "INFO";

export interface IntegrationConnection {
  readonly connectionId: string;
  readonly provider: IntegrationProviderType;
  readonly name: string;
  readonly category: IntegrationCategory;
  readonly authType: IntegrationAuthType;
  readonly isConnected: boolean;
  readonly isMock: boolean;
  readonly rateLimitPerMinute: number;
  readonly totalRequests: number;
  readonly lastSyncAt?: number;
  readonly errorCount: number;
  readonly createdAt: number;
}

export interface UnifiedIssue {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: IssueStatus;
  readonly priority: IssuePriority;
  readonly assignee?: string;
  readonly labels: readonly string[];
  readonly url?: string;
  readonly sourceService: IntegrationProviderType;
  readonly sourceId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface UnifiedCustomer {
  readonly customerId: string;
  readonly name: string;
  readonly email: string;
  readonly paymentStatus: CustomerPaymentStatus;
  readonly totalSpendUsd: number;
  readonly currency: string;
  readonly sourceService: IntegrationProviderType;
  readonly sourceId: string;
  readonly createdAt: number;
}

export interface UnifiedAlert {
  readonly alertId: string;
  readonly title: string;
  readonly level: AlertLevel;
  readonly errorType: string;
  readonly stackSummary: string;
  readonly service: IntegrationProviderType;
  readonly occurrenceCount: number;
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
  readonly url?: string;
}

export interface UnifiedDocument {
  readonly docId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly wordCount: number;
  readonly lastModifiedAt: number;
  readonly url?: string;
  readonly service: IntegrationProviderType;
}

export interface WorkflowStep {
  readonly stepId: string;
  readonly service: IntegrationProviderType;
  readonly actionType: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface IntegrationRecipe {
  readonly recipeId: string;
  readonly title: string;
  readonly description: string;
  readonly category: IntegrationCategory;
  readonly triggerEvent: string;
  readonly steps: readonly WorkflowStep[];
  readonly isInstalled: boolean;
  readonly executionCount: number;
  readonly createdAt: number;
}

export interface WorkflowExecutionResult {
  readonly executionId: string;
  readonly recipeId: string;
  readonly success: boolean;
  readonly stepsExecuted: number;
  readonly totalDurationMs: number;
  readonly stepResults: readonly Readonly<Record<string, unknown>>[];
  readonly error?: string;
  readonly executedAt: number;
}

export interface IntegrationAuditLog {
  readonly logId: string;
  readonly connectionId: string;
  readonly provider: IntegrationProviderType;
  readonly endpoint: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  readonly statusCode: number;
  readonly latencyMs: number;
  readonly timestamp: number;
}

export interface ServiceCatalogEntry {
  readonly provider: IntegrationProviderType;
  readonly displayName: string;
  readonly category: IntegrationCategory;
  readonly description: string;
  readonly iconEmoji: string;
  readonly popularRecipes: readonly string[];
  readonly supportedFeatures: readonly string[];
}

export interface IntegrationsSkillConfig {
  readonly enabled: boolean;
  readonly allowedProviders: readonly IntegrationProviderType[];
  readonly defaultTimeoutMs: number;
  readonly sandboxModeEnabled: boolean;
  readonly rateLimitPerMinute: number;
  readonly platformCredentials?: Readonly<Record<string, unknown>>;
}

export interface PlatformIntegrationHealth {
  readonly provider: IntegrationProviderType;
  readonly displayName: string;
  readonly isConnected: boolean;
  readonly isMock: boolean;
  readonly latencyMs: number;
  readonly uptimePercent: number;
  readonly totalRequests: number;
  readonly errorCount: number;
  readonly lastSyncAt?: number;
}

export interface IntegrationsHealthMatrix {
  readonly totalConnected: number;
  readonly overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly providers: readonly PlatformIntegrationHealth[];
  readonly totalRequests: number;
  readonly errorRatePercent: number;
  readonly timestamp: number;
}

export interface IntegrationsSubstrateSnapshot {
  readonly connections: readonly IntegrationConnection[];
  readonly issues: readonly UnifiedIssue[];
  readonly customers: readonly UnifiedCustomer[];
  readonly alerts: readonly UnifiedAlert[];
  readonly documents: readonly UnifiedDocument[];
  readonly recipes: readonly IntegrationRecipe[];
  readonly auditLogs: readonly IntegrationAuditLog[];
  readonly recipeExecutions: readonly WorkflowExecutionResult[];
  readonly totalConnections: number;
  readonly totalIssues: number;
  readonly totalCustomers: number;
  readonly totalAlerts: number;
  readonly totalDocuments: number;
  readonly totalRecipes: number;
  readonly config: IntegrationsSkillConfig;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface IntegrationConnectionRow {
  readonly id: string;
  readonly connectionId: string;
  readonly provider: string;
  readonly name: string;
  readonly category: string;
  readonly authType: string;
  readonly isConnected: boolean;
  readonly isMock: boolean;
  readonly totalRequests: number;
  readonly errorCount: number;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface UnifiedIssueRow {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly sourceService: string;
  readonly sourceId: string;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface IntegrationRecipeRow {
  readonly id: string;
  readonly recipeId: string;
  readonly title: string;
  readonly category: string;
  readonly triggerEvent: string;
  readonly isInstalled: boolean;
  readonly executionCount: number;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface IntegrationAuditLogRow {
  readonly id: string;
  readonly connectionId: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly method: string;
  readonly statusCode: number;
  readonly latencyMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type IntegrationsHealthStatus = "optimal" | "healthy" | "degraded" | "critical";

export interface IntegrationsHealthAuditReport {
  readonly totalConnections: number;
  readonly activeConnections: number;
  readonly totalRecipes: number;
  readonly totalExecutions: number;
  readonly overallStatus: IntegrationsHealthStatus;
  readonly providerHealths: readonly PlatformIntegrationHealth[];
  readonly recommendations: readonly string[];
}

export interface IntegrationsMetricsReport {
  readonly totalConnections: number;
  readonly totalIssues: number;
  readonly totalCustomers: number;
  readonly totalAlerts: number;
  readonly totalDocuments: number;
  readonly totalRecipes: number;
  readonly totalExecutions: number;
  readonly totalRequests: number;
  readonly errorRatePercent: number;
  readonly avgLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type IntegrationsGroupBy = "category" | "provider" | "status";

export type IntegrationsSortBy = "name" | "createdAt" | "totalRequests";

export type IntegrationsSortDirection = "asc" | "desc";

export interface IntegrationsGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly connections: readonly IntegrationConnection[];
  readonly recipes?: readonly IntegrationRecipe[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface IntegrationsDslQueryFilter {
  readonly rawQuery: string;
  readonly provider?: IntegrationProviderType;
  readonly category?: IntegrationCategory;
  readonly isConnected?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface IntegrationsMutationUndoRecord {
  readonly mutationType: "upsert_connection" | "delete_connection" | "record_recipe" | "bulk_purge" | "clear";
  readonly previousSnapshot: IntegrationsSubstrateSnapshot;
  readonly nextSnapshot: IntegrationsSubstrateSnapshot;
  readonly timestampMs: number;
}

export interface IntegrationsBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedConnectionIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliIntegrationsSubstrate {
  upsertConnection(conn: IntegrationConnection): void;
  getConnection(connectionId: string): IntegrationConnection | undefined;
  listConnections(): readonly IntegrationConnection[];
  deleteConnection(connectionId: string): boolean;
  
  upsertIssue(issue: UnifiedIssue): void;
  getIssue(id: string): UnifiedIssue | undefined;
  listIssues(provider?: IntegrationProviderType): readonly UnifiedIssue[];

  upsertCustomer(customer: UnifiedCustomer): void;
  getCustomer(customerId: string): UnifiedCustomer | undefined;
  listCustomers(provider?: IntegrationProviderType): readonly UnifiedCustomer[];

  upsertAlert(alert: UnifiedAlert): void;
  getAlert(alertId: string): UnifiedAlert | undefined;
  listAlerts(provider?: IntegrationProviderType): readonly UnifiedAlert[];

  upsertDocument(doc: UnifiedDocument): void;
  getDocument(docId: string): UnifiedDocument | undefined;
  listDocuments(provider?: IntegrationProviderType): readonly UnifiedDocument[];
  
  upsertRecipe(recipe: IntegrationRecipe): void;
  getRecipe(recipeId: string): IntegrationRecipe | undefined;
  listRecipes(): readonly IntegrationRecipe[];
  
  recordRecipeExecution(result: WorkflowExecutionResult): void;
  listRecipeExecutions(recipeId?: string): readonly WorkflowExecutionResult[];
  
  recordAuditLog(log: IntegrationAuditLog): void;
  listAuditLogs(connectionId?: string): readonly IntegrationAuditLog[];
  
  auditHealth(): IntegrationsHealthAuditReport;
  getMetrics(): IntegrationsMetricsReport;
  getGroupedConnections(groupBy?: IntegrationsGroupBy, sortBy?: IntegrationsSortBy, direction?: IntegrationsSortDirection): readonly IntegrationsGroupedLane[];
  queryIntegrationsDsl(query: IntegrationsDslQueryFilter | string): readonly IntegrationConnection[];
  bulkPurgeConnections(connectionIds: readonly string[]): IntegrationsBulkMutationResult;
  
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): IntegrationsSubstrateSnapshot;
  importSnapshot(snapshot: IntegrationsSubstrateSnapshot): void;
  
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
