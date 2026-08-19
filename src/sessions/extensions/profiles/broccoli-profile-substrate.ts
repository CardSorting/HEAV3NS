/**
 * broccoli-profile-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for isolated profile environments, session bindings,
 * persona memory stores, telemetry tracking, and zero-GC state transitions (Target #76 / ADR-119).
 */

import type {
  IBroccoliProfileSubstrate,
  ProfileAuditRow,
  ProfileBindingRow,
  ProfileBulkMutationResult,
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileDslQueryFilter,
  ProfileGroupBy,
  ProfileGroupedLane,
  ProfileHealthAuditReport,
  ProfileHealthStatus,
  ProfileMetricsReport,
  ProfileMutation,
  ProfileMutationUndoRecord,
  ProfileQueryFilter,
  ProfileRow,
  ProfileSortBy,
  ProfileSortDirection,
  ProfileTransitionRow,
  ProfileWorkspaceSnapshot,
} from "../../../core/contracts/profile.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export interface ProfileTransitionRecord {
  readonly sessionId: string;
  readonly fromProfile: string;
  readonly toProfile: string;
  readonly timestampMs: number;
}

export class BroccoliProfileSubstrate implements IBroccoliProfileSubstrate {
  private profiles: Map<string, ProfileDescriptor>;
  private sessionBindings: Map<string, string>;
  private activeDefaultProfileId: string;
  private transitionHistory: ProfileTransitionRecord[];
  private auditLogs: ProfileAuditRow[] = [];
  private static readonly MAX_HISTORY = 1000;

