/**
 * broccoli-profile-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for isolated profile environments, session bindings,
 * persona memory stores, immutable revisions, SLA quota governance, delegation checking,
 * telemetry tracking, and zero-GC state transitions (Target #76 / ADR-119 / Apex Tier).
 */

import type {
  FallbackTrigger,
  IBroccoliProfileSubstrate,
  ProfileAuditRow,
  ProfileBindingRow,
  ProfileBulkMutationResult,
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileDslQueryFilter,
  ProfileExemplar,
  ProfileGroupBy,
  ProfileGroupedLane,
  ProfileHealthAuditReport,
  ProfileHealthStatus,
  ProfileLifecycleEvent,
  ProfileLifecycleEventPayload,
  ProfileLifecycleHook,
  ProfileMetricsReport,
  ProfileMutation,
  ProfileMutationUndoRecord,
  ProfilePrefixCacheFrame,
  ProfileQueryFilter,
  ProfileRevision,
  ProfileRevisionRow,
  ProfileRow,
  ProfileRunState,
  ProfileRunStep,
  ProfileRunStatus,
  ProfileSortBy,
  ProfileSortDirection,
  ProfileTemplateHydrationContext,
  ProfileTransitionRow,
  ProfileWorkspaceSnapshot,
} from "../../../core/contracts/profile.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";
import { DeterministicProfileEngine } from "../../../agents/extensions/profiles/deterministic-profile-engine.js";

export interface ProfileTransitionRecord {
  readonly sessionId: string;
  readonly fromProfile: string;
  readonly toProfile: string;
  readonly timestampMs: number;
}

export class BroccoliProfileSubstrate implements IBroccoliProfileSubstrate {
  private profiles: Map<string, ProfileDescriptor>;
  private revisions: Map<string, ProfileRevision[]>;
  private sessionBindings: Map<string, string>;
  private activeDefaultProfileId: string;
  private transitionHistory: ProfileTransitionRecord[];
  private auditLogs: ProfileAuditRow[] = [];
  private static readonly MAX_HISTORY = 1000;

  private readonly undoStack: ProfileMutationUndoRecord[] = [];
  private readonly redoStack: ProfileMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  private readonly runs: Map<string, ProfileRunState> = new Map();
  private readonly hooks: Map<ProfileLifecycleEvent, ProfileLifecycleHook[]> = new Map();

  private readonly engine: DeterministicProfileEngine;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private profilesTable?: IDbTable<ProfileRow>;
  private revisionsTable?: IDbTable<ProfileRevisionRow>;
  private bindingsTable?: IDbTable<ProfileBindingRow>;
  private transitionsTable?: IDbTable<ProfileTransitionRow>;
  private auditsTable?: IDbTable<ProfileAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    this.profiles = new Map<string, ProfileDescriptor>();
    this.revisions = new Map<string, ProfileRevision[]>();
    this.sessionBindings = new Map<string, string>();
    this.activeDefaultProfileId = "default";
    this.transitionHistory = [];
    this.engine = new DeterministicProfileEngine();

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.profilesTable = dbKernel.getTable<ProfileRow>("profiles");
      this.revisionsTable = dbKernel.getTable<ProfileRevisionRow>("profile_revisions");
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
      version: "1.0.0",
      revisionNumber: 1,
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
      parameters: {
        topP: 1.0,
        responseFormat: "text",
      },
      governance: {
        maxTokensPerTurn: 16384,
        maxMonthlyBudgetUsd: 500.0,
        rateLimitPerMin: 120,
      },
      delegation: {
        canSpawnSubagents: true,
        maxSubagentDepth: 5,
        delegationStrategy: "peer_mesh",
      },
      conversationStarters: [
        {
          id: "starter_lumi_init",
          title: "System Status & Telemetry",
          prompt: "Report current substrate health, active profile bindings, and system telemetry.",
          icon: "⚡",
          category: "System",
        },
      ],
      telemetry: {
        totalInvocations: 0,
        totalSessionsBound: 0,
        lastActivatedAtMs: Date.now(),
        estimatedTokensSaved: 0,
        totalTokensConsumed: 0,
        totalCostUsd: 0,
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
      totalTokensConsumed: 0,
      totalCostUsd: 0,
    };
    const created: ProfileDescriptor = {
      ...profile,
      version: profile.version || "1.0.0",
      revisionNumber: profile.revisionNumber || 1,
      telemetry,
    };
    this.profiles.set(profile.id, created);

