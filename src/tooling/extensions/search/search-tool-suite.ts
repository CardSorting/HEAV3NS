import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IBroccoliSearchSubstrate,
  IDeterministicSessionSearchEngine,
} from "../../../core/contracts/search.contracts.js";

/**
 * Model-Facing Tool Suite for Session Search & Inverted-Index Queries.
 */
export class SearchToolSuite {
  private readonly searchEngine: IDeterministicSessionSearchEngine;
  private readonly substrate: IBroccoliSearchSubstrate;

  constructor(searchEngine: IDeterministicSessionSearchEngine, substrate: IBroccoliSearchSubstrate) {
    this.searchEngine = searchEngine;
    this.substrate = substrate;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "session_search_history",
        description: "Full-text search across session message history and transcripts using BM25 relevance ranking.",
        parameters: {
          query: {
            type: "string",
            required: true,
            description: "Search keywords or natural language phrase.",
          },
          role: {
            type: "string",
            required: false,
            description: "Optional role filter: 'user', 'assistant', 'system', 'tool'.",
          },
          limit: {
            type: "number",
            required: false,
            description: "Maximum results to return (default 10).",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("session_search_history", args),
      },
      {
        name: "session_extract_context",
        description: "Extract surrounding conversation context window for a given message record ID.",
        parameters: {
          recordId: {
            type: "string",
            required: true,
            description: "Unique message record ID to extract context around.",
          },
          radius: {
            type: "number",
            required: false,
            description: "Number of turns before and after to include (default 2).",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("session_extract_context", args),
      },
      {
        name: "session_index_status",
        description: "Inspect the current status, total indexed messages, and unique vocabulary terms in the search index.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => this.executeTool("session_index_status", args),
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string; executionTimeMs: number }> {
    const startedAt = Date.now();

    try {
      if (name === "session_search_history") {
        const query = String(args.query ?? "");
        const roleFilter = typeof args.role === "string" ? args.role : undefined;
        const limit = typeof args.limit === "number" ? args.limit : 10;

        const matches = this.searchEngine.search({
          query,
          roleFilter,
          limit,
        });

        return {
          success: true,
          result: {
            query,
            totalMatches: matches.length,
            matches,
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "session_extract_context") {
        const recordId = String(args.recordId ?? "");
        const target = this.substrate.getMessage(recordId);
        if (!target) {
          return {
            success: false,
            error: `Message record '${recordId}' not found in search index.`,
            executionTimeMs: Date.now() - startedAt,
          };
        }

        const radius = typeof args.radius === "number" ? args.radius : 2;
        const all = this.substrate.listMessages(target.sessionId);
        const sorted = [...all].sort((a, b) => a.turnIndex - b.turnIndex);
        const idx = sorted.findIndex((r) => r.id === target.id);

        const start = Math.max(0, idx - radius);
        const end = Math.min(sorted.length, idx + radius + 1);
        const contextWindow = sorted.slice(start, end);

        return {
          success: true,
          result: {
            targetRecord: target,
            contextWindow,
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "session_index_status") {
        const allRecords = this.substrate.listMessages();
        const terms = this.substrate.getAllTerms();

        return {
          success: true,
          result: {
            totalIndexedMessages: allRecords.length,
            totalUniqueTerms: terms.length,
            sampleTerms: terms.slice(0, 20),
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      return {
        success: false,
        error: `Unknown tool '${name}' in SearchToolSuite.`,
        executionTimeMs: Date.now() - startedAt,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startedAt,
      };
    }
  }
}
