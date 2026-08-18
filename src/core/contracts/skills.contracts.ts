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
  signalOrigin?: "user_correction" | "workflow_refinement" | "debugging_technique" | "tool_workaround";
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
  type: "user_correction" | "workflow_refinement" | "debugging_technique" | "tool_workaround";
  context: string;
  confidence: number;
  targetSkillHint?: string;
  suggestedAction: "patch_loaded" | "patch_umbrella" | "add_support_file" | "create_class_umbrella";
  proposedContent?: string;
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
  readonly mutationType: "create" | "update" | "delete" | "patch" | "bulk";
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

export interface IBroccoliSkillTreeSubstrate {
  initialize(initialNodes?: readonly SkillNodeManifest[]): void;
  getNode(id: string): SkillNodeManifest | undefined;
  getAllNodes(): readonly SkillNodeManifest[];
  getDag(): SkillTreeDag;
  saveNode(node: SkillNodeManifest): void;
  deleteNode?(id: string): boolean;
  recordSkillUsage(id: string, tickIndex: number): void;
  clear(): void;
}

export interface ISkillTreeSnapshotManager {
  createSnapshot(tickIndex: number): string;
  restoreSnapshot(snapshotId: string): boolean;
  rollbackLastMutation(): boolean;
  getSnapshotHistory(): readonly { snapshotId: string; tickIndex: number; timestamp: number }[];
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
}

export interface IAntiDegenerationGuard {
  validateEvolutionProposal(signal: SkillEvolutionSignal, proposedContent: string): {
    allowed: boolean;
    violations: readonly string[];
  };
}
