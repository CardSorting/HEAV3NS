/**
 * profile-supervisor.ts
 *
 * High-level coordinator managing multi-profile isolation, hierarchical inheritance,
 * blueprint catalog instantiation, structural diffing, and rich slash command UX (/profile) (Target #76 / ADR-119).
 */

import type {
  ProfileBlueprint,
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileDiffResult,
  ProfileExportBundle,
  ProfileMutation,
  ProfileQueryFilter,
} from "../../../core/contracts/profile.contracts.js";
import { BroccoliProfileSubstrate } from "../../../sessions/extensions/profiles/broccoli-profile-substrate.js";
import { DeterministicProfileEngine } from "./deterministic-profile-engine.js";

export class ProfileSupervisor {
  private engine: DeterministicProfileEngine;
  private substrate: BroccoliProfileSubstrate;

  constructor(engine: DeterministicProfileEngine, substrate: BroccoliProfileSubstrate) {
    this.engine = engine;
    this.substrate = substrate;
  }

  /**
   * Creates a new isolated profile environment.
   */
  public createProfile(
    id: string,
    name: string,
    description: string,
    options: Partial<ProfileDescriptor> = {}
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const valRes = this.engine.validateProfileId(id);
    if (!valRes.valid) {
      return { success: false, error: valRes.error };
    }

    if (this.substrate.getProfile(id)) {
      return { success: false, error: `Profile '${id}' already exists` };
    }

    const now = Date.now();
    const newProfile: ProfileDescriptor = {
      id,
      name,
      description,
      status: options.status || "active",
      extends: options.extends,
      category: options.category || "custom",
      icon: options.icon || "📋",
      isFavorite: options.isFavorite ?? false,
      isProtected: options.isProtected ?? false,
      soulPrompt: options.soulPrompt || `You are operating under profile '${name}'.`,
      systemPromptOverlay: options.systemPromptOverlay,
      modelPreference: options.modelPreference,
      fallbackModel: options.fallbackModel,
      reasoningEffort: options.reasoningEffort || "medium",
      temperature: options.temperature !== undefined ? options.temperature : 0.7,
      enabledToolsets: options.enabledToolsets ? [...options.enabledToolsets] : undefined,
      disabledToolsets: options.disabledToolsets ? [...options.disabledToolsets] : undefined,
      skin: options.skin,
      customAxioms: options.customAxioms ? [...options.customAxioms] : undefined,
      tags: options.tags ? [...options.tags] : ["custom"],
      memoryStore: options.memoryStore ? { ...options.memoryStore } : { "MEMORY.md": `# ${name} Memory\n` },
      envOverrides: options.envOverrides ? { ...options.envOverrides } : undefined,
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: now,
        estimatedTokensSaved: 0,
      },
      createdAtMs: now,
      updatedAtMs: now,
    };

    const added = this.substrate.createProfile(newProfile);
    if (!added) {
      return { success: false, error: `Failed to create profile '${id}' in substrate` };
    }

