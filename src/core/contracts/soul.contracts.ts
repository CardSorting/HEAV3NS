/**
 * Soul & Ethos Kernel System Contracts.
 * Formalized under ADR-014 (AKD-DSO Osmosis Paradigm).
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
}

export interface SoulSnapshot {
  readonly frameIndex: number;
  readonly timestamp: number;
  readonly manifest: SoulManifest;
  readonly checksum: string;
}
