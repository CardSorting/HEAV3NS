/**
 * profile-tool-suite.ts
 *
 * Model tool surface for Persistent Multi-Profile Subsystem (Target #76 / ADR-119 / Apex Tier):
 * 38 specialized model tools for creating, updating, cloning, diffing, binding sessions,
 * blueprints, DSL search, swimlanes, dashboards, immutable revisions, prompt hydration,
 * axiom compliance auditing, governance checks, and delegation verification.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ProfileCategory,
  ProfileCloneKind,
  ProfileExportBundle,
  ProfileGroupBy,
  ProfileReasoningEffort,
  ProfileSortBy,
  ProfileSortDirection,
  ProfileStatus,
  ProfileTemplateHydrationContext,
} from "../../../core/contracts/profile.contracts.js";
import { ProfileSupervisor } from "../../../agents/extensions/profiles/profile-supervisor.js";
import { ProfileSnapshotManager } from "../../../sessions/extensions/profiles/profile-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class ProfileToolSuite {
  private readonly supervisor: ProfileSupervisor;
  private readonly snapshotManager: ProfileSnapshotManager;

  constructor(supervisor: ProfileSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new ProfileSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "profile_create",
        description: "Creates a new isolated agent operational profile with custom soul, model preference, and toolsets.",
        parameters: {
          id: { type: "string", required: true, description: "Unique slug ID (e.g. 'researcher')" },
          name: { type: "string", required: true, description: "Display name" },
          description: { type: "string", required: true, description: "Description" },
          soulPrompt: { type: "string", description: "Custom persona instructions" },
          category: { type: "string", description: "Category: general, engineering, research, operations, writing, education, creative, custom" },
          modelPreference: { type: "string", description: "Model preference" },
          reasoningEffort: { type: "string", description: "Reasoning effort: none, low, medium, high" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_create", args);
        },
      },
      {
        name: "profile_get",
        description: "Retrieves a specific profile descriptor and its resolved inheritance.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          resolveInheritance: { type: "boolean", description: "Flatten ancestor inheritance" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_get", args);
        },
      },
      {
        name: "profile_list",
        description: "Lists or queries available operational profiles with filter options.",
        parameters: {
          query: { type: "string", description: "DSL query string or search text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_list", args);
        },
      },
      {
        name: "profile_update",
        description: "Updates fields of an existing operational profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID to update" },
          name: { type: "string", description: "Updated display name" },
          description: { type: "string", description: "Updated description" },
          status: { type: "string", description: "Status: active, suspended, archived" },
          soulPrompt: { type: "string", description: "Updated soul instructions" },
          category: { type: "string", description: "Updated category" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_update", args);
        },
      },
      {
        name: "profile_delete",
        description: "Deletes an unprotected profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID to delete" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_delete", args);
        },
      },
      {
        name: "profile_clone",
        description: "Clones a profile into a new ID with optional persona or shallow mode.",
        parameters: {
          sourceProfileId: { type: "string", required: true, description: "Source profile ID" },
          targetProfileId: { type: "string", required: true, description: "Target profile ID" },
          newName: { type: "string", description: "New display name" },
          cloneKind: { type: "string", description: "Clone kind: shallow, persona, full" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_clone", args);
        },
      },
      {
        name: "profile_diff",
        description: "Computes deep structural differences between two profiles.",
        parameters: {
          profileA: { type: "string", required: true, description: "First profile ID" },
          profileB: { type: "string", required: true, description: "Second profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_diff", args);
        },
      },
      {
        name: "profile_bind_session",
        description: "Binds an active conversation session to a specific profile.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_bind_session", args);
        },
      },
      {
        name: "profile_unbind_session",
        description: "Unbinds a session, reverting to default profile.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_unbind_session", args);
        },
      },
      {
        name: "profile_get_session_profile",
        description: "Gets the active profile for a session.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_get_session_profile", args);
        },
      },
      {
        name: "profile_set_default",
        description: "Sets the system active default profile ID.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_set_default", args);
        },
      },
      {
        name: "profile_get_default",
        description: "Gets the current active default profile descriptor.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_get_default", args);
        },
      },
      {
        name: "profile_list_blueprints",
        description: "Lists all built-in profile blueprint templates.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_list_blueprints", args);
        },
      },
      {
        name: "profile_get_blueprint",
        description: "Retrieves a specific blueprint definition.",
        parameters: {
          blueprintId: { type: "string", required: true, description: "Blueprint ID (e.g. 'coder')" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_get_blueprint", args);
        },
      },
      {
        name: "profile_instantiate_blueprint",
        description: "Instantiates a new operational profile from a built-in blueprint template.",
        parameters: {
          blueprintId: { type: "string", required: true, description: "Blueprint ID" },
          customId: { type: "string", required: true, description: "New unique profile ID" },
          customName: { type: "string", description: "Optional custom display name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_instantiate_blueprint", args);
        },
      },
      {
        name: "profile_export_bundle",
        description: "Exports a signed, portable profile bundle JSON.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID to export" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_bundle", args);
        },
      },
      {
        name: "profile_import_bundle",
        description: "Imports and verifies a signed profile bundle JSON.",
        parameters: {
          bundleJson: { type: "string", required: true, description: "Serialized bundle JSON" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_import_bundle", args);
        },
      },
      {
        name: "profile_toggle_favorite",
        description: "Toggles the favorite flag for a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_toggle_favorite", args);
        },
      },
      {
        name: "profile_audit_health",
        description: "Runs SLA health audit and returns status report and recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_audit_health", args);
        },
      },
      {
        name: "profile_get_metrics",
        description: "Retrieves aggregate telemetry metrics and token savings percentiles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_get_metrics", args);
        },
      },
      {
        name: "profile_group_and_sort",
        description: "Returns multi-criteria swimlane groups of profiles.",
        parameters: {
          groupBy: { type: "string", description: "Group by: category, status, model, favorite" },
          sortBy: { type: "string", description: "Sort by: name, category, recent, usage" },
          direction: { type: "string", description: "Direction: asc, desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_group_and_sort", args);
        },
      },
      {
        name: "profile_search_dsl",
        description: "Executes natural query DSL search (e.g. 'is:favorite model:gpt-5* sort:recent').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_search_dsl", args);
        },
      },
      {
        name: "profile_render_dashboard",
        description: "Renders an ANSI ASCII dashboard view of profile metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_render_dashboard", args);
        },
      },
      {
        name: "profile_render_card",
        description: "Renders an ANSI ASCII card for a single profile descriptor.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_render_card", args);
        },
      },
      {
        name: "profile_export_html",
        description: "Exports an interactive HTML visualization of all profiles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_html", args);
        },
      },
      {
        name: "profile_export_markdown",
        description: "Exports a structured Markdown report of all profiles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_markdown", args);
        },
      },
      {
        name: "profile_export_csv",
        description: "Exports a CSV data sheet of profiles and telemetry.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_csv", args);
        },
      },
      {
        name: "profile_bulk_purge",
        description: "Atomically deletes a batch of unprotected profiles.",
        parameters: {
          profileIdsJson: { type: "string", required: true, description: "JSON array of profile IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_bulk_purge", args);
        },
      },
      {
        name: "profile_undo",
        description: "Reverts the last profile mutation on the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_undo", args);
        },
      },
      {
        name: "profile_redo",
        description: "Re-applies the last undone mutation on the redo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_redo", args);
        },
      },
      {
        name: "profile_capture_snapshot",
        description: "Captures a zero-GC checkpoint frame in ProfileSnapshotManager.",
        parameters: {
          frameIndex: { type: "number", description: "Snapshot frame slot index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_capture_snapshot", args);
        },
      },
      {
        name: "profile_restore_snapshot",
        description: "Restores substrate state to a previous snapshot frame in <0.05ms SLA.",
        parameters: {
          frameIndex: { type: "number", description: "Snapshot frame slot index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_restore_snapshot", args);
        },
      },
      {
        name: "profile_validate_id",
        description: "Validates a profile slug identifier against regex constraints.",
        parameters: {
          id: { type: "string", required: true, description: "Candidate ID string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_validate_id", args);
        },
      },
      // -----------------------------------------------------------------------
      // Apex-Tier Model Tools
      // -----------------------------------------------------------------------
      {
        name: "profile_create_revision",
        description: "Creates an immutable versioned revision checkpoint for a profile with change log.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          changeLog: { type: "string", required: true, description: "Summary of changes in this revision" },
          author: { type: "string", description: "Author identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_create_revision", args);
        },
      },
      {
        name: "profile_rollback_revision",
        description: "Rolls back a profile descriptor to a previous immutable revision.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          revisionId: { type: "string", required: true, description: "Target revision ID or semantic version" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_rollback_revision", args);
        },
      },
      {
        name: "profile_list_revisions",
        description: "Lists all historical revisions for an agent profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_list_revisions", args);
        },
      },
      {
        name: "profile_hydrate_prompt",
        description: "Hydrates dynamic prompt template variables with runtime context.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          contextJson: { type: "string", description: "JSON hydration context" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_hydrate_prompt", args);
        },
      },
      {
        name: "profile_audit_axioms",
        description: "Audits transcript text against profile custom axioms for compliance scoring.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          transcript: { type: "string", required: true, description: "Session transcript text to audit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_audit_axioms", args);
        },
      },
      {
        name: "profile_verify_delegation",
        description: "Checks if an agent profile is permitted to delegate to another target profile.",
        parameters: {
          sourceProfileId: { type: "string", required: true, description: "Source profile ID" },
          targetProfileId: { type: "string", required: true, description: "Target profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_verify_delegation", args);
        },
      },
      {
        name: "profile_check_governance",
        description: "Checks if a profile is within its SLA token and spend governance budget.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_check_governance", args);
        },
      },
      {
        name: "profile_list_starters",
        description: "Lists conversation starters and prompt shortcuts for a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_list_starters", args);
        },
      },
      {
        name: "profile_add_exemplar",
        description: "Adds a few-shot in-context learning demonstration to a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          exemplarId: { type: "string", required: true, description: "Exemplar ID" },
          title: { type: "string", required: true, description: "Exemplar title" },
          input: { type: "string", required: true, description: "Sample input/request" },
          output: { type: "string", required: true, description: "Expected output" },
          explanation: { type: "string", required: false, description: "Rationale/explanation" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_add_exemplar", args);
        },
      },
      {
        name: "profile_remove_exemplar",
        description: "Removes an exemplar demonstration from a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          exemplarId: { type: "string", required: true, description: "Exemplar ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_remove_exemplar", args);
        },
      },
      {
        name: "profile_list_exemplars",
        description: "Lists all few-shot exemplars registered for a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_list_exemplars", args);
        },
      },
      {
        name: "profile_resolve_fallback_model",
        description: "Resolves the next resilient model fallback for a failure trigger (timeout, rate_limit, server_error).",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          trigger: { type: "string", required: true, description: "Failure trigger (timeout, rate_limit, server_error)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_resolve_fallback_model", args);
        },
      },
      {
        name: "profile_configure_voice",
        description: "Configures voice synthesis settings for a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          voiceId: { type: "string", required: true, description: "Voice ID" },
          provider: { type: "string", required: false, description: "Voice provider (elevenlabs, openai, web_speech)" },
          pitch: { type: "number", required: false, description: "Voice pitch" },
          speed: { type: "number", required: false, description: "Voice speed" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_configure_voice", args);
        },
      },
      {
        name: "profile_configure_memory_policy",
        description: "Configures context window limits and eviction policy for a profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
          maxContextTokens: { type: "number", required: false, description: "Max context tokens" },
          evictionStrategy: { type: "string", required: false, description: "Eviction strategy (lru, sliding_window, summarize)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_configure_memory_policy", args);
        },
      },
    ];
  }

  public async executeTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      switch (name) {
        case "profile_create": {
          const id = String(args.id || "").trim();
          const pName = String(args.name || "").trim();
          const desc = String(args.description || "").trim();
          const soul = args.soulPrompt ? String(args.soulPrompt) : undefined;
          const cat = args.category as ProfileCategory | undefined;
          const model = args.modelPreference ? String(args.modelPreference) : undefined;
          const reasoning = args.reasoningEffort as ProfileReasoningEffort | undefined;

          const res = this.supervisor.createProfile(id, pName, desc, {
            soulPrompt: soul,
            category: cat,
            modelPreference: model,
            reasoningEffort: reasoning,
          });
          return { ...res };
        }

        case "profile_get": {
          const profileId = String(args.profileId || "").trim();
          const resolve = Boolean(args.resolveInheritance);
          const res = this.supervisor.getProfile(profileId, resolve);
          return { ...res };
        }

        case "profile_list": {
          const query = args.query ? String(args.query).trim() : undefined;
          const profiles = query
            ? this.supervisor.getSubstrate().queryProfilesDsl(query)
            : this.supervisor.getSubstrate().listProfiles();
          return { success: true, count: profiles.length, profiles };
        }

        case "profile_update": {
          const profileId = String(args.profileId || "").trim();
          const mutation: Record<string, unknown> = {};
          if (args.name) mutation.name = String(args.name);
          if (args.description) mutation.description = String(args.description);
          if (args.status) mutation.status = args.status as ProfileStatus;
          if (args.soulPrompt) mutation.soulPrompt = String(args.soulPrompt);
          if (args.category) mutation.category = args.category as ProfileCategory;

          const res = this.supervisor.updateProfile(profileId, mutation);
          return { ...res };
        }

        case "profile_delete": {
          const profileId = String(args.profileId || "").trim();
          const res = this.supervisor.deleteProfile(profileId);
          return { ...res };
        }

        case "profile_clone": {
          const src = String(args.sourceProfileId || "").trim();
          const tgt = String(args.targetProfileId || "").trim();
          const newName = args.newName ? String(args.newName) : undefined;
          const cloneKind = args.cloneKind as ProfileCloneKind | undefined;

          const res = this.supervisor.cloneProfile(src, tgt, { newName, cloneKind });
          return { ...res };
        }

        case "profile_diff": {
          const a = String(args.profileA || args.profileIdA || "").trim();
          const b = String(args.profileB || args.profileIdB || "").trim();
          const res = this.supervisor.diffProfiles(a, b);
          if (!res) return { success: false, error: `One or both profiles not found` };
          return { success: true, diff: res };
        }

        case "profile_bind_session": {
          const sessionId = String(args.sessionId || "").trim();
          const profileId = String(args.profileId || "").trim();
          const ok = this.supervisor.getSubstrate().bindSession(sessionId, profileId);
          return { success: ok, sessionId, profileId };
        }

        case "profile_unbind_session": {
          const sessionId = String(args.sessionId || "").trim();
          const ok = this.supervisor.getSubstrate().unbindSession(sessionId);
          return { success: ok, sessionId };
        }

        case "profile_get_session_profile": {
          const sessionId = String(args.sessionId || "").trim();
          const profile = this.supervisor.getSubstrate().getProfileForSession(sessionId);
          return { success: true, sessionId, profile };
        }

        case "profile_set_default": {
          const profileId = String(args.profileId || "").trim();
          const ok = this.supervisor.getSubstrate().setActiveDefaultProfile(profileId);
          return { success: ok, profileId };
        }

        case "profile_get_default": {
          const profile = this.supervisor.getSubstrate().getActiveDefaultProfile();
          return { success: true, profile };
        }

        case "profile_list_blueprints": {
          const blueprints = this.supervisor.getEngine().listBlueprints();
          return { success: true, count: blueprints.length, blueprints };
        }

        case "profile_get_blueprint": {
          const bpId = String(args.blueprintId || "").trim();
          const blueprint = this.supervisor.getEngine().getBlueprint(bpId);
          if (!blueprint) return { success: false, error: `Blueprint '${bpId}' not found` };
          return { success: true, blueprint };
        }

        case "profile_instantiate_blueprint": {
          const bpId = String(args.blueprintId || "").trim();
          const customId = String(args.customId || "").trim();
          const customName = args.customName ? String(args.customName) : undefined;
          const res = this.supervisor.instantiateBlueprint(bpId, customId, customName);
          return { ...res };
        }

        case "profile_export_bundle": {
          const profileId = String(args.profileId || "").trim();
          const res = this.supervisor.exportProfileBundle(profileId);
          return { ...res };
        }

        case "profile_import_bundle": {
          const bundleJson = String(args.bundleJson || "{}");
          let bundle: ProfileExportBundle;
          try {
            bundle = JSON.parse(bundleJson);
          } catch {
            return { success: false, error: "bundleJson must be valid JSON" };
          }
          const res = this.supervisor.importProfileBundle(bundle);
          return { ...res };
        }

        case "profile_toggle_favorite": {
          const profileId = String(args.profileId || "").trim();
          const isFav = this.supervisor.toggleFavorite(profileId);
          return { success: true, profileId, isFavorite: isFav };
        }

        case "profile_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "profile_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "profile_group_and_sort": {
          const groupBy = (args.groupBy as ProfileGroupBy) || "category";
          const sortBy = (args.sortBy as ProfileSortBy) || "name";
          const direction = (args.direction as ProfileSortDirection) || "asc";
          const lanes = this.supervisor.getGroupedProfiles(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "profile_search_dsl": {
          const query = String(args.query || "");
          const profiles = this.supervisor.queryDsl(query);
          return { success: true, count: profiles.length, profiles };
        }

        case "profile_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderProfileDashboard(metrics);
          return { success: true, rendered };
        }

        case "profile_render_card": {
          const profileId = String(args.profileId || "").trim();
          const profile = this.supervisor.getSubstrate().getProfile(profileId);
          if (!profile) return { success: false, error: `Profile '${profileId}' not found` };
          const rendered = BroccoliViewRenderer.renderProfileCard(profile);
          return { success: true, rendered };
        }

        case "profile_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "profile_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "profile_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "profile_bulk_purge": {
          const idsJson = String(args.profileIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "profileIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "profile_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "profile_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "profile_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "profile_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "profile_validate_id": {
          const id = String(args.id || "").trim();
          const res = this.supervisor.getEngine().validateProfileId(id);
          return { success: res.valid, ...res };
        }

        // ---------------------------------------------------------------------
        // Apex-Tier Handlers
        // ---------------------------------------------------------------------
        case "profile_create_revision": {
          const profileId = String(args.profileId || "").trim();
          const changeLog = String(args.changeLog || "Revision update").trim();
          const author = args.author ? String(args.author) : "agent";
          const res = this.supervisor.createRevision(profileId, changeLog, author);
          return { ...res };
        }

        case "profile_rollback_revision": {
          const profileId = String(args.profileId || "").trim();
          const revisionId = String(args.revisionId || "").trim();
          const res = this.supervisor.rollbackRevision(profileId, revisionId);
          return { ...res };
        }

        case "profile_list_revisions": {
          const profileId = String(args.profileId || "").trim();
          const revisions = this.supervisor.listRevisions(profileId);
          return { success: true, profileId, count: revisions.length, revisions };
        }

        case "profile_hydrate_prompt": {
          const profileId = String(args.profileId || "").trim();
          let ctx: ProfileTemplateHydrationContext | undefined;
          if (args.contextJson) {
            try {
              ctx = JSON.parse(String(args.contextJson));
            } catch {
              // ignore parse error
            }
          }
          const prompt = this.supervisor.hydrateSoulPrompt(profileId, ctx);
          return { success: true, profileId, prompt };
        }

        case "profile_audit_axioms": {
          const profileId = String(args.profileId || "").trim();
          const transcript = String(args.transcript || "");
          const report = this.supervisor.auditAxiomCompliance(profileId, transcript);
          return { success: true, report };
        }

        case "profile_verify_delegation": {
          const src = String(args.sourceProfileId || "").trim();
          const tgt = String(args.targetProfileId || "").trim();
          const res = this.supervisor.verifyDelegation(src, tgt);
          return { ...res };
        }

        case "profile_check_governance": {
          const profileId = String(args.profileId || "").trim();
          const res = this.supervisor.checkGovernance(profileId);
          return { ...res };
        }

        case "profile_list_starters": {
          const profileId = String(args.profileId || "").trim();
          const starters = this.supervisor.getConversationStarters(profileId);
          return { success: true, profileId, count: starters.length, starters };
        }

        case "profile_add_exemplar": {
          const profileId = String(args.profileId || "").trim();
          const ex = {
            id: String(args.exemplarId || `ex_${Date.now()}`),
            title: String(args.title || "Demonstration"),
            input: String(args.input || ""),
            output: String(args.output || ""),
            explanation: args.explanation ? String(args.explanation) : undefined,
          };
          const ok = this.supervisor.addExemplar(profileId, ex);
          return { success: ok, profileId, exemplar: ex };
        }

        case "profile_remove_exemplar": {
          const profileId = String(args.profileId || "").trim();
          const exemplarId = String(args.exemplarId || "").trim();
          const ok = this.supervisor.removeExemplar(profileId, exemplarId);
          return { success: ok, profileId, exemplarId };
        }

        case "profile_list_exemplars": {
          const profileId = String(args.profileId || "").trim();
          const exemplars = this.supervisor.getExemplars(profileId);
          return { success: true, profileId, count: exemplars.length, exemplars };
        }

        case "profile_resolve_fallback_model": {
          const profileId = String(args.profileId || "").trim();
          const trigger = String(args.trigger || "server_error") as any;
          const fallback = this.supervisor.resolveFallbackModel(profileId, trigger);
          return { success: true, profileId, trigger, fallbackModel: fallback };
        }

        case "profile_configure_voice": {
          const profileId = String(args.profileId || "").trim();
          const voice = {
            voiceId: String(args.voiceId || "alloy"),
            provider: (args.provider as any) || "openai",
            pitch: typeof args.pitch === "number" ? args.pitch : undefined,
            speed: typeof args.speed === "number" ? args.speed : undefined,
          };
          const res = this.supervisor.updateProfile(profileId, { voice });
          return { success: res.success, profileId, voice };
        }

        case "profile_configure_memory_policy": {
          const profileId = String(args.profileId || "").trim();
          const policy = {
            maxContextTokens: typeof args.maxContextTokens === "number" ? args.maxContextTokens : undefined,
            evictionStrategy: (args.evictionStrategy as any) || "sliding_window",
          };
          const res = this.supervisor.updateProfile(profileId, { memoryPolicy: policy });
          return { success: res.success, profileId, memoryPolicy: policy };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
