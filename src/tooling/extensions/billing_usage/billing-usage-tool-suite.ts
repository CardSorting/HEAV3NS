/**
 * billing-usage-tool-suite.ts
 *
 * Model tool surface for Dollar-Denominated Billing Usage, Dual-Tier Credit Meters & Telemetry (Phase 132 / ADR-108 / Target #65):
 * 30 specialized model tools for querying balances, executing debits, adding top-up credits,
 * refreshing plan allowances, setting thresholds, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  BillingAccountInfo,
  BillingUsageConfig,
  BillingUsageGroupBy,
  BillingUsageSortBy,
  BillingUsageSortDirection,
} from "../../../core/contracts/billing-usage.contracts.js";
import { BillingUsageSupervisor } from "../../../agents/extensions/billing_usage/billing-usage-supervisor.js";
import { BillingUsageSnapshotManager } from "../../../sessions/extensions/billing_usage/billing-usage-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class BillingUsageToolSuite {
  private readonly supervisor: BillingUsageSupervisor;
  private readonly snapshotManager: BillingUsageSnapshotManager;

  constructor(supervisor: BillingUsageSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new BillingUsageSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "billing_get_usage_model",
        description: "Retrieves the dollar-denominated usage model, dual visual bars, and account status.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_get_usage_model", args);
        },
      },
      {
        name: "billing_debit_usage",
        description: "Debits a dollar magnitude of usage (plan allowance first, then top-up rollover).",
        parameters: {
          amountUsd: { type: "number", required: true, description: "Amount in USD to debit" },
          reason: { type: "string", description: "Optional purpose or model name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_debit_usage", args);
        },
      },
      {
        name: "billing_add_topup",
        description: "Credits a dollar magnitude of top-up funds that roll over indefinitely.",
        parameters: {
          amountUsd: { type: "number", required: true, description: "Amount in USD to add" },
          reason: { type: "string", description: "Optional deposit description" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_add_topup", args);
        },
      },
      {
        name: "billing_refresh_plan",
        description: "Refreshes or resets the monthly plan allowance and sets the new renewal date.",
        parameters: {
          allowanceUsd: { type: "number", description: "New monthly allowance in USD" },
          periodEndIso: { type: "string", description: "ISO timestamp for next renewal" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_refresh_plan", args);
        },
      },
      {
        name: "billing_get_account",
        description: "Retrieves the current billing account configuration and balances.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_get_account", args);
        },
      },
      {
        name: "billing_set_account",
        description: "Updates billing account attributes (plan allowance, plan remaining, top-up, paid status).",
        parameters: {
          planAllowanceUsd: { type: "number", description: "Plan allowance in USD" },
          planRemainingUsd: { type: "number", description: "Plan remaining in USD" },
          topupRemainingUsd: { type: "number", description: "Top-up remaining in USD" },
          isPaidPlan: { type: "boolean", description: "Whether on paid plan" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_set_account", args);
        },
      },
      {
        name: "billing_get_config",
        description: "Retrieves the global billing usage configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_get_config", args);
        },
      },
      {
        name: "billing_set_config",
        description: "Configures low-balance thresholds, currency symbols, and alerting preferences.",
        parameters: {
          lowBalanceThresholdUsd: { type: "number", description: "Threshold in USD" },
          currencySymbol: { type: "string", description: "Currency symbol (e.g. '$')" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_set_config", args);
        },
      },
      {
        name: "billing_list_transactions",
        description: "Lists all recent billing debits, credits, and plan renewals.",
        parameters: {
          limit: { type: "number", description: "Optional limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_list_transactions", args);
        },
      },
      {
        name: "billing_audit_health",
        description: "Audits billing account solvency, low-balance warning, and exhaustion state.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_audit_health", args);
        },
      },
      {
        name: "billing_get_metrics",
        description: "Fetches aggregated billing spend, credit totals, and latency metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_get_metrics", args);
        },
      },
      {
        name: "billing_group_and_sort",
        description: "Organizes billing transactions into multi-criteria swimlanes (type, tier, date).",
        parameters: {
          groupBy: { type: "string", description: "Group by: type, tier, date" },
          sortBy: { type: "string", description: "Sort by: timestamp, amount, type" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_group_and_sort", args);
        },
      },
      {
        name: "billing_search_dsl",
        description: "Searches billing transactions using Natural Query DSL (e.g. 'type:debit min_amount:1.00').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_search_dsl", args);
        },
      },
      {
        name: "billing_render_dashboard",
        description: "Renders an ANSI CLI summary card with dual-tier credit meters and status indicators.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_render_dashboard", args);
        },
      },
      {
        name: "billing_render_card",
        description: "Renders an interactive ANSI CLI billing transaction descriptor card.",
        parameters: {
          transactionId: { type: "string", required: true, description: "Transaction ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_render_card", args);
        },
      },
      {
        name: "billing_export_html",
        description: "Exports billing usage and credit ledgers to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_export_html", args);
        },
      },
      {
        name: "billing_export_markdown",
        description: "Exports billing usage diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_export_markdown", args);
        },
      },
      {
        name: "billing_export_csv",
        description: "Exports billing transactions to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_export_csv", args);
        },
      },
      {
        name: "billing_bulk_purge",
        description: "Atomically purges multiple billing transactions.",
        parameters: {
          transactionIdsJson: { type: "string", required: true, description: "JSON array of transaction IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_bulk_purge", args);
        },
      },
      {
        name: "billing_undo",
        description: "Reverts the last billing mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_undo", args);
        },
      },
      {
        name: "billing_redo",
        description: "Re-applies the last undone billing mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_redo", args);
        },
      },
      {
        name: "billing_capture_snapshot",
        description: "Captures a frame-perfect snapshot of billing workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_capture_snapshot", args);
        },
      },
      {
        name: "billing_restore_snapshot",
        description: "Restores billing workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_restore_snapshot", args);
        },
      },
      {
        name: "billing_format_status_summary",
        description: "Generates a compact human-readable ASCII summary for CLI / TUI surfaces.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_format_status_summary", args);
        },
      },
      {
        name: "billing_check_low_balance",
        description: "Evaluates whether total spendable funds are below the low-balance alert threshold.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_check_low_balance", args);
        },
      },
      {
        name: "billing_get_plan_bar",
        description: "Extracts plan allowance visual progress bar descriptor.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_get_plan_bar", args);
        },
      },
      {
        name: "billing_get_topup_bar",
        description: "Extracts top-up credit rollover visual progress bar descriptor.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_get_topup_bar", args);
        },
      },
      {
        name: "billing_format_usd",
        description: "Formats a numeric magnitude into USD currency representation.",
        parameters: {
          value: { type: "number", required: true, description: "Amount in USD" },
          symbol: { type: "string", description: "Currency symbol" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_format_usd", args);
        },
      },
      {
        name: "billing_format_renewal_date",
        description: "Formats an ISO date timestamp into a human-readable renewal string.",
        parameters: {
          isoDate: { type: "string", required: true, description: "ISO timestamp" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_format_renewal_date", args);
        },
      },
      {
        name: "billing_render_ascii_bar",
        description: "Renders an ASCII progress meter for a fraction between 0.0 and 1.0.",
        parameters: {
          fraction: { type: "number", required: true, description: "Fraction between 0.0 and 1.0" },
          width: { type: "number", description: "Width in characters" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("billing_render_ascii_bar", args);
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
        case "billing_get_usage_model": {
          const model = this.supervisor.getUsageModel();
          const summary = this.supervisor.formatStatusSummary();
          return { success: true, model, summary };
        }

        case "billing_debit_usage": {
          const amountUsd = Number(args.amountUsd) || 0;
          const reason = typeof args.reason === "string" ? args.reason : undefined;
          const result = this.supervisor.debitUsage(amountUsd, reason);
          return { success: true, transaction: result.transaction, updatedModel: result.model };
        }

        case "billing_add_topup": {
          const amountUsd = Number(args.amountUsd) || 0;
          const reason = typeof args.reason === "string" ? args.reason : undefined;
          const result = this.supervisor.addTopup(amountUsd, reason);
          return { success: true, transaction: result.transaction, updatedModel: result.model };
        }

        case "billing_refresh_plan": {
          const allowanceUsd = typeof args.allowanceUsd === "number" ? args.allowanceUsd : undefined;
          const periodEndIso = typeof args.periodEndIso === "string" ? args.periodEndIso : undefined;
          const tx = this.supervisor.getSubstrate().refreshPlan(allowanceUsd, periodEndIso);
          const model = this.supervisor.getUsageModel();
          return { success: true, transaction: tx, updatedModel: model };
        }

        case "billing_get_account": {
          const account = this.supervisor.getAccountInfo();
          return { success: true, account };
        }

        case "billing_set_account": {
          const updates: Partial<BillingAccountInfo> = {};
          if (typeof args.planAllowanceUsd === "number") updates.planAllowanceUsd = args.planAllowanceUsd;
          if (typeof args.planRemainingUsd === "number") updates.planRemainingUsd = args.planRemainingUsd;
          if (typeof args.topupRemainingUsd === "number") updates.topupRemainingUsd = args.topupRemainingUsd;
          if (typeof args.isPaidPlan === "boolean") updates.isPaidPlan = args.isPaidPlan;
          this.supervisor.updateAccountInfo(updates);
          return { success: true, updatedAccount: this.supervisor.getAccountInfo() };
        }

        case "billing_get_config": {
          const config = this.supervisor.getConfig();
          return { success: true, config };
        }

        case "billing_set_config": {
          const updates: Partial<BillingUsageConfig> = {};
          if (typeof args.lowBalanceThresholdUsd === "number") updates.lowBalanceThresholdUsd = args.lowBalanceThresholdUsd;
          if (typeof args.currencySymbol === "string") updates.currencySymbol = args.currencySymbol;
          this.supervisor.configure(updates);
          return { success: true, updatedConfig: this.supervisor.getConfig() };
        }

        case "billing_list_transactions": {
          const limit = typeof args.limit === "number" ? args.limit : undefined;
          const transactions = this.supervisor.getTransactions();
          const sliced = limit ? transactions.slice(-limit) : transactions;
          return { success: true, count: sliced.length, transactions: sliced };
        }

        case "billing_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "billing_get_metrics": {
          const metrics = this.supervisor.getSubstrate().getMetrics();
          return { success: true, metrics };
        }

        case "billing_group_and_sort": {
          const groupBy = (args.groupBy as BillingUsageGroupBy) || "type";
          const sortBy = (args.sortBy as BillingUsageSortBy) || "timestamp";
          const direction = (args.direction as BillingUsageSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedTransactions(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "billing_search_dsl": {
          const query = String(args.query || "");
          const transactions = this.supervisor.queryDsl(query);
          return { success: true, count: transactions.length, transactions };
        }

        case "billing_render_dashboard": {
          const model = this.supervisor.getUsageModel();
          const rendered = BroccoliViewRenderer.renderBillingUsageDashboard(model);
          return { success: true, rendered };
        }

        case "billing_render_card": {
          const txId = String(args.transactionId || "").trim();
          const txs = this.supervisor.getTransactions();
          const tx = txs.find((t) => t.id === txId);
          if (!tx) return { success: false, error: `Transaction '${txId}' not found` };
          const rendered = BroccoliViewRenderer.renderBillingTransactionCard(tx);
          return { success: true, rendered };
        }

        case "billing_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "billing_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "billing_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "billing_bulk_purge": {
          const idsJson = String(args.transactionIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "transactionIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "billing_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "billing_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "billing_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "billing_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "billing_format_status_summary": {
          const summary = this.supervisor.formatStatusSummary();
          return { success: true, summary };
        }

        case "billing_check_low_balance": {
          const model = this.supervisor.getUsageModel();
          return { success: true, isLowBalance: model.isLowBalance, status: model.status, totalSpendableUsd: model.totalSpendableUsd };
        }

        case "billing_get_plan_bar": {
          const model = this.supervisor.getUsageModel();
          return { success: true, planBar: model.planBar };
        }

        case "billing_get_topup_bar": {
          const model = this.supervisor.getUsageModel();
          return { success: true, topupBar: model.topupBar };
        }

        case "billing_format_usd": {
          const val = Number(args.value) || 0;
          const symbol = typeof args.symbol === "string" ? args.symbol : "$";
          const formatted = (this.supervisor as any).engine?.formatUsd(val, symbol) || `$${val.toFixed(2)}`;
          return { success: true, formatted };
        }

        case "billing_format_renewal_date": {
          const iso = String(args.isoDate || "");
          const formatted = (this.supervisor as any).engine?.formatRenews(iso) || iso;
          return { success: true, formatted };
        }

        case "billing_render_ascii_bar": {
          const frac = Number(args.fraction) || 0;
          const width = typeof args.width === "number" ? args.width : 20;
          const bar = (this.supervisor as any).engine?.renderAsciiBar(frac, width) || "█".repeat(Math.round(frac * width));
          return { success: true, bar };
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
