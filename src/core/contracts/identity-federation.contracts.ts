/**
 * identity-federation.contracts.ts
 *
 * Core contracts for OAuth2 PKCE Device Flow, Multi-Provider Identity Federation,
 * and Subscription Tier Governance (Phase 98 / ADR-052).
 */

export type AuthProviderId = "nous" | "openai" | "anthropic" | "copilot" | "custom";

export type AuthFlowType = "pkce_device_flow" | "authorization_code" | "api_key" | "jwt_bearer";

export type SubscriptionTier = "free" | "pro" | "team" | "enterprise";

export interface PkceChallengePair {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly challengeMethod: "S256";
}

export interface DeviceAuthorizationPending {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete?: string;
  readonly expiresIn: number;
  readonly interval: number;
  readonly createdAt: number;
}

export interface TokenLeaseRecord {
  readonly leaseId: string;
  readonly providerId: AuthProviderId;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenType: string;
  readonly scope: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly userId?: string;
  readonly tier: SubscriptionTier;
}

export interface SubscriptionEntitlement {
  readonly tier: SubscriptionTier;
  readonly maxTokensPerTurn: number;
  readonly maxContextBudget: number;
  readonly parallelToolsAllowed: boolean;
  readonly customFineTunesAllowed: boolean;
  readonly priorityInference: boolean;
}

export interface AuthWorkspaceSnapshot {
  readonly totalTokens: number;
  readonly activeLeases: readonly TokenLeaseRecord[];
  readonly pendingAuthorizations: readonly DeviceAuthorizationPending[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface TokenLeaseRow {
  readonly id: string;
  readonly leaseId: string;
  readonly providerId: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenType: string;
  readonly scope: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly userId?: string;
  readonly tier: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface DeviceAuthRow {
  readonly id: string;
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete?: string;
  readonly expiresIn: number;
  readonly interval: number;
  readonly createdAt: number;
  readonly [key: string]: unknown;
}

export interface SubscriptionTierRow {
  readonly id: string;
  readonly tier: string;
  readonly maxTokensPerTurn: number;
  readonly maxContextBudget: number;
  readonly parallelToolsAllowed: boolean;
  readonly customFineTunesAllowed: boolean;
  readonly priorityInference: boolean;
  readonly [key: string]: unknown;
}

export interface AuthAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type IdentityFederationHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "unhealthy";

export interface IdentityFederationHealthAuditReport {
  readonly totalActiveLeases: number;
  readonly expiredLeasesCount: number;
  readonly pendingAuthorizationsCount: number;
  readonly healthStatus: IdentityFederationHealthStatus;
  readonly recommendations: readonly string[];
}

export interface IdentityFederationMetricsReport {
  readonly totalLeasesIssued: number;
  readonly totalAuthorizationsInitiated: number;
  readonly totalAuthorizationsExchanged: number;
  readonly totalTokensRefreshed: number;
  readonly activeLeaseCount: number;
  readonly tierDistribution: Record<SubscriptionTier, number>;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type IdentityFederationGroupBy = "provider" | "tier" | "expiry_status";

export type IdentityFederationSortBy = "issuedAt" | "expiresAt" | "providerId" | "tier";

export type IdentityFederationSortDirection = "asc" | "desc";

export interface IdentityFederationGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly leases: readonly TokenLeaseRecord[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface IdentityFederationDslQueryFilter {
  readonly rawQuery: string;
  readonly providerId?: AuthProviderId;
  readonly tier?: SubscriptionTier;
  readonly activeOnly?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface IdentityFederationMutationUndoRecord {
  readonly mutationType: "issue_lease" | "revoke_lease" | "bulk_purge" | "clear";
  readonly previousSnapshot: AuthWorkspaceSnapshot;
  readonly nextSnapshot: AuthWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface IdentityFederationBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedLeaseIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliAuthSubstrate {
  recordLease(lease: TokenLeaseRecord): void;
  getLease(leaseId: string): TokenLeaseRecord | undefined;
  getLeaseByProvider(providerId: AuthProviderId): TokenLeaseRecord | undefined;
  listLeases(): readonly TokenLeaseRecord[];
  revokeLease(leaseId: string): boolean;
  recordPendingAuth(pending: DeviceAuthorizationPending): void;
  getPendingAuth(deviceCode: string): DeviceAuthorizationPending | undefined;
  removePendingAuth(deviceCode: string): boolean;
  listPendingAuths(): readonly DeviceAuthorizationPending[];
  auditHealth(): IdentityFederationHealthAuditReport;
  getMetrics(): IdentityFederationMetricsReport;
  getGroupedLeases(groupBy?: IdentityFederationGroupBy, sortBy?: IdentityFederationSortBy, direction?: IdentityFederationSortDirection): readonly IdentityFederationGroupedLane[];
  queryLeasesDsl(query: IdentityFederationDslQueryFilter | string): readonly TokenLeaseRecord[];
  bulkPurgeLeases(leaseIds: readonly string[]): IdentityFederationBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): AuthWorkspaceSnapshot;
  importSnapshot(snapshot: AuthWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
