/**
 * Soul & Ethos Kernel System Contracts.
 * Formalized under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Defines the topological persona, immutable operational axioms, dynamic personality traits,
 * integrity verification hashes, frame-perfect state snapshots, preset bundles, multi-format
 * interoperability, human-readable diffs, and approachable non-technical navigation for LUMI-JOY.
 */

export type SoulArchetype =
  | "lumi_core"
  | "game_engine_architect"
  | "formal_verifier"
  | "autonomous_critic"
  | "security_sentinel"
  | "socratic_mentor"
  | "creative_collaborator"
  | "executive_assistant"
  | "data_scientist"
  | "domain_specialist"
  | "custom_persona";

export interface SoulTrait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly weight: number; // 0.0 to 1.0
  readonly minWeight: number; // bounded minimum
  readonly maxWeight: number; // bounded maximum
  readonly category: "communication" | "cognition" | "execution" | "behavior";
  readonly nonTechnicalLabel?: string;
  readonly effectSummary?: string;
}

export interface SoulAxiom {
  readonly id: string;
  readonly statement: string;
  readonly priority: number; // 1 (highest) to 10
  readonly isImmutable: boolean; // Cannot be altered or deleted by mutations
  readonly category: "determinism" | "safety" | "integrity" | "performance";
  readonly rationale?: string;
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
  readonly type: "tune_trait" | "update_style" | "append_axiom" | "patch_body" | "switch_archetype" | "apply_preset";
  readonly targetTraitId?: string;
  readonly targetWeight?: number;
  readonly targetStyle?: Partial<SoulStyleRules>;
  readonly newAxiom?: SoulAxiom;
  readonly bodyPatch?: {
    readonly searchAnchor: string;
    readonly replaceWith: string;
  };
  readonly targetArchetype?: SoulArchetype;
  readonly presetId?: string;
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
  readonly narrativeDiff?: string;
}

export interface SoulSnapshot {
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly manifest: SoulManifest;
  readonly checksum: string;
}

// ---------------------------------------------------------------------------
// Ergonomics: Presets, Taxonomy & Non-Technical Navigation
// ---------------------------------------------------------------------------

export type SoulPresetCategory = "productivity" | "education" | "engineering" | "creative" | "compliance";

export interface SoulPresetBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly archetype: SoulArchetype;
  readonly targetTraits: readonly { readonly traitId: string; readonly weight: number }[];
  readonly targetStyle: Partial<SoulStyleRules>;
  readonly suggestedAxioms?: readonly SoulAxiom[];
  readonly category: SoulPresetCategory;
  readonly icon?: string;
  readonly recommendedFor?: readonly string[];
}

export interface SoulTaxonomyTraitInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nonTechnicalSummary: string;
  readonly defaultWeight: number;
  readonly sliderRecommendation: string;
  readonly commonSynonyms: readonly string[];
}

export interface SoulTaxonomyNode {
  readonly dimension: string;
  readonly category: "communication" | "cognition" | "execution" | "behavior";
  readonly description: string;
  readonly traits: readonly SoulTaxonomyTraitInfo[];
}

// ---------------------------------------------------------------------------
// Human-Readable Explainability & Diff Engine
// ---------------------------------------------------------------------------

export interface SoulDiffEntry {
  readonly target: "archetype" | "trait" | "axiom" | "style" | "body";
  readonly identifier: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly plainEnglishNarrative: string;
  readonly impact: "subtle" | "moderate" | "significant";
}

export interface SoulDiffReport {
  readonly fromHash: string;
  readonly toHash: string;
  readonly timestamp: number;
  readonly entries: readonly SoulDiffEntry[];
  readonly summaryNarrative: string;
}

// ---------------------------------------------------------------------------
// Semantic Bookmarking & Revision Graph
// ---------------------------------------------------------------------------

export interface SoulBookmark {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly manifest: SoulManifest;
  readonly frameTick: number;
}

export interface SoulAuditTrailEntry {
  readonly mutationId: string;
  readonly timestamp: number;
  readonly mutationType: string;
  readonly auditedBy: string;
  readonly plainEnglishRationale: string;
  readonly previousHash: string;
  readonly newHash: string;
  readonly diffSummary: string;
}

// ---------------------------------------------------------------------------
// Multi-Format Interoperability (CharacterCard V2, OpenAI, Claude XML, etc.)
// ---------------------------------------------------------------------------

export type SoulFormatExportKind =
  | "soul_markdown"
  | "character_card_v2"
  | "openai_gpt_schema"
  | "anthropic_claude_xml"
  | "json_ld_agent"
  | "compact_json";

export interface SoulImportResult {
  readonly success: boolean;
  readonly sourceFormat: SoulFormatExportKind;
  readonly manifest?: SoulManifest;
  readonly warnings: readonly string[];
  readonly error?: string;
}