    // Create initial revision
    const initialRev = this.engine.createRevisionCheckpoint(created, "Initial profile creation", "creator");
    this.revisions.set(profile.id, [initialRev]);

    if (this.profilesTable) {
      this.profilesTable.put(profile.id, {
        id: profile.id,
        name: profile.name,
        category: profile.category || "general",
        status: profile.status,
        modelPreference: profile.modelPreference || "default",
        isFavorite: !!profile.isFavorite,
        isProtected: !!profile.isProtected,
        version: created.version,
        createdAtMs: profile.createdAtMs,
        updatedAtMs: profile.updatedAtMs,
      });
    }

    this.pushUndoRecord("create_profile", prev);
    this.recordAudit(profile.id, "create_profile", "user", `Created profile: ${profile.name} (v${created.version})`);
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
    if (filter.hasExemplars !== undefined) {
      result = result.filter((p) => (p.exemplars && p.exemplars.length > 0) === filter.hasExemplars);
    }
    if (filter.hasMcp !== undefined) {
      result = result.filter((p) => (p.mcpBindings && p.mcpBindings.length > 0) === filter.hasMcp);
    }
    if (filter.hasVoice !== undefined) {
      result = result.filter((p) => Boolean(p.voice) === filter.hasVoice);
    }
    if (filter.minInvocations !== undefined) {
      result = result.filter((p) => (p.telemetry?.totalInvocations || 0) >= filter.minInvocations!);
    }
    if (filter.maxCost !== undefined) {
      result = result.filter((p) => (p.telemetry?.totalCostUsd || 0) <= filter.maxCost!);
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
          case "category":
            return dir * (a.category || "general").localeCompare(b.category || "general");
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
      name: mutation.name ?? existing.name,
      description: mutation.description ?? existing.description,
      status: mutation.status ?? existing.status,
      version: mutation.version ?? existing.version,
      extends: mutation.extends !== undefined ? mutation.extends : existing.extends,
      category: mutation.category ?? existing.category,
      icon: mutation.icon ?? existing.icon,
      isFavorite: mutation.isFavorite !== undefined ? mutation.isFavorite : existing.isFavorite,
      isProtected: mutation.isProtected !== undefined ? mutation.isProtected : existing.isProtected,
      soulPrompt: mutation.soulPrompt ?? existing.soulPrompt,
      systemPromptOverlay: mutation.systemPromptOverlay !== undefined ? mutation.systemPromptOverlay : existing.systemPromptOverlay,
      modelPreference: mutation.modelPreference ?? existing.modelPreference,
      fallbackModel: mutation.fallbackModel ?? existing.fallbackModel,
      reasoningEffort: mutation.reasoningEffort ?? existing.reasoningEffort,
      temperature: mutation.temperature !== undefined ? mutation.temperature : existing.temperature,
      parameters: mutation.parameters !== undefined ? { ...(existing.parameters || {}), ...mutation.parameters } : existing.parameters,
      governance: mutation.governance !== undefined ? { ...(existing.governance || {}), ...mutation.governance } : existing.governance,
      delegation: mutation.delegation !== undefined ? { ...(existing.delegation || {}), ...mutation.delegation } : existing.delegation,
      mcpBindings: mutation.mcpBindings ?? existing.mcpBindings,
      knowledgeSources: mutation.knowledgeSources ?? existing.knowledgeSources,
      guardrails: mutation.guardrails !== undefined ? { ...(existing.guardrails || {}), ...mutation.guardrails } : existing.guardrails,
      conversationStarters: mutation.conversationStarters ?? existing.conversationStarters,
      exemplars: mutation.exemplars ? [...mutation.exemplars] : existing.exemplars,
      memoryPolicy: mutation.memoryPolicy !== undefined ? { ...(existing.memoryPolicy || {}), ...mutation.memoryPolicy } : existing.memoryPolicy,
      fallbackLadder: mutation.fallbackLadder ? [...mutation.fallbackLadder] : existing.fallbackLadder,
      voice: mutation.voice !== undefined ? { ...(existing.voice || {}), ...mutation.voice } : existing.voice,
      secrets: mutation.secrets ? [...mutation.secrets] : existing.secrets,
      variants: mutation.variants ? [...mutation.variants] : existing.variants,
      activeVariantId: mutation.activeVariantId !== undefined ? mutation.activeVariantId : existing.activeVariantId,
      enabledToolsets: mutation.enabledToolsets ? [...mutation.enabledToolsets] : existing.enabledToolsets,
      disabledToolsets: mutation.disabledToolsets ? [...mutation.disabledToolsets] : existing.disabledToolsets,
      skin: mutation.skin ?? existing.skin,
      customAxioms: mutation.customAxioms ? [...mutation.customAxioms] : existing.customAxioms,
      tags: mutation.tags ? [...mutation.tags] : existing.tags,
      memoryStore: mutation.memoryStore ? { ...(existing.memoryStore || {}), ...mutation.memoryStore } : existing.memoryStore,
      envOverrides: mutation.envOverrides ? { ...(existing.envOverrides || {}), ...mutation.envOverrides } : existing.envOverrides,
      metadata: mutation.metadata ? { ...(existing.metadata || {}), ...mutation.metadata } : existing.metadata,
      updatedAtMs: Date.now(),
    };

