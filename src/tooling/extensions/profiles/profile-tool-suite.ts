/**
 * profile-tool-suite.ts
 *
 * Model tool surface for Persistent Multi-Profile Subsystem (Target #76 / ADR-119):
 * 30 specialized model tools for creating, updating, cloning, diffing, binding sessions,
 * blueprints, DSL search, swimlanes, dashboards, and reports.
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
        name: "profile_list_blueprints",
        description: "Lists built-in profile blueprint templates (coder, researcher, sre, writer).",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_list_blueprints", args);
        },
      },
      {
        name: "profile_instantiate_blueprint",
        description: "Instantiates a profile from a built-in blueprint template.",
        parameters: {
          blueprintId: { type: "string", required: true, description: "Blueprint ID (e.g. 'coder')" },
          customId: { type: "string", required: true, description: "Custom ID for the new profile" },
          customName: { type: "string", description: "Optional custom name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_instantiate_blueprint", args);
        },
      },
      {
        name: "profile_export_bundle",
        description: "Exports a profile with cryptographic SHA-256 integrity signature.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID to export" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_bundle", args);
        },
      },
      {
        name: "profile_import_bundle",
        description: "Imports and verifies a cryptographically signed profile bundle.",
        parameters: {
          bundleJson: { type: "string", required: true, description: "Signed JSON bundle" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_import_bundle", args);
        },
      },
      {
        name: "profile_toggle_favorite",
        description: "Stars or unstars a profile as a favorite.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_toggle_favorite", args);
        },
      },
      {
        name: "profile_audit_health",
        description: "Audits profile health posture, active personas, and session bindings.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_audit_health", args);
        },
      },
      {
        name: "profile_get_metrics",
        description: "Fetches comprehensive telemetry on profiles, invocations, and category distribution.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_get_metrics", args);
        },
      },
      {
        name: "profile_group_and_sort",
        description: "Organizes profiles into multi-criteria swimlanes (category, status, model, favorite).",
        parameters: {
          groupBy: { type: "string", description: "Group by: category, status, model, favorite" },
          sortBy: { type: "string", description: "Sort by: name, category, recent, usage" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_group_and_sort", args);
        },
      },
      {
        name: "profile_search_dsl",
        description: "Searches profiles using Natural Query DSL (e.g. 'category:engineering status:active').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_search_dsl", args);
        },
      },
      {
        name: "profile_render_dashboard",
        description: "Renders an ANSI CLI summary card with active profiles and categories.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_render_dashboard", args);
        },
      },
      {
        name: "profile_render_card",
        description: "Renders an interactive ANSI CLI profile descriptor card.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_render_card", args);
        },
      },
      {
        name: "profile_export_html",
        description: "Exports profiles to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_html", args);
        },
      },
      {
        name: "profile_export_markdown",
        description: "Exports profile diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_markdown", args);
        },
      },
      {
        name: "profile_export_csv",
        description: "Exports profiles to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_export_csv", args);
        },
      },
      {
        name: "profile_bulk_purge",
        description: "Atomically purges multiple unprotected profiles.",
        parameters: {
          profileIdsJson: { type: "string", required: true, description: "JSON array of profile IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_bulk_purge", args);
        },
      },
      {
        name: "profile_undo",
        description: "Reverts the last profile mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_undo", args);
        },
      },
      {
        name: "profile_redo",
        description: "Re-applies the last undone profile mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_redo", args);
        },
      },
      {
        name: "profile_capture_snapshot",
        description: "Captures a frame-perfect snapshot of profile workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_capture_snapshot", args);
        },
      },
      {
        name: "profile_restore_snapshot",
        description: "Restores profile workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_restore_snapshot", args);
        },
      },
      {
        name: "profile_validate_id",
        description: "Validates a profile slug ID according to regex rules.",
        parameters: {
          id: { type: "string", required: true, description: "Profile ID to validate" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("profile_validate_id", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "profile_create": {
          const id = String(args.id || "").trim();
          const pName = String(args.name || "").trim();
          const description = String(args.description || "").trim();
          const soulPrompt = typeof args.soulPrompt === "string" ? args.soulPrompt : undefined;
          const category = args.category as ProfileCategory | undefined;
          const modelPreference = typeof args.modelPreference === "string" ? args.modelPreference : undefined;
          const reasoningEffort = args.reasoningEffort as ProfileReasoningEffort | undefined;

          const res = this.supervisor.createProfile(id, pName, description, {
            soulPrompt,
            category,
            modelPreference,
            reasoningEffort,
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
          const query = typeof args.query === "string" ? args.query : undefined;
          const profiles = this.supervisor.listProfiles(query);
          return { success: true, count: profiles.length, profiles };
        }

        case "profile_update": {
          const profileId = String(args.profileId || "").trim();
          const updates: Record<string, unknown> = {};
          if (typeof args.name === "string") updates.name = args.name;
          if (typeof args.description === "string") updates.description = args.description;
          if (typeof args.status === "string") updates.status = args.status as ProfileStatus;
          if (typeof args.soulPrompt === "string") updates.soulPrompt = args.soulPrompt;
          if (typeof args.category === "string") updates.category = args.category as ProfileCategory;

          const res = this.supervisor.updateProfile(profileId, updates);
          return { ...res };
        }

        case "profile_delete": {
          const profileId = String(args.profileId || "").trim();
          const res = this.supervisor.deleteProfile(profileId);
          return { ...res };
        }

        case "profile_clone": {
          const src = String(args.sourceProfileId || "").trim();
          const dst = String(args.targetProfileId || "").trim();
          const newName = typeof args.newName === "string" ? args.newName : undefined;
          const cloneKind = args.cloneKind as ProfileCloneKind | undefined;

          const res = this.supervisor.cloneProfile(src, dst, { newName, cloneKind });
          return { ...res };
        }

        case "profile_diff": {
          const idA = String(args.profileIdA || args.profileA || "").trim();
          const idB = String(args.profileIdB || args.profileB || "").trim();
          const res = this.supervisor.diffProfiles(idA, idB);
          if (!res) return { success: false, error: `One or both profiles ('${idA}', '${idB}') not found` };
          return { success: true, diff: res, ...res };
        }

        case "profile_bind_session": {
          const sessionId = String(args.sessionId || "").trim();
          const profileId = String(args.profileId || "").trim();
          const ok = this.supervisor.bindSession(sessionId, profileId);
          return { success: ok, sessionId, profileId };
        }

        case "profile_unbind_session": {
          const sessionId = String(args.sessionId || "").trim();
          const ok = this.supervisor.unbindSession(sessionId);
          return { success: ok, sessionId };
        }

        case "profile_get_session_profile": {
          const sessionId = String(args.sessionId || "").trim();
          const profile = this.supervisor.getSessionProfile(sessionId);
          return { success: true, profile };
        }

        case "profile_list_blueprints": {
          const blueprints = this.supervisor.getEngine().listBlueprints();
          return { success: true, count: blueprints.length, blueprints };
        }

        case "profile_instantiate_blueprint": {
          const blueprintId = String(args.blueprintId || "").trim();
          const customId = String(args.customId || "").trim();
          const customName = typeof args.customName === "string" ? args.customName : undefined;
          const res = this.supervisor.instantiateBlueprint(blueprintId, customId, customName);
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

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