export interface SoulFuzzyMatchSuggestion {
  readonly inputQuery: string;
  readonly matchedTraitId: string;
  readonly matchedTraitName: string;
  readonly confidenceScore: number; // 0.0 to 1.0
  readonly reason: string;
  readonly suggestedWeight?: number;
}

// ---------------------------------------------------------------------------
// Safety & Risk Scoring
// ---------------------------------------------------------------------------

export type SoulRiskSeverity = "low" | "medium" | "high" | "critical";

export interface SoulThreatScanDetailed {
  readonly isSafe: boolean;
  readonly severity: SoulRiskSeverity;
  readonly category: "clean" | "trojan_unicode" | "roleplay_hijack" | "axiom_tamper" | "c2_command" | "axiom_contradiction";
  readonly blockedReason?: string;
  readonly plainLanguageExplanation?: string;
  readonly remediationGuidance?: string;
  readonly threatsDetected: readonly string[];
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
  readonly mutationType: "tune_trait" | "update_style" | "append_axiom" | "patch_body" | "switch_archetype" | "apply_preset" | "bulk";
  readonly previousManifest: SoulManifest;
  readonly nextManifest: SoulManifest;
  readonly timestampMs: number;
  readonly rationale?: string;
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
// Intuitive Custom SOUL Forge & Wizard Contracts
// ---------------------------------------------------------------------------

export interface SoulWizardOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon?: string;
  readonly defaultArchetype?: SoulArchetype;
  readonly traitModifiers?: readonly { readonly traitId: string; readonly weight: number }[];
  readonly styleModifiers?: Partial<SoulStyleRules>;
}

export interface SoulWizardQuestion {
  readonly id: "roleOrGoal" | "personalityVibe" | "communicationStyle" | "strictnessLevel" | "appliedPacks";
  readonly title: string;
  readonly subtitle: string;
  readonly isMultiSelect?: boolean;
  readonly options: readonly SoulWizardOption[];
}

export interface SoulWizardAnswers {
  readonly name?: string;
  readonly roleOrGoal: string; // e.g. "coder", "tutor", "executive", "support", "companion", "analyst", "custom"
  readonly personalityVibe: string; // e.g. "warm_encouraging", "direct_efficient", "deep_analytical", "playful_witty", "ultra_minimalist"
  readonly communicationStyle: string; // e.g. "bullet_points", "conversational", "step_by_step", "code_first"
  readonly strictnessLevel: string; // e.g. "uncompromising", "balanced", "flexible"
  readonly customRules?: readonly string[];
  readonly appliedPacks?: readonly string[]; // pack IDs
}

export interface SoulPersonalityPack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "attitude" | "expertise" | "communication" | "safeguards";
  readonly icon: string;
  readonly traitAdjustments: readonly { readonly traitId: string; readonly weightDelta: number }[];
  readonly styleAdjustments?: Partial<SoulStyleRules>;
  readonly customAxioms?: readonly SoulAxiom[];
  readonly samplePromptAddendum?: string;
}

export interface SoulCustomTweakSpec {
  readonly name?: string;
  readonly summary?: string;
  readonly archetype?: SoulArchetype;
  readonly traits?: readonly { readonly traitId: string; readonly weight: number }[];
  readonly style?: Partial<SoulStyleRules>;
  readonly addedAxioms?: readonly SoulAxiom[];
  readonly removedAxiomIds?: readonly string[];
  readonly rawBody?: string;
}

export type SoulLintSeverity = "info" | "warning" | "error";

export interface SoulPersonaLintIssue {
  readonly id: string;
  readonly severity: SoulLintSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly affectedFields: readonly string[];
  readonly suggestedFix: string;
  readonly autoFixable: boolean;
}

export interface SoulPersonaLintReport {
  readonly isValid: boolean;
  readonly issuesCount: number;
  readonly warningsCount: number;
  readonly errorsCount: number;
  readonly issues: readonly SoulPersonaLintIssue[];
  readonly overallCohesionScore: number; // 0 to 100
  readonly plainLanguageVerdict: string;
}

export interface SoulForgeOptions {
  readonly name?: string;
  readonly baseArchetype?: SoulArchetype;
  readonly appliedPacks?: readonly string[];
  readonly safetyLevel?: "standard" | "strict" | "air_gapped";
  readonly targetProfileId?: string;
}

// ---------------------------------------------------------------------------
// Drag-and-Drop Dedicated Directory Vault Contracts
// ---------------------------------------------------------------------------

export interface SoulDroppedFileEntry {
  readonly filename: string;
  readonly fullPath: string;
  readonly formatDetected: SoulFormatExportKind | "unknown_text";
  readonly profileId: string;
  readonly sizeBytes: number;
  readonly lastModified: number;
  readonly isValid: boolean;
  readonly errorMessage?: string;
  readonly manifestName?: string;
  readonly archetype?: SoulArchetype;
}

