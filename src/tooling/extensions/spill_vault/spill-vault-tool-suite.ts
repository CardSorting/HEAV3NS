/**
 * spill-vault-tool-suite.ts
 *
 * Model tool definitions exposing Spill-Safe File Vault and Turn Budget Governor to agents
 * (Phase 117 / ADR-093 / Target #50).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SpillVaultSupervisor } from "../../../agents/extensions/spill_vault/spill-vault-supervisor.js";

export class SpillVaultToolSuite {
  private readonly supervisor: SpillVaultSupervisor;

  constructor(supervisor: SpillVaultSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "spill_persist_result",
        description:
          "Persists an oversized tool result to the spill-safe vault, returning a structured preview with a <persisted-output> reference tag.",
        parameters: {
          tool_use_id: {
            type: "string",
            description: "The unique tool invocation identifier.",
            required: true,
          },
          tool_name: {
            type: "string",
            description: "The name of the tool generating the result.",
            required: true,
          },
          content: {
            type: "string",
            description: "The full raw text content to persist.",
            required: true,
          },
          session_id: {
            type: "string",
            description: "Optional session identifier for isolation.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const toolUseId = typeof args.tool_use_id === "string" ? args.tool_use_id : "";
          const toolName = typeof args.tool_name === "string" ? args.tool_name : "";
          const content = typeof args.content === "string" ? args.content : "";
          const sessionId = typeof args.session_id === "string" ? args.session_id : undefined;

          if (!content) {
            return { success: false, error: "content is required" };
          }

          const outcome = this.supervisor.persistResult(
            toolUseId,
            toolName,
            content,
            sessionId
          );

          return {
            success: true,
            inContextText: outcome.inContextText,
            isPersisted: !!outcome.persisted,
            persisted: outcome.persisted,
          };
        },
      },
      {
        name: "spill_enforce_turn_budget",
        description:
          "Enforces aggregate character budgets across multiple tool outputs in a turn, spilling the largest outputs to disk.",
        parameters: {
          results_json: {
            type: "string",
            description: "JSON array of tool results objects: [{ id, toolName, text }].",
            required: true,
          },
          session_id: {
            type: "string",
            description: "Optional session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let results: any[] = [];
          if (typeof args.results_json === "string") {
            try {
              results = JSON.parse(args.results_json);
            } catch {
              results = [];
            }
          } else if (Array.isArray((args as any).results)) {
            results = (args as any).results;
          }
          const sessionId = typeof args.session_id === "string" ? args.session_id : undefined;

          const res = this.supervisor.enforceTurnBudget(results, sessionId);

          return {
            success: true,
            updatedResults: res.updatedResults,
            outcome: res.outcome,
          };
        },
      },
      {
        name: "spill_read_persisted_content",
        description:
          "Reads the full un-truncated content of a previously spilled tool result or hook payload.",
        parameters: {
          result_id_or_path: {
            type: "string",
            description: "The resultId or file path of the persisted content.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const idOrPath = typeof args.result_id_or_path === "string" ? args.result_id_or_path : "";
          if (!idOrPath) {
            return { success: false, error: "result_id_or_path is required" };
          }

          try {
            const content = this.supervisor.readPersistedContent(idOrPath);
            return {
              success: true,
              resultIdOrPath: idOrPath,
              content,
              size: content.length,
            };
          } catch (err: any) {
            return {
              success: false,
              error: err?.message ?? String(err),
            };
          }
        },
      },
      {
        name: "spill_inspect_session_vault",
        description:
          "Lists and inspects all persisted tool result descriptors within a session.",
        parameters: {
          session_id: {
            type: "string",
            description: "The session identifier to inspect (defaults to 'default_session').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.session_id === "string" ? args.session_id : "default_session";
          const results = this.supervisor.listSessionResults(sessionId);

          return {
            success: true,
            sessionId,
            persistedResults: results,
            count: results.length,
          };
        },
      },
      {
        name: "spill_get_governor_metrics",
        description:
          "Retrieves aggregate metrics on persisted tool results, spilled bytes, and turn budget enforcements.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
