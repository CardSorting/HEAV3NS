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
