/**
 * broccoli-profile-substrate.ts
 *
 * In-memory Broccolidb substrate for isolated profile environments, session bindings,
 * persona memory stores, telemetry tracking, and zero-GC state transitions (Target #76 / ADR-119).
 */

import type {
  ProfileDescriptor,
  ProfileMutation,
  ProfileQueryFilter,
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
      category: "general",
      icon: "⚡",
      isFavorite: true,
      isProtected: true,
      soulPrompt: "You are LUMI, an autonomous, deterministic, and self-verifying AI agent.",
      modelPreference: "default",
      reasoningEffort: "medium",
      temperature: 0.7,
      enabledToolsets: ["core", "files", "execution", "goals", "kanban"],
      tags: ["system", "default", "core"],
      memoryStore: {
        "MEMORY.md": "# Global Operational Memory\n- Core system initialized cleanly.",
        "USER.md": "# User Profile\n- Autonomous agent pairing active.",
      },
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: Date.now(),
        estimatedTokensSaved: 0,
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
    const telemetry = profile.telemetry || {
      totalInvocations: 0,
      totalSessionsBound: 0,
      lastActivatedAtMs: Date.now(),
      estimatedTokensSaved: 0,
    };
    this.profiles.set(profile.id, { ...profile, telemetry });
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
   * Queries profiles using structured filters, search queries, and sorting.
   */
  queryProfiles(filter: ProfileQueryFilter = {}): readonly ProfileDescriptor[] {
    let result = Array.from(this.profiles.values());

    if (filter.status) {
      result = result.filter((p) => p.status === filter.status);
    } else {
      // Default to non-archived unless explicitly asked
      result = result.filter((p) => p.status !== "archived");
    }

    if (filter.category) {
      result = result.filter((p) => p.category === filter.category);
    }

    if (filter.isFavorite !== undefined) {
      result = result.filter((p) => (p.isFavorite ?? false) === filter.isFavorite);
    }

    if (filter.model) {
      const modelLower = filter.model.toLowerCase();
      result = result.filter((p) => p.modelPreference?.toLowerCase().includes(modelLower));
    }

    if (filter.tag) {
      const tagLower = filter.tag.toLowerCase();
      result = result.filter((p) => p.tags?.some((t) => t.toLowerCase() === tagLower));
    }

    if (filter.extends) {
      result = result.filter((p) => p.extends === filter.extends);
    }

    if (filter.text) {
      const q = filter.text.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sorting
    const sortBy = filter.sortBy || "name";
    const dir = filter.sortDirection === "desc" ? -1 : 1;

    result.sort((a, b) => {
      if (sortBy === "recent") {
        return ((b.telemetry?.lastActivatedAtMs || b.updatedAtMs) - (a.telemetry?.lastActivatedAtMs || a.updatedAtMs)) * dir;
      }
      if (sortBy === "usage") {
        return ((b.telemetry?.totalInvocations || 0) - (a.telemetry?.totalInvocations || 0)) * dir;
      }
      if (sortBy === "favorites") {
        const favA = a.isFavorite ? 1 : 0;
        const favB = b.isFavorite ? 1 : 0;
        if (favA !== favB) return (favB - favA) * dir;
        return a.name.localeCompare(b.name) * dir;
      }
      return a.name.localeCompare(b.name) * dir;
    });

    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Resolves a profile by exact ID or best fuzzy alias match.
   */
  resolveProfileOrFuzzy(query: string): { profile?: ProfileDescriptor; isFuzzyMatch?: boolean; matchScore?: number } {
    if (!query) return {};
    const q = query.trim().toLowerCase();

    // 1. Exact ID
    const exact = this.profiles.get(q);
    if (exact) return { profile: exact, isFuzzyMatch: false, matchScore: 1.0 };

    // 2. Exact Name Match (case-insensitive)
    for (const p of this.profiles.values()) {
      if (p.name.toLowerCase() === q) {
        return { profile: p, isFuzzyMatch: false, matchScore: 0.95 };
      }
    }

    // 3. Substring / Tag prefix matching
    let bestMatch: ProfileDescriptor | undefined;
    let bestScore = 0;

    for (const p of this.profiles.values()) {
      let score = 0;
      const idLower = p.id.toLowerCase();
      const nameLower = p.name.toLowerCase();

      if (idLower.startsWith(q)) score = Math.max(score, 0.85);
      else if (idLower.includes(q)) score = Math.max(score, 0.7);

      if (nameLower.startsWith(q)) score = Math.max(score, 0.8);
      else if (nameLower.includes(q)) score = Math.max(score, 0.65);

      if (p.tags?.some((t) => t.toLowerCase() === q)) score = Math.max(score, 0.75);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch && bestScore >= 0.6) {
      return { profile: bestMatch, isFuzzyMatch: true, matchScore: bestScore };
    }

    return {};
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
      extends: mutation.extends !== undefined ? mutation.extends : existing.extends,
      category: mutation.category ?? existing.category,
      icon: mutation.icon !== undefined ? mutation.icon : existing.icon,
      isFavorite: mutation.isFavorite !== undefined ? mutation.isFavorite : existing.isFavorite,
      isProtected: mutation.isProtected !== undefined ? mutation.isProtected : existing.isProtected,
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
   * Toggles favorite flag for a profile.
   */
  toggleFavorite(profileId: string): boolean {
    const p = this.profiles.get(profileId);
    if (!p) return false;
    const isFavorite = !p.isFavorite;
    this.profiles.set(profileId, { ...p, isFavorite, updatedAtMs: Date.now() });
    return isFavorite;
  }

  /**
   * Deletes a profile (cannot delete protected profiles or 'default').
   */
  deleteProfile(profileId: string): boolean {
    const existing = this.profiles.get(profileId);
    if (!existing) return false;
    if (existing.isProtected || profileId === "default") return false;

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
   * Restores an archived profile back to active status.
   */
  restoreProfile(profileId: string): ProfileDescriptor | undefined {
    const existing = this.profiles.get(profileId);
    if (!existing || existing.status !== "archived") return undefined;
    const restored: ProfileDescriptor = {
      ...existing,
      status: "active",
      updatedAtMs: Date.now(),
    };
    this.profiles.set(profileId, restored);
    return restored;
  }

  /**
   * Binds a session to a profile and updates telemetry.
   */
  bindSessionProfile(sessionId: string, profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const oldProfile = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    this.sessionBindings.set(sessionId, profileId);

    // Update telemetry
    const curTelemetry = profile.telemetry || {
      totalInvocations: 0,
      totalSessionsBound: 0,
      lastActivatedAtMs: Date.now(),
      estimatedTokensSaved: 0,
    };
    this.profiles.set(profileId, {
      ...profile,
      telemetry: {
        ...curTelemetry,
        totalSessionsBound: curTelemetry.totalSessionsBound + 1,
        lastActivatedAtMs: Date.now(),
      },
    });

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
   * Increments invocation counter on active session profile.
   */
  recordInvocation(sessionId: string): void {
    const profileId = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    const curTelemetry = profile.telemetry || {
      totalInvocations: 0,
      totalSessionsBound: 0,
      lastActivatedAtMs: Date.now(),
      estimatedTokensSaved: 0,
    };

    this.profiles.set(profileId, {
      ...profile,
      telemetry: {
        ...curTelemetry,
        totalInvocations: curTelemetry.totalInvocations + 1,
        lastActivatedAtMs: Date.now(),
      },
    });
  }

  /**
   * Retrieves the active profile for a session.
   */
  getSessionProfile(sessionId: string): ProfileDescriptor {
    const profileId = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    const profile = this.profiles.get(profileId);
    if (profile) return profile;

    const defaultProfile = this.profiles.get("default");
    if (defaultProfile) return defaultProfile;

    // Guaranteed fallback
    return {
      id: "default",
      name: "Default Agent Profile",
      description: "Standard primary operational profile",
      status: "active",
      soulPrompt: "You are LUMI, an autonomous AI assistant.",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
  }

  /**
   * Retrieves the root default profile.
   */
  getDefaultProfile(): ProfileDescriptor {
    return this.getSessionProfile("");
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
   * Unbinds a session.
   */
  unbindSession(sessionId: string): void {
    this.sessionBindings.delete(sessionId);
  }

  /**
   * Retrieves transition history.
   */
  getTransitionHistory(): readonly ProfileTransitionRecord[] {
    return [...this.transitionHistory];
  }

  /**
   * Exports an immutable state snapshot for frame rollback.
   */
  exportSnapshot(): ProfileWorkspaceSnapshot {
    return {
      profiles: Array.from(this.profiles.values()).map((p) => ({
        ...p,
        enabledToolsets: p.enabledToolsets ? [...p.enabledToolsets] : undefined,
        disabledToolsets: p.disabledToolsets ? [...p.disabledToolsets] : undefined,
        customAxioms: p.customAxioms ? [...p.customAxioms] : undefined,
        tags: p.tags ? [...p.tags] : undefined,
        memoryStore: p.memoryStore ? { ...p.memoryStore } : undefined,
        envOverrides: p.envOverrides ? { ...p.envOverrides } : undefined,
        telemetry: p.telemetry ? { ...p.telemetry } : undefined,
      })),
      sessionBindings: Object.fromEntries(this.sessionBindings.entries()),
      activeDefaultProfileId: this.activeDefaultProfileId,
      totalProfiles: this.profiles.size,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores substrate state from a snapshot.
   */
  restoreSnapshot(snapshot: ProfileWorkspaceSnapshot): void {
    this.profiles.clear();
    for (const p of snapshot.profiles) {
      this.profiles.set(p.id, {
        ...p,
        enabledToolsets: p.enabledToolsets ? [...p.enabledToolsets] : undefined,
        disabledToolsets: p.disabledToolsets ? [...p.disabledToolsets] : undefined,
        customAxioms: p.customAxioms ? [...p.customAxioms] : undefined,
        tags: p.tags ? [...p.tags] : undefined,
        memoryStore: p.memoryStore ? { ...p.memoryStore } : undefined,
        envOverrides: p.envOverrides ? { ...p.envOverrides } : undefined,
        telemetry: p.telemetry ? { ...p.telemetry } : undefined,
      });
    }

    this.sessionBindings.clear();
    for (const [sId, pId] of Object.entries(snapshot.sessionBindings)) {
      this.sessionBindings.set(sId, pId);
    }

    this.activeDefaultProfileId = snapshot.activeDefaultProfileId || "default";
  }

  /**
   * Alias for restoreSnapshot.
   */
  importSnapshot(snapshot: ProfileWorkspaceSnapshot): void {
    this.restoreSnapshot(snapshot);
  }

  /**
   * Resets substrate to clean default state.
   */
  clear(): void {
    this.profiles.clear();
    this.sessionBindings.clear();
    this.transitionHistory = [];
    this.activeDefaultProfileId = "default";
    this.initDefaultProfile();
  }
}
