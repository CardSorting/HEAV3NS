export type SkillTier = "novice" | "adept" | "master" | "sovereign";

export type SkillLifecycleState = "active" | "dormant" | "consolidated" | "archived" | "pinned";

export type SkillProvenance = "system_bundled" | "user_created" | "evolved_mutation" | "hub_installed";

export interface SkillSupportFile {
  relativePath: string;
  kind: "reference" | "template" | "script" | "asset";
  content: string;
  hash: string;
  byteSize: number;
}

export interface SkillCompetencyVector {
  syntaxAccuracy: number; // 0 to 100
  executionReliability: number; // 0 to 100
  recoveryResilience: number; // 0 to 100
  speedEfficiency: number; // 0 to 100
}

export interface SkillEvolutionLineage {
  generation: number;
  ancestorId?: string;
  branchOrigin?: string;
  mutationCount: number;
  speciatedChildren?: readonly string[];
  consolidatedFrom?: readonly string[];
  createdAtMs?: number;
}

export interface SkillNodeManifest {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: SkillTier;
  version: string;
  author: string;
  platforms?: readonly string[];
  prerequisites: readonly string[];
  relatedSkills: readonly string[];
  tags: readonly string[];
  masteryScore: number; // 0 to 100
  fitnessScore: number; // 0.0 to 1.0
  useCount: number;
  lastUsedTick: number;
  createdTick: number;
  lifecycleState: SkillLifecycleState;
  provenance: SkillProvenance;
  pinned: boolean;
  location: string;
  body: string;
  contentHash: string;
  supportFiles: readonly SkillSupportFile[];
  competencies?: SkillCompetencyVector;
  lineage?: SkillEvolutionLineage;
  synergies?: readonly string[];
  updatedAtMs?: number;
}

export interface SkillTreeDag {
  nodes: ReadonlyMap<string, SkillNodeManifest>;
  prerequisiteEdges: ReadonlyMap<string, readonly string[]>; // node -> prerequisite parents
  dependentsEdges: ReadonlyMap<string, readonly string[]>; // parent -> dependent children
  affinityEdges: ReadonlyMap<string, readonly string[]>; // bidirectional conceptual links
  topologicalOrder: readonly string[];
  cycles: readonly string[][];
  unlockedNodeIds: ReadonlySet<string>;
  lockedNodeIds: ReadonlyMap<string, readonly string[]>; // node -> missing prerequisite ids
}

export interface SkillMutationChunk {
  startLine: number;
  endLine: number;
  targetContent: string;
  replacementContent: string;
  expectedHash?: string;
}

export interface SkillMutationPayload {
  mutationId: string;
  targetSkillId: string;
  action: "create" | "patch" | "rewrite" | "add_support_file" | "remove_support_file" | "archive" | "consolidate";
  reason: string;
  signalOrigin?: "user_correction" | "workflow_refinement" | "debugging_technique" | "tool_workaround" | "performance_breakthrough";
  chunks?: readonly SkillMutationChunk[];
  newNode?: Partial<SkillNodeManifest>;
  supportFile?: SkillSupportFile;
  targetSupportFilePath?: string;
  umbrellaTargetId?: string;
  tickIndex: number;
}

export interface SkillMutationResult {
  mutationId: string;
  success: boolean;
  skillId: string;
  previousHash?: string;
  newHash?: string;
  error?: string;
  timestamp: number;
  rolledBack?: boolean;
}

