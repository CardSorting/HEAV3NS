/**
 * cost-governance-tool-suite.ts
 *
 * Model tool suite exposing cost estimation, token accounting, and budget governance:
 * 30 specialized model tools for pre-flight budgeting, tier registration, burn rate analytics,
 * SLA health audits, swimlanes, DSL query, snapshots, and interactive exports (Phase 90 / ADR-042).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { CostGovernanceSupervisor } from "../../../agents/extensions/cost/cost-governance-supervisor.js";
import { BroccoliCostSubstrate } from "../../../sessions/extensions/cost/broccoli-cost-substrate.js";
import { DeterministicCostGovernor } from "./deterministic-cost-governor.js";
import { CostSnapshotManager } from "../../../sessions/extensions/cost/cost-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  CostGroupBy,
  CostSortBy,
  CostSortDirection,
  ModelPricingTier,
} from "../../../core/contracts/cost-governance.contracts.js";

export class CostGovernanceToolSuite {
  private readonly supervisor: CostGovernanceSupervisor;
  private readonly substrate: BroccoliCostSubstrate;
  private readonly governor: DeterministicCostGovernor;
  private readonly snapshotManager: CostSnapshotManager;

  constructor(
    supervisor?: CostGovernanceSupervisor,
    substrate?: BroccoliCostSubstrate,
    governor?: DeterministicCostGovernor
  ) {
    this.governor = governor ?? new DeterministicCostGovernor();
    this.substrate = substrate ?? new BroccoliCostSubstrate();
    this.supervisor = supervisor ?? new CostGovernanceSupervisor(this.governor, this.substrate);
    this.snapshotManager = new CostSnapshotManager(this.substrate);
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "cost_estimate_turn",
        description: "Pre-flight estimates the token cost for a planned model turn against the pricing catalog.",
        parameters: {
          modelId: { type: "string", description: "The target model identifier", required: true },
          promptTokens: { type: "number", description: "Estimated prompt token count", required: true },
          completionTokens: { type: "number", description: "Estimated completion token count", required: true },
          cachedPromptTokens: { type: "number", description: "Estimated cached prompt tokens" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_estimate_turn", args);
        },
      },
      {
        name: "cost_budget_status",
        description: "Queries current session token consumption, cumulative dollar cost, and budget ceiling status.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_budget_status", args);
        },
      },
      {
        name: "cost_record_usage",
        description: "Records completed turn token consumption and micro-cent integer arithmetic spend.",
        parameters: {
          turnIndex: { type: "number", required: true, description: "Turn index number" },
          modelId: { type: "string", required: true, description: "Model identifier" },
          promptTokens: { type: "number", required: true, description: "Prompt tokens consumed" },
          completionTokens: { type: "number", required: true, description: "Completion tokens generated" },
          cachedPromptTokens: { type: "number", description: "Cached prompt tokens reused" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_record_usage", args);
        },
      },
      {
        name: "cost_set_budget_cap",
        description: "Sets or updates session budget ceiling limits and turns cost hard caps.",
        parameters: {
          maxSessionCostUsd: { type: "number", description: "Maximum allowable session dollar budget" },
          maxTurnCostUsd: { type: "number", description: "Maximum allowable per-turn dollar spend" },
          hardCapEnforced: { type: "boolean", description: "Whether to strictly block model dispatch on budget breach" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_set_budget_cap", args);
        },
      },
      {
        name: "cost_register_pricing_tier",
        description: "Registers or updates custom model pricing in the deterministic pricing catalog.",
        parameters: {
          modelId: { type: "string", required: true, description: "Model identifier" },
          provider: { type: "string", required: true, description: "Provider name (e.g., openai, anthropic, deepseek)" },
          promptCostPerMillion: { type: "number", required: true, description: "Dollars per 1M prompt tokens" },
          completionCostPerMillion: { type: "number", required: true, description: "Dollars per 1M completion tokens" },
          cachedPromptCostPerMillion: { type: "number", description: "Dollars per 1M cached prompt tokens" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_register_pricing_tier", args);
        },
      },
      {
        name: "cost_get_pricing_tier",
        description: "Fetches pricing tier details for a specified model ID.",
        parameters: {
          modelId: { type: "string", required: true, description: "Model ID to query" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_get_pricing_tier", args);
        },
      },
      {
        name: "cost_list_pricing_tiers",
        description: "Lists all registered model pricing tiers in the active catalog.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_list_pricing_tiers", args);
        },
      },
      {
        name: "cost_audit_health",
        description: "Audits SLA budget health, token burn velocity, top spenders, and generates cost-saving tips.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_audit_health", args);
        },
      },
      {
        name: "cost_get_metrics",
        description: "Fetches comprehensive telemetry on tokens, turns, total dollar cost, and model usage distributions.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_get_metrics", args);
        },
      },
      {
        name: "cost_group_and_sort",
        description: "Organizes token usage ledger entries into multi-criteria swimlanes (model, provider, tier, status).",
        parameters: {
          groupBy: { type: "string", description: "Group by: model, provider, tier, status" },
          sortBy: { type: "string", description: "Sort by: cost, tokens, timestamp, turnIndex" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_group_and_sort", args);
        },
      },
      {
        name: "cost_search_dsl",
        description: "Searches token usage ledger using natural query DSL (e.g. 'model:gpt-4o cost>0.01 is:cached').",
        parameters: {
          query: { type: "string", required: true, description: "DSL search query" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_search_dsl", args);
        },
      },
      {
        name: "cost_render_dashboard",
        description: "Renders an ANSI CLI summary card for cost governance and token metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_render_dashboard", args);
        },
      },
      {
        name: "cost_render_pricing",
        description: "Renders an ANSI CLI visual table of model pricing tiers.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_render_pricing", args);
        },
      },
      {
        name: "cost_export_html",
        description: "Exports session cost ledger and token analytics into a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_export_html", args);
        },
      },
      {
        name: "cost_export_markdown",
        description: "Exports session cost summary and per-turn ledger as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_export_markdown", args);
        },
      },
      {
        name: "cost_export_csv",
        description: "Exports per-turn token usage ledger as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_export_csv", args);
        },
      },
      {
        name: "cost_bulk_clear",
        description: "Atomically clears specified turn usage entries from the ledger.",
        parameters: {
          turnIndices: { type: "string", required: true, description: "Comma-separated turn index numbers" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_bulk_clear", args);
        },
      },
      {
        name: "cost_undo",
        description: "Undo the last cost ledger mutation or recording.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_undo", args);
        },
      },
      {
        name: "cost_redo",
        description: "Redo the previously undone cost ledger mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_redo", args);
        },
      },
      {
        name: "cost_snapshot_create",
        description: "Captures an O(1) state snapshot of the cost governance substrate.",
        parameters: {
          frameIndex: { type: "number", description: "Snapshot frame number" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_snapshot_create", args);
        },
      },
      {
        name: "cost_snapshot_restore",
        description: "Restores cost governance state from a previously captured frame snapshot.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_snapshot_restore", args);
        },
      },
      {
        name: "cost_clear_ledger",
        description: "Clears all token usage ledger entries and resets session spend counters.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_clear_ledger", args);
        },
      },
      {
        name: "cost_reset_pricing",
        description: "Resets the model pricing catalog to default tier configurations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_reset_pricing", args);
        },
      },
      {
        name: "cost_toggle_hard_cap",
        description: "Toggles hard cap enforcement on budget ceilings.",
        parameters: {
          enforced: { type: "boolean", required: true, description: "Whether hard cap is enforced" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_toggle_hard_cap", args);
        },
      },
      {
        name: "cost_get_burn_rate",
        description: "Calculates live token spend velocity and cost per turn/hour.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_get_burn_rate", args);
        },
      },
      {
        name: "cost_get_turn_entry",
        description: "Retrieves token usage ledger entry for a specific turn index.",
        parameters: {
          turnIndex: { type: "number", required: true, description: "Turn index number" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_get_turn_entry", args);
        },
      },
      {
        name: "cost_list_ledger",
        description: "Lists historical per-turn token usage entries.",
        parameters: {
          limit: { type: "number", description: "Maximum entries to return (default 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_list_ledger", args);
        },
      },
      {
        name: "cost_audit_log",
        description: "Retrieves administrative audit ledger of cost governance actions.",
        parameters: {
          limit: { type: "number", description: "Maximum audit records (default 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_audit_log", args);
        },
      },
      {
        name: "cost_calculate_batch",
        description: "Calculates cumulative token spend across multiple hypothetical model turns.",
        parameters: {
          batchRuns: { type: "string", required: true, description: "JSON array of { modelId, promptTokens, completionTokens }" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_calculate_batch", args);
        },
      },
      {
        name: "cost_check_budget_headroom",
        description: "Calculates remaining budget headroom in dollars and maximum affordable tokens.",
        parameters: {
          modelId: { type: "string", description: "Target model ID (default 'gpt-4o')" },
          budgetCapUsd: { type: "number", description: "Optional budget ceiling (default active cap)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cost_check_budget_headroom", args);
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
        case "cost_estimate_turn": {
          const modelId = typeof args.modelId === "string" ? args.modelId : "gpt-4o";
          const promptTokens = typeof args.promptTokens === "number" ? args.promptTokens : 0;
          const completionTokens = typeof args.completionTokens === "number" ? args.completionTokens : 0;

          const preflight = this.supervisor.evaluatePreFlight(promptTokens, completionTokens, modelId);
          return {
            success: preflight.allowed,
            modelId,
            estimatedCostUsd: preflight.estimatedCostUsd,
            formattedCostLabel: preflight.formattedCostLabel,
            totalSessionCostUsd: preflight.totalSessionCostUsd,
            remainingBudgetUsd: preflight.remainingBudgetUsd,
            hardCapBreached: preflight.hardCapBreached,
            breachReason: preflight.breachReason,
          };
        }

        case "cost_budget_status": {
          const stats = this.supervisor.getStats();
          return {
            success: true,
            totalCostUsd: stats.totalCostUsd,
            formattedTotalCostLabel: stats.formattedTotalCostLabel,
            totalTokens: stats.totalTokens,
            totalPromptTokens: stats.totalPromptTokens,
            totalCompletionTokens: stats.totalCompletionTokens,
            totalCachedPromptTokens: stats.totalCachedPromptTokens,
            totalTurns: stats.totalTurns,
            hardCapBreached: stats.hardCapBreached,
          };
        }

        case "cost_record_usage": {
          const turnIndex = typeof args.turnIndex === "number" ? args.turnIndex : 1;
          const modelId = String(args.modelId || "gpt-4o");
          const promptTokens = Number(args.promptTokens) || 0;
          const completionTokens = Number(args.completionTokens) || 0;
          const cachedPromptTokens = Number(args.cachedPromptTokens) || 0;

          const entry = this.supervisor.recordTurn(turnIndex, modelId, promptTokens, completionTokens, cachedPromptTokens);
          return { success: true, entry };
        }

        case "cost_set_budget_cap": {
          const maxSessionCostUsd = typeof args.maxSessionCostUsd === "number" ? args.maxSessionCostUsd : undefined;
          const maxTurnCostUsd = typeof args.maxTurnCostUsd === "number" ? args.maxTurnCostUsd : undefined;
          const hardCapEnforced = args.hardCapEnforced !== false;

          this.supervisor.setBudgetCap({
            maxSessionCostUsd,
            maxTurnCostUsd,
            hardCapEnforced,
          });
          return { success: true, maxSessionCostUsd, maxTurnCostUsd, hardCapEnforced };
        }

        case "cost_register_pricing_tier": {
          const modelId = String(args.modelId || "").trim();
          const provider = String(args.provider || "custom").trim();
          const promptCostPerMillion = Number(args.promptCostPerMillion) || 1.0;
          const completionCostPerMillion = Number(args.completionCostPerMillion) || 2.0;
          const cachedPromptCostPerMillion = typeof args.cachedPromptCostPerMillion === "number" ? args.cachedPromptCostPerMillion : undefined;

          if (!modelId) return { success: false, error: "modelId is required" };

          const tier: ModelPricingTier = {
            modelId,
            provider,
            promptCostPerMillion,
            completionCostPerMillion,
            cachedPromptCostPerMillion,
          };
          this.governor.registerTier(tier);
          return { success: true, tier };
        }

        case "cost_get_pricing_tier": {
          const modelId = String(args.modelId || "");
          const tier = this.governor.getTier(modelId);
          return { success: true, tier };
        }

        case "cost_list_pricing_tiers": {
          const models = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "deepseek-chat", "hermes-3-llama-3.1-405b"];
          const tiers = models.map((m) => this.governor.getTier(m));
          return { success: true, count: tiers.length, tiers };
        }

        case "cost_audit_health": {
          const audit = this.substrate.auditCostHealth();
          return { success: true, audit };
        }

        case "cost_get_metrics": {
          const metrics = this.substrate.getCostMetrics();
          return { success: true, metrics };
        }

        case "cost_group_and_sort": {
          const groupBy = (args.groupBy as CostGroupBy) || "model";
          const sortBy = (args.sortBy as CostSortBy) || "cost";
          const direction = (args.direction as CostSortDirection) || "desc";
          const lanes = this.substrate.getGroupedCosts(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "cost_search_dsl": {
          const query = String(args.query || "");
          const entries = this.substrate.queryCostsDsl(query);
          return { success: true, count: entries.length, entries };
        }

        case "cost_render_dashboard": {
          const metrics = this.substrate.getCostMetrics();
          const rendered = BroccoliViewRenderer.renderCostDashboard(metrics);
          return { success: true, rendered };
        }

        case "cost_render_pricing": {
          const models = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", "deepseek-chat", "hermes-3-llama-3.1-405b"];
          const tiers = models.map((m) => this.governor.getTier(m));
          const rendered = BroccoliViewRenderer.renderPricingCatalog(tiers);
          return { success: true, rendered };
        }

        case "cost_export_html": {
          const html = this.substrate.exportInteractiveHtmlView();
          return { success: true, html };
        }

        case "cost_export_markdown": {
          const markdown = this.substrate.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "cost_export_csv": {
          const csv = this.substrate.exportCsvReport();
          return { success: true, csv };
        }

        case "cost_bulk_clear": {
          const turnIndices = String(args.turnIndices || "")
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => !isNaN(n));
          const result = this.substrate.bulkClearLedger(turnIndices);
          return { success: result.modifiedCount > 0, result };
        }

        case "cost_undo": {
          const success = this.substrate.undo();
          return { success };
        }

        case "cost_redo": {
          const success = this.substrate.redo();
          return { success };
        }

        case "cost_snapshot_create": {
          const frameIndex = typeof args.frameIndex === "number" ? args.frameIndex : Date.now();
          const snapshot = this.snapshotManager.createSnapshot(frameIndex);
          return { success: true, snapshot };
        }

        case "cost_snapshot_restore": {
          const frameIndex = Number(args.frameIndex) || 0;
          const restored = this.snapshotManager.restoreSnapshot(frameIndex);
          return { success: restored, restored };
        }

        case "cost_clear_ledger": {
          this.substrate.clear();
          return { success: true, message: "Token usage ledger and cost spend counters cleared." };
        }

        case "cost_reset_pricing": {
          this.governor.reset();
          return { success: true, message: "Pricing catalog reset to default model tiers." };
        }

        case "cost_toggle_hard_cap": {
          const enforced = Boolean(args.enforced);
          this.supervisor.setBudgetCap({ hardCapEnforced: enforced });
          return { success: true, hardCapEnforced: enforced };
        }

        case "cost_get_burn_rate": {
          const metrics = this.substrate.getCostMetrics();
          const audit = this.substrate.auditCostHealth();
          return {
            success: true,
            burnRatePerTurnUsd: metrics.burnRatePerTurnUsd,
            burnRatePerHourUsd: audit.burnRateUsdPerHour,
          };
        }

        case "cost_get_turn_entry": {
          const turnIndex = Number(args.turnIndex) || 0;
          const entry = this.substrate.listLedger(500).find((e) => e.turnIndex === turnIndex);
          return { success: entry !== undefined, entry };
        }

        case "cost_list_ledger": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const ledger = this.substrate.listLedger(limit);
          return { success: true, count: ledger.length, ledger };
        }

        case "cost_audit_log": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const logs = this.substrate.getAuditLogs(limit);
          return { success: true, count: logs.length, logs };
        }

        case "cost_calculate_batch": {
          let batch: Array<{ modelId: string; promptTokens: number; completionTokens: number; cachedPromptTokens?: number }> = [];
          if (typeof args.batchRuns === "string") {
            try {
              batch = JSON.parse(args.batchRuns);
            } catch {
              return { success: false, error: "Invalid JSON in batchRuns" };
            }
          }
          let cumulativeMicroCents = 0;
          const runs = batch.map((r) => {
            const cost = this.governor.calculateTurnCost(r.modelId, r.promptTokens, r.completionTokens, r.cachedPromptTokens);
            cumulativeMicroCents += cost.costMicroCents;
            return { ...r, cost };
          });
          const totalCostUsd = Number((cumulativeMicroCents / 1_000_000).toFixed(6));
          return {
            success: true,
            totalCostUsd,
            formattedTotalCostLabel: this.governor.formatCostLabel(totalCostUsd),
            runs,
          };
        }

        case "cost_check_budget_headroom": {
          const modelId = String(args.modelId || "gpt-4o");
          const tier = this.governor.getTier(modelId);
          const currentSpend = this.substrate.getCostMetrics().totalCostUsd;
          const capUsd = typeof args.budgetCapUsd === "number" ? args.budgetCapUsd : 10.0;
          const remainingUsd = Math.max(0, capUsd - currentSpend);

          // Headroom tokens at 50/50 prompt/completion split
          const avgCostPerToken = (tier.promptCostPerMillion + tier.completionCostPerMillion) / 2 / 1_000_000;
          const affordableTokens = Math.floor(remainingUsd / avgCostPerToken);

          return {
            success: true,
            modelId,
            currentSpendUsd: currentSpend,
            budgetCapUsd: capUsd,
            remainingHeadroomUsd: Number(remainingUsd.toFixed(4)),
            approximateAffordableTokens: affordableTokens,
          };
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
