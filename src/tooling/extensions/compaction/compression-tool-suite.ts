import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IBroccoliCompressionSubstrate,
  IDeterministicToolPruner,
  IHeadTailBudgetGovernor,
  ITrajectoryCompactorEngine,
} from "../../../core/contracts/compression.contracts.js";

/**
 * Model-Facing Tool Suite for Semantic Context Compression.
 */
export class CompressionToolSuite {
  private readonly substrate: IBroccoliCompressionSubstrate;
  private readonly budgetGovernor: IHeadTailBudgetGovernor;
  private readonly toolPruner: IDeterministicToolPruner;
  private readonly compactorEngine: ITrajectoryCompactorEngine;

  constructor(
    substrate: IBroccoliCompressionSubstrate,
    budgetGovernor: IHeadTailBudgetGovernor,
    toolPruner: IDeterministicToolPruner,
    compactorEngine: ITrajectoryCompactorEngine
  ) {
    this.substrate = substrate;
    this.budgetGovernor = budgetGovernor;
    this.toolPruner = toolPruner;
    this.compactorEngine = compactorEngine;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "context_compress_window",
        description: "Mathematically compact middle conversation turns while preserving system axioms and active tail context.",
        parameters: {
          currentTokens: {
            type: "number",
            required: true,
            description: "Current estimated conversation tokens.",
          },
          maxLimit: {
            type: "number",
            required: false,
            description: "Maximum token context window limit (default 128k).",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("context_compress_window", args),
      },
      {
        name: "context_prune_tools",
        description: "Deterministic AST-level pruning of noisy tool outputs (stripping base64 blobs, collapsing repeat logs).",
        parameters: {
          rawOutput: {
            type: "string",
            required: true,
            description: "Raw tool text output to prune.",
          },
          maxChars: {
            type: "number",
            required: false,
            description: "Maximum characters to retain (default 4000).",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("context_prune_tools", args),
      },
      {
        name: "context_inspect_budget",
        description: "Inspect the current context window token budget, compression thresholds, and compaction history.",
        parameters: {
          totalTokens: {
            type: "number",
            required: false,
            description: "Estimated total tokens to calculate budget against.",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("context_inspect_budget", args),
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string; executionTimeMs: number }> {
    const startedAt = Date.now();

    try {
      if (name === "context_compress_window") {
        const currentTokens = Number(args.currentTokens ?? 0);
        const maxLimit = typeof args.maxLimit === "number" ? args.maxLimit : undefined;
        const budget = this.budgetGovernor.calculateBudget(currentTokens, maxLimit);
        const shouldCompress = this.budgetGovernor.shouldCompress(currentTokens, budget);

        return {
          success: true,
          result: {
            shouldCompress,
            budget,
            totalHistoricalCompactedTurns: this.substrate.listSummaries().length,
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "context_prune_tools") {
        const rawOutput = String(args.rawOutput ?? "");
        const maxChars = typeof args.maxChars === "number" ? args.maxChars : 4000;
        const pruned = this.toolPruner.pruneToolResult(rawOutput, { maxOutputChars: maxChars });

        return {
          success: true,
          result: pruned,
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "context_inspect_budget") {
        const totalTokens = Number(args.totalTokens ?? 10000);
        const budget = this.budgetGovernor.calculateBudget(totalTokens);
        const summaries = this.substrate.listSummaries();

        return {
          success: true,
          result: {
            budget,
            totalCompactedSummaries: summaries.length,
            latestSummary: this.substrate.getLatestSummary(),
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      return {
        success: false,
        error: `Unknown tool name '${name}' in CompressionToolSuite.`,
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
