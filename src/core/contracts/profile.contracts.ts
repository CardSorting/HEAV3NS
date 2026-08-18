/**
 * profile.contracts.ts
 *
 * Core data contracts for Persistent Multi-Profile Isolation, Environment Routing,
 * Persona Cloning, Hierarchical Inheritance, and Blueprint Catalog (Target #76 / ADR-119).
 */

export type ProfileStatus = "active" | "suspended" | "archived";

export type ProfileCloneKind = "shallow" | "persona" | "full";

export type ProfileReasoningEffort = "none" | "low" | "medium" | "high";

export type ProfileCategory =
  | "general"
  | "engineering"
  | "research"
  | "operations"
  | "writing"
  | "education"
  | "creative"
  | "custom";

export const PROFILE_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface ProfileTelemetry {
  readonly totalInvocations: number;
  readonly totalSessionsBound: number;
  readonly lastActivatedAtMs?: number;
  readonly estimatedTokensSaved: number;
}

export interface ProfileDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProfileStatus;
  readonly extends?: string;
  readonly category?: ProfileCategory;
  readonly icon?: string;
  readonly isFavorite?: boolean;
  readonly isProtected?: boolean;
  readonly isEphemeral?: boolean;
  readonly soulPrompt: string;
  readonly systemPromptOverlay?: string;
  readonly modelPreference?: string;
  readonly fallbackModel?: string;
  readonly reasoningEffort?: ProfileReasoningEffort;
  readonly temperature?: number;
  readonly enabledToolsets?: readonly string[];
  readonly disabledToolsets?: readonly string[];
  readonly skin?: string;
  readonly customAxioms?: readonly string[];
  readonly tags?: readonly string[];
  readonly memoryStore?: Record<string, string>;
  readonly envOverrides?: Record<string, string>;
  readonly telemetry?: ProfileTelemetry;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ProfileMutation {
  readonly name?: string;
  readonly description?: string;
  readonly status?: ProfileStatus;
  readonly extends?: string;
  readonly category?: ProfileCategory;
  readonly icon?: string;
  readonly isFavorite?: boolean;
  readonly isProtected?: boolean;
  readonly soulPrompt?: string;
  readonly systemPromptOverlay?: string;
  readonly modelPreference?: string;
  readonly fallbackModel?: string;
  readonly reasoningEffort?: ProfileReasoningEffort;
  readonly temperature?: number;
  readonly enabledToolsets?: readonly string[];
  readonly disabledToolsets?: readonly string[];
  readonly skin?: string;
  readonly customAxioms?: readonly string[];
  readonly tags?: readonly string[];
  readonly memoryStore?: Record<string, string>;
  readonly envOverrides?: Record<string, string>;
  readonly metadata?: Record<string, unknown>;
}

export interface ProfileCloneOptions {
  readonly cloneKind?: ProfileCloneKind;
  readonly newName?: string;
  readonly newDescription?: string;
  readonly newCategory?: ProfileCategory;
  readonly newIcon?: string;
  readonly preserveMemories?: boolean;
  readonly preserveSkills?: boolean;
  readonly envOverrides?: Record<string, string>;
}

export interface ProfileBlueprint {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ProfileCategory;
  readonly icon: string;
  readonly defaultSoulPrompt: string;
  readonly recommendedModel: string;
  readonly recommendedReasoningEffort: ProfileReasoningEffort;
  readonly recommendedToolsets: readonly string[];
  readonly customAxioms: readonly string[];
  readonly tags: readonly string[];
  readonly defaultMemoryStore?: Record<string, string>;
}

export interface ProfileDiffResult {
  readonly profileA: string;
  readonly profileB: string;
  readonly identical: boolean;
  readonly differences: {
    readonly field: string;
    readonly valueA: unknown;
    readonly valueB: unknown;
  }[];
  readonly toolsetDelta: {
    readonly onlyInA: readonly string[];
    readonly onlyInB: readonly string[];
    readonly shared: readonly string[];
  };
  readonly axiomDelta: {
    readonly onlyInA: readonly string[];
    readonly onlyInB: readonly string[];
    readonly shared: readonly string[];
  };
}

