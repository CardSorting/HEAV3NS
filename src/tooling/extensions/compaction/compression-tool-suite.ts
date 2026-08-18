/**
 * compression-tool-suite.ts
 *
 * Model tool surface for Context Compression, Token Attention Pruning & Trajectory Compaction:
 * 30 specialized model tools for compacting conversations, pruning tool outputs, calculating budgets,
 * DSL queries, swimlanes, dashboards, and reports (Phase 86 / ADR-038).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { ContextCompressionSupervisor } from "../../../agents/extensions/compaction/context-compression-supervisor.js";
import { BroccoliCompressionSubstrate } from "../../../sessions/extensions/compaction/broccoli-compression-substrate.js";
import { HeadTailBudgetGovernor } from "./head-tail-budget-governor.js";
import { DeterministicToolPruner } from "./deterministic-tool-pruner.js";
import { TrajectoryCompactorEngine } from "../../../agents/extensions/compaction/trajectory-compactor-engine.js";
import { CompressionSnapshotManager } from "../../../sessions/extensions/compaction/compression-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  CompressionGroupBy,
  CompressionSortBy,
  CompressionSortDirection,
} from "../../../core/contracts/compression.contracts.js";

export class CompressionToolSuite {
  private readonly supervisor: ContextCompressionSupervisor;
  private readonly substrate: BroccoliCompressionSubstrate;
  private readonly budgetGovernor: HeadTailBudgetGovernor;
  private readonly toolPruner: DeterministicToolPruner;
  private readonly compactorEngine: TrajectoryCompactorEngine;
  private readonly snapshotManager: CompressionSnapshotManager;

  constructor(
    supervisor?: ContextCompressionSupervisor,
    substrate?: BroccoliCompressionSubstrate,
    budgetGovernor?: HeadTailBudgetGovernor,
    toolPruner?: DeterministicToolPruner,
    compactorEngine?: TrajectoryCompactorEngine
  ) {
    this.substrate = substrate ?? new BroccoliCompressionSubstrate();
    this.budgetGovernor = budgetGovernor ?? new HeadTailBudgetGovernor();
    this.toolPruner = toolPruner ?? new DeterministicToolPruner();
    this.compactorEngine = compactorEngine ?? new TrajectoryCompactorEngine(this.substrate, this.budgetGovernor, this.toolPruner);
    this.supervisor = supervisor ?? new ContextCompressionSupervisor(this.substrate, this.budgetGovernor, this.toolPruner, this.compactorEngine);
    this.snapshotManager = new CompressionSnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "compact_trajectory",
        description: "Compacts a multi-turn conversation trajectory into structured LUMI-CONTEXT summaries.",
        parameters: {
          turnsJson: { type: "string", required: true, description: "JSON array of turns [{turnIndex, role, content}]" },
          maxLimit: { type: "number", description: "Maximum token context window limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compact_trajectory", args);
        },
      },
      {
        name: "prune_tool_output",
        description: "Prunes noisy tool output by stripping base64, collapsing lines, and truncating traces.",
        parameters: {
          rawOutput: { type: "string", required: true, description: "Raw tool output text" },
          maxChars: { type: "number", description: "Max character limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("prune_tool_output", args);
        },
      },
      {
        name: "calculate_token_budget",
        description: "Calculates token window budget partitions (head, middle, tail, summary).",
        parameters: {
          totalTokens: { type: "number", required: true, description: "Total token usage" },
          maxLimit: { type: "number", description: "Max context limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("calculate_token_budget", args);
        },
      },
      {
        name: "get_compression_summary",
        description: "Retrieves a specific compacted turn summary.",
        parameters: {
          summaryId: { type: "string", required: true, description: "Summary ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_compression_summary", args);
        },
      },
      {
        name: "list_compression_summaries",
        description: "Lists historical trajectory compression summaries.",
        parameters: {
          limit: { type: "number", description: "Max summaries to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_compression_summaries", args);
        },
      },
      {
        name: "get_latest_compression_summary",
        description: "Retrieves the most recent compacted turn summary.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_latest_compression_summary", args);
        },
      },
      {
        name: "compression_audit_health",
        description: "Audits compression efficiency, savings ratio, and overflow risk.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_audit_health", args);
        },
      },
      {
        name: "compression_get_metrics",
        description: "Fetches comprehensive telemetry on token savings and compacted turns.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_get_metrics", args);
        },
      },
      {
        name: "compression_group_and_sort",
        description: "Organizes summaries into multi-criteria swimlanes (savingsTier, turnRange, goalStatus).",
        parameters: {
          groupBy: { type: "string", description: "Group by: savingsTier, turnRange, goalStatus" },
          sortBy: { type: "string", description: "Sort by: timestamp, tokensSaved, compressedTokens" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_group_and_sort", args);
        },
      },
      {
        name: "compression_search_dsl",
        description: "Searches summaries using natural query DSL (e.g. 'savings>500 goal:resolved').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_search_dsl", args);
        },
      },
      {
        name: "compression_render_dashboard",
        description: "Renders an ANSI CLI summary card with token savings meters.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_render_dashboard", args);
        },
      },
      {
        name: "compression_render_card",
        description: "Renders an interactive ANSI CLI compressed block summary card.",
        parameters: {
          summaryId: { type: "string", required: true, description: "Summary ID to render" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_render_card", args);
        },
      },
      {
        name: "compression_export_html",
        description: "Exports compression telemetry to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_export_html", args);
        },
      },
      {
        name: "compression_export_markdown",
        description: "Exports compression diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_export_markdown", args);
        },
      },
      {
        name: "compression_export_csv",
        description: "Exports compression summaries to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_export_csv", args);
        },
      },
      {
        name: "compression_bulk_purge",
        description: "Atomically purges multiple compression summaries.",
        parameters: {
          summaryIdsJson: { type: "string", required: true, description: "JSON array of summary IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_bulk_purge", args);
        },
      },
      {
        name: "compression_undo",
        description: "Reverts the last compression mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_undo", args);
        },
      },
      {
        name: "compression_redo",
        description: "Re-applies the last undone compression mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_redo", args);
        },
      },
      {
        name: "compression_capture_snapshot",
        description: "Captures a frame-perfect snapshot of compression state in memory.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_capture_snapshot", args);
        },
      },
      {
        name: "compression_restore_snapshot",
        description: "Restores compression state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_restore_snapshot", args);
        },
      },
      {
        name: "compression_estimate_tokens",
        description: "Estimates token count for a text string using 4 chars/token heuristic.",
        parameters: {
          text: { type: "string", required: true, description: "Text string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_estimate_tokens", args);
        },
      },
      {
        name: "compression_check_budget",
        description: "Checks whether current tokens exceed compression threshold.",
        parameters: {
          currentTokens: { type: "number", required: true, description: "Current tokens" },
          maxLimit: { type: "number", description: "Max context limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_check_budget", args);
        },
      },
      {
        name: "compression_inspect_snapshot",
        description: "Inspects full workspace compression snapshot.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_inspect_snapshot", args);
        },
      },
      {
        name: "compression_clear_history",
        description: "Clears compression summaries and pruned output ledgers.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_clear_history", args);
        },
      },
      {
        name: "compression_partition_turns",
        description: "Partitions a turn list into head, middle, and tail.",
        parameters: {
          turnsJson: { type: "string", required: true, description: "JSON array of turns" },
          headCount: { type: "number", description: "Head turn count (default: 2)" },
          tailCount: { type: "number", description: "Tail turn count (default: 4)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_partition_turns", args);
        },
      },
      {
        name: "compression_strip_base64",
        description: "Strips base64 image and data payloads from raw text.",
        parameters: {
          text: { type: "string", required: true, description: "Input text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_strip_base64", args);
        },
      },
      {
        name: "compression_collapse_repeated_lines",
        description: "Collapses repeating identical lines from noisy log dumps.",
        parameters: {
          text: { type: "string", required: true, description: "Input text" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_collapse_repeated_lines", args);
        },
      },
      {
        name: "compression_truncate_trace",
        description: "Truncates long trace preserving head and tail.",
        parameters: {
          text: { type: "string", required: true, description: "Input text" },
          maxChars: { type: "number", description: "Max characters limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_truncate_trace", args);
        },
      },
      {
        name: "compression_get_savings_ratio",
        description: "Calculates token savings percentage between original and compressed counts.",
        parameters: {
          originalTokens: { type: "number", required: true, description: "Original tokens" },
          compressedTokens: { type: "number", required: true, description: "Compressed tokens" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_get_savings_ratio", args);
        },
      },
      {
        name: "compression_simulate_multi_turn",
        description: "Simulates multi-turn trajectory compaction over N turns.",
        parameters: {
          numTurns: { type: "number", description: "Number of turns to simulate (default: 10)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("compression_simulate_multi_turn", args);
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
        case "compact_trajectory": {
          const turnsJson = String(args.turnsJson || "[]");
          let turns: { turnIndex: number; role: string; content: string }[];
          try {
            turns = JSON.parse(turnsJson);
          } catch {
            return { success: false, error: "turnsJson must be valid JSON" };
          }
          const maxLimit = typeof args.maxLimit === "number" ? args.maxLimit : undefined;
          const res = this.supervisor.compactTrajectory(turns, { maxContextLimit: maxLimit });
          return { success: true, tokensSaved: res.tokensSaved, summary: res.summary, compactedTurnsCount: res.compactedTurns.length };
        }

        case "prune_tool_output": {
          const rawOutput = String(args.rawOutput || "");
          const maxOutputChars = typeof args.maxChars === "number" ? args.maxChars : undefined;
          const res = this.supervisor.pruneToolResult(rawOutput, { maxOutputChars });
          return { success: true, ...res };
        }

        case "calculate_token_budget": {
          const totalTokens = Number(args.totalTokens || 0);
          const maxLimit = typeof args.maxLimit === "number" ? args.maxLimit : undefined;
          const budget = this.supervisor.calculateBudget(totalTokens, maxLimit);
          return { success: true, budget };
        }

        case "get_compression_summary": {
          const id = String(args.summaryId || "");
          const summary = this.supervisor.getSummary(id);
          return { success: summary !== undefined, summary };
        }

        case "list_compression_summaries": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const summaries = this.supervisor.listSummaries(limit);
          return { success: true, count: summaries.length, summaries };
        }

        case "get_latest_compression_summary": {
          const summary = this.supervisor.getLatestSummary();
          return { success: summary !== undefined, summary };
        }

        case "compression_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "compression_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "compression_group_and_sort": {
          const groupBy = (args.groupBy as CompressionGroupBy) || "savingsTier";
          const sortBy = (args.sortBy as CompressionSortBy) || "timestamp";
          const direction = (args.direction as CompressionSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedSummaries(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "compression_search_dsl": {
          const query = String(args.query || "");
          const summaries = this.supervisor.queryDsl(query);
          return { success: true, count: summaries.length, summaries };
        }

        case "compression_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderCompressionDashboard(metrics);
          return { success: true, rendered };
        }

        case "compression_render_card": {
          const id = String(args.summaryId || "");
          const summary = this.supervisor.getSummary(id);
          if (!summary) return { success: false, error: `Summary ${id} not found` };
          const rendered = BroccoliViewRenderer.renderCompressionCard(summary);
          return { success: true, rendered };
        }

        case "compression_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "compression_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "compression_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "compression_bulk_purge": {
          const idsJson = String(args.summaryIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "summaryIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "compression_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "compression_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "compression_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "compression_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "compression_estimate_tokens": {
          const text = String(args.text || "");
          const tokens = Math.ceil(text.length / 4);
          return { success: true, chars: text.length, tokens };
        }

        case "compression_check_budget": {
          const tokens = Number(args.currentTokens || 0);
          const limit = typeof args.maxLimit === "number" ? args.maxLimit : undefined;
          const budget = this.budgetGovernor.calculateBudget(tokens, limit);
          const shouldCompress = this.budgetGovernor.shouldCompress(tokens, budget);
          return { success: true, shouldCompress, threshold: budget.compressionThreshold, tokens };
        }

        case "compression_inspect_snapshot": {
          const snap = this.supervisor.getStats();
          return { success: true, snapshot: snap };
        }

        case "compression_clear_history": {
          this.substrate.clear();
          return { success: true };
        }

        case "compression_partition_turns": {
          const turnsJson = String(args.turnsJson || "[]");
          let turns: unknown[];
          try {
            turns = JSON.parse(turnsJson);
          } catch {
            return { success: false, error: "turnsJson must be valid JSON" };
          }
          const headCount = typeof args.headCount === "number" ? args.headCount : 2;
          const tailCount = typeof args.tailCount === "number" ? args.tailCount : 4;
          const partitioned = this.budgetGovernor.partitionTurns(turns, headCount, tailCount);
          return { success: true, partitioned };
        }

        case "compression_strip_base64": {
          const text = String(args.text || "");
          const res = this.toolPruner.pruneToolResult(text, { stripBase64Data: true, collapseRepeatedLines: false, maxOutputChars: 1000000 });
          return { success: true, text: res.prunedText, originalChars: res.originalChars, prunedChars: res.prunedChars };
        }

        case "compression_collapse_repeated_lines": {
          const text = String(args.text || "");
          const res = this.toolPruner.pruneToolResult(text, { stripBase64Data: false, collapseRepeatedLines: true, maxOutputChars: 1000000 });
          return { success: true, text: res.prunedText };
        }

        case "compression_truncate_trace": {
          const text = String(args.text || "");
          const maxChars = Number(args.maxChars || 4000);
          const res = this.toolPruner.pruneToolResult(text, { maxOutputChars: maxChars });
          return { success: true, text: res.prunedText };
        }

        case "compression_get_savings_ratio": {
          const orig = Number(args.originalTokens || 0);
          const comp = Number(args.compressedTokens || 0);
          const saved = Math.max(0, orig - comp);
          const pct = orig > 0 ? Number(((saved / orig) * 100).toFixed(1)) : 0;
          return { success: true, originalTokens: orig, compressedTokens: comp, tokensSaved: saved, savingsPercentage: pct };
        }

        case "compression_simulate_multi_turn": {
          const numTurns = typeof args.numTurns === "number" ? args.numTurns : 10;
          const fakeTurns = Array.from({ length: numTurns }, (_, i) => ({
            turnIndex: i + 1,
            role: i % 2 === 0 ? "user" : "assistant",
            content: `Turn #${i + 1} content with important details and work progress item. ${i === 3 ? "COMPLETED: initial design" : ""}`,
          }));
          const res = this.supervisor.compactTrajectory(fakeTurns);
          return { success: true, tokensSaved: res.tokensSaved, summary: res.summary };
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
