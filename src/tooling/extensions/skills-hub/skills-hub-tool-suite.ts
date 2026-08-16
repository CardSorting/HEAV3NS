/**
 * skills-hub-tool-suite.ts
 *
 * Model tool surface for Skills Hub & Package Quarantine Subsystem (Phase 89 / ADR-041).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { SkillsHubSupervisor } from "../../../agents/extensions/skills-hub/skills-hub-supervisor.js";

export class SkillsHubToolSuite {
  private readonly supervisor: SkillsHubSupervisor;

  constructor(supervisor: SkillsHubSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "skills_hub_search",
        description: "Searches remote skill package registries by keyword or tag.",
        parameters: {
          query: { type: "string", required: true, description: "Search query or keyword" },
          tag: { type: "string", description: "Optional skill category tag (e.g. git, devops, react)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const query = String(args.query || "");
          const tag = args.tag ? String(args.tag) : undefined;
          const matches = this.supervisor.search(query, tag);

          return {
            success: true,
            totalMatches: matches.length,
            packages: matches.map((p) => ({
              id: p.id,
              name: p.name,
              version: p.version,
              description: p.description,
              author: p.author,
              tags: p.tags,
              contentHash: p.contentHash,
            })),
          };
        },
      },
      {
        name: "skills_hub_install",
        description: "Installs a remote skill package with cryptographic SHA-256 integrity and Trojan security quarantine check.",
        parameters: {
          packageId: { type: "string", required: true, description: "ID of the skill package to install" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const packageId = String(args.packageId || "").trim();
          const result = this.supervisor.install(packageId);

          return {
            success: result.success,
            packageId: result.packageId,
            version: result.version,
            quarantined: result.quarantined,
            quarantineReason: result.quarantineReason,
            contentHash: result.contentHash,
            durationMs: result.durationMs,
            error: result.error,
          };
        },
      },
      {
        name: "skills_hub_status",
        description: "Queries installed skills, quarantined packages, and remote registry sync metadata.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const stats = this.supervisor.getStats();
          const installed = this.supervisor.listInstalled();
          const quarantined = this.supervisor.listQuarantined();
          const history = this.supervisor.listHistory(10);

          return {
            success: true,
            stats,
            installed: installed.map((p) => ({ id: p.id, name: p.name, version: p.version })),
            quarantined: quarantined.map((p) => ({ id: p.id, name: p.name, reason: p.quarantineReason })),
            recentHistory: history,
          };
        },
      },
    ];
  }
}