export interface SkillEvolutionSignal {
  type: "user_correction" | "workflow_refinement" | "debugging_technique" | "tool_workaround" | "performance_breakthrough";
  context: string;
  confidence: number;
  targetSkillHint?: string;
  suggestedAction: "patch_loaded" | "patch_umbrella" | "add_support_file" | "create_class_umbrella" | "speciate_skill";
  proposedContent?: string;
  detectedMetrics?: {
    latencyReductionMs?: number;
    toolCallCount?: number;
    errorRecoverySuccess?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Skill Strategy & Execution Plan Contracts
// ---------------------------------------------------------------------------

export type SkillExecutionPolicy =
  | "greedy_mastery"
  | "balanced_adaptive"
  | "exploration_learning"
  | "min_latency"
  | "defensive_sovereign";

export interface SkillStrategyGoal {
  readonly prompt: string;
  readonly categoryHint?: string;
  readonly requiredCapabilities?: readonly string[];
  readonly maxDepth?: number;
  readonly policy?: SkillExecutionPolicy;
  readonly preferredSkillIds?: readonly string[];
}

export interface SkillStrategyStep {
  readonly stepIndex: number;
  readonly skillId: string;
  readonly skillName: string;
  readonly tier: SkillTier;
  readonly masteryScore: number;
  readonly rationale: string;
  readonly expectedOutput?: string;
}

export interface SkillComboSynergy {
  readonly pairKey: string;
  readonly skillIds: readonly string[];
  readonly name: string;
  readonly description: string;
  readonly fitnessMultiplier: number;
  readonly xpMultiplier: number;
  readonly active: boolean;
}

export interface SkillStrategyPlan {
  readonly strategyId: string;
  readonly goal: SkillStrategyGoal;
  readonly policy: SkillExecutionPolicy;
  readonly primarySkill: SkillNodeManifest;
  readonly executionChain: readonly SkillStrategyStep[];
  readonly fallbackChain: readonly SkillStrategyStep[];
  readonly synergies: readonly SkillComboSynergy[];
  readonly confidenceScore: number; // 0.0 to 1.0
  readonly estimatedLatencyMs: number;
  readonly rationale: string;
  readonly createdMs: number;
}

export interface SkillEvolutionPath {
  readonly targetSkillId: string;
  readonly targetSkillName: string;
  readonly targetTier: SkillTier;
  readonly currentMastery: number;
  readonly unlocked: boolean;
  readonly requiredPrerequisites: readonly string[];
  readonly recommendedSequence: readonly {
    readonly skillId: string;
    readonly skillName: string;
    readonly currentMastery: number;
    readonly targetMastery: number;
    readonly estimatedXpNeeded: number;
  }[];
  readonly totalXpToTarget: number;
  readonly difficulty: "trivial" | "moderate" | "demanding" | "epic";
}

export interface SpecializedBranch {
  readonly suffix: string;
  readonly name: string;
  readonly description: string;
  readonly focusTags: readonly string[];
  readonly specializedBody: string;
}

export interface SkillRecommendation {
  readonly skill: SkillNodeManifest;
  readonly score: number;
  readonly reason: string;
}

export interface SkillProgressionTrack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly targetRole: string;
  readonly stages: readonly {
    readonly stageIndex: number;
    readonly title: string;
    readonly requiredSkillIds: readonly string[];
    readonly minimumMastery: number;
    readonly unlockedReward: string;
  }[];
  readonly progressPercent: number;
}

export interface SkillEvolutionMilestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly unlocked: boolean;
  readonly progress: number; // 0.0 to 1.0
  readonly requirementText: string;
  readonly rewardPerk: string;
}

// ---------------------------------------------------------------------------
// Health, Metrics & SLA Contracts
// ---------------------------------------------------------------------------

export type SkillHealthStatus = "mastered" | "developing" | "stagnant" | "degraded";

export interface SkillHealthAuditReport {
  readonly skillId?: string;
  readonly totalSkills: number;
  readonly activeSkills: number;
  readonly averageMasteryScore: number;
  readonly averageFitnessScore: number;
  readonly healthStatus: SkillHealthStatus;
  readonly lockedPrerequisitesCount: number;
  readonly degradedSkillsCount: number;
  readonly recommendations: readonly string[];
}

export interface SkillMetricsReport {
  readonly totalSkills: number;
  readonly activeSkills: number;
  readonly dormantSkills: number;
  readonly archivedSkills: number;
  readonly pinnedSkills: number;
  readonly averageMasteryScore: number;
  readonly averageFitnessScore: number;
  readonly totalMutationsCount: number;
  readonly mutationSuccessRatePercent: number;
  readonly p50MutationLatencyMs: number;
  readonly p95MutationLatencyMs: number;
  readonly tierDistribution: Record<SkillTier, number>;
}