export interface ProfileQueryFilter {
  readonly text?: string;
  readonly status?: ProfileStatus;
  readonly category?: ProfileCategory;
  readonly isFavorite?: boolean;
  readonly model?: string;
  readonly tag?: string;
  readonly extends?: string;
  readonly sortBy?: "recent" | "name" | "usage" | "favorites";
  readonly sortDirection?: "asc" | "desc";
  readonly limit?: number;
}

export interface ProfileExportBundle {
  readonly version: "1.0.0";
  readonly exportedAtMs: number;
  readonly profile: ProfileDescriptor;
  readonly sha256Signature: string;
}

export interface ProfileWorkspaceSnapshot {
  readonly profiles: readonly ProfileDescriptor[];
  readonly sessionBindings: Record<string, string>;
  readonly activeDefaultProfileId: string;
  readonly totalProfiles: number;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface ProfileRow {
  readonly id: string;
  readonly name: string;
  readonly category: ProfileCategory;
  readonly status: ProfileStatus;
  readonly modelPreference: string;
  readonly isFavorite: boolean;
  readonly isProtected: boolean;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly [key: string]: unknown;
}

export interface ProfileBindingRow {
  readonly id: string;
  readonly sessionId: string;
  readonly profileId: string;
  readonly boundAtMs: number;
  readonly [key: string]: unknown;
}

export interface ProfileTransitionRow {
  readonly id: string;
  readonly sessionId: string;
  readonly fromProfile: string;
  readonly toProfile: string;
  readonly timestampMs: number;
  readonly [key: string]: unknown;
}

export interface ProfileAuditRow {
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

export type ProfileHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "critical_unbound";

export interface ProfileHealthAuditReport {
  readonly totalProfiles: number;
  readonly activeProfilesCount: number;
  readonly favoriteProfilesCount: number;
  readonly boundSessionsCount: number;
  readonly healthStatus: ProfileHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ProfileMetricsReport {
  readonly totalProfiles: number;
  readonly activeProfiles: number;
  readonly suspendedProfiles: number;
  readonly archivedProfiles: number;
  readonly categoryDistribution: Readonly<Record<string, number>>;
  readonly totalBoundSessions: number;
  readonly totalInvocations: number;
  readonly totalTokensSaved: number;
  readonly p50Invocations: number;
  readonly p95Invocations: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type ProfileGroupBy = "category" | "status" | "model" | "favorite";

export type ProfileSortBy = "name" | "category" | "recent" | "usage";

export type ProfileSortDirection = "asc" | "desc";

export interface ProfileGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly profiles: readonly ProfileDescriptor[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface ProfileDslQueryFilter {
  readonly rawQuery: string;
  readonly category?: ProfileCategory;
  readonly status?: ProfileStatus;
  readonly model?: string;
  readonly isFavorite?: boolean;
  readonly isProtected?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface ProfileMutationUndoRecord {
  readonly mutationType: "create_profile" | "update_profile" | "delete_profile" | "clone_profile" | "bulk";
  readonly previousSnapshot: ProfileWorkspaceSnapshot;
  readonly nextSnapshot: ProfileWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ProfileBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedProfileIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliProfileSubstrate {
  createProfile(profile: ProfileDescriptor): boolean;
  getProfile(profileId: string): ProfileDescriptor | undefined;
  listProfiles(filter?: ProfileQueryFilter): readonly ProfileDescriptor[];
  updateProfile(profileId: string, mutation: ProfileMutation): ProfileDescriptor | undefined;
  deleteProfile(profileId: string): boolean;
  cloneProfile(sourceProfileId: string, targetProfileId: string, options?: ProfileCloneOptions): ProfileDescriptor | undefined;
  bindSession(sessionId: string, profileId: string): boolean;
  unbindSession(sessionId: string): boolean;
  getProfileForSession(sessionId: string): ProfileDescriptor;
  getActiveDefaultProfile(): ProfileDescriptor;
  setActiveDefaultProfile(profileId: string): boolean;
  getMetrics(): ProfileMetricsReport;
  auditHealth(): ProfileHealthAuditReport;
  getGroupedProfiles(groupBy?: ProfileGroupBy, sortBy?: ProfileSortBy, direction?: ProfileSortDirection): readonly ProfileGroupedLane[];
  queryProfilesDsl(query: ProfileDslQueryFilter | string): readonly ProfileDescriptor[];
  bulkPurgeProfiles(profileIds: readonly string[]): ProfileBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ProfileWorkspaceSnapshot;
  importSnapshot(snapshot: ProfileWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}

