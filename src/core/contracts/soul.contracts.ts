/**
 * Soul & Ethos Kernel System Contracts.
 * Formalized under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Defines the topological persona, immutable operational axioms, dynamic personality traits,
 * integrity verification hashes, and frame-perfect state snapshots for LUMI-JOY.
 */

export type SoulArchetype =
  | "lumi_core"
  | "game_engine_architect"
  | "formal_verifier"
  | "autonomous_critic"
  | "security_sentinel"
  | "custom_persona";

export interface SoulTrait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly weight: number; // 0.0 to 1.0
  readonly minWeight: number; // bounded minimum
  readonly maxWeight: number; // bounded maximum
  readonly category: "communication" | "cognition" | "execution" | "behavior";
}

export interface SoulAxiom {
  readonly id: string;
  readonly statement: string;
  readonly priority: number; // 1 (highest) to 10
  readonly isImmutable: boolean; // Cannot be altered or deleted by mutations
  readonly category: "determinism" | "safety" | "integrity" | "performance";
}

export interface SoulStyleRules {
  readonly tone: "direct" | "analytical" | "formal" | "concise" | "collaborative";
  readonly verbosity: "terse" | "balanced" | "detailed";
  readonly codePreference: "typescript_strict" | "idiomatic_zero_gc" | "minimal_diff";
  readonly mathematicalRigor: "informal" | "rigorous" | "axiomatic";
}

export interface SoulManifest {
  readonly id: string;
  readonly name: string;
  readonly archetype: SoulArchetype;
  readonly version: string;
  readonly summary: string;
  readonly axioms: readonly SoulAxiom[];
  readonly traits: readonly SoulTrait[];
  readonly style: SoulStyleRules;
  readonly rawBody: string;
  readonly integrityHash: string; // SHA-256 of canonical manifest
  readonly updatedTick: number;
}

export interface SoulMutationIntent {
  readonly type: "tune_trait" | "update_style" | "append_axiom" | "patch_body" | "switch_archetype";
  readonly targetTraitId?: string;
  readonly targetWeight?: number;
  readonly targetStyle?: Partial<SoulStyleRules>;
  readonly newAxiom?: SoulAxiom;
  readonly bodyPatch?: {
    readonly searchAnchor: string;
    readonly replaceWith: string;
  };
  readonly targetArchetype?: SoulArchetype;
  readonly rationale: string;
}

export interface SoulMutationResult {
  readonly success: boolean;
  readonly previousHash: string;
  readonly newHash: string;
  readonly updatedManifest?: SoulManifest;
  readonly failureReason?: string;
  readonly auditedBy: string;
  readonly timestamp?: number;
  readonly mutationId?: string;
}

export interface SoulSnapshot {
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly manifest: SoulManifest;
  readonly checksum: string;
}

// ---------------------------------------------------------------------------
// Health, Metrics & SLA Contracts
// ---------------------------------------------------------------------------

export type SoulHealthStatus = "aligned" | "drifting" | "axiom_violation" | "corrupted";

export interface SoulHealthAuditReport {
  readonly archetype: SoulArchetype;
  readonly totalTraits: number;
  readonly totalAxioms: number;
  readonly immutableAxiomsCount: number;
  readonly healthStatus: SoulHealthStatus;
  readonly averageTraitWeight: number;
  readonly integrityVerified: boolean;
  readonly recommendations: readonly string[];
}

export interface SoulMetricsReport {
  readonly archetype: SoulArchetype;
  readonly totalTraits: number;
  readonly totalAxioms: number;
  readonly averageTraitWeight: number;
  readonly categoryAverages: Record<"communication" | "cognition" | "execution" | "behavior", number>;
  readonly totalMutationsCount: number;
  readonly mutationSuccessRatePercent: number;
  readonly p50MutationLatencyMs: number;
  readonly p95MutationLatencyMs: number;
  readonly style: SoulStyleRules;
}

// ---------------------------------------------------------------------------
// Grouping & Swimlanes Contracts
// ---------------------------------------------------------------------------

export type SoulGroupBy = "category" | "archetype" | "priority" | "health";
export type SoulSortBy = "weight" | "priority" | "name" | "recent";
export type SoulSortDirection = "asc" | "desc";

export interface SoulGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly traits: readonly SoulTrait[];
}

// ---------------------------------------------------------------------------
// Mutation Undo/Redo & Query Contracts
// ---------------------------------------------------------------------------

export interface SoulMutationUndoRecord {
  readonly mutationType: "tune_trait" | "update_style" | "append_axiom" | "patch_body" | "switch_archetype" | "bulk";
  readonly previousManifest: SoulManifest;
  readonly nextManifest: SoulManifest;
  readonly timestampMs: number;
}

export interface SoulDslQueryFilter {
  readonly rawQuery: string;
  readonly category?: "communication" | "cognition" | "execution" | "behavior";
  readonly minWeight?: number;
  readonly maxWeight?: number;
  readonly textTerms?: readonly string[];
}

export interface SoulBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly updatedTraitIds: readonly string[];
  readonly manifest: SoulManifest;
}

// ---------------------------------------------------------------------------
// BroccoliDB Table Row Schemas
// ---------------------------------------------------------------------------

export interface SoulManifestRow {
  readonly id: string;
  readonly name: string;
  readonly archetype: SoulArchetype;
  readonly version: string;
  readonly integrityHash: string;
  readonly updatedTick: number;
  readonly [key: string]: unknown;
}

export interface SoulTraitRow {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly category: string;
  readonly minWeight: number;
  readonly maxWeight: number;
  readonly [key: string]: unknown;
}

export interface SoulAxiomRow {
  readonly id: string;
  readonly statement: string;
  readonly priority: number;
  readonly isImmutable: boolean;
  readonly category: string;
  readonly [key: string]: unknown;
}

export interface SoulMutationRow {
  readonly id: string;
  readonly mutationId: string;
  readonly success: boolean;
  readonly previousHash: string;
  readonly newHash: string;
  readonly auditedBy: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSoulSubstrate {
  initialize(initialManifest?: SoulManifest): void;
  getManifest(): SoulManifest;
  saveManifest(manifest: SoulManifest): void;
  tuneTrait(traitId: string, deltaOrTarget: number, isDelta?: boolean): SoulMutationResult;
  switchArchetype(targetArchetype: SoulArchetype, rationale?: string): SoulMutationResult;
  appendAxiom(axiom: SoulAxiom): SoulMutationResult;
  auditSoulHealth(): SoulHealthAuditReport;
  getSoulMetrics(): SoulMetricsReport;
  getGroupedTraits(groupBy?: SoulGroupBy, sortBy?: SoulSortBy, direction?: SoulSortDirection): readonly SoulGroupedLane[];
  queryTraitsDsl(query: SoulDslQueryFilter | string): readonly SoulTrait[];
  bulkTuneTraits(traitIds: readonly string[], delta: number): SoulBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
}