// ---------------------------------------------------------------------------
// Grouping & Swimlanes Contracts
// ---------------------------------------------------------------------------

export type SkillGroupBy = "tier" | "category" | "lifecycleState" | "provenance" | "health";
export type SkillSortBy = "mastery" | "fitness" | "usage" | "recent" | "name";
export type SkillSortDirection = "asc" | "desc";

export interface SkillGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly skills: readonly SkillNodeManifest[];
}

// ---------------------------------------------------------------------------
// Notification Contracts
// ---------------------------------------------------------------------------

export type SkillNotificationTrigger =
  | "skill_unlocked"
  | "skill_mutated"
  | "skill_degraded"
  | "mastery_promoted"
  | "curation_warning"
  | "custom";

export type SkillNotificationUrgency = "low" | "normal" | "critical";

export interface SkillNotificationEvent {
  readonly skillId?: string;
  readonly title: string;
  readonly message: string;
  readonly urgency: SkillNotificationUrgency;
  readonly trigger: SkillNotificationTrigger;
  readonly metadata?: Record<string, unknown>;
  readonly actionUrl?: string;
}

export interface SkillNotificationPreferences {
  readonly enabled: boolean;
  readonly soundEnabled: boolean;
  readonly dndEnabled: boolean;
  readonly minUrgency: SkillNotificationUrgency;
  readonly allowedTriggers: readonly SkillNotificationTrigger[];
}

export interface SkillNotificationRecord {
  readonly id: string;
  readonly event: SkillNotificationEvent;
  readonly dispatchedAtMs: number;
  readonly delivered: boolean;
  readonly read: boolean;
  readonly audioPlayed: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Query Contracts
// ---------------------------------------------------------------------------

export interface SkillMutationUndoRecord {
  readonly mutationType: "create" | "update" | "delete" | "patch" | "bulk" | "speciate" | "consolidate";
  readonly previousNode?: SkillNodeManifest;
  readonly nextNode?: SkillNodeManifest;
  readonly previousNodes?: readonly SkillNodeManifest[];
  readonly nextNodes?: readonly SkillNodeManifest[];
  readonly timestampMs: number;
}

export interface SkillDslQueryFilter {
  readonly rawQuery: string;
  readonly tier?: SkillTier;
  readonly category?: string;
  readonly lifecycleState?: SkillLifecycleState;
  readonly provenance?: SkillProvenance;
  readonly minMastery?: number;
  readonly isPinned?: boolean;
  readonly tags?: readonly string[];
  readonly textTerms?: readonly string[];
}

export interface SkillBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedSkillIds: readonly string[];
}

export interface SkillStateSnapshot {
  readonly nodes: readonly SkillNodeManifest[];
  readonly mutations: readonly SkillMutationResult[];
  readonly timestamp: number;
  readonly snapshotTick: number;
}

// ---------------------------------------------------------------------------
// BroccoliDB Table Row Schemas
// ---------------------------------------------------------------------------

export interface SkillNodeRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly tier: SkillTier;
  readonly masteryScore: number;
  readonly fitnessScore: number;
  readonly useCount: number;
  readonly lifecycleState: SkillLifecycleState;
  readonly provenance: SkillProvenance;
  readonly pinned: boolean;
  readonly tags: string;
  readonly updatedAtMs: number;
  readonly [key: string]: unknown;
}

