/**
 * profile-tool-suite.ts
 *
 * Model tool surface for the Profile Subsystem (Target #76 / ADR-119).
 * Exposes 9 ergonomic tools for managing isolated profile environments,
 * hierarchical inheritance, structural diffing, blueprint catalog, and signed bundle export/import.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ProfileCategory,
  ProfileCloneKind,
  ProfileExportBundle,
  ProfileReasoningEffort,
  ProfileStatus,
} from "../../../core/contracts/profile.contracts.js";
import { ProfileSupervisor } from "../../../agents/extensions/profiles/profile-supervisor.js";

export class ProfileToolSuite {
  private readonly supervisor: ProfileSupervisor;

  constructor(supervisor: ProfileSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "profile_list",
        description: "Lists or queries available operational profiles with active status, domain category, model preferences, and telemetry stats.",
        parameters: {
          query: { type: "string", description: "Optional Natural Query DSL filter (e.g. 'is:favorite category:engineering sort:recent')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const query = typeof args.query === "string" ? args.query : undefined;
          const profiles = this.supervisor.listProfiles(query);
          return {
            success: true,
            totalProfiles: profiles.length,
            profiles: profiles.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              category: p.category,
              icon: p.icon,
              isFavorite: p.isFavorite,
              extends: p.extends,
              description: p.description,
              modelPreference: p.modelPreference,
              reasoningEffort: p.reasoningEffort,
              tags: p.tags,
              telemetry: p.telemetry,
            })),
          };
        },
      },
      {
        name: "profile_create",
        description: "Creates a new isolated agent operational profile with custom persona soul, model preferences, hierarchical inheritance, and toolsets.",
        parameters: {
          id: { type: "string", required: true, description: "Unique profile slug (e.g. 'coder', 'researcher', 'sre')" },
          name: { type: "string", required: true, description: "Human-readable display name" },
          description: { type: "string", required: true, description: "Purpose and domain scope of this profile" },
          extends: { type: "string", description: "Optional parent profile ID to inherit configurations and axioms from" },
          category: { type: "string", description: "'general' | 'engineering' | 'research' | 'operations' | 'writing' | 'education' | 'creative'" },
          icon: { type: "string", description: "Emoji icon representation (e.g. '💻', '🔬', '🛡️')" },
          soulPrompt: { type: "string", description: "Custom persona axioms and behavioral rules" },
          modelPreference: { type: "string", description: "Preferred LLM model ID for this profile" },
          reasoningEffort: { type: "string", description: "'none' | 'low' | 'medium' | 'high'" },
          enabledToolsets: { type: "string", description: "Comma-separated list of enabled toolsets" },
          disabledToolsets: { type: "string", description: "Comma-separated list of disabled toolsets" },
          skin: { type: "string", description: "Terminal skin theme name" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const id = String(args.id || "").trim();
          const name = String(args.name || "").trim();
          const description = String(args.description || "").trim();
          if (!id || !name || !description) {
            return { success: false, error: "id, name, and description are required" };
          }

          const enabledToolsets =
            typeof args.enabledToolsets === "string" && args.enabledToolsets.length > 0
              ? args.enabledToolsets.split(",").map((t) => t.trim()).filter(Boolean)
              : undefined;

          const disabledToolsets =
            typeof args.disabledToolsets === "string" && args.disabledToolsets.length > 0
              ? args.disabledToolsets.split(",").map((t) => t.trim()).filter(Boolean)
              : undefined;

          const res = this.supervisor.createProfile(id, name, description, {
            extends: typeof args.extends === "string" ? args.extends : undefined,
            category: typeof args.category === "string" ? (args.category as ProfileCategory) : undefined,
            icon: typeof args.icon === "string" ? args.icon : undefined,
            soulPrompt: typeof args.soulPrompt === "string" ? args.soulPrompt : undefined,
            modelPreference: typeof args.modelPreference === "string" ? args.modelPreference : undefined,
            reasoningEffort: typeof args.reasoningEffort === "string" ? (args.reasoningEffort as ProfileReasoningEffort) : undefined,
            enabledToolsets,
            disabledToolsets,
            skin: typeof args.skin === "string" ? args.skin : undefined,
          });

          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            profile: res.profile,
            message: `Created profile '${id}' (${name})`,
          };
        },
      },
      {
        name: "profile_switch",
        description: "Switches the active operational profile for the current session (supports exact ID or fuzzy name match).",
        parameters: {
          profileId: { type: "string", required: true, description: "Target profile ID or fuzzy alias to activate" },
          sessionId: { type: "string", description: "Session ID (default: 'current')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const profileId = String(args.profileId || "").trim();
          const sessionId = String(args.sessionId || "current").trim();
          if (!profileId) return { success: false, error: "profileId is required" };

          const res = this.supervisor.switchProfile(sessionId, profileId);
          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            profile: res.profile,
            isFuzzyMatch: res.isFuzzyMatch,
            message: `Session '${sessionId}' successfully switched to profile '${res.profile?.name}' (${res.profile?.id})`,
          };
        },
      },
      {
        name: "profile_clone",
        description: "Clones an existing profile into a new isolated profile environment with optional persona, shallow, or full mode.",
        parameters: {
          sourceProfileId: { type: "string", required: true, description: "Source profile ID to clone" },
          targetProfileId: { type: "string", required: true, description: "New target profile ID" },
          cloneKind: { type: "string", description: "'shallow' | 'persona' | 'full' (default: 'persona')" },
          newName: { type: "string", description: "Optional new display name" },
          newDescription: { type: "string", description: "Optional new description" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const sourceProfileId = String(args.sourceProfileId || "").trim();
          const targetProfileId = String(args.targetProfileId || "").trim();
          if (!sourceProfileId || !targetProfileId) {
            return { success: false, error: "sourceProfileId and targetProfileId are required" };
          }

          const res = this.supervisor.cloneProfile(sourceProfileId, targetProfileId, {
            cloneKind: typeof args.cloneKind === "string" ? (args.cloneKind as ProfileCloneKind) : "persona",
            newName: typeof args.newName === "string" ? args.newName : undefined,
            newDescription: typeof args.newDescription === "string" ? args.newDescription : undefined,
          });

          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            profile: res.profile,
            message: `Cloned profile '${sourceProfileId}' -> '${targetProfileId}'`,
          };
        },
      },
      {
        name: "profile_diff",
        description: "Performs a structural diff comparison between two operational profiles.",
        parameters: {
          profileIdA: { type: "string", required: true, description: "First profile ID" },
          profileIdB: { type: "string", required: true, description: "Second profile ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const idA = String(args.profileIdA || "").trim();
          const idB = String(args.profileIdB || "").trim();
          if (!idA || !idB) return { success: false, error: "profileIdA and profileIdB are required" };

          const diff = this.supervisor.diffProfiles(idA, idB);
          if (!diff) return { success: false, error: `One or both profiles ('${idA}', '${idB}') not found` };

          return {
            success: true,
            diff,
          };
        },
      },
      {
        name: "profile_blueprints",
        description: "Lists built-in archetypal profile blueprints or instantiates a new profile from a blueprint.",
        parameters: {
          action: { type: "string", required: true, description: "'list' | 'instantiate'" },
          blueprintId: { type: "string", description: "Blueprint ID (required for 'instantiate')" },
          customId: { type: "string", description: "Custom slug ID for instantiated profile (required for 'instantiate')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "").toLowerCase();

          if (action === "list") {
            const blueprints = this.supervisor.listBlueprints();
            return {
              success: true,
              totalBlueprints: blueprints.length,
              blueprints,
            };
          }

          if (action === "instantiate") {
            const blueprintId = String(args.blueprintId || "").trim();
            const customId = String(args.customId || "").trim();
            if (!blueprintId || !customId) {
              return { success: false, error: "blueprintId and customId are required for instantiate" };
            }

            const res = this.supervisor.instantiateBlueprint(blueprintId, customId);
            if (!res.success) return { success: false, error: res.error };

            return {
              success: true,
              profile: res.profile,
              message: `Created profile '${customId}' from blueprint '${blueprintId}'`,
            };
          }

          return { success: false, error: "action must be 'list' or 'instantiate'" };
        },
      },
      {
        name: "profile_update",
        description: "Updates metadata, soul persona axioms, or toolset configurations for an existing profile.",
        parameters: {
          profileId: { type: "string", required: true, description: "Target profile ID" },
          name: { type: "string", description: "Updated display name" },
          description: { type: "string", description: "Updated description" },
          status: { type: "string", description: "'active' | 'suspended' | 'archived'" },
          soulPrompt: { type: "string", description: "Updated persona soul prompt" },
          modelPreference: { type: "string", description: "Updated preferred model" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const profileId = String(args.profileId || "").trim();
          if (!profileId) return { success: false, error: "profileId is required" };

          const res = this.supervisor.updateProfile(profileId, {
            name: typeof args.name === "string" ? args.name : undefined,
            description: typeof args.description === "string" ? args.description : undefined,
            status: typeof args.status === "string" ? (args.status as ProfileStatus) : undefined,
            soulPrompt: typeof args.soulPrompt === "string" ? args.soulPrompt : undefined,
            modelPreference: typeof args.modelPreference === "string" ? args.modelPreference : undefined,
          });

          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            profile: res.profile,
            message: `Updated profile '${profileId}' successfully`,
          };
        },
      },
      {
        name: "profile_delete",
        description: "Deletes an isolated profile (root 'default' profile is protected and cannot be deleted).",
        parameters: {
          profileId: { type: "string", required: true, description: "Target profile ID to delete" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const profileId = String(args.profileId || "").trim();
          if (!profileId) return { success: false, error: "profileId is required" };

          const res = this.supervisor.deleteProfile(profileId);
          if (!res.success) return { success: false, error: res.error };

          return {
            success: true,
            message: `Deleted profile '${profileId}'`,
          };
        },
      },
      {
        name: "profile_export_import",
        description: "Exports a profile to a signed JSON bundle or imports a verified signed bundle.",
        parameters: {
          action: { type: "string", required: true, description: "'export' | 'import'" },
          profileId: { type: "string", description: "Profile ID to export (required for 'export')" },
          bundleJson: { type: "string", description: "Signed bundle JSON string (required for 'import')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "").toLowerCase();

          if (action === "export") {
            const profileId = String(args.profileId || "").trim();
            if (!profileId) return { success: false, error: "profileId is required for export" };

            const res = this.supervisor.exportProfile(profileId);
            if (!res.success) return { success: false, error: res.error };

            return {
              success: true,
              bundle: res.bundle,
              message: `Exported profile '${profileId}' bundle`,
            };
          }

          if (action === "import") {
            const bundleJson = String(args.bundleJson || "").trim();
            if (!bundleJson) return { success: false, error: "bundleJson is required for import" };

            try {
              const bundle = JSON.parse(bundleJson) as ProfileExportBundle;
              const res = this.supervisor.importProfile(bundle);
              if (!res.success) return { success: false, error: res.error };

              return {
                success: true,
                profile: res.profile,
                message: `Imported profile '${res.profile?.id}'`,
              };
            } catch (err: any) {
              return { success: false, error: `Invalid JSON payload: ${err.message}` };
            }
          }

          return { success: false, error: "action must be 'export' or 'import'" };
        },
      },
    ];
  }
}
