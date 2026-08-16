/**
 * profile.contracts.ts
 *
 * Core data contracts for Persistent Multi-Profile Isolation, Environment Routing,
 * and Persona Cloning Engine (Target #76 / ADR-119).
 */

export type ProfileStatus = "active" | "suspended" | "archived";

export type ProfileCloneKind = "shallow" | "persona" | "full";

export type ProfileReasoningEffort = "none" | "low" | "medium" | "high";

export const PROFILE_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface ProfileDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProfileStatus;
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
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ProfileMutation {
  readonly name?: string;
  readonly description?: string;
  readonly status?: ProfileStatus;
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
  readonly preserveMemories?: boolean;
  readonly preserveSkills?: boolean;
  readonly envOverrides?: Record<string, string>;
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
