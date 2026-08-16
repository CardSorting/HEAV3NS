/**
 * deterministic-profile-engine.ts
 *
 * Deterministic engine for profile validation, deep persona cloning, cryptographic bundle
 * export/import, and prefix-cache-stable prompt context synthesis (Target #76 / ADR-119).
 */

import * as crypto from "node:crypto";
import type {
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileExportBundle,
} from "../../../core/contracts/profile.contracts.js";
import { PROFILE_ID_REGEX } from "../../../core/contracts/profile.contracts.js";

export class DeterministicProfileEngine {
  /**
   * Validates a profile ID against strict slug constraints.
   */
  public validateProfileId(id: string): { valid: boolean; error?: string } {
    if (!id || typeof id !== "string") {
      return { valid: false, error: "Profile ID must be a non-empty string" };
    }
    const trimmed = id.trim();
    if (!PROFILE_ID_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid profile ID '${trimmed}'. Must match /^[a-z0-9][a-z0-9_-]{0,63}$/`,
      };
    }
    return { valid: true };
  }

  /**
   * Clones a profile descriptor according to the specified clone kind.
   */
  public cloneProfile(
    source: ProfileDescriptor,
    targetId: string,
    options: ProfileCloneOptions = {}
  ): ProfileDescriptor {
    const cloneKind = options.cloneKind ?? "persona";
    const now = Date.now();

    const base: ProfileDescriptor = {
      id: targetId,
      name: options.newName ?? `${source.name} (Clone)`,
      description: options.newDescription ?? `Cloned from ${source.id} (${cloneKind} mode)`,
      status: "active",
      soulPrompt: source.soulPrompt,
      systemPromptOverlay: source.systemPromptOverlay,
      modelPreference: source.modelPreference,
      fallbackModel: source.fallbackModel,
      reasoningEffort: source.reasoningEffort,
      temperature: source.temperature,
      enabledToolsets: source.enabledToolsets ? [...source.enabledToolsets] : undefined,
      disabledToolsets: source.disabledToolsets ? [...source.disabledToolsets] : undefined,
      skin: source.skin,
      customAxioms: source.customAxioms ? [...source.customAxioms] : undefined,
      tags: [...(source.tags || []), "cloned", cloneKind],
      memoryStore: options.preserveMemories !== false && source.memoryStore ? { ...source.memoryStore } : {},
      envOverrides: options.envOverrides
        ? { ...(source.envOverrides || {}), ...options.envOverrides }
        : source.envOverrides
        ? { ...source.envOverrides }
        : undefined,
      createdAtMs: now,
      updatedAtMs: now,
    };

    if (cloneKind === "shallow") {
      return {
        ...base,
        soulPrompt: "You are LUMI, an autonomous AI assistant.",
        systemPromptOverlay: undefined,
        memoryStore: {},
        customAxioms: [],
      };
    }

    if (cloneKind === "persona") {
      return {
        ...base,
        soulPrompt: source.soulPrompt,
        customAxioms: source.customAxioms ? [...source.customAxioms] : undefined,
        memoryStore: options.preserveMemories !== false && source.memoryStore ? { ...source.memoryStore } : {},
      };
    }

    // "full" clone preserves everything
    return base;
  }

  /**
   * Generates a signed export bundle for a profile descriptor.
   */
  public exportBundle(profile: ProfileDescriptor): ProfileExportBundle {
    const canonicalPayload = JSON.stringify(profile, Object.keys(profile).sort());
    const hash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    return {
      version: "1.0.0",
      exportedAtMs: Date.now(),
      profile: {
        ...profile,
        enabledToolsets: profile.enabledToolsets ? [...profile.enabledToolsets] : undefined,
        disabledToolsets: profile.disabledToolsets ? [...profile.disabledToolsets] : undefined,
        customAxioms: profile.customAxioms ? [...profile.customAxioms] : undefined,
        tags: profile.tags ? [...profile.tags] : undefined,
        memoryStore: profile.memoryStore ? { ...profile.memoryStore } : undefined,
        envOverrides: profile.envOverrides ? { ...profile.envOverrides } : undefined,
      },
      sha256Signature: hash,
    };
  }

  /**
   * Verifies and imports a signed profile export bundle.
   */
  public verifyAndImportBundle(bundle: ProfileExportBundle): {
    valid: boolean;
    profile?: ProfileDescriptor;
    error?: string;
  } {
    if (!bundle || bundle.version !== "1.0.0" || !bundle.profile) {
      return { valid: false, error: "Invalid bundle structure or unsupported version" };
    }

    const valRes = this.validateProfileId(bundle.profile.id);
    if (!valRes.valid) {
      return { valid: false, error: valRes.error };
    }

    const canonicalPayload = JSON.stringify(bundle.profile, Object.keys(bundle.profile).sort());
    const computedHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");

    if (computedHash !== bundle.sha256Signature) {
      return {
        valid: false,
        error: `Signature mismatch: computed '${computedHash}', expected '${bundle.sha256Signature}'`,
      };
    }

    return {
      valid: true,
      profile: bundle.profile,
    };
  }

  /**
   * Synthesizes a byte-stable, prefix-cache-friendly profile context frame for LLM prompts.
   */
  public renderProfileContext(profile: ProfileDescriptor): string {
    const lines: string[] = [
      `### Active Profile: ${profile.name} (${profile.id})`,
      profile.description,
    ];

    if (profile.soulPrompt) {
      lines.push(`\n**Persona Axioms:**\n${profile.soulPrompt}`);
    }

    if (profile.customAxioms && profile.customAxioms.length > 0) {
      lines.push("\n**Operational Rules:**");
      for (const axiom of profile.customAxioms) {
        lines.push(`- ${axiom}`);
      }
    }

    if (profile.memoryStore && Object.keys(profile.memoryStore).length > 0) {
      lines.push("\n**Curated Profile Memories:**");
      for (const [filename, content] of Object.entries(profile.memoryStore)) {
        lines.push(`\n[${filename}]:\n${content}`);
      }
    }

    return lines.join("\n");
  }
}