    return { success: true, profile: newProfile };
  }

  /**
   * Instantiates a new profile from a built-in blueprint.
   */
  public instantiateBlueprint(
    blueprintId: string,
    customId: string,
    customName?: string
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    if (this.substrate.getProfile(customId)) {
      return { success: false, error: `Profile '${customId}' already exists` };
    }

    const instantiated = this.engine.instantiateBlueprint(blueprintId, customId, customName);
    if (!instantiated) {
      return { success: false, error: `Blueprint '${blueprintId}' not found or invalid custom ID '${customId}'` };
    }

    const added = this.substrate.createProfile(instantiated);
    if (!added) {
      return { success: false, error: `Failed to register profile '${customId}' in substrate` };
    }

    return { success: true, profile: instantiated };
  }

  /**
   * Lists all available blueprints.
   */
  public listBlueprints(): readonly ProfileBlueprint[] {
    return this.engine.listBlueprints();
  }

  /**
   * Clones an existing profile into a new profile ID.
   */
  public cloneProfile(
    sourceProfileId: string,
    targetProfileId: string,
    options: ProfileCloneOptions = {}
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const valRes = this.engine.validateProfileId(targetProfileId);
    if (!valRes.valid) {
      return { success: false, error: valRes.error };
    }

    const source = this.substrate.getProfile(sourceProfileId);
    if (!source) {
      return { success: false, error: `Source profile '${sourceProfileId}' not found` };
    }

    if (this.substrate.getProfile(targetProfileId)) {
      return { success: false, error: `Target profile '${targetProfileId}' already exists` };
    }

    const cloned = this.engine.cloneProfile(source, targetProfileId, options);
    const added = this.substrate.createProfile(cloned);
    if (!added) {
      return { success: false, error: `Failed to register cloned profile '${targetProfileId}'` };
    }

    return { success: true, profile: cloned };
  }

  /**
   * Switches the active profile for a session (with fuzzy resolution fallback).
   */
  public switchProfile(
    sessionId: string,
    query: string
  ): { success: boolean; profile?: ProfileDescriptor; isFuzzyMatch?: boolean; error?: string } {
    const resolution = this.substrate.resolveProfileOrFuzzy(query);
    if (!resolution.profile) {
      return { success: false, error: `Profile matching '${query}' not found` };
    }

    const profile = resolution.profile;
    if (profile.status !== "active") {
      return { success: false, error: `Cannot switch to profile '${profile.id}' because it is ${profile.status}` };
    }

    const bound = this.substrate.bindSessionProfile(sessionId, profile.id);
    if (!bound) {
      return { success: false, error: `Failed to bind session '${sessionId}' to profile '${profile.id}'` };
    }

    return { success: true, profile, isFuzzyMatch: resolution.isFuzzyMatch };
  }

  /**
   * Retrieves a profile by ID or fuzzy alias.
   */
  public getProfile(query: string): ProfileDescriptor | undefined {
    return this.substrate.resolveProfileOrFuzzy(query).profile;
  }

  /**
   * Gets effective profile resolving inheritance chain.
   */
  public getEffectiveProfile(profileId: string): {
    effective: ProfileDescriptor;
    inheritanceChain: string[];
    error?: string;
  } {
    const raw = this.substrate.getProfile(profileId) || this.substrate.getDefaultProfile();
    const res = this.engine.resolveInheritedProfile(raw, this.substrate);
    return {
      effective: res.resolved,
      inheritanceChain: res.inheritanceChain,
      error: res.error,
    };
  }

  /**
   * Gets the active profile for a session.
   */
  public getSessionProfile(sessionId: string): ProfileDescriptor {
    return this.substrate.getSessionProfile(sessionId);
  }

  /**
   * Lists all profiles or queries with Natural Query DSL / filters.
   */
  public listProfiles(queryOrFilter?: string | ProfileQueryFilter): readonly ProfileDescriptor[] {
    if (!queryOrFilter) {
      return this.substrate.listProfiles();
    }
    if (typeof queryOrFilter === "string") {
      const filter = this.engine.parseQueryDSL(queryOrFilter);
      return this.substrate.queryProfiles(filter);
    }
    return this.substrate.queryProfiles(queryOrFilter);
  }

  /**
   * Performs structural diff comparison between two profiles.
   */
  public diffProfiles(profileIdA: string, profileIdB: string): ProfileDiffResult | undefined {
    const profileA = this.substrate.getProfile(profileIdA);
    const profileB = this.substrate.getProfile(profileIdB);
    if (!profileA || !profileB) return undefined;
    return this.engine.diffProfiles(profileA, profileB);
  }

  /**
   * Toggles favorite status for a profile.
   */
  public toggleFavorite(profileId: string): boolean {
    return this.substrate.toggleFavorite(profileId);
  }

  /**
   * Restores an archived profile.
   */
  public restoreProfile(profileId: string): ProfileDescriptor | undefined {
    return this.substrate.restoreProfile(profileId);
  }

  /**
   * Updates an existing profile.
   */
  public updateProfile(
    profileId: string,
    mutation: ProfileMutation
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const updated = this.substrate.updateProfile(profileId, mutation);
    if (!updated) {
      return { success: false, error: `Profile '${profileId}' not found or update failed` };
    }
    return { success: true, profile: updated };
  }

  /**
   * Deletes a profile.
   */
  public deleteProfile(profileId: string): { success: boolean; error?: string } {
    const deleted = this.substrate.deleteProfile(profileId);
    if (!deleted) {
      return { success: false, error: `Cannot delete profile '${profileId}' (protected or does not exist)` };
    }
    return { success: true };
  }

  /**
   * Exports profile to signed JSON bundle.
   */
  public exportProfile(profileId: string): { success: boolean; bundle?: ProfileExportBundle; error?: string } {
    const profile = this.substrate.getProfile(profileId);
    if (!profile) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }
    const bundle = this.engine.exportBundle(profile);
    return { success: true, bundle };
  }

  /**
   * Imports a verified signed profile bundle.
   */
  public importProfile(bundle: ProfileExportBundle): {
    success: boolean;
    profile?: ProfileDescriptor;
    error?: string;
  } {
    const verified = this.engine.verifyAndImportBundle(bundle);
    if (!verified.valid || !verified.profile) {
      return { success: false, error: verified.error || "Bundle verification failed" };
    }

    const created = this.substrate.createProfile(verified.profile);
    if (!created) {
      const updated = this.substrate.updateProfile(verified.profile.id, verified.profile);
      if (!updated) {
        return { success: false, error: `Failed to import profile '${verified.profile.id}'` };
      }
      return { success: true, profile: updated };
    }

    return { success: true, profile: verified.profile };
  }

  /**
   * Renders the prefix-cache-stable contextual prompt block for the active session profile.
   */
  public renderSessionProfileContext(sessionId: string): string {
    const sessionProfile = this.substrate.getSessionProfile(sessionId);
    const { effective, inheritanceChain } = this.getEffectiveProfile(sessionProfile.id);
    return this.engine.renderProfileContext(effective, inheritanceChain);
  }

  /**
   * Executes interactive /profile slash commands.
   */
  public executeSlashCommand(sessionId: string, commandLine: string): { success: boolean; output: string } {
    const parts = commandLine.trim().split(/\s+/);
    const subCmd = parts[1]?.toLowerCase();

    // /profile (Interactive Overview Dashboard)
    if (!subCmd || subCmd === "dashboard" || subCmd === "status") {
      const active = this.substrate.getSessionProfile(sessionId);
      const all = this.substrate.listProfiles();
      const favs = all.filter((p) => p.isFavorite);
      const blueprints = this.engine.listBlueprints();

      const out = [
        `\x1b[1;36m=== LUMI Profile Management & Persona Switcher ===\x1b[0m`,
        `Active Session Profile: \x1b[1;32m${active.icon || "⚡"} ${active.name}\x1b[0m (\x1b[33m${active.id}\x1b[0m)`,
        `Domain Category:        \x1b[35m${(active.category || "general").toUpperCase()}\x1b[0m`,
        `Preferred Model:        \x1b[36m${active.modelPreference || "default"}\x1b[0m (Reasoning: ${active.reasoningEffort || "medium"})`,
        `Total Registered:       ${all.length} profiles (${favs.length} starred favorites)`,
        ``,
        `\x1b[1;34m★ Starred Favorites:\x1b[0m`,
        ...favs.map((f) => `  ${f.icon || "★"} \x1b[1m${f.id.padEnd(16)}\x1b[0m - ${f.name}`),
        ``,
        `\x1b[1;34m🛠 Available Blueprints (${blueprints.length}):\x1b[0m`,
        `  ${blueprints.map((b) => `${b.icon} ${b.id}`).join("  |  ")}`,
        ``,
        `\x1b[90mQuick Commands: /profile list | /profile use <name> | /profile init <blueprint> | /profile diff <a b> | /profile show\x1b[0m`,
      ];
      return { success: true, output: out.join("\n") };
    }

    // /profile list [dsl_query]
    if (subCmd === "list" || subCmd === "ls") {
      const queryStr = parts.slice(2).join(" ");
      const profiles = this.listProfiles(queryStr || undefined);
      const active = this.substrate.getSessionProfile(sessionId);

      const out = [
        `\x1b[1;36m=== Available Profiles (${profiles.length}) ===\x1b[0m`,
        ...profiles.map((p) => {
          const isAct = p.id === active.id ? "\x1b[1;32m▶ [ACTIVE]\x1b[0m " : "           ";
          const fav = p.isFavorite ? "★ " : "  ";
          const icon = p.icon ? `${p.icon} ` : "";
          const model = p.modelPreference ? `\x1b[90m(${p.modelPreference})\x1b[0m` : "";
          const ext = p.extends ? `\x1b[33m[extends ${p.extends}]\x1b[0m` : "";
          return `${isAct}${fav}${icon}\x1b[1m${p.id.padEnd(18)}\x1b[0m ${p.name} ${model} ${ext}`;
        }),
      ];
      return { success: true, output: out.join("\n") };
    }

    // /profile use <profile_id_or_fuzzy>
    if (subCmd === "use" || subCmd === "switch" || subCmd === "select") {
      const targetQuery = parts[2];
      if (!targetQuery) {
        return { success: false, output: "Usage: /profile use <profile_id_or_name>" };
      }
      const res = this.switchProfile(sessionId, targetQuery);
      if (!res.success) {
        return { success: false, output: `\x1b[1;31mError:\x1b[0m ${res.error}` };
      }
      const fuzzyNote = res.isFuzzyMatch ? " \x1b[90m(matched via fuzzy alias)\x1b[0m" : "";
      return {
        success: true,
        output: `\x1b[1;32m✓ Switched session to profile:\x1b[0m ${res.profile?.icon || "⚡"} \x1b[1m${res.profile?.name}\x1b[0m (\x1b[33m${res.profile?.id}\x1b[0m)${fuzzyNote}`,
      };
    }

    // /profile init <blueprint_id> [custom_id]
    if (subCmd === "init" || subCmd === "create-preset") {
      const bpId = parts[2]?.toLowerCase();
      const customId = parts[3] || bpId;
      if (!bpId) {
        const bps = this.engine.listBlueprints().map((b) => `${b.icon} ${b.id}`).join(", ");
        return { success: false, output: `Usage: /profile init <blueprint> [custom_id]\nAvailable blueprints: ${bps}` };
      }
      const res = this.instantiateBlueprint(bpId, customId);
      if (!res.success) {
        return { success: false, output: `\x1b[1;31mError:\x1b[0m ${res.error}` };
      }
      return {
        success: true,
        output: `\x1b[1;32m✓ Created profile '${customId}' from blueprint '${bpId}'!\x1b[0m\nType \x1b[33m/profile use ${customId}\x1b[0m to activate it.`,
      };
    }

    // /profile show [profile_id]
    if (subCmd === "show" || subCmd === "inspect" || subCmd === "info") {
      const targetId = parts[2] || this.substrate.getSessionProfile(sessionId).id;
      const profile = this.getProfile(targetId);
      if (!profile) {
        return { success: false, output: `Profile '${targetId}' not found` };
      }
      const { effective, inheritanceChain } = this.getEffectiveProfile(profile.id);
      const out = [
        `\x1b[1;36m=== Profile: ${profile.icon || "📋"} ${profile.name} (${profile.id}) ===\x1b[0m`,
        `Description:        ${profile.description}`,
        `Status:             ${profile.status}`,
        `Domain Category:    ${(profile.category || "general").toUpperCase()}`,
        `Inheritance Chain:  ${inheritanceChain.join(" -> ")}`,
        `Model Preference:   ${effective.modelPreference || "default"} (Reasoning: ${effective.reasoningEffort || "medium"})`,
        `Enabled Toolsets:   ${effective.enabledToolsets?.join(", ") || "(all standard)"}`,
        `Starred Favorite:   ${profile.isFavorite ? "Yes ★" : "No"}`,
        `Total Invocations:  ${profile.telemetry?.totalInvocations || 0}`,
        ``,
        `\x1b[1;34mPersona Soul Axioms:\x1b[0m`,
        effective.soulPrompt,
      ];
      if (effective.customAxioms && effective.customAxioms.length > 0) {
        out.push(``, `\x1b[1;34mOperational Rules:\x1b[0m`);
        for (const ax of effective.customAxioms) out.push(`- ${ax}`);
      }
      return { success: true, output: out.join("\n") };
    }

    // /profile diff <idA> <idB>
    if (subCmd === "diff" || subCmd === "compare") {
      const idA = parts[2];
      const idB = parts[3];
      if (!idA || !idB) {
        return { success: false, output: "Usage: /profile diff <profile_id_a> <profile_id_b>" };
      }
      const diff = this.diffProfiles(idA, idB);
      if (!diff) {
        return { success: false, output: `Could not compare profiles '${idA}' and '${idB}'` };
      }
      if (diff.identical) {
        return { success: true, output: `\x1b[1;32m✓ Profiles '${idA}' and '${idB}' are structurally identical.\x1b[0m` };
      }
      const out = [
        `\x1b[1;36m=== Structural Diff: ${idA} <-> ${idB} ===\x1b[0m`,
        ...diff.differences.map((d) => `  \x1b[1m${d.field.padEnd(18)}\x1b[0m: \x1b[31m${JSON.stringify(d.valueA)}\x1b[0m -> \x1b[32m${JSON.stringify(d.valueB)}\x1b[0m`),
      ];
      if (diff.toolsetDelta.onlyInA.length > 0) {
        out.push(`  Toolsets only in ${idA}: \x1b[31m${diff.toolsetDelta.onlyInA.join(", ")}\x1b[0m`);
      }
      if (diff.toolsetDelta.onlyInB.length > 0) {
        out.push(`  Toolsets only in ${idB}: \x1b[32m${diff.toolsetDelta.onlyInB.join(", ")}\x1b[0m`);
      }
      return { success: true, output: out.join("\n") };
    }

    // /profile clone <source> <target>
    if (subCmd === "clone" || subCmd === "copy") {
      const src = parts[2];
      const dst = parts[3];
      if (!src || !dst) {
        return { success: false, output: "Usage: /profile clone <source_id> <target_id>" };
      }
      const res = this.cloneProfile(src, dst);
      if (!res.success) {
        return { success: false, output: `\x1b[1;31mError:\x1b[0m ${res.error}` };
      }
      return { success: true, output: `\x1b[1;32m✓ Cloned profile '${src}' -> '${dst}'\x1b[0m` };
    }

    // /profile fav <id>
    if (subCmd === "fav" || subCmd === "star") {
      const id = parts[2] || this.substrate.getSessionProfile(sessionId).id;
      const res = this.toggleFavorite(id);
      return {
        success: true,
        output: res ? `\x1b[1;32m★ Starred '${id}' as favorite!\x1b[0m` : `\x1b[90mUnstarred '${id}'\x1b[0m`,
      };
    }

    // /profile blueprints
    if (subCmd === "blueprints" || subCmd === "presets") {
      const bps = this.engine.listBlueprints();
      const out = [
        `\x1b[1;36m=== Built-in Profile Blueprints (${bps.length}) ===\x1b[0m`,
        ...bps.map((b) => `  ${b.icon} \x1b[1m${b.id.padEnd(12)}\x1b[0m - ${b.name}\n    \x1b[90m${b.description}\x1b[0m`),
        ``,
        `\x1b[33mUse '/profile init <blueprint>' to create a profile from any template.\x1b[0m`,
      ];
      return { success: true, output: out.join("\n") };
    }

    // /profile help
    return {
      success: true,
      output: [
        `\x1b[1;36m=== /profile Command Navigation ===\x1b[0m`,
        `  /profile                   - Show active profile overview and favorites`,
        `  /profile list [query]      - List profiles (supports Natural Query DSL)`,
        `  /profile use <name>        - Switch active session profile`,
        `  /profile show [id]         - Inspect profile details and inheritance`,
        `  /profile init <blueprint>  - Create profile from ready-to-use template`,
        `  /profile blueprints        - Browse available built-in templates`,
        `  /profile diff <idA> <idB>  - Compare structural differences between profiles`,
        `  /profile clone <src> <dst> - Clone an existing profile`,
        `  /profile fav [id]          - Star/unstar a profile as favorite`,
      ].join("\n"),
    };
  }
}