    this.profiles.set(profileId, updated);

    // Auto-create revision if prompt or parameters mutated
    if (mutation.soulPrompt || mutation.customAxioms || mutation.parameters || mutation.modelPreference) {
      this.createRevision(profileId, "Profile mutation update", "user");
    }

    if (this.profilesTable) {
      this.profilesTable.put(profileId, {
        id: updated.id,
        name: updated.name,
        category: updated.category || "general",
        status: updated.status,
        modelPreference: updated.modelPreference || "default",
        isFavorite: !!updated.isFavorite,
        isProtected: !!updated.isProtected,
        version: updated.version,
        createdAtMs: updated.createdAtMs,
        updatedAtMs: updated.updatedAtMs,
      });
    }

    this.pushUndoRecord("update_profile", prev);
    this.recordAudit(profileId, "update_profile", "user", `Updated profile ${profileId}`);
    return updated;
  }

  deleteProfile(profileId: string): boolean {
    const existing = this.profiles.get(profileId);
    if (!existing) return false;
    if (existing.isProtected || profileId === "default" || profileId === this.activeDefaultProfileId) {
      return false;
    }

    const prev = this.exportSnapshot();
    this.profiles.delete(profileId);
    this.revisions.delete(profileId);

    // Clean up bindings
    for (const [sessId, profId] of this.sessionBindings.entries()) {
      if (profId === profileId) {
        this.sessionBindings.delete(sessId);
      }
    }

    if (this.profilesTable) {
      this.profilesTable.delete(profileId);
    }

    this.pushUndoRecord("delete_profile", prev);
    this.recordAudit(profileId, "delete_profile", "user", `Deleted profile ${profileId}`);
    return true;
  }

  cloneProfile(sourceProfileId: string, targetProfileId: string, options: ProfileCloneOptions = {}): ProfileDescriptor | undefined {
    const source = this.profiles.get(sourceProfileId);
    if (!source) return undefined;

    if (this.profiles.has(targetProfileId)) return undefined;

    const cloned = this.engine.cloneProfile(source, targetProfileId, options);
    const created = this.createProfile(cloned);
    if (!created) return undefined;

    this.recordAudit(targetProfileId, "clone_profile", "user", `Cloned from ${sourceProfileId} (${options.cloneKind || "persona"})`);
    return this.profiles.get(targetProfileId);
  }

  // ---------------------------------------------------------------------------
  // Revision Management & Rollback
  // ---------------------------------------------------------------------------

  createRevision(profileId: string, changeLog: string, author: string = "user"): ProfileRevision | undefined {
    const profile = this.profiles.get(profileId);
    if (!profile) return undefined;

    const rev = this.engine.createRevisionCheckpoint(profile, changeLog, author);
    const list = this.revisions.get(profileId) || [];
    list.unshift(rev);
    if (list.length > 50) list.pop();
    this.revisions.set(profileId, list);

    // Update profile version and revision number
    const updated: ProfileDescriptor = {
      ...profile,
      version: rev.semanticVersion,
      revisionNumber: rev.revisionNumber,
      updatedAtMs: rev.timestampMs,
    };
    this.profiles.set(profileId, updated);

    if (this.revisionsTable) {
      this.revisionsTable.put(rev.revisionId, {
        id: rev.revisionId,
        profileId,
        revisionId: rev.revisionId,
        revisionNumber: rev.revisionNumber,
        semanticVersion: rev.semanticVersion,
        changeLog,
        timestampMs: rev.timestampMs,
      });
    }

    this.recordAudit(profileId, "create_revision", author, `Created revision ${rev.semanticVersion} (${rev.revisionId})`);
    return rev;
  }

  rollbackToRevision(profileId: string, revisionId: string): ProfileDescriptor | undefined {
    const revs = this.revisions.get(profileId);
    if (!revs) return undefined;

    const targetRev = revs.find((r) => r.revisionId === revisionId || r.semanticVersion === revisionId);
    if (!targetRev) return undefined;

    const prev = this.exportSnapshot();
    const restored: ProfileDescriptor = {
      ...targetRev.snapshot,
      updatedAtMs: Date.now(),
    };

    this.profiles.set(profileId, restored);
    this.pushUndoRecord("rollback", prev);
    this.recordAudit(profileId, "rollback", "user", `Rolled back to revision ${targetRev.semanticVersion}`);
    return restored;
  }

  listRevisions(profileId: string): readonly ProfileRevision[] {
    return this.revisions.get(profileId) || [];
  }

  addExemplar(profileId: string, exemplar: ProfileExemplar): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const existingExemplars = profile.exemplars || [];
    const updatedExemplars = [...existingExemplars.filter((e) => e.id !== exemplar.id), exemplar];
    return !!this.updateProfile(profileId, { exemplars: updatedExemplars });
  }

  removeExemplar(profileId: string, exemplarId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile || !profile.exemplars) return false;

    const updatedExemplars = profile.exemplars.filter((e) => e.id !== exemplarId);
    return !!this.updateProfile(profileId, { exemplars: updatedExemplars });
  }

  resolveNextFallbackModel(profileId: string, trigger: FallbackTrigger): string | undefined {
    const profile = this.profiles.get(profileId);
    if (!profile) return undefined;

    if (profile.fallbackLadder && profile.fallbackLadder.length > 0) {
      const candidates = profile.fallbackLadder
        .filter((f) => f.triggers.includes(trigger))
        .sort((a, b) => a.priority - b.priority);

      if (candidates.length > 0) {
        return candidates[0].targetModel;
      }
    }

    return profile.fallbackModel;
  }

  buildPrefixCacheFrame(profileId: string, context?: ProfileTemplateHydrationContext): ProfilePrefixCacheFrame {
    const p = this.profiles.get(profileId) || this.getActiveDefaultProfile();
    return this.engine.buildPrefixCacheFrame(p, context);
  }

  createRun(profileId: string, sessionId: string, maxSteps: number = 25): ProfileRunState {
    const runId = `run_${profileId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const run: ProfileRunState = {
      runId,
      profileId,
      sessionId,
      status: "in_progress",
      maxSteps,
      currentStep: 0,
      steps: [],
      totalTokensConsumed: 0,
      totalCostUsd: 0,
      handoffHops: 0,
      startedAtMs: Date.now(),
    };
    this.runs.set(runId, run);
    return run;
  }

  recordRunStep(runId: string, step: Omit<ProfileRunStep, "stepIndex">): ProfileRunStep | undefined {
    const run = this.runs.get(runId);
    if (!run || run.status !== "in_progress") return undefined;

    const nextStepIndex = run.steps.length + 1;
    const fullStep: ProfileRunStep = {
      stepIndex: nextStepIndex,
      ...step,
    };

    const tokens = (run.totalTokensConsumed || 0) + (step.tokensConsumed || 0);
    const updatedSteps = [...run.steps, fullStep];
    const isBudgetExceeded = nextStepIndex >= run.maxSteps;

    const updatedRun: ProfileRunState = {
      ...run,
      currentStep: nextStepIndex,
      steps: updatedSteps,
      totalTokensConsumed: tokens,
      handoffHops: step.stepKind === "handoff" ? run.handoffHops + 1 : run.handoffHops,
      status: isBudgetExceeded ? "budget_exceeded" : run.status,
      completedAtMs: isBudgetExceeded ? Date.now() : undefined,
    };
    this.runs.set(runId, updatedRun);
    return fullStep;
  }

  completeRun(runId: string, status: ProfileRunStatus, failureReason?: string): ProfileRunState | undefined {
    const run = this.runs.get(runId);
    if (!run) return undefined;

    const updated: ProfileRunState = {
      ...run,
      status,
      failureReason,
      completedAtMs: Date.now(),
    };
    this.runs.set(runId, updated);
    this.triggerHook("on_run_completed", { profileId: run.profileId, sessionId: run.sessionId, details: { runId, status } });
    return updated;
  }

  getRun(runId: string): ProfileRunState | undefined {
    return this.runs.get(runId);
  }

  registerHook(event: ProfileLifecycleEvent, hook: ProfileLifecycleHook): void {
    const existing = this.hooks.get(event) || [];
    this.hooks.set(event, [...existing, hook]);
  }

  async triggerHook(event: ProfileLifecycleEvent, payload: Omit<ProfileLifecycleEventPayload, "event" | "timestampMs">): Promise<void> {
    const list = this.hooks.get(event);
    if (!list || list.length === 0) return;

    const fullPayload: ProfileLifecycleEventPayload = {
      event,
      timestampMs: Date.now(),
      ...payload,
    };

    for (const fn of list) {
      try {
        await fn(fullPayload);
      } catch {
        // Safe execution, isolate plugin failures
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Session Bindings & Dynamic Context Routing
  // ---------------------------------------------------------------------------

  bindSession(sessionId: string, profileId: string): boolean {
    if (!this.profiles.has(profileId)) return false;

    const fromProfile = this.sessionBindings.get(sessionId) || this.activeDefaultProfileId;
    this.sessionBindings.set(sessionId, profileId);

    // Record transition
    const rec: ProfileTransitionRecord = {
      sessionId,
      fromProfile,
      toProfile: profileId,
      timestampMs: Date.now(),
    };
    this.transitionHistory.unshift(rec);
    if (this.transitionHistory.length > BroccoliProfileSubstrate.MAX_HISTORY) {
      this.transitionHistory.pop();
    }

    // Update telemetry
    const target = this.profiles.get(profileId);
    if (target) {
      const curTele = target.telemetry || {
        totalInvocations: 0,
        totalSessionsBound: 0,
        estimatedTokensSaved: 0,
      };
      this.profiles.set(profileId, {
        ...target,
        telemetry: {
          ...curTele,
          totalSessionsBound: curTele.totalSessionsBound + 1,
          lastActivatedAtMs: Date.now(),
        },
      });
    }

    if (this.bindingsTable) {
      this.bindingsTable.put(sessionId, {
        id: sessionId,
        sessionId,
        profileId,
        boundAtMs: Date.now(),
      });
    }

    if (this.transitionsTable) {
      this.transitionsTable.put(`${sessionId}_${Date.now()}`, {
        id: `${sessionId}_${Date.now()}`,
        sessionId,
        fromProfile,
        toProfile: profileId,
        timestampMs: Date.now(),
      });
    }

    this.recordAudit(profileId, "bind_session", "session", `Session ${sessionId} bound to profile ${profileId}`);
    return true;
  }

  unbindSession(sessionId: string): boolean {
    const bound = this.sessionBindings.get(sessionId);
    if (!bound) return false;

    this.sessionBindings.delete(sessionId);
    if (this.bindingsTable) {
      this.bindingsTable.delete(sessionId);
    }
    this.recordAudit(bound, "unbind_session", "session", `Session ${sessionId} unbound from profile ${bound}`);
    return true;
  }

  getProfileForSession(sessionId: string): ProfileDescriptor {
    const boundId = this.sessionBindings.get(sessionId);
    if (boundId && this.profiles.has(boundId)) {
      return this.profiles.get(boundId)!;
    }
    return this.getActiveDefaultProfile();
  }

  getSessionProfile(sessionId: string): ProfileDescriptor {
    return this.getProfileForSession(sessionId);
  }

  recordInvocation(sessionId: string): void {
    const p = this.getProfileForSession(sessionId);
    this.recordInvocationUsage(p.id, 0, 0, 1, true);
  }

  getActiveDefaultProfile(): ProfileDescriptor {
    return this.profiles.get(this.activeDefaultProfileId) || this.profiles.get("default")!;
  }

  getDefaultProfile(): ProfileDescriptor {
    return this.getActiveDefaultProfile();
  }

  setActiveDefaultProfile(profileId: string): boolean {
    if (!this.profiles.has(profileId)) return false;
    this.activeDefaultProfileId = profileId;
    this.recordAudit(profileId, "set_active_default", "user", `Active default profile set to ${profileId}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Quota Governance & Delegation Checks
  // ---------------------------------------------------------------------------

  recordInvocationUsage(profileId: string, tokensUsed: number, costUsd: number, latencyMs: number, success: boolean): void {
    const p = this.profiles.get(profileId);
    if (!p) return;

    const cur = p.telemetry || {
      totalInvocations: 0,
      totalSessionsBound: 0,
      estimatedTokensSaved: 0,
      totalTokensConsumed: 0,
      totalCostUsd: 0,
    };

    const totalInvs = cur.totalInvocations + 1;
    const totalConsumed = (cur.totalTokensConsumed || 0) + tokensUsed;
    const totalCost = (cur.totalCostUsd || 0) + costUsd;
    const successCount = (cur.toolCallSuccessCount || 0) + (success ? 1 : 0);
    const failureCount = (cur.toolCallFailureCount || 0) + (success ? 0 : 1);
    const errorRate = Math.round((failureCount / totalInvs) * 100);

    const updatedTelemetry = {
      ...cur,
      totalInvocations: totalInvs,
      totalTokensConsumed: totalConsumed,
      totalCostUsd: Number(totalCost.toFixed(4)),
      lastActivatedAtMs: Date.now(),
      toolCallSuccessCount: successCount,
      toolCallFailureCount: failureCount,
      errorRatePercent: errorRate,
      p50LatencyMs: latencyMs,
      p99LatencyMs: Math.round(latencyMs * 1.5),
    };

    this.profiles.set(profileId, {
      ...p,
      telemetry: updatedTelemetry,
    });
  }

  checkGovernanceQuota(profileId: string): { allowed: boolean; reason?: string } {
    const p = this.profiles.get(profileId);
    if (!p || !p.governance) return { allowed: true };

    const gov = p.governance;
    const tele = p.telemetry;

    if (gov.maxMonthlyBudgetUsd && tele?.totalCostUsd && tele.totalCostUsd >= gov.maxMonthlyBudgetUsd) {
      return {
        allowed: false,
        reason: `Monthly spend budget ($${gov.maxMonthlyBudgetUsd.toFixed(2)}) reached ($${tele.totalCostUsd.toFixed(2)})`,
      };
    }

    return { allowed: true };
  }

  canDelegateTo(sourceProfileId: string, targetProfileId: string): { allowed: boolean; reason?: string } {
    const src = this.profiles.get(sourceProfileId);
    if (!src) return { allowed: false, reason: `Source profile '${sourceProfileId}' not found` };

    const tgt = this.profiles.get(targetProfileId);
    if (!tgt) return { allowed: false, reason: `Target profile '${targetProfileId}' not found` };

    if (tgt.status !== "active") {
      return { allowed: false, reason: `Target profile '${targetProfileId}' is ${tgt.status}` };
    }

    if (!src.delegation) return { allowed: true }; // Permissive by default if not configured

    if (src.delegation.canSpawnSubagents === false) {
      return { allowed: false, reason: `Profile '${sourceProfileId}' is prohibited from spawning subagents` };
    }

    if (src.delegation.allowedHandoffProfiles && src.delegation.allowedHandoffProfiles.length > 0) {
      if (!src.delegation.allowedHandoffProfiles.includes(targetProfileId)) {
        return {
          allowed: false,
          reason: `Target '${targetProfileId}' is not in allowed handoff list: [${src.delegation.allowedHandoffProfiles.join(", ")}]`,
        };
      }
    }

    return { allowed: true };
  }

  // ---------------------------------------------------------------------------
  // Metrics & Health Audits
  // ---------------------------------------------------------------------------

  getMetrics(): ProfileMetricsReport {
    const all = Array.from(this.profiles.values());
    let active = 0;
    let suspended = 0;
    let archived = 0;
    let totalInvs = 0;
    let totalSaved = 0;
    let totalConsumed = 0;
    let totalCost = 0;
    const catDist: Record<string, number> = {};

    for (const p of all) {
      if (p.status === "active") active++;
      else if (p.status === "suspended") suspended++;
      else if (p.status === "archived") archived++;

      const cat = p.category || "general";
      catDist[cat] = (catDist[cat] || 0) + 1;

      if (p.telemetry) {
        totalInvs += p.telemetry.totalInvocations;
        totalSaved += p.telemetry.estimatedTokensSaved;
        totalConsumed += p.telemetry.totalTokensConsumed || 0;
        totalCost += p.telemetry.totalCostUsd || 0;
      }
    }

    return {
      totalProfiles: all.length,
      activeProfiles: active,
      suspendedProfiles: suspended,
      archivedProfiles: archived,
      categoryDistribution: catDist,
      totalBoundSessions: this.sessionBindings.size,
      totalInvocations: totalInvs,
      totalTokensSaved: totalSaved,
      totalTokensConsumed: totalConsumed,
      totalCostUsd: Number(totalCost.toFixed(4)),
      p50Invocations: totalInvs > 0 ? Math.floor(totalInvs / all.length) : 0,
      p95Invocations: totalInvs > 0 ? totalInvs : 0,
    };
  }

  auditHealth(): ProfileHealthAuditReport {
    const all = Array.from(this.profiles.values());
    const active = all.filter((p) => p.status === "active").length;
    const favs = all.filter((p) => p.isFavorite).length;
    const recs: string[] = [];
    let quotaViolations = 0;

    if (!this.profiles.has("default")) {
      recs.push("Root default profile is missing; reinitialize immediately.");
    }

    if (!this.profiles.has(this.activeDefaultProfileId)) {
      recs.push(`Active default profile '${this.activeDefaultProfileId}' is dangling; fall back to root default.`);
    }

    // Check quota violations
    for (const p of all) {
      const qRes = this.checkGovernanceQuota(p.id);
      if (!qRes.allowed) {
        quotaViolations++;
        recs.push(`Profile '${p.id}': ${qRes.reason}`);
      }
    }

    let status: ProfileHealthStatus = "optimal";
    if (quotaViolations > 0) {
      status = "quota_exceeded";
    } else if (!this.profiles.has("default")) {
      status = "critical_unbound";
    } else if (active === 0) {
      status = "degraded";
    } else if (recs.length > 0) {
      status = "healthy";
    }

    return {
      totalProfiles: all.length,
      activeProfilesCount: active,
      favoriteProfilesCount: favs,
      boundSessionsCount: this.sessionBindings.size,
      healthStatus: status,
      quotaViolationsCount: quotaViolations,
      recommendations: recs,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Swimlanes & DSL
  // ---------------------------------------------------------------------------

  getGroupedProfiles(
    groupBy: ProfileGroupBy = "category",
    sortBy: ProfileSortBy = "name",
    direction: ProfileSortDirection = "asc"
  ): readonly ProfileGroupedLane[] {
    const all = this.listProfiles({ sortBy, sortDirection: direction });
    const groups = new Map<string, ProfileDescriptor[]>();

    for (const p of all) {
      let key = "other";
      if (groupBy === "category") key = p.category || "general";
      else if (groupBy === "status") key = p.status;
      else if (groupBy === "model") key = p.modelPreference || "default";
      else if (groupBy === "favorite") key = p.isFavorite ? "favorite" : "standard";

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    const lanes: ProfileGroupedLane[] = [];
    for (const [key, profiles] of groups.entries()) {
      lanes.push({
        key,
        title: key.toUpperCase(),
        count: profiles.length,
        profiles,
      });
    }

    return lanes;
  }

  queryProfilesDsl(query: ProfileDslQueryFilter | string): readonly ProfileDescriptor[] {
    const filter = typeof query === "string" ? this.engine.parseQueryDSL(query) : query;
    return this.listProfiles(filter as ProfileQueryFilter);
  }

  bulkPurgeProfiles(profileIds: readonly string[]): ProfileBulkMutationResult {
    let matched = 0;
    let modified = 0;
    const affected: string[] = [];

    for (const id of profileIds) {
      if (this.profiles.has(id)) {
        matched++;
        const deleted = this.deleteProfile(id);
        if (deleted) {
          modified++;
          affected.push(id);
        }
      }
    }

    return {
      matchedCount: matched,
      modifiedCount: modified,
      affectedProfileIds: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Snapshot & Report Exporters
  // ---------------------------------------------------------------------------

  exportSnapshot(): ProfileWorkspaceSnapshot {
    return {
      profiles: Array.from(this.profiles.values()),
      sessionBindings: Object.fromEntries(this.sessionBindings.entries()),
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
    for (const [sId, pId] of Object.entries(snapshot.sessionBindings)) {
      this.sessionBindings.set(sId, pId);
    }
    this.activeDefaultProfileId = snapshot.activeDefaultProfileId || "default";
  }

  exportInteractiveHtmlView(): string {
    const profiles = Array.from(this.profiles.values());
    return `<!DOCTYPE html>
<html>
<head><title>LUMI Agent Profiles Dashboard</title></head>
<body style="background:#09090b;color:#fff;font-family:sans-serif;padding:24px;">
<h1>LUMI Agent Profiles (${profiles.length})</h1>
<ul>${profiles.map((p) => `<li><strong>${p.name}</strong> (${p.id}) [v${p.version || "1.0.0"}] - ${p.category}</li>`).join("")}</ul>
</body></html>`;
  }

  exportMarkdownReport(): string {
    const profiles = Array.from(this.profiles.values());
    const lines = ["# LUMI Agent Profile Subsystem Diagnostic Report", ""];
    for (const p of profiles) {
      lines.push(`## ${p.icon || "📋"} ${p.name} (\`${p.id}\`) [v${p.version || "1.0.0"}]`);
      lines.push(`- **Category:** ${p.category}`);
      lines.push(`- **Status:** ${p.status}`);
      lines.push(`- **Model:** ${p.modelPreference}`);
      lines.push(`- **Description:** ${p.description}`);
      lines.push("");
    }
    return lines.join("\n");
  }

  exportCsvReport(): string {
    const profiles = Array.from(this.profiles.values());
    const header = "id,name,category,status,version,modelPreference,isFavorite,isProtected,totalInvocations\n";
    const rows = profiles
      .map(
        (p) =>
          `"${p.id}","${p.name}","${p.category}","${p.status}","${p.version || "1.0.0"}","${p.modelPreference}",${!!p.isFavorite},${!!p.isProtected},${p.telemetry?.totalInvocations || 0}`
      )
      .join("\n");
    return header + rows;
  }

  clear(): void {
    this.profiles.clear();
    this.revisions.clear();
    this.sessionBindings.clear();
    this.transitionHistory = [];
    this.auditLogs = [];
    this.initDefaultProfile();
  }

  private recordAudit(id: string, action: string, operator: string, details: string): void {
    const row: ProfileAuditRow = {
      id: `${id}_${Date.now()}`,
      action,
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
}
