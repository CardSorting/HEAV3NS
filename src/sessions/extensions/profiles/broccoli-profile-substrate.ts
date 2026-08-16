/**
 * broccoli-profile-substrate.ts
 *
 * In-memory Broccolidb substrate for isolated profile environments, session bindings,
 * persona memory stores, and zero-GC state transitions (Target #76 / ADR-119).
 */

import type {
  ProfileDescriptor,
  ProfileMutation,
  ProfileWorkspaceSnapshot,
} from "../../../core/contracts/profile.contracts.js";

export interface ProfileTransitionRecord {
  readonly sessionId: string;
  readonly fromProfile: string;
  readonly toProfile: string;
  readonly timestampMs: number;
}

export class BroccoliProfileSubstrate {
  private profiles: Map<string, ProfileDescriptor>;
  private sessionBindings: Map<string, string>;
  private activeDefaultProfileId: string;
  private transitionHistory: ProfileTransitionRecord[];
  private static readonly MAX_HISTORY = 1000;

  constructor() {
    this.profiles = new Map<string, ProfileDescriptor>();
    this.sessionBindings = new Map<string, string>();
    this.activeDefaultProfileId = "default";
    this.transitionHistory = [];

    // Initialize root default profile
    this.initDefaultProfile();
  }

  private initDefaultProfile(): void {
    const defaultProfile: ProfileDescriptor = {
      id: "default",
      name: "Default Agent Profile",
      description: "Standard primary operational profile with universal capability access",
      status: "active",
      soulPrompt: "You are LUMI, an autonomous, deterministic, and self-verifying AI agent.",
      modelPreference: "default",
      reasoningEffort: "medium",
      temperature: 0.7,
      enabledToolsets: ["core", "files", "execution", "goals", "kanban"],
      tags: ["system", "default"],
      memoryStore: {
        "MEMORY.md": "# Global Operational Memory\n- Core system initialized cleanly.",
        "USER.md": "# User Profile\n- Autonomous agent pairing active.",
      },
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    this.profiles.set("default", defaultProfile);
  }

  /**
   * Registers a new profile descriptor.
   */
  createProfile(profile: ProfileDescriptor): boolean {
    if (this.profiles.has(profile.id)) {
      return false;
    }
    this.profiles.set(profile.id, { ...profile });
    return true;
  }

  /**
   * Retrieves a profile by ID.
   */
  getProfile(profileId: string): ProfileDescriptor | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * Lists all available profiles.
   */
  listProfiles(): readonly ProfileDescriptor[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Updates an existing profile.
   */
  updateProfile(profileId: string, mutation: ProfileMutation): ProfileDescriptor | undefined {
    const existing = this.profiles.get(profileId);
    if (!existing) return undefined;

    const updated: ProfileDescriptor = {
      ...existing,
      name: mutation.name ?? existing.name,
      description: mutation.description ?? existing.description,
      status: mutation.status ?? existing.status,
      soulPrompt: mutation.soulPrompt ?? existing.soulPrompt,
      systemPromptOverlay: mutation.systemPromptOverlay !== undefined ? mutation.systemPromptOverlay : existing.systemPromptOverlay,
      modelPreference: mutation.modelPreference !== undefined ? mutation.modelPreference : existing.modelPreference,
      fallbackModel: mutation.fallbackModel !== undefined ? mutation.fallbackModel : existing.fallbackModel,
      reasoningEffort: mutation.reasoningEffort ?? existing.reasoningEffort,
      temperature: mutation.temperature !== undefined ? mutation.temperature : existing.temperature,
      enabledToolsets: mutation.enabledToolsets ?? existing.enabledToolsets,
      disabledToolsets: mutation.disabledToolsets ?? existing.disabledToolsets,
      skin: mutation.skin !== undefined ? mutation.skin : existing.skin,
      customAxioms: mutation.customAxioms ?? existing.customAxioms,
      tags: mutation.tags ?? existing.tags,
      memoryStore: mutation.memoryStore ? { ...(existing.memoryStore || {}), ...mutation.memoryStore } : existing.memoryStore,
      envOverrides: mutation.envOverrides ? { ...(existing.envOverrides || {}), ...mutation.envOverrides } : existing.envOverrides,
      metadata: mutation.metadata ?? existing.metadata,
      updatedAtMs: Date.now(),
    };

    this.profiles.set(profileId, updated);
    return updated;
  }

  /**
   * Deletes a profile (cannot delete 'default').
   */
  deleteProfile(profileId: string): boolean {
    if (profileId === "default") return false;
    if (!this.profiles.has(profileId)) return false;

    this.profiles.delete(profileId);

    // Re-bind any sessions that were using this profile back to default
    for (const [sessionId, boundProfile] of this.sessionBindings.entries()) {
      if (boundProfile === profileId) {
        this.sessionBindings.set(sessionId, "default");
      }
    }

    if (this.activeDefaultProfileId === profileId) {
      this.activeDefaultProfileId = "default";
    }

    return true;
  }

  /**
   * Binds a session to a profile.
   */
  bindSessionProfile(sessionId: string, profileId: string): boolean {
    if (!this.profiles.has(profileId)) return false;

    const oldProfile = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    this.sessionBindings.set(sessionId, profileId);

    if (oldProfile !== profileId) {
      this.transitionHistory.push({
        sessionId,
        fromProfile: oldProfile,
        toProfile: profileId,
        timestampMs: Date.now(),
      });
      if (this.transitionHistory.length > BroccoliProfileSubstrate.MAX_HISTORY) {
        this.transitionHistory.shift();
      }
    }

    return true;
  }

  /**
   * Gets the active profile for a session.
   */
  getSessionProfile(sessionId: string): ProfileDescriptor {
    const boundId = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    return this.profiles.get(boundId) || this.getDefaultProfile();
  }

  /**
   * Sets the global default profile.
   */
  setDefaultProfile(profileId: string): boolean {
    if (!this.profiles.has(profileId)) return false;
    this.activeDefaultProfileId = profileId;
    return true;
  }

  /**
   * Gets the current default profile.
   */
  getDefaultProfile(): ProfileDescriptor {
    return this.profiles.get(this.activeDefaultProfileId) || this.profiles.get("default")!;
  }

  /**
   * Gets the transition history.
   */
  getTransitionHistory(): readonly ProfileTransitionRecord[] {
    return [...this.transitionHistory];
  }

  /**
   * Exports an immutable snapshot of all profiles and session bindings.
   */
  exportSnapshot(): ProfileWorkspaceSnapshot {
    const profilesCopy = Array.from(this.profiles.values()).map((p) => ({
      ...p,
      enabledToolsets: p.enabledToolsets ? [...p.enabledToolsets] : undefined,
      disabledToolsets: p.disabledToolsets ? [...p.disabledToolsets] : undefined,
      customAxioms: p.customAxioms ? [...p.customAxioms] : undefined,
      tags: p.tags ? [...p.tags] : undefined,
      memoryStore: p.memoryStore ? { ...p.memoryStore } : undefined,
      envOverrides: p.envOverrides ? { ...p.envOverrides } : undefined,
    }));

    const sessionBindingsCopy: Record<string, string> = {};
    for (const [k, v] of this.sessionBindings.entries()) {
      sessionBindingsCopy[k] = v;
    }

    return {
      profiles: profilesCopy,
      sessionBindings: sessionBindingsCopy,
      activeDefaultProfileId: this.activeDefaultProfileId,
      totalProfiles: profilesCopy.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores substrate state from a snapshot.
   */
  importSnapshot(snapshot: ProfileWorkspaceSnapshot): void {
    this.profiles.clear();
    this.sessionBindings.clear();

    for (const p of snapshot.profiles) {
      this.profiles.set(p.id, {
        ...p,
        enabledToolsets: p.enabledToolsets ? [...p.enabledToolsets] : undefined,
        disabledToolsets: p.disabledToolsets ? [...p.disabledToolsets] : undefined,
        customAxioms: p.customAxioms ? [...p.customAxioms] : undefined,
        tags: p.tags ? [...p.tags] : undefined,
        memoryStore: p.memoryStore ? { ...p.memoryStore } : undefined,
        envOverrides: p.envOverrides ? { ...p.envOverrides } : undefined,
      });
    }

    if (snapshot.sessionBindings) {
      for (const [k, v] of Object.entries(snapshot.sessionBindings)) {
        this.sessionBindings.set(k, v);
      }
    }

    this.activeDefaultProfileId = snapshot.activeDefaultProfileId || "default";
  }

  /**
   * Resets substrate to pristine state.
   */
  clear(): void {
    this.profiles.clear();
    this.sessionBindings.clear();
    this.activeDefaultProfileId = "default";
    this.transitionHistory = [];
    this.initDefaultProfile();
  }
}
