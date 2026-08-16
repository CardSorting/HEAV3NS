/**
 * schema-sanitizer.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Deterministic Tool Parameter Schema Sanitizer,
 * Non-Conforming Key Bidirectional Rewriter & LLM GBNF Grammar Firewall Subsystem (Phase 139 / ADR-115 / Target #72).
 */

export interface SchemaSanitizerConfig {
  enabled: boolean;
  enforceConformingKeys: boolean;
  collapseNullableUnions: boolean;
  stripRefSiblings: boolean;
  stripTopLevelCombinators: boolean;
  maxPropertyKeyLength: number;
}

export interface SchemaSanitizationResult {
  sanitizedSchema: Record<string, unknown>;
  renamedKeys: Record<string, string>;
  mutationsApplied: readonly string[];
  warnings: readonly string[];
}

export interface SchemaSanitizerMetrics {
  totalSchemasSanitized: number;
  invalidPropertyKeysRenamed: number;
  nullableUnionsCollapsed: number;
  refSiblingsStripped: number;
  topLevelCombinatorsCleaned: number;
  argumentsUnrenamed: number;
}

export interface SchemaSanitizerWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: SchemaSanitizerConfig;
  metrics: SchemaSanitizerMetrics;
}

export const PROPERTY_KEY_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;
export const PROPERTY_KEY_INVALID_CHARS_REGEX = /[^a-zA-Z0-9_.-]/g;
export const FORBIDDEN_REF_SIBLING_KEYWORDS = new Set<string>(["default"]);
export const TOP_LEVEL_FORBIDDEN_COMBINATORS = new Set<string>([
  "allOf",
  "anyOf",
  "oneOf",
  "enum",
  "not",
]);

export const DEFAULT_SCHEMA_SANITIZER_CONFIG: SchemaSanitizerConfig = {
  enabled: true,
  enforceConformingKeys: true,
  collapseNullableUnions: true,
  stripRefSiblings: true,
  stripTopLevelCombinators: true,
  maxPropertyKeyLength: 64,
};