export interface SkillMutationRow {
  readonly id: string;
  readonly mutationId: string;
  readonly skillId: string;
  readonly success: boolean;
  readonly action?: string;
  readonly durationMs?: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface SkillUsageRow {
  readonly id: string;
  readonly skillId: string;
  readonly tickIndex: number;
  readonly timestampMs: number;
  readonly [key: string]: unknown;
}

export interface SkillNotificationRow {
  readonly id: string;
  readonly skillId?: string;
  readonly title: string;
  readonly trigger: SkillNotificationTrigger;
  readonly urgency: SkillNotificationUrgency;
  readonly dispatchedAtMs: number;
  readonly read: boolean;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface ISkillTreeParser {
  parseSkillMarkdown(folderName: string, filePath: string, rawContent: string): SkillNodeManifest;
  buildSkillDag(manifests: readonly SkillNodeManifest[]): SkillTreeDag;
  validateFrontmatter(manifest: SkillNodeManifest): { valid: boolean; errors: readonly string[] };
  sanitizeSourceText(text: string): string;
}

export interface IAnchoredSkillMutator {
  applyMutation(payload: SkillMutationPayload, currentDag: SkillTreeDag): Promise<SkillMutationResult>;
  verifyProvenanceRead(skillId: string): boolean;
  markSkillRead(skillId: string): void;
}

// ---------------------------------------------------------------------------
// Intuitive Custom SKILL Creation & Guided Wizard Contracts
// ---------------------------------------------------------------------------

export type SkillFormatExportKind =
  | "skill_markdown"
  | "openai_tool_schema"
  | "anthropic_tool_spec"
  | "json_ld_skill"
  | "declarative_yaml"
  | "compact_json";

export interface SkillWizardOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly defaultTier?: SkillTier;
  readonly defaultCategory?: string;
}

export interface SkillWizardQuestion {
  readonly step: number;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly isMultiSelect?: boolean;
  readonly options: readonly SkillWizardOption[];
}

export interface SkillWizardAnswers {
  readonly name?: string;
  readonly domainOrCategory: string;
  readonly executionMode: string;
  readonly initialTier?: SkillTier;
  readonly safetyLevel?: "read_only_safe" | "mutation_allowed" | "air_gapped_isolated" | "strict_zero_gc";
  readonly customRules?: readonly string[];
  readonly appliedPacks?: readonly string[];
  readonly targetSkillId?: string;
}

export interface SkillPowerUpPack {
  readonly id: string;
  readonly name: string;
  readonly tagLine: string;
  readonly description: string;
  readonly category: "resilience" | "performance" | "security" | "observability" | "governance";
  readonly masteryScoreDelta: number;
  readonly addedRules: readonly string[];
  readonly tags: readonly string[];
  readonly supportFiles?: readonly SkillSupportFile[];
}

export interface SkillCustomTweakSpec {
  readonly name?: string;
  readonly description?: string;
  readonly category?: string;
  readonly tier?: SkillTier;
  readonly addedRules?: readonly string[];
  readonly addedTags?: readonly string[];
  readonly addedPrerequisites?: readonly string[];
  readonly masteryDelta?: number;
}

export type SkillNodeLintSeverity = "info" | "warning" | "error";

export interface SkillNodeLintIssue {
  readonly id: string;
  readonly severity: SkillNodeLintSeverity;
  readonly title: string;
  readonly description: string;
  readonly affectedField: string;
  readonly autoFixable: boolean;
  readonly suggestedFix?: string;
}

export interface SkillNodeLintReport {
  readonly skillId: string;
  readonly skillName: string;
  readonly isValid: boolean;
  readonly issuesCount: number;
  readonly warningsCount: number;
  readonly errorsCount: number;
  readonly issues: readonly SkillNodeLintIssue[];
  readonly overallCohesionScore: number; // 0 to 100
  readonly plainLanguageVerdict: string;
}

export interface SkillForgeOptions {
  readonly name?: string;
  readonly category?: string;
  readonly tier?: SkillTier;
  readonly appliedPacks?: readonly string[];
  readonly targetSkillId?: string;
}

export interface SkillDroppedFileEntry {
  readonly filename: string;
  readonly fullPath: string;
  readonly formatDetected: SkillFormatExportKind | "unknown_text" | "script_code";
  readonly skillId: string;
  readonly sizeBytes: number;
  readonly lastModified: number;
  readonly isValid: boolean;
  readonly errorMessage?: string;
  readonly skillName?: string;
  readonly tier?: SkillTier;
  readonly category?: string;
}

export interface SkillDirectorySyncReport {
  readonly directoryPath: string;
  readonly isInitialized: boolean;
  readonly filesScanned: number;
  readonly loadedCount: number;
  readonly failedCount: number;
  readonly droppedFiles: readonly SkillDroppedFileEntry[];
  readonly loadedSkillIds: readonly string[];
  readonly syncTimestamp: number;
}

export interface SkillDropVaultStatus {
  readonly directoryPath: string;
  readonly isInitialized: boolean;
  readonly totalFiles: number;
  readonly loadedSkillsCount: number;
  readonly supportedExtensions: readonly string[];
  readonly templatesAvailable: boolean;
}

export interface SkillImportResult {
  readonly success: boolean;
  readonly sourceFormat: SkillFormatExportKind;
  readonly skillId?: string;
  readonly manifest?: SkillNodeManifest;
  readonly warnings: readonly string[];
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSkillTreeSubstrate {
  initialize(initialNodes?: readonly SkillNodeManifest[]): void;
  getNode(id: string): SkillNodeManifest | undefined;
  getAllNodes(): readonly SkillNodeManifest[];
  getDag(): SkillTreeDag;
  saveNode(node: SkillNodeManifest): void;
  deleteNode?(id: string): boolean;
  recordSkillUsage(id: string, tickIndex: number): void;
  clear(): void;

  // Intuitive Custom SKILL Forge, Wizard & Power-Up API
  forgeCustomSkill(prompt: string, options?: SkillForgeOptions): SkillNodeManifest;
  buildSkillFromWizard(answers: SkillWizardAnswers): SkillNodeManifest;
  cloneAndModifySkill(sourceSkillId: string, newSkillId: string, tweaks: SkillCustomTweakSpec): SkillNodeManifest;
  applySkillPowerUp(skillId: string, packId: string): SkillNodeManifest | undefined;
  listSkillPowerUps(): readonly SkillPowerUpPack[];
  lintSkillNode(skillId: string): SkillNodeLintReport;
  autoFixSkillNode(skillId: string): SkillNodeManifest | undefined;
  getSkillWizardQuestions(): readonly SkillWizardQuestion[];

  // Dedicated Drag-and-Drop Skill Directory Vault API (skills/)
  syncDropDirectory(customPath?: string): SkillDirectorySyncReport;
  exportToDropDirectory(skillId: string, format?: SkillFormatExportKind, filename?: string): string;
  getDropVaultStatus(customPath?: string): SkillDropVaultStatus;
  ingestDroppedFile(filePath: string): SkillImportResult;
}

export interface SkillSnapshotDiffResult {
  readonly snapshotAId: string;
  readonly snapshotBId: string;
  readonly addedNodeIds: readonly string[];
  readonly removedNodeIds: readonly string[];
  readonly modifiedNodes: readonly {
    readonly skillId: string;
    readonly masteryDelta: number;
    readonly fitnessDelta: number;
  }[];
}

export interface SkillPruningRecommendation {
  readonly skillId: string;
  readonly skillName: string;
  readonly action: "archive" | "decay" | "consolidate";
  readonly riskLevel: "low" | "medium" | "high";
  readonly rationale: string;
}

export interface ISkillTreeSnapshotManager {
  createSnapshot(tickIndex: number): string;
  restoreSnapshot(snapshotId: string): boolean;
  rollbackLastMutation(): boolean;
  getSnapshotHistory(): readonly { snapshotId: string; tickIndex: number; timestamp: number }[];
  diffSnapshots?(snapshotAId: string, snapshotBId: string): SkillSnapshotDiffResult | undefined;
}

export interface IDeterministicSkillCurator {
  evaluateDecay(currentTick: number, staleTickThreshold: number, archiveTickThreshold: number): {
    staleNodeIds: readonly string[];
    archivableNodeIds: readonly string[];
  };
  detectConsolidationClusters(similarityThreshold?: number): readonly {
    clusterName: string;
    nodeIds: readonly string[];
    similarityScore: number;
  }[];
  generatePruningRecommendations?(currentTick: number, staleThreshold?: number, archiveThreshold?: number): readonly SkillPruningRecommendation[];
}



export interface SkillCriticalPath {
  readonly criticalPathNodeIds: readonly string[];
  readonly totalPrerequisiteDepth: number;
  readonly bottleneckNodes: readonly {
    readonly skillId: string;
    readonly skillName: string;
    readonly blockedDownstreamCount: number;
    readonly currentMastery: number;
  }[];
}

export interface SkillSpeciationEvaluation {
  readonly skillId: string;
  readonly shouldSpeciate: boolean;
  readonly divergenceScore: number;
  readonly reason: string;
  readonly recommendedBranches: readonly SpecializedBranch[];
}

export interface SkillTransactionContext {
  readonly transactionId: string;
  readonly startMs: number;
  readonly operationsCount: number;
}

export interface SkillAutoRemediationReport {
  readonly repairedCount: number;
  readonly brokenEdgesFixed: number;
  readonly unlockedOrphansCount: number;
  readonly actionsTaken: readonly string[];
  readonly healthStatusAfter: SkillHealthStatus;
}

export interface SkillCompetencyUncertainty {
  readonly skillId: string;
  readonly observationCount: number;
  readonly epistemicUncertainty: number;
  readonly confidenceInterval: { readonly min: number; readonly max: number };
  readonly isStableSovereign: boolean;
}

export interface ISkillStrategyEngine {
  synthesizeStrategy(goal: SkillStrategyGoal): SkillStrategyPlan;
  evaluateSynergies(skillIds: readonly string[]): readonly SkillComboSynergy[];
  computeEvolutionPath(targetSkillId: string): SkillEvolutionPath;
  computeCriticalPath(): SkillCriticalPath;
  optimizePipelineForCostAndLatency(plan: SkillStrategyPlan, maxLatencyMs: number): SkillStrategyPlan;
  recommendNextSkills(context: string, limit?: number): readonly SkillRecommendation[];
  getProgressionTracks(): readonly SkillProgressionTrack[];
  getEvolutionMilestones(): readonly SkillEvolutionMilestone[];
}

export interface IEvolutionarySkillEngine {
  analyzeTrajectory(
    trajectory: {
      prompt: string;
      response: string;
      toolCalls?: readonly { name: string; args: unknown; result: unknown }[];
      userCorrections?: readonly string[];
      tickIndex: number;
    }
  ): readonly SkillEvolutionSignal[];
  calculateFitness(node: SkillNodeManifest, currentTick: number): number;
  updateMastery(nodeId: string, success: boolean): number;
  estimateCompetencyUncertainty(skillId: string): SkillCompetencyUncertainty;
  recombineSkillBodies(nodes: readonly SkillNodeManifest[]): string;
  evaluateSpeciationOpportunity(skillId: string): SkillSpeciationEvaluation;
  speciateSkill(skillId: string, branches: readonly SpecializedBranch[]): readonly SkillNodeManifest[];
  consolidateSkills(skillIds: readonly string[], mergedId: string, mergedName: string, mergedCategory: string): SkillNodeManifest;
  getLineage(skillId: string): SkillEvolutionLineage | undefined;
  autoRemediateHealthIssues?(): SkillAutoRemediationReport;
  getStrategyEngine?(): ISkillStrategyEngine;
}


export interface IAntiDegenerationGuard {
  validateEvolutionProposal(signal: SkillEvolutionSignal, proposedContent: string): {
    allowed: boolean;
    violations: readonly string[];
  };
  checkMutationThrashing?(targetSkillId: string, proposedContent: string, history: readonly SkillMutationResult[]): {
    isThrashing: boolean;
    reason?: string;
  };
  validateTextEntropy?(content: string): {
    valid: boolean;
    entropy: number;
    reason?: string;
  };
}

