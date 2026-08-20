/**
 * profile.contracts.ts
 *
 * Core data contracts for Persistent Multi-Profile Isolation, Environment Routing,
 * Persona Cloning, Hierarchical Inheritance, Blueprint Catalog, Immutable Revisions,
 * Dynamic Prompt Hydration, Multi-Agent Mesh, MCP Bindings, RAG Knowledge Scoping,
 * SLA Governance, Few-Shot Exemplars, Memory Policies, Resilient Model Fallbacks,
 * Voice Multimodal Synthesis, Prefix Cache Framing, Run Step Budgeting, Lifecycle Hooks,
 * Automated Eval Benchmark Suites, and Guardrails (Target #76 / ADR-119 / Zenith Tier).
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

// ---------------------------------------------------------------------------
// Execution Hyperparameters & Structured Output Schemas
// ---------------------------------------------------------------------------

export type ProfileResponseFormat = "text" | "json_object" | "json_schema";

export interface ProfileExecutionParameters {
  readonly temperature?: number; // 0.0 - 2.0
  readonly topP?: number; // 0.0 - 1.0
  readonly frequencyPenalty?: number; // -2.0 - 2.0
  readonly presencePenalty?: number; // -2.0 - 2.0
  readonly maxTokens?: number;
  readonly seed?: number;
  readonly stopSequences?: readonly string[];
  readonly responseFormat?: ProfileResponseFormat;
  readonly jsonSchema?: Record<string, unknown>;
  readonly contextWindowLimit?: number;
}

// ---------------------------------------------------------------------------
// SLA Budgets, Quotas & Token Governance
// ---------------------------------------------------------------------------

export interface ProfileGovernanceConfig {
  readonly maxTokensPerTurn?: number;
  readonly maxMonthlyBudgetUsd?: number;
  readonly rateLimitPerMin?: number;
  readonly concurrencyLimit?: number;
  readonly strictTimeoutMs?: number;
  readonly costPerInputTokenUsd?: number;
  readonly costPerOutputTokenUsd?: number;
}

// ---------------------------------------------------------------------------
// Multi-Agent Swarm / Delegation Mesh
// ---------------------------------------------------------------------------

export type ProfileDelegationStrategy = "router" | "hierarchical" | "peer_mesh" | "standalone";

export interface ProfileDelegationConfig {
  readonly canSpawnSubagents?: boolean;
  readonly maxSubagentDepth?: number;
  readonly allowedHandoffProfiles?: readonly string[];
  readonly delegationStrategy?: ProfileDelegationStrategy;
  readonly autoHandoffAxiom?: string;
}

// ---------------------------------------------------------------------------
// Model Context Protocol (MCP) Bindings
// ---------------------------------------------------------------------------

export interface ProfileMcpBinding {
  readonly serverName: string;
  readonly transport: "stdio" | "sse" | "websocket";
  readonly commandOrUrl: string;
  readonly toolsWhitelist?: readonly string[];
  readonly autoApproveTools?: readonly string[];
  readonly envOverrides?: Record<string, string>;
  readonly isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Scoped Knowledge / RAG Attachments
// ---------------------------------------------------------------------------

export type KnowledgeSourceKind = "file_glob" | "vector_index" | "url_crawler" | "git_repo";

export interface ProfileKnowledgeSource {
  readonly id: string;
  readonly name: string;
  readonly kind: KnowledgeSourceKind;
  readonly pathOrUri: string;
  readonly chunkSize?: number;
  readonly relevanceThreshold?: number;
  readonly topK?: number;
  readonly isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Safety Guardrails & Persona Drift
// ---------------------------------------------------------------------------

export type ContentModerationTier = "strict" | "standard" | "permissive" | "off";

export interface ProfileGuardrailConfig {
  readonly contentModerationLevel?: ContentModerationTier;
  readonly blockPromptInjection?: boolean;
  readonly prohibitedKeywords?: readonly string[];
  readonly maxConsecutiveFailures?: number;
  readonly fallbackResponseOnViolation?: string;
}

// ---------------------------------------------------------------------------
// Conversation Starters & Quick Action Prompts
// ---------------------------------------------------------------------------

export interface ProfileConversationStarter {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly icon?: string;
  readonly category?: string;
  readonly prefilledParameters?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Few-Shot In-Context Learning Exemplars
// ---------------------------------------------------------------------------

export interface ProfileExemplar {
  readonly id: string;
  readonly title: string;
  readonly input: string;
  readonly output: string;
  readonly explanation?: string;
  readonly tags?: readonly string[];
}

// ---------------------------------------------------------------------------
// Context Window Compression & Eviction Memory Policies
// ---------------------------------------------------------------------------

export type MemoryEvictionStrategy = "lru" | "sliding_window" | "summarize" | "hierarchical";

export interface ProfileMemoryPolicy {
  readonly maxContextTokens?: number;
  readonly evictionStrategy?: MemoryEvictionStrategy;
  readonly autoSummarizeThreshold?: number;
  readonly pinnedMemoryKeys?: readonly string[];
  readonly summarizerModel?: string;
}

// ---------------------------------------------------------------------------
// Resilient Model Fallback Ladder & Circuit Breaking
// ---------------------------------------------------------------------------

export type FallbackTrigger = "timeout" | "rate_limit" | "server_error" | "context_overflow" | "content_filter";

export interface ProfileModelFallback {
  readonly targetModel: string;
  readonly priority: number;
  readonly triggers: readonly FallbackTrigger[];
  readonly maxRetries?: number;
  readonly backoffMs?: number;
}

// ---------------------------------------------------------------------------
// Voice & Multimodal Speech Synthesis Bindings
// ---------------------------------------------------------------------------

export interface ProfileVoiceConfig {
  readonly voiceId: string;
  readonly provider: "elevenlabs" | "openai" | "web_speech" | "local_piper";
  readonly pitch?: number;
  readonly speed?: number;
  readonly stability?: number;
  readonly autoSpeakResponses?: boolean;
}

// ---------------------------------------------------------------------------
// Secret Environment & Credential Isolation
// ---------------------------------------------------------------------------

export interface ProfileSecretBinding {
  readonly secretKey: string;
  readonly envVarName: string;
  readonly isMasked: boolean;
  readonly scope: "session" | "workspace" | "global";
}

// ---------------------------------------------------------------------------
// A/B Prompt Variants & Experimentation
// ---------------------------------------------------------------------------

export interface ProfileVariant {
  readonly variantId: string;
  readonly name: string;
  readonly weight: number; // 0.0 - 1.0
  readonly soulPrompt: string;
  readonly parameters?: ProfileExecutionParameters;
  readonly totalRuns: number;
  readonly averageScore: number;
}

// ---------------------------------------------------------------------------
// Prefix Cache Frame Engineering (Anthropic / OpenAI Cache Optimization)
// ---------------------------------------------------------------------------

export interface ProfilePrefixCacheFrame {
  readonly profileId: string;
  readonly prefixCacheHash: string; // SHA-256 of static immutable prefix
  readonly systemBlock: string;
  readonly toolsBlock: string;
  readonly knowledgeBlock: string;
  readonly exemplarsBlock: string;
  readonly dynamicBlock: string;
  readonly fullRenderedPrompt: string;
  readonly estimatedStaticTokens: number;
}

// ---------------------------------------------------------------------------
// Run Orchestration & Step Budgeting
// ---------------------------------------------------------------------------

export type ProfileRunStatus = "queued" | "in_progress" | "requires_action" | "completed" | "failed" | "cancelled" | "budget_exceeded";

export interface ProfileRunStep {
  readonly stepIndex: number;
  readonly stepKind: "prompt" | "tool_call" | "tool_result" | "reasoning" | "handoff";
  readonly name: string;
  readonly inputPayload?: unknown;
  readonly outputPayload?: unknown;
  readonly tokensConsumed?: number;
  readonly latencyMs: number;
  readonly status: "success" | "failure";
}

export interface ProfileRunState {
  readonly runId: string;
  readonly profileId: string;
  readonly sessionId: string;
  readonly status: ProfileRunStatus;
  readonly maxSteps: number;
  readonly currentStep: number;
  readonly steps: readonly ProfileRunStep[];
  readonly totalTokensConsumed: number;
  readonly totalCostUsd: number;
  readonly handoffHops: number;
  readonly startedAtMs: number;
  readonly completedAtMs?: number;
  readonly failureReason?: string;
}

// ---------------------------------------------------------------------------
// Automated Profile Evals & Benchmarks
// ---------------------------------------------------------------------------

export interface ProfileEvalAssertion {
  readonly type: "contains_text" | "not_contains_text" | "axiom_compliance" | "json_schema_valid" | "max_latency_ms" | "tool_invoked";
  readonly value: unknown;
}

export interface ProfileTestCase {
  readonly id: string;
  readonly name: string;
  readonly userPrompt: string;
  readonly assertions: readonly ProfileEvalAssertion[];
  readonly context?: ProfileTemplateHydrationContext;
}

export interface ProfileTestCaseResult {
  readonly testCaseId: string;
  readonly passed: boolean;
  readonly scorePercent: number;
  readonly latencyMs: number;
  readonly failures: readonly string[];
}

export interface ProfileEvalReport {
  readonly profileId: string;
  readonly suiteName: string;
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  readonly overallScorePercent: number;
  readonly results: readonly ProfileTestCaseResult[];
  readonly evaluatedAtMs: number;
}

// ---------------------------------------------------------------------------
// Lifecycle Event Hooks & Interceptors
// ---------------------------------------------------------------------------

export type ProfileLifecycleEvent =
  | "before_session_bind"
  | "after_session_bind"
  | "before_prompt_synthesis"
  | "after_prompt_synthesis"
  | "on_governance_violation"
  | "on_drift_detected"
  | "on_model_fallback"
  | "on_run_completed";

export interface ProfileLifecycleEventPayload {
  readonly event: ProfileLifecycleEvent;
  readonly profileId: string;
  readonly sessionId?: string;
  readonly details?: Record<string, unknown>;
  readonly timestampMs: number;
}

export type ProfileLifecycleHook = (payload: ProfileLifecycleEventPayload) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Immutable Profile Revision Ledger
// ---------------------------------------------------------------------------

export interface ProfileRevision {
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly semanticVersion: string; // e.g. "1.0.0"
  readonly snapshot: ProfileDescriptor;
  readonly changeLog: string;
  readonly author?: string;
  readonly timestampMs: number;
  readonly sha256Signature: string;
}

// ---------------------------------------------------------------------------
// Telemetry & Metrics
// ---------------------------------------------------------------------------

export interface ProfileTelemetry {
  readonly totalInvocations: number;
  readonly totalSessionsBound: number;
  readonly lastActivatedAtMs?: number;
  readonly estimatedTokensSaved: number;
  readonly totalTokensConsumed?: number;
  readonly totalCostUsd?: number;
  readonly p50LatencyMs?: number;
  readonly p99LatencyMs?: number;
  readonly errorRatePercent?: number;
  readonly toolCallSuccessCount?: number;
  readonly toolCallFailureCount?: number;
  readonly rateLimitViolationsCount?: number;
  readonly lastAxiomComplianceScore?: number;
}

// ---------------------------------------------------------------------------
// Dynamic Prompt Template Hydration Context
// ---------------------------------------------------------------------------

export interface ProfileTemplateHydrationContext {
  readonly workspaceRoot?: string;
  readonly userName?: string;
  readonly sessionId?: string;
  readonly datetimeIso?: string;
  readonly env?: Record<string, string>;
  readonly customVars?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Axiom Compliance & Drift Report
// ---------------------------------------------------------------------------

export interface ProfileAxiomComplianceReport {
  readonly profileId: string;
  readonly totalAxioms: number;
  readonly compliantAxioms: readonly string[];
  readonly violatedAxioms: readonly { axiom: string; violationReason: string; severity: "low" | "medium" | "high" }[];
  readonly complianceScorePercent: number; // 0 - 100
  readonly isAcceptable: boolean;
  readonly timestampMs: number;
}

// ---------------------------------------------------------------------------
// Primary Profile Descriptor (Zenith Tier)
// ---------------------------------------------------------------------------

export interface ProfileDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProfileStatus;
  readonly version?: string; // e.g. "1.0.0"
  readonly revisionNumber?: number;
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
  readonly parameters?: ProfileExecutionParameters;
  readonly governance?: ProfileGovernanceConfig;
  readonly delegation?: ProfileDelegationConfig;
  readonly mcpBindings?: readonly ProfileMcpBinding[];
  readonly knowledgeSources?: readonly ProfileKnowledgeSource[];
  readonly guardrails?: ProfileGuardrailConfig;
  readonly conversationStarters?: readonly ProfileConversationStarter[];
  readonly exemplars?: readonly ProfileExemplar[];
  readonly memoryPolicy?: ProfileMemoryPolicy;
  readonly fallbackLadder?: readonly ProfileModelFallback[];
  readonly voice?: ProfileVoiceConfig;
  readonly secrets?: readonly ProfileSecretBinding[];
  readonly variants?: readonly ProfileVariant[];
  readonly activeVariantId?: string;
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
  readonly version?: string;
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
  readonly parameters?: ProfileExecutionParameters;
  readonly governance?: ProfileGovernanceConfig;
  readonly delegation?: ProfileDelegationConfig;
  readonly mcpBindings?: readonly ProfileMcpBinding[];
  readonly knowledgeSources?: readonly ProfileKnowledgeSource[];
  readonly guardrails?: ProfileGuardrailConfig;
  readonly conversationStarters?: readonly ProfileConversationStarter[];
  readonly exemplars?: readonly ProfileExemplar[];
  readonly memoryPolicy?: ProfileMemoryPolicy;
  readonly fallbackLadder?: readonly ProfileModelFallback[];
  readonly voice?: ProfileVoiceConfig;
  readonly secrets?: readonly ProfileSecretBinding[];
  readonly variants?: readonly ProfileVariant[];
  readonly activeVariantId?: string;
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
  readonly preserveRevisions?: boolean;
  readonly preserveExemplars?: boolean;
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
  readonly defaultParameters?: ProfileExecutionParameters;
  readonly defaultGovernance?: ProfileGovernanceConfig;
  readonly defaultDelegation?: ProfileDelegationConfig;
  readonly conversationStarters?: readonly ProfileConversationStarter[];
  readonly defaultExemplars?: readonly ProfileExemplar[];
  readonly defaultMemoryPolicy?: ProfileMemoryPolicy;
  readonly defaultVoice?: ProfileVoiceConfig;
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

export type ProfileSortBy = "name" | "category" | "recent" | "usage" | "favorites";

export interface ProfileQueryFilter {
  readonly text?: string;
  readonly status?: ProfileStatus;
  readonly category?: ProfileCategory;
  readonly isFavorite?: boolean;
  readonly model?: string;
  readonly tag?: string;
  readonly extends?: string;
  readonly hasExemplars?: boolean;
  readonly hasMcp?: boolean;
  readonly hasVoice?: boolean;
  readonly minInvocations?: number;
  readonly maxCost?: number;
  readonly sortBy?: ProfileSortBy;
  readonly sortDirection?: "asc" | "desc";
  readonly limit?: number;
}

export interface ProfileExportBundle {
  readonly version: "2.0.0" | "1.0.0";
  readonly exportedAtMs: number;
  readonly profile: ProfileDescriptor;
  readonly revisions?: readonly ProfileRevision[];
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
  readonly version?: string;
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

export interface ProfileRevisionRow {
  readonly id: string;
  readonly profileId: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly semanticVersion: string;
  readonly changeLog: string;
  readonly timestampMs: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type ProfileHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "critical_unbound"
  | "quota_exceeded";

export interface ProfileHealthAuditReport {
  readonly totalProfiles: number;
  readonly activeProfilesCount: number;
  readonly favoriteProfilesCount: number;
  readonly boundSessionsCount: number;
  readonly healthStatus: ProfileHealthStatus;
  readonly quotaViolationsCount: number;
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
  readonly totalTokensConsumed: number;
  readonly totalCostUsd: number;
  readonly p50Invocations: number;
  readonly p95Invocations: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type ProfileGroupBy = "category" | "status" | "model" | "favorite";

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
  readonly hasExemplars?: boolean;
  readonly hasMcp?: boolean;
  readonly hasVoice?: boolean;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface ProfileMutationUndoRecord {
  readonly mutationType: "create_profile" | "update_profile" | "delete_profile" | "clone_profile" | "rollback" | "bulk";
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
// Substrate Interface (Zenith Tier)
// ---------------------------------------------------------------------------

export interface IBroccoliProfileSubstrate {
  createProfile(profile: ProfileDescriptor): boolean;
  getProfile(profileId: string): ProfileDescriptor | undefined;
  listProfiles(filter?: ProfileQueryFilter): readonly ProfileDescriptor[];
  updateProfile(profileId: string, mutation: ProfileMutation): ProfileDescriptor | undefined;
  deleteProfile(profileId: string): boolean;
  cloneProfile(sourceProfileId: string, targetProfileId: string, options?: ProfileCloneOptions): ProfileDescriptor | undefined;
  createRevision(profileId: string, changeLog: string, author?: string): ProfileRevision | undefined;
  rollbackToRevision(profileId: string, revisionId: string): ProfileDescriptor | undefined;
  listRevisions(profileId: string): readonly ProfileRevision[];
  addExemplar(profileId: string, exemplar: ProfileExemplar): boolean;
  removeExemplar(profileId: string, exemplarId: string): boolean;
  resolveNextFallbackModel(profileId: string, trigger: FallbackTrigger): string | undefined;
  buildPrefixCacheFrame(profileId: string, context?: ProfileTemplateHydrationContext): ProfilePrefixCacheFrame;
  createRun(profileId: string, sessionId: string, maxSteps?: number): ProfileRunState;
  recordRunStep(runId: string, step: Omit<ProfileRunStep, "stepIndex">): ProfileRunStep | undefined;
  completeRun(runId: string, status: ProfileRunStatus, failureReason?: string): ProfileRunState | undefined;
  getRun(runId: string): ProfileRunState | undefined;
  registerHook(event: ProfileLifecycleEvent, hook: ProfileLifecycleHook): void;
  triggerHook(event: ProfileLifecycleEvent, payload: Omit<ProfileLifecycleEventPayload, "event" | "timestampMs">): Promise<void>;
  bindSession(sessionId: string, profileId: string): boolean;
  unbindSession(sessionId: string): boolean;
  getProfileForSession(sessionId: string): ProfileDescriptor;
  getActiveDefaultProfile(): ProfileDescriptor;
  setActiveDefaultProfile(profileId: string): boolean;
  recordInvocationUsage(profileId: string, tokensUsed: number, costUsd: number, latencyMs: number, success: boolean): void;
  checkGovernanceQuota(profileId: string): { allowed: boolean; reason?: string };
  canDelegateTo(sourceProfileId: string, targetProfileId: string): { allowed: boolean; reason?: string };
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