  private readonly undoStack: ProfileMutationUndoRecord[] = [];
  private readonly redoStack: ProfileMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private profilesTable?: IDbTable<ProfileRow>;
  private bindingsTable?: IDbTable<ProfileBindingRow>;
  private transitionsTable?: IDbTable<ProfileTransitionRow>;
  private auditsTable?: IDbTable<ProfileAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.profiles = new Map<string, ProfileDescriptor>();
    this.sessionBindings = new Map<string, string>();
    this.activeDefaultProfileId = "default";
    this.transitionHistory = [];

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.profilesTable = dbKernel.getTable<ProfileRow>("profiles");
      this.bindingsTable = dbKernel.getTable<ProfileBindingRow>("profile_session_bindings");
      this.transitionsTable = dbKernel.getTable<ProfileTransitionRow>("profile_transitions");
      this.auditsTable = dbKernel.getTable<ProfileAuditRow>("profile_audits");
    }

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

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: ProfileMutationUndoRecord["mutationType"], prev: ProfileWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliProfileSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    this.redoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.previousSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.previousSnapshot);
    this.recordAudit("system", "undo", "system", `Reverted ${record.mutationType}`);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    this.undoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.nextSnapshot);
    this.recordAudit("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Profile CRUD & Session Routing
  // ---------------------------------------------------------------------------

  createProfile(profile: ProfileDescriptor): boolean {
    if (this.profiles.has(profile.id)) {
      return false;
    }
    const prev = this.exportSnapshot();
    const telemetry = profile.telemetry || {
      totalInvocations: 0,
      totalSessionsBound: 0,
      lastActivatedAtMs: Date.now(),
      estimatedTokensSaved: 0,
    };
    const created: ProfileDescriptor = { ...profile, telemetry };
    this.profiles.set(profile.id, created);

    if (this.profilesTable) {
      this.profilesTable.put(profile.id, {
        id: profile.id,
        name: profile.name,
        category: profile.category || "general",
        status: profile.status,
        modelPreference: profile.modelPreference || "default",
        isFavorite: !!profile.isFavorite,
        isProtected: !!profile.isProtected,
        createdAtMs: profile.createdAtMs,
        updatedAtMs: profile.updatedAtMs,
      });
    }

    this.pushUndoRecord("create_profile", prev);
    this.recordAudit(profile.id, "create_profile", "user", `Created profile: ${profile.name}`);
    return true;
  }

  getProfile(profileId: string): ProfileDescriptor | undefined {
    return this.profiles.get(profileId);
  }

  listProfiles(filter?: ProfileQueryFilter): readonly ProfileDescriptor[] {
    let result = Array.from(this.profiles.values());

    if (!filter) {
      return result;
    }

    if (filter.status) {
      result = result.filter((p) => p.status === filter.status);
    }
    if (filter.category) {
      result = result.filter((p) => p.category === filter.category);
    }
    if (filter.isFavorite !== undefined) {
      result = result.filter((p) => !!p.isFavorite === filter.isFavorite);
    }
    if (filter.model) {
      result = result.filter((p) => p.modelPreference === filter.model);
    }
    if (filter.extends) {
      result = result.filter((p) => p.extends === filter.extends);
    }
    if (filter.tag) {
      const targetTag = filter.tag.toLowerCase();
      result = result.filter((p) => p.tags?.some((t) => t.toLowerCase() === targetTag));
    }
    if (filter.text) {
      const q = filter.text.toLowerCase();
      result = result.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.soulPrompt.toLowerCase().includes(q)
      );
    }

    if (filter.sortBy) {
      const dir = filter.sortDirection === "desc" ? -1 : 1;
      result.sort((a, b) => {
        switch (filter.sortBy) {
          case "name":
            return dir * a.name.localeCompare(b.name);
          case "recent":
            return dir * (b.updatedAtMs - a.updatedAtMs);
          case "usage":
            return dir * ((b.telemetry?.totalInvocations || 0) - (a.telemetry?.totalInvocations || 0));
          case "favorites":
            return dir * (Number(!!b.isFavorite) - Number(!!a.isFavorite));
          default:
            return 0;
        }
      });
    }

    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  updateProfile(profileId: string, mutation: ProfileMutation): ProfileDescriptor | undefined {
    const existing = this.profiles.get(profileId);
    if (!existing) {
      return undefined;
    }

    const prev = this.exportSnapshot();
    const updated: ProfileDescriptor = {
      ...existing,
      ...mutation,
      id: existing.id,
      isProtected: existing.isProtected,
      updatedAtMs: Date.now(),
    };

    this.profiles.set(profileId, updated);

    if (this.profilesTable) {
      this.profilesTable.put(profileId, {
        id: updated.id,
        name: updated.name,
        category: updated.category || "general",
        status: updated.status,
        modelPreference: updated.modelPreference || "default",
        isFavorite: !!updated.isFavorite,
        isProtected: !!updated.isProtected,
        createdAtMs: updated.createdAtMs,
        updatedAtMs: updated.updatedAtMs,
      });
    }

    this.pushUndoRecord("update_profile", prev);
    this.recordAudit(profileId, "update_profile", "user", `Updated profile: ${updated.name}`);
    return updated;
  }

  deleteProfile(profileId: string): boolean {
    const existing = this.profiles.get(profileId);
    if (!existing || existing.isProtected || profileId === this.activeDefaultProfileId) {
      return false;
    }

    const prev = this.exportSnapshot();
    this.profiles.delete(profileId);

    // Clean up session bindings that mapped to this profile
    for (const [sessId, pId] of this.sessionBindings.entries()) {
      if (pId === profileId) {
        this.sessionBindings.delete(sessId);
      }
    }

    this.pushUndoRecord("delete_profile", prev);
    this.recordAudit(profileId, "delete_profile", "user", `Deleted profile: ${existing.name}`);
    return true;
  }

  cloneProfile(
    sourceProfileId: string,
    targetProfileId: string,
    options?: ProfileCloneOptions
  ): ProfileDescriptor | undefined {
    const source = this.profiles.get(sourceProfileId);
    if (!source || this.profiles.has(targetProfileId)) {
      return undefined;
    }

    const prev = this.exportSnapshot();
    const now = Date.now();
    const cloneKind = options?.cloneKind || "persona";

    const cloned: ProfileDescriptor = {
      ...source,
      id: targetProfileId,
      name: options?.newName || `${source.name} (Copy)`,
      description: options?.newDescription || source.description,
      category: options?.newCategory || source.category,
      icon: options?.newIcon || source.icon,
      isProtected: false,
      isFavorite: false,
      createdAtMs: now,
      updatedAtMs: now,
      memoryStore:
        cloneKind === "shallow" || options?.preserveMemories === false
          ? {}
          : { ...source.memoryStore },
      envOverrides: options?.envOverrides ? { ...options.envOverrides } : { ...source.envOverrides },
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: now,
        estimatedTokensSaved: 0,
      },
    };

    this.profiles.set(targetProfileId, cloned);
    this.pushUndoRecord("clone_profile", prev);
    this.recordAudit(targetProfileId, "clone_profile", "user", `Cloned from ${source.id} -> ${cloned.id}`);
    return cloned;
  }

  bindSession(sessionId: string, profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      return false;
    }

    const prevProfile = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    this.sessionBindings.set(sessionId, profileId);

    const now = Date.now();
    this.transitionHistory.unshift({
      sessionId,
      fromProfile: prevProfile,
      toProfile: profileId,
      timestampMs: now,
    });
    if (this.transitionHistory.length > BroccoliProfileSubstrate.MAX_HISTORY) {
      this.transitionHistory.pop();
    }

    if (this.bindingsTable) {
      this.bindingsTable.put(sessionId, {
        id: sessionId,
        sessionId,
        profileId,
        boundAtMs: now,
      });
    }

    if (this.transitionsTable) {
      this.transitionsTable.put(`trans_${now}_${sessionId}`, {
        id: `trans_${now}_${sessionId}`,
        sessionId,
        fromProfile: prevProfile,
        toProfile: profileId,
        timestampMs: now,
      });
    }

    // Update telemetry
    if (profile.telemetry) {
      const updatedTelemetry = {
        ...profile.telemetry,
        totalSessionsBound: profile.telemetry.totalSessionsBound + 1,
        lastActivatedAtMs: now,
      };
      this.profiles.set(profileId, { ...profile, telemetry: updatedTelemetry });
    }

    return true;
  }

  unbindSession(sessionId: string): boolean {
    return this.sessionBindings.delete(sessionId);
  }

  getProfileForSession(sessionId: string): ProfileDescriptor {
    const profileId = this.sessionBindings.get(sessionId);
    if (profileId) {
      const p = this.profiles.get(profileId);
      if (p) return p;
    }
    return this.getActiveDefaultProfile();
  }

  getActiveDefaultProfile(): ProfileDescriptor {
    const def = this.profiles.get(this.activeDefaultProfileId);
    if (def) return def;
    const fallback = Array.from(this.profiles.values())[0];
    if (fallback) return fallback;
    this.initDefaultProfile();
    return this.profiles.get("default")!;
  }

  setActiveDefaultProfile(profileId: string): boolean {
    if (!this.profiles.has(profileId)) {
      return false;
    }
    this.activeDefaultProfileId = profileId;
    return true;
  }

  resolveProfileOrFuzzy(query: string): { profile?: ProfileDescriptor; isFuzzyMatch: boolean } {
    const exact = this.profiles.get(query);
    if (exact) return { profile: exact, isFuzzyMatch: false };
    const lower = query.toLowerCase();
    for (const p of this.profiles.values()) {
      if (p.id.toLowerCase() === lower || p.name.toLowerCase() === lower) {
        return { profile: p, isFuzzyMatch: true };
      }
    }
    return { profile: undefined, isFuzzyMatch: false };
  }

  getSessionProfile(sessionId: string): ProfileDescriptor {
    return this.getProfileForSession(sessionId);
  }

  getDefaultProfile(): ProfileDescriptor {
    return this.getActiveDefaultProfile();
  }

  bindSessionProfile(sessionId: string, profileId: string): boolean {
    return this.bindSession(sessionId, profileId);
  }

  queryProfiles(query?: ProfileQueryFilter | string): readonly ProfileDescriptor[] {
    if (typeof query === "string") {
      return this.queryProfilesDsl(query);
    }
    return this.listProfiles(query);
  }

  toggleFavorite(profileId: string): boolean {
    const p = this.profiles.get(profileId);
    if (!p) return false;
    const isFav = !p.isFavorite;
    this.updateProfile(profileId, { isFavorite: isFav });
    return isFav;
  }

  restoreProfile(profileId: string): ProfileDescriptor | undefined {
    return this.updateProfile(profileId, { status: "active" });
  }

  recordInvocation(sessionIdOrProfileId: string, tokensSaved: number = 0): void {
    let profile = this.profiles.get(sessionIdOrProfileId);
    if (!profile) {
      profile = this.getProfileForSession(sessionIdOrProfileId);
    }
    if (profile && profile.telemetry) {
      const updatedTelemetry = {
        ...profile.telemetry,
        totalInvocations: (profile.telemetry.totalInvocations || 0) + 1,
        lastActivatedAtMs: Date.now(),
        estimatedTokensSaved: (profile.telemetry.estimatedTokensSaved || 0) + tokensSaved,
      };
      this.profiles.set(profile.id, { ...profile, telemetry: updatedTelemetry });
    }
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): ProfileHealthAuditReport {
    const profileList = Array.from(this.profiles.values());
    const totalProfiles = profileList.length;
    const activeProfilesCount = profileList.filter((p) => p.status === "active").length;
    const favoriteProfilesCount = profileList.filter((p) => !!p.isFavorite).length;
    const boundSessionsCount = this.sessionBindings.size;

    let healthStatus: ProfileHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (activeProfilesCount === 0) {
      healthStatus = "critical_unbound";
      recommendations.push("No active agent profiles found. Activate or initialize at least one default profile.");
    } else if (activeProfilesCount < totalProfiles) {
      healthStatus = "healthy";
    }

    if (recommendations.length === 0) {
      recommendations.push("All persona configurations, toolsets, and session bindings are in optimal alignment.");
    }

    return {
      totalProfiles,
      activeProfilesCount,
      favoriteProfilesCount,
      boundSessionsCount,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): ProfileMetricsReport {
    const profileList = Array.from(this.profiles.values());
    let active = 0;
    let suspended = 0;
    let archived = 0;
    let totalInvocations = 0;
    let totalTokensSaved = 0;
    const catDist: Record<string, number> = {};
    const invocationsList: number[] = [];

    for (const p of profileList) {
      if (p.status === "active") active++;
      else if (p.status === "suspended") suspended++;
      else if (p.status === "archived") archived++;

      const cat = p.category || "general";
      catDist[cat] = (catDist[cat] || 0) + 1;

      const inv = p.telemetry?.totalInvocations || 0;
      totalInvocations += inv;
      totalTokensSaved += p.telemetry?.estimatedTokensSaved || 0;
      invocationsList.push(inv);
    }

    invocationsList.sort((a, b) => a - b);
    const p50 = invocationsList.length > 0 ? invocationsList[Math.floor(invocationsList.length * 0.5)] : 0;
    const p95 = invocationsList.length > 0 ? invocationsList[Math.floor(invocationsList.length * 0.95)] : 0;

    return {
      totalProfiles: profileList.length,
      activeProfiles: active,
      suspendedProfiles: suspended,
      archivedProfiles: archived,
      categoryDistribution: catDist,
      totalBoundSessions: this.sessionBindings.size,
      totalInvocations,
      totalTokensSaved,
      p50Invocations: p50,
      p95Invocations: p95,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedProfiles(
    groupBy: ProfileGroupBy = "category",
    sortBy: ProfileSortBy = "name",
    direction: ProfileSortDirection = "asc"
  ): readonly ProfileGroupedLane[] {
    const lanes = new Map<string, ProfileDescriptor[]>();

    for (const p of this.profiles.values()) {
      let key: string = p.category || "general";
      switch (groupBy) {
        case "category":
          key = p.category || "general";
          break;
        case "status":
          key = p.status;
          break;
        case "model":
          key = p.modelPreference || "default";
          break;
        case "favorite":
          key = p.isFavorite ? "favorite" : "standard";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(p);
    }

    const result: ProfileGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") cmp = a.name.localeCompare(b.name);
        else if (sortBy === "category") cmp = (a.category || "").localeCompare(b.category || "");
        else if (sortBy === "recent") cmp = b.updatedAtMs - a.updatedAtMs;
        else if (sortBy === "usage") cmp = (b.telemetry?.totalInvocations || 0) - (a.telemetry?.totalInvocations || 0);
        return direction === "asc" ? cmp : -cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        profiles: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryProfilesDsl(query: ProfileDslQueryFilter | string): readonly ProfileDescriptor[] {
    const parsed: ProfileDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.profiles.values()).filter((p) => {
      if (parsed.category && p.category !== parsed.category) return false;
      if (parsed.status && p.status !== parsed.status) return false;
      if (parsed.model && p.modelPreference !== parsed.model) return false;
      if (parsed.isFavorite !== undefined && !!p.isFavorite !== parsed.isFavorite) return false;
      if (parsed.isProtected !== undefined && !!p.isProtected !== parsed.isProtected) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${p.id} ${p.name} ${p.description} ${p.soulPrompt} ${p.tags?.join(" ") || ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): ProfileDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let category: any;
    let status: any;
    let model: string | undefined;
    let isFavorite: boolean | undefined;
    let isProtected: boolean | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("category:")) {
        category = tok.slice(9);
      } else if (tok.startsWith("status:")) {
        status = tok.slice(7);
      } else if (tok.startsWith("model:")) {
        model = tok.slice(6);
      } else if (tok === "is:favorite" || tok === "favorite:true") {
        isFavorite = true;
      } else if (tok === "is:protected" || tok === "protected:true") {
        isProtected = true;
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      category,
      status,
      model,
      isFavorite,
      isProtected,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeProfiles(profileIds: readonly string[]): ProfileBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const pid of profileIds) {
      const p = this.profiles.get(pid);
      if (p && !p.isProtected && pid !== this.activeDefaultProfileId) {
        this.profiles.delete(pid);
        affected.push(pid);
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: profileIds.length,
      modifiedCount: affected.length,
      affectedProfileIds: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Persistent Multi-Profile Orchestrator</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #0284c7; color: #bae6fd; }
  </style>
</head>
<body>
  <h1>👤 LUMI Multi-Profile & Persona Orchestrator</h1>
  <p style="color: #94a3b8;">Isolated Persona Environments, Toolset Permissions & Inheritance (Target #76 / ADR-119)</p>
  
  <div class="grid">
    <div class="card"><div>Total Profiles</div><div class="metric-val">${metrics.totalProfiles}</div></div>
    <div class="card"><div>Active Personas</div><div class="metric-val" style="color:#10b981;">${metrics.activeProfiles}</div></div>
    <div class="card"><div>Bound Sessions</div><div class="metric-val" style="color:#f59e0b;">${metrics.totalBoundSessions}</div></div>
    <div class="card"><div>Health Posture</div><div class="metric-val" style="color:${health.healthStatus === 'critical_unbound' ? '#ef4444' : '#22c55e'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Configured Profiles</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Category</th>
        <th>Model</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.profiles.values()).map((p) => `
        <tr>
          <td><code>${p.id}</code></td>
          <td>${p.icon || '👤'} <strong>${p.name}</strong></td>
          <td><span class="badge">${(p.category || 'general').toUpperCase()}</span></td>
          <td>${p.modelPreference || 'default'}</td>
          <td><strong style="color: ${p.status === 'active' ? '#22c55e' : '#94a3b8'}">${p.status.toUpperCase()}</strong></td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();

    let md = `# LUMI Agent Profile Subsystem Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Profiles:** \`${metrics.totalProfiles}\` | **Active Sessions:** \`${metrics.totalBoundSessions}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Active Profiles:** ${metrics.activeProfiles}\n`;
    md += `- **Suspended Profiles:** ${metrics.suspendedProfiles}\n`;
    md += `- **Archived Profiles:** ${metrics.archivedProfiles}\n`;
    md += `- **Total Invocations:** ${metrics.totalInvocations}\n`;
    md += `- **Tokens Saved:** ${metrics.totalTokensSaved}\n\n`;

    md += `## Profiles Ledger\n\n`;
    md += `| Icon | ID | Name | Category | Status | Model |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const p of Array.from(this.profiles.values())) {
      md += `| ${p.icon || "👤"} | \`${p.id}\` | **${p.name}** | ${p.category || "general"} | \`${p.status}\` | ${p.modelPreference || "default"} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "id,name,category,status,modelPreference,isFavorite,isProtected,createdAtMs,updatedAtMs\n";
    const rows = Array.from(this.profiles.values()).map((p) => {
      return `"${p.id}","${p.name}","${p.category || "general"}","${p.status}","${p.modelPreference || "default"}",${!!p.isFavorite},${!!p.isProtected},${p.createdAtMs},${p.updatedAtMs}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

  exportSnapshot(): ProfileWorkspaceSnapshot {
    const bindingsObj: Record<string, string> = {};
    for (const [k, v] of this.sessionBindings.entries()) {
      bindingsObj[k] = v;
    }
    return {
      profiles: Array.from(this.profiles.values()),
      sessionBindings: bindingsObj,
      activeDefaultProfileId: this.activeDefaultProfileId,
      totalProfiles: this.profiles.size,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: ProfileWorkspaceSnapshot): void {
    this.profiles.clear();
    for (const p of snapshot.profiles) {
      this.profiles.set(p.id, p);
    }

    this.sessionBindings.clear();
    if (snapshot.sessionBindings) {
      for (const [k, v] of Object.entries(snapshot.sessionBindings)) {
        this.sessionBindings.set(k, v);
      }
    }

    this.activeDefaultProfileId = snapshot.activeDefaultProfileId || "default";
  }

  public recordAudit(profileId: string, action: string, operator: string, details: string): void {
    const row: ProfileAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${profileId}`,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  clear(): void {
    this.profiles.clear();
    this.sessionBindings.clear();
    this.transitionHistory.length = 0;
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.initDefaultProfile();
  }
}
