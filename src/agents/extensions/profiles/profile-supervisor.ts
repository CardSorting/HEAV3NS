/**
 * profile-supervisor.ts
 *
 * High-level coordinator managing multi-profile isolation, hierarchical inheritance,
 * blueprint catalog instantiation, structural diffing, immutable revisions, dynamic prompt hydration,
 * axiom compliance auditing, SLA governance checks, and rich slash command UX (/profile) (Target #76 / ADR-119 / Apex Tier).
 */

import type {
  FallbackTrigger,
  ProfileAxiomComplianceReport,
  ProfileBlueprint,
  ProfileBulkMutationResult,
  ProfileCloneOptions,
  ProfileConversationStarter,
  ProfileDescriptor,
  ProfileDiffResult,
  ProfileEvalReport,
  ProfileExemplar,
  ProfileExportBundle,
  ProfileGroupBy,
  ProfileGroupedLane,
  ProfileHealthAuditReport,
  ProfileLifecycleEvent,
  ProfileLifecycleHook,
  ProfileMetricsReport,
  ProfileMutation,
  ProfilePrefixCacheFrame,
  ProfileQueryFilter,
  ProfileRevision,
  ProfileRunState,
  ProfileRunStep,
  ProfileRunStatus,
  ProfileSortBy,
  ProfileSortDirection,
  ProfileTemplateHydrationContext,
  ProfileTestCase,
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
      version: options.version || "1.0.0",
      revisionNumber: 1,
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
      parameters: options.parameters,
      governance: options.governance,
      delegation: options.delegation,
      mcpBindings: options.mcpBindings,
      knowledgeSources: options.knowledgeSources,
      guardrails: options.guardrails,
      conversationStarters: options.conversationStarters,
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
        totalTokensConsumed: 0,
        totalCostUsd: 0,
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

  public listBlueprints(): readonly ProfileBlueprint[] {
    return this.engine.listBlueprints();
  }

  public getBlueprint(id: string): ProfileBlueprint | undefined {
    return this.engine.getBlueprint(id);
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

    const descriptor = this.engine.instantiateBlueprint(blueprintId, customId, customName);
    if (!descriptor) {
      return { success: false, error: `Failed to instantiate blueprint '${blueprintId}'` };
    }

    const created = this.substrate.createProfile(descriptor);
    if (!created) {
      return { success: false, error: `Failed to register instantiated profile in substrate` };
    }

    return { success: true, profile: descriptor };
  }

  /**
   * Retrieves a profile by ID with optional hierarchical inheritance flattening.
   */
  public getProfile(
    profileId: string,
    resolveInheritance: boolean = false
  ): { success: boolean; profile?: ProfileDescriptor; inheritanceChain?: string[]; error?: string } {
    const raw = this.substrate.getProfile(profileId);
    if (!raw) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }

    if (!resolveInheritance || !raw.extends) {
      return { success: true, profile: raw, inheritanceChain: [raw.id] };
    }

    const res = this.engine.resolveInheritedProfile(raw, this.substrate);
    if (res.error) {
      return { success: false, profile: raw, inheritanceChain: res.inheritanceChain, error: res.error };
    }

    return { success: true, profile: res.resolved, inheritanceChain: res.inheritanceChain };
  }

  public getEffectiveProfile(profileId: string): { effective: ProfileDescriptor; inheritanceChain: string[]; error?: string } {
    const res = this.getProfile(profileId, true);
    return {
      effective: res.profile || this.substrate.getActiveDefaultProfile(),
      inheritanceChain: res.inheritanceChain || [profileId],
      error: res.error,
    };
  }

  public switchProfile(sessionId: string, profileId: string): boolean {
    return this.substrate.bindSession(sessionId, profileId);
  }

  public renderSessionProfileContext(sessionId: string): string {
    const profile = this.getSessionProfile(sessionId);
    const res = this.getEffectiveProfile(profile.id);
    return this.engine.renderProfileContext(res.effective, res.inheritanceChain);
  }

  public listProfiles(filter?: string | ProfileQueryFilter): readonly ProfileDescriptor[] {
    if (typeof filter === "string") {
      return this.substrate.queryProfilesDsl(filter);
    }
    return this.substrate.listProfiles(filter);
  }

  public bindSession(sessionId: string, profileId: string): boolean {
    return this.substrate.bindSession(sessionId, profileId);
  }

  public unbindSession(sessionId: string): boolean {
    return this.substrate.unbindSession(sessionId);
  }

  public getSessionProfile(sessionId: string): ProfileDescriptor {
    return this.substrate.getProfileForSession(sessionId);
  }

  public executeSlashCommand(sessionId: string, commandString: string): { success: boolean; output: string } {
    const trimmed = commandString.trim();
    const parts = trimmed.split(/\s+/);
    const subArgs = parts[0] === "/profile" ? parts.slice(1) : parts;
    const sub = (subArgs[0] || "dashboard").toLowerCase();

    if (sub === "dashboard" || subArgs.length === 0) {
      const list = this.substrate.listProfiles();
      return {
        success: true,
        output: `### LUMI Profile Management Dashboard (${list.length} active profiles)\nUse /profile list, /profile use, /profile diff, /profile fav.`,
      };
    }

    if (sub === "list" || sub === "ls") {
      const query = subArgs.slice(1).join(" ");
      const list = query ? this.substrate.queryProfilesDsl(query) : this.substrate.listProfiles();
      return {
        success: true,
        output: `Found ${list.length} profiles:\n` + list.map(p => `- ${p.name} (${p.id})`).join("\n"),
      };
    }

    if (sub === "init" || sub === "new") {
      const bpId = subArgs[1];
      const customId = subArgs[2];
      const customName = subArgs.slice(3).join(" ") || undefined;
      const res = this.instantiateBlueprint(bpId, customId, customName);
      return {
        success: res.success,
        output: res.success ? `Created profile ${res.profile!.id}` : (res.error || "Failed"),
      };
    }

    if (sub === "use" || sub === "switch") {
      const target = subArgs[1];
      const ok = this.substrate.bindSession(sessionId, target);
      return {
        success: ok,
        output: ok ? `Switched session ${sessionId} to profile ${target}` : `Profile ${target} not found`,
      };
    }

    if (sub === "diff") {
      const a = subArgs[1];
      const b = subArgs[2];
      const diff = this.diffProfiles(a, b);
      return {
        success: diff !== undefined,
        output: diff ? `### Structural Diff between ${a} and ${b}:\nIdentical: ${diff.identical}` : "Profiles not found",
      };
    }

    if (sub === "fav" || sub === "favorite") {
      const target = subArgs[1];
      const fav = this.toggleFavorite(target);
      return {
        success: true,
        output: `Profile ${target} favorite status: ${fav}`,
      };
    }

    return {
      success: true,
      output: `Executed /profile ${sub}`,
    };
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
      return { success: false, error: `Profile '${profileId}' does not exist` };
    }
    return { success: true, profile: updated };
  }

  /**
   * Deletes a profile.
   */
  public deleteProfile(profileId: string): { success: boolean; error?: string } {
    const deleted = this.substrate.deleteProfile(profileId);
    if (!deleted) {
      return { success: false, error: `Cannot delete profile '${profileId}' (protected or not found)` };
    }
    return { success: true };
  }

  /**
   * Clones a profile descriptor.
   */
  public cloneProfile(
    sourceProfileId: string,
    targetProfileId: string,
    options: ProfileCloneOptions = {}
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const cloned = this.substrate.cloneProfile(sourceProfileId, targetProfileId, options);
    if (!cloned) {
      return { success: false, error: `Failed to clone '${sourceProfileId}' to '${targetProfileId}'` };
    }
    return { success: true, profile: cloned };
  }

  /**
   * Computes a structural difference between two profiles.
   */
  public diffProfiles(
    profileAId: string,
    profileBId: string
  ): ProfileDiffResult | undefined {
    const a = this.substrate.getProfile(profileAId);
    const b = this.substrate.getProfile(profileBId);
    if (!a || !b) {
      return undefined;
    }

    return this.engine.diffProfiles(a, b);
  }

  /**
   * Toggles the favorite status of a profile.
   */
  public toggleFavorite(profileId: string): boolean {
    const p = this.substrate.getProfile(profileId);
    if (!p) return false;
    const updated = this.substrate.updateProfile(profileId, { isFavorite: !p.isFavorite });
    return !!updated?.isFavorite;
  }

  /**
   * Creates an immutable revision for a profile.
   */
  public createRevision(
    profileId: string,
    changeLog: string,
    author?: string
  ): { success: boolean; revision?: ProfileRevision; error?: string } {
    const rev = this.substrate.createRevision(profileId, changeLog, author);
    if (!rev) {
      return { success: false, error: `Profile '${profileId}' not found` };
    }
    return { success: true, revision: rev };
  }

  /**
   * Rolls back a profile to a previous revision.
   */
  public rollbackRevision(
    profileId: string,
    revisionId: string
  ): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const restored = this.substrate.rollbackToRevision(profileId, revisionId);
    if (!restored) {
      return { success: false, error: `Revision '${revisionId}' not found for profile '${profileId}'` };
    }
    return { success: true, profile: restored };
  }

  /**
   * Lists all revisions for a profile.
   */
  public listRevisions(profileId: string): readonly ProfileRevision[] {
    return this.substrate.listRevisions(profileId);
  }

  /**
   * Hydrates dynamic soul prompt with contextual runtime variables.
   */
  public hydrateSoulPrompt(profileId: string, context?: ProfileTemplateHydrationContext): string {
    const p = this.substrate.getProfile(profileId);
    if (!p) return "";
    return this.engine.hydratePromptTemplate(p.soulPrompt, context);
  }

  /**
   * Audits axiom compliance of an agent session.
   */
  public auditAxiomCompliance(profileId: string, transcript: string): ProfileAxiomComplianceReport {
    const p = this.substrate.getProfile(profileId) || this.substrate.getActiveDefaultProfile();
    return this.engine.auditAxiomCompliance(p, transcript);
  }

  /**
   * Verifies if an agent profile can delegate a task to a target profile.
   */
  public verifyDelegation(sourceProfileId: string, targetProfileId: string): { allowed: boolean; reason?: string } {
    return this.substrate.canDelegateTo(sourceProfileId, targetProfileId);
  }

  /**
   * Checks governance quotas for a profile.
   */
  public checkGovernance(profileId: string): { allowed: boolean; reason?: string } {
    return this.substrate.checkGovernanceQuota(profileId);
  }

  /**
   * Retrieves conversation starters for a profile.
   */
  public getConversationStarters(profileId: string): readonly ProfileConversationStarter[] {
    const p = this.substrate.getProfile(profileId);
    return p?.conversationStarters || [];
  }

  /**
   * Adds an in-context learning exemplar to a profile.
   */
  public addExemplar(profileId: string, exemplar: ProfileExemplar): boolean {
    return this.substrate.addExemplar(profileId, exemplar);
  }

  /**
   * Removes an exemplar from a profile.
   */
  public removeExemplar(profileId: string, exemplarId: string): boolean {
    return this.substrate.removeExemplar(profileId, exemplarId);
  }

  /**
   * Retrieves all exemplars registered for a profile.
   */
  public getExemplars(profileId: string): readonly ProfileExemplar[] {
    const p = this.substrate.getProfile(profileId);
    return p?.exemplars || [];
  }

  /**
   * Resolves the next resilient model fallback for a failure trigger.
   */
  public resolveFallbackModel(profileId: string, trigger: FallbackTrigger): string | undefined {
    return this.substrate.resolveNextFallbackModel(profileId, trigger);
  }

  /**
   * Builds a deterministic prefix cache frame separating static and dynamic prompt blocks.
   */
  public buildPrefixCacheFrame(profileId: string, context?: ProfileTemplateHydrationContext): ProfilePrefixCacheFrame {
    return this.substrate.buildPrefixCacheFrame(profileId, context);
  }

  /**
   * Initializes an orchestrated profile run state.
   */
  public createRun(profileId: string, sessionId: string, maxSteps: number = 25): ProfileRunState {
    return this.substrate.createRun(profileId, sessionId, maxSteps);
  }

  /**
   * Records an execution step within an ongoing run.
   */
  public recordRunStep(runId: string, step: Omit<ProfileRunStep, "stepIndex">): ProfileRunStep | undefined {
    return this.substrate.recordRunStep(runId, step);
  }

  /**
   * Completes or terminates an orchestrated profile run.
   */
  public completeRun(runId: string, status: ProfileRunStatus, failureReason?: string): ProfileRunState | undefined {
    return this.substrate.completeRun(runId, status, failureReason);
  }

  /**
   * Retrieves an orchestrated run by ID.
   */
  public getRun(runId: string): ProfileRunState | undefined {
    return this.substrate.getRun(runId);
  }

  /**
   * Executes an automated test assertion benchmark against a profile.
   */
  public executeEvalSuite(profileId: string, suite: readonly ProfileTestCase[]): ProfileEvalReport {
    const p = this.substrate.getProfile(profileId) || this.substrate.getActiveDefaultProfile();
    return this.engine.executeProfileEval(p, suite);
  }

  /**
   * Registers a lifecycle event interceptor.
   */
  public registerHook(event: ProfileLifecycleEvent, hook: ProfileLifecycleHook): void {
    this.substrate.registerHook(event, hook);
  }

  /**
   * Audits health and SLA metrics.
   */
  public auditHealth(): ProfileHealthAuditReport {
    return this.substrate.auditHealth();
  }

  /**
   * Gets aggregate metrics report.
   */
  public getMetrics(): ProfileMetricsReport {
    return this.substrate.getMetrics();
  }

  /**
   * Gets grouped lanes.
   */
  public getGroupedProfiles(
    groupBy: ProfileGroupBy = "category",
    sortBy: ProfileSortBy = "name",
    direction: ProfileSortDirection = "asc"
  ): readonly ProfileGroupedLane[] {
    return this.substrate.getGroupedProfiles(groupBy, sortBy, direction);
  }

  /**
   * Evaluates a natural DSL query string.
   */
  public queryDsl(query: string): readonly ProfileDescriptor[] {
    return this.substrate.queryProfilesDsl(query);
  }

  /**
   * Exports interactive HTML view.
   */
  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  /**
   * Exports markdown report.
   */
  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  /**
   * Exports CSV report.
   */
  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  /**
   * Performs bulk purge of profiles.
   */
  public bulkPurge(profileIds: readonly string[]): ProfileBulkMutationResult {
    return this.substrate.bulkPurgeProfiles(profileIds);
  }

  /**
   * Reverts the most recent mutation.
   */
  public undo(): boolean {
    return this.substrate.undo();
  }

  /**
   * Re-applies the most recent reverted mutation.
   */
  public redo(): boolean {
    return this.substrate.redo();
  }

  /**
   * Exports a signed bundle.
   */
  public exportProfileBundle(profileId: string): { success: boolean; bundle?: ProfileExportBundle; error?: string } {
    const p = this.substrate.getProfile(profileId);
    if (!p) return { success: false, error: `Profile '${profileId}' not found` };

    const revs = this.substrate.listRevisions(profileId);
    const bundle = this.engine.exportBundle(p, revs);
    return { success: true, bundle };
  }

  /**
   * Imports a verified signed bundle.
   */
  public importProfileBundle(bundle: ProfileExportBundle): { success: boolean; profile?: ProfileDescriptor; error?: string } {
    const res = this.engine.verifyAndImportBundle(bundle);
    if (!res.valid || !res.profile) {
      return { success: false, error: res.error || "Bundle verification failed" };
    }

    if (this.substrate.getProfile(res.profile.id)) {
      this.substrate.updateProfile(res.profile.id, res.profile);
    } else {
      this.substrate.createProfile(res.profile);
    }

    return { success: true, profile: res.profile };
  }

  /**
   * Handles `/profile` slash commands from user chat sessions.
   */
  public async handleSlashCommand(args: string[]): Promise<string> {
    const sub = (args[0] || "list").toLowerCase();

    if (sub === "list" || sub === "ls") {
      const query = args.slice(1).join(" ");
      const list = query ? this.substrate.queryProfilesDsl(query) : this.substrate.listProfiles();
      const lines = [`### Operational Profiles (${list.length})`];
      for (const p of list) {
        const star = p.isFavorite ? "⭐ " : "";
        const icon = p.icon || "📋";
        const v = p.version ? ` [v${p.version}]` : "";
        lines.push(`- ${star}${icon} **${p.name}** (\`${p.id}\`)${v} - ${p.category} | Model: \`${p.modelPreference || "default"}\``);
      }
      return lines.join("\n");
    }

    if (sub === "blueprints" || sub === "templates") {
      const bps = this.engine.listBlueprints();
      const lines = [`### Built-in Blueprints (${bps.length})`];
      for (const b of bps) {
        lines.push(`- ${b.icon} **${b.name}** (\`${b.id}\`): ${b.description}`);
      }
      return lines.join("\n");
    }

    if (sub === "use" || sub === "switch") {
      const target = args[1];
      if (!target) return "Usage: `/profile use <profile_id>`";
      const p = this.substrate.getProfile(target);
      if (!p) return `Error: Profile '${target}' not found.`;
      this.substrate.setActiveDefaultProfile(target);
      return `Switched active default profile to **${p.name}** (\`${p.id}\`).`;
    }

    if (sub === "init" || sub === "new") {
      const bpId = args[1];
      const customId = args[2];
      if (!bpId || !customId) return "Usage: `/profile init <blueprint_id> <custom_id> [name]`";
      const customName = args.slice(3).join(" ") || undefined;
      const res = this.instantiateBlueprint(bpId, customId, customName);
      if (!res.success) return `Failed: ${res.error}`;
      return `Created profile **${res.profile!.name}** (\`${res.profile!.id}\`) from blueprint \`${bpId}\`.`;
    }

    if (sub === "revisions" || sub === "history") {
      const target = args[1];
      if (!target) return "Usage: `/profile revisions <profile_id>`";
      const revs = this.listRevisions(target);
      if (revs.length === 0) return `No revisions recorded for profile '${target}'.`;
      const lines = [`### Revision History for \`${target}\` (${revs.length})`];
      for (const r of revs) {
        lines.push(`- **v${r.semanticVersion}** (\`${r.revisionId}\`): ${r.changeLog} [${new Date(r.timestampMs).toLocaleTimeString()}]`);
      }
      return lines.join("\n");
    }

    if (sub === "rollback") {
      const target = args[1];
      const revId = args[2];
      if (!target || !revId) return "Usage: `/profile rollback <profile_id> <revision_id>`";
      const res = this.rollbackRevision(target, revId);
      if (!res.success) return `Rollback failed: ${res.error}`;
      return `Successfully rolled back \`${target}\` to revision \`${revId}\` (v${res.profile!.version}).`;
    }

    if (sub === "starters") {
      const target = args[1];
      if (!target) return "Usage: `/profile starters <profile_id>`";
      const starters = this.getConversationStarters(target);
      if (starters.length === 0) return `No starters configured for \`${target}\`.`;
      const lines = [`### Conversation Starters for \`${target}\``];
      for (const s of starters) {
        lines.push(`- ${s.icon || "💡"} **${s.title}**: "${s.prompt}"`);
      }
      return lines.join("\n");
    }

    return "Unknown `/profile` subcommand. Available: `list`, `blueprints`, `use`, `init`, `revisions`, `rollback`, `starters`";
  }

  public getSubstrate(): BroccoliProfileSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicProfileEngine {
    return this.engine;
  }
}
