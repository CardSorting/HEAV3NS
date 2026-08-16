/**
 * profile-supervisor.ts
 *
 * High-level coordinator managing multi-profile isolation, session routing,
 * slash command dispatch (/profile), and persona lifecycle (Target #76 / ADR-119).
 */

import type {
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileExportBundle,
  ProfileMutation,
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
   * Switches the active profile for a session.
   */
  public switchProfile(
    sessionId: string,
    profileId: string
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const profile = this.substrate.getProfile(profileId);
    if (!profile) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }

    if (profile.status !== "active") {
      return { success: false, error: `Cannot switch to profile '${profileId}' because it is ${profile.status}` };
    }

    const bound = this.substrate.bindSessionProfile(sessionId, profileId);
    if (!bound) {
      return { success: false, error: `Failed to bind session '${sessionId}' to profile '${profileId}'` };
    }

    return { success: true, profile };
  }

  /**
   * Retrieves a profile by ID.
   */
  public getProfile(profileId: string): ProfileDescriptor | undefined {
    return this.substrate.getProfile(profileId);
  }

  /**
   * Gets the active profile for a session.
   */
  public getSessionProfile(sessionId: string): ProfileDescriptor {
    return this.substrate.getSessionProfile(sessionId);
  }

  /**
   * Lists all profiles.
   */
  public listProfiles(): readonly ProfileDescriptor[] {
    return this.substrate.listProfiles();
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
   * Deletes a non-default profile.
   */
  public deleteProfile(profileId: string): { success: boolean; error?: string } {
    if (profileId === "default") {
      return { success: false, error: "Cannot delete the default root profile" };
    }
    const deleted = this.substrate.deleteProfile(profileId);
    if (!deleted) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }
    return { success: true };
  }

  /**
   * Exports a profile bundle with SHA-256 signature.
   */
  public exportProfile(profileId: string): {
    success: boolean;
    bundle?: ProfileExportBundle;
    error?: string;
  } {
    const profile = this.substrate.getProfile(profileId);
    if (!profile) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }

    const bundle = this.engine.exportBundle(profile);
    return { success: true, bundle };
  }

  /**
   * Imports a profile from a verified signed bundle.
   */
  public importProfile(bundle: ProfileExportBundle): {
    success: boolean;
    profile?: ProfileDescriptor;
    error?: string;
  } {
    const res = this.engine.verifyAndImportBundle(bundle);
    if (!res.valid || !res.profile) {
      return { success: false, error: res.error || "Bundle verification failed" };
    }

    if (this.substrate.getProfile(res.profile.id)) {
      return { success: false, error: `Profile '${res.profile.id}' already exists in workspace` };
    }

    this.substrate.createProfile(res.profile);
    return { success: true, profile: res.profile };
  }

  /**
   * Synthesizes byte-stable prompt context for a session's bound profile.
   */
  public renderSessionProfileContext(sessionId: string): string {
    const profile = this.getSessionProfile(sessionId);
    return this.engine.renderProfileContext(profile);
  }

  /**
   * Handles `/profile` slash command invocations.
   */
  public executeSlashCommand(sessionId: string, commandLine: string): { success: boolean; output: string } {
    const parts = commandLine.trim().split(/\s+/);
    const subcmd = parts[1]?.toLowerCase() || "list";

    if (subcmd === "list") {
      const profiles = this.listProfiles();
      const current = this.getSessionProfile(sessionId);
      const lines = profiles.map(
        (p) => `${p.id === current.id ? "* " : "  "}• ${p.name} (${p.id}) [${p.status}] - ${p.description}`
      );
      return {
        success: true,
        output: `Available Profiles (${profiles.length}):\n${lines.join("\n")}`,
      };
    }

    if (subcmd === "use" || subcmd === "switch") {
      const targetId = parts[2];
      if (!targetId) return { success: false, output: "Usage: /profile use <profile_id>" };
      const res = this.switchProfile(sessionId, targetId);
      if (!res.success) return { success: false, output: `Error: ${res.error}` };
      return { success: true, output: `Switched session to profile '${res.profile?.name}' (${targetId})` };
    }

    if (subcmd === "show" || subcmd === "status") {
      const current = this.getSessionProfile(sessionId);
      return {
        success: true,
        output: `Current Profile:\n- ID: ${current.id}\n- Name: ${current.name}\n- Status: ${current.status}\n- Model: ${current.modelPreference || "default"}\n- Soul: ${current.soulPrompt}`,
      };
    }

    if (subcmd === "clone") {
      const srcId = parts[2];
      const dstId = parts[3];
      if (!srcId || !dstId) return { success: false, output: "Usage: /profile clone <source_id> <target_id>" };
      const res = this.cloneProfile(srcId, dstId);
      if (!res.success) return { success: false, output: `Error: ${res.error}` };
      return { success: true, output: `Cloned profile '${srcId}' -> '${dstId}' successfully.` };
    }

    return {
      success: false,
      output: `Unknown subcommand '${subcmd}'. Usage: /profile [list|use <id>|show|clone <src> <dst>]`,
    };
  }
}
