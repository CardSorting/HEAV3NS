/**
 * skills-sync-tool-suite.ts
 *
 * Model tool definitions exposing Distributed Skill Sync Protocol, CAS Ref Head,
 * 3-Way Merge Resolution & Provenance Ledger to agents and CLI (Phase 112 / ADR-088 / Target #45).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SkillsSyncSupervisor } from "../../../agents/extensions/skills_sync/skills-sync-supervisor.js";
import type { ConflictResolutionChoice } from "../../../core/contracts/skills-sync.contracts.js";

export class SkillsSyncToolSuite {
  private readonly supervisor: SkillsSyncSupervisor;

  constructor(supervisor: SkillsSyncSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "skill_sync_status",
        description:
          "Inspects local vs remote skill sync state, head commit hash, active conflicts, and sync manifest.",
        parameters: {},
        execute: async () => {
          const status = this.supervisor.getStatus({});
          return {
            success: true,
            status,
          };
        },
      },
      {
        name: "skill_sync_push",
        description:
          "Pushes local skill modifications to the content-addressed sync plane with atomic CAS head verification.",
        parameters: {
          author: {
            type: "string",
            description: "Author identifier committing the skill update.",
            required: true,
          },
          message: {
            type: "string",
            description: "Commit message describing the skill update.",
            required: true,
          },
          skills_json: {
            type: "string",
            description: "JSON string mapping relative file paths to skill file contents.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const author = typeof args.author === "string" ? args.author : "Agent";
          const message = typeof args.message === "string" ? args.message : "Update skills";
          let localSkills: Record<string, string> = {};
          try {
            if (typeof args.skills_json === "string") {
              localSkills = JSON.parse(args.skills_json);
            }
          } catch {
            return { success: false, error: "Invalid JSON format in 'skills_json'" };
          }

          const result = this.supervisor.push({
            author,
            message,
            localSkills,
          });

          return {
            success: result.success,
            status: result.status,
            pushedObjectsCount: result.pushedObjectsCount,
            newHead: result.newHead,
            message: result.message,
          };
        },
      },
      {
        name: "skill_sync_pull",
        description:
          "Pulls remote skill updates and performs automatic 3-way merge resolution against the local workspace.",
        parameters: {
          remote_skills_json: {
            type: "string",
            description: "JSON string mapping remote relative file paths to skill file contents.",
            required: true,
          },
          local_skills_json: {
            type: "string",
            description: "JSON string mapping local relative file paths to skill file contents.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let remoteSkills: Record<string, string> = {};
          let localSkills: Record<string, string> = {};
          try {
            if (typeof args.remote_skills_json === "string") {
              remoteSkills = JSON.parse(args.remote_skills_json);
            }
            if (typeof args.local_skills_json === "string") {
              localSkills = JSON.parse(args.local_skills_json);
            }
          } catch {
            return { success: false, error: "Invalid JSON format in skills parameters" };
          }

          const result = this.supervisor.pull({
            remoteSkills,
            localSkills,
          });

          return {
            success: result.success,
            status: result.status,
            pulledObjectsCount: result.pulledObjectsCount,
            updatedSkills: result.updatedSkills,
            conflicts: result.conflicts,
            activeHead: result.activeHead,
          };
        },
      },
      {
        name: "skill_sync_resolve_conflict",
        description:
          "Resolves an active 3-way skill merge conflict using explicit strategy ('ours', 'theirs', or 'union').",
        parameters: {
          skill_name: {
            type: "string",
            description: "The name of the skill experiencing a conflict.",
            required: true,
          },
          file_path: {
            type: "string",
            description: "The file path experiencing a conflict (e.g. 'code-refactor/SKILL.md').",
            required: true,
          },
          choice: {
            type: "string",
            description: "Resolution choice: 'ours', 'theirs', 'union'.",
            required: true,
          },
          union_content: {
            type: "string",
            description: "Optional combined content when choice is 'union'.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skillName = typeof args.skill_name === "string" ? args.skill_name : "";
          const filePath = typeof args.file_path === "string" ? args.file_path : "";
          const choice = (typeof args.choice === "string" ? args.choice : "ours") as ConflictResolutionChoice;
          const unionContent = typeof args.union_content === "string" ? args.union_content : undefined;

          const res = this.supervisor.resolveConflict(skillName, filePath, choice, unionContent);
          return {
            success: res.success,
            message: res.message,
          };
        },
      },
      {
        name: "skill_sync_inspect_provenance",
        description:
          "Inspects the cryptographic provenance, origin hash, and pristine vs modified state of a skill.",
        parameters: {
          skill_name: {
            type: "string",
            description: "The name of the skill to inspect.",
            required: true,
          },
          content: {
            type: "string",
            description: "Current content of the skill file to verify.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skillName = typeof args.skill_name === "string" ? args.skill_name : "";
          const content = typeof args.content === "string" ? args.content : "";
          const report = this.supervisor.inspectProvenance(skillName, content);
          return {
            success: true,
            provenance: report,
          };
        },
      },
      {
        name: "skill_sync_toggle_opt_in",
        description:
          "Toggles synchronization participation for a specific skill in the sync manifest.",
        parameters: {
          skill_name: {
            type: "string",
            description: "The skill name to toggle.",
            required: true,
          },
          enabled: {
            type: "boolean",
            description: "True to enable sync, false to exclude.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skillName = typeof args.skill_name === "string" ? args.skill_name : "";
          const enabled = Boolean(args.enabled);
          const ok = this.supervisor.toggleOptIn(skillName, enabled);
          return {
            success: ok,
            skillName,
            enabled,
          };
        },
      },
    ];
  }
}