export interface SoulDirectorySyncReport {
  readonly directoryPath: string;
  readonly isInitialized: boolean;
  readonly filesScanned: number;
  readonly loadedCount: number;
  readonly failedCount: number;
  readonly droppedFiles: readonly SoulDroppedFileEntry[];
  readonly activeProfileId: string;
  readonly loadedProfiles: readonly string[];
  readonly syncTimestamp: number;
}

export interface SoulDropVaultStatus {
  readonly directoryPath: string;
  readonly isInitialized: boolean;
  readonly totalFiles: number;
  readonly loadedProfilesCount: number;
  readonly activeProfileId: string;
  readonly supportedExtensions: readonly string[];
  readonly templatesAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliSoulSubstrate {
  initialize(initialManifest?: SoulManifest): void;
  getManifest(profileId?: string): SoulManifest;
  getActiveManifest(): SoulManifest;
  getActiveProfileId(): string;
  setActiveProfileId(profileId: string): void;
  getAllProfiles(): readonly string[];
  saveManifest(manifest: SoulManifest, profileId?: string): void;
  tuneTrait(traitId: string, deltaOrTarget: number, isDelta?: boolean, profileId?: string): SoulMutationResult;
  switchArchetype(targetArchetype: SoulArchetype, rationale?: string, profileId?: string): SoulMutationResult;
  appendAxiom(axiom: SoulAxiom, profileId?: string): SoulMutationResult;
  patchStyle(styleUpdates: Partial<SoulStyleRules>, profileId?: string): SoulMutationResult;
  applyPreset(presetId: string, rationale?: string, profileId?: string): SoulMutationResult;
  listPresets(category?: SoulPresetCategory): readonly SoulPresetBundle[];
  getTaxonomy(): readonly SoulTaxonomyNode[];
  createBookmark(label: string, description?: string, tags?: readonly string[], profileId?: string): SoulBookmark;
  listBookmarks(tag?: string, profileId?: string): readonly SoulBookmark[];
  restoreBookmark(bookmarkIdOrLabel: string, profileId?: string): boolean;
  deleteBookmark(bookmarkIdOrLabel: string, profileId?: string): boolean;
  auditSoulHealth(profileId?: string): SoulHealthAuditReport;
  getSoulMetrics(profileId?: string): SoulMetricsReport;
  getGroupedTraits(groupBy?: SoulGroupBy, sortBy?: SoulSortBy, direction?: SoulSortDirection, profileId?: string): readonly SoulGroupedLane[];
  queryTraitsDsl(query: SoulDslQueryFilter | string, profileId?: string): readonly SoulTrait[];
  queryTraitsFuzzy(query: string, limit?: number, profileId?: string): readonly SoulFuzzyMatchSuggestion[];
  suggestCorrections(query: string, profileId?: string): readonly string[];
  bulkTuneTraits(traitIds: readonly string[], delta: number, profileId?: string): SoulBulkMutationResult;
  undo(profileId?: string): boolean;
  redo(profileId?: string): boolean;
  exportFormat(format: SoulFormatExportKind, profileId?: string): string;
  importFormat(rawContent: string, format?: SoulFormatExportKind, profileId?: string): SoulImportResult;
  getDiffReport(previousManifestOrHash?: string | SoulManifest, profileId?: string): SoulDiffReport;
  getAuditTrail(limit?: number): readonly SoulAuditTrailEntry[];
  exportInteractiveHtmlView(profileId?: string): string;
  exportMarkdownReport(profileId?: string): string;
  exportCsvReport(profileId?: string): string;

  // Intuitive Custom SOUL Forge & Wizard API
  forgeCustomSoul(prompt: string, options?: SoulForgeOptions, profileId?: string): SoulManifest;
  buildSoulFromWizard(answers: SoulWizardAnswers, profileId?: string): SoulManifest;
  cloneAndModifyProfile(sourceProfileId: string, newProfileId: string, tweaks: SoulCustomTweakSpec): SoulManifest;
  applyPersonalityPack(packId: string, profileId?: string): SoulMutationResult;
  listPersonalityPacks(): readonly SoulPersonalityPack[];
  lintProfile(profileId?: string): SoulPersonaLintReport;
  autoFixProfile(profileId?: string): SoulMutationResult;
  getWizardQuestions(): readonly SoulWizardQuestion[];

  // Dedicated Drag-and-Drop Directory Vault API
  syncDropDirectory(customPath?: string): SoulDirectorySyncReport;
  exportToDropDirectory(profileId?: string, format?: SoulFormatExportKind, filename?: string): string;
  getDropVaultStatus(): SoulDropVaultStatus;
  ingestDroppedFile(filePath: string): SoulImportResult;
}

