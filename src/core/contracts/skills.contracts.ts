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
