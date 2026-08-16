/**
 * billing-usage-tool-suite.ts
 *
 * Model tool definitions exposing Dollar-Denominated Billing Usage & Top-Up Rollover
 * (Phase 132 / ADR-108 / Target #65).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { BillingUsageSupervisor } from "../../../agents/extensions/billing_usage/billing-usage-supervisor.js";

export class BillingUsageToolSuite {
  private readonly supervisor: BillingUsageSupervisor;

  constructor(supervisor: BillingUsageSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "billing_usage_get_model",
        description: "Retrieves the dollar-denominated usage model, dual visual bars, and account status.",
        parameters: {},
        execute: async () => {
          const model = this.supervisor.getUsageModel();
          const summary = this.supervisor.formatStatusSummary();
          return {
            success: true,
            model,
            summary,
          };
        },
      },
      {
        name: "billing_usage_record_debit",
        description: "Debits a dollar magnitude of LLM usage (first from monthly plan allowance, then top-up rollover).",
        parameters: {
          amountUsd: {
            type: "number",
            description: "Amount in USD to debit.",
            required: true,
          },
          reason: {
            type: "string",
            description: "Optional purpose or model name for the transaction.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const amountUsd = Number(args.amountUsd) || 0;
          const reason = typeof args.reason === "string" ? args.reason : undefined;

          const result = this.supervisor.debitUsage(amountUsd, reason);
          return {
            success: true,
            transaction: result.transaction,
            updatedModel: result.model,
          };
        },
      },
      {
        name: "billing_usage_add_topup",
        description: "Credits non-expiring purchased top-up dollars to the account balance.",
        parameters: {
          amountUsd: {
            type: "number",
            description: "Amount in USD to add.",
            required: true,
          },
          reason: {
            type: "string",
            description: "Optional top-up invoice or reference identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const amountUsd = Number(args.amountUsd) || 0;
          const reason = typeof args.reason === "string" ? args.reason : undefined;

          const result = this.supervisor.addTopup(amountUsd, reason);
          return {
            success: true,
            transaction: result.transaction,
            updatedModel: result.model,
          };
        },
      },
      {
        name: "billing_usage_configure",
        description: "Configures low-balance alert thresholds and currency display preferences.",
        parameters: {
          lowBalanceThresholdUsd: {
            type: "number",
            description: "Alert trigger threshold in USD (default $5.00).",
            required: false,
          },
          alertOnLowBalance: {
            type: "boolean",
            description: "Whether to flag low-balance alert status.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const lowBalanceThresholdUsd =
            typeof args.lowBalanceThresholdUsd === "number" ? args.lowBalanceThresholdUsd : undefined;
          const alertOnLowBalance =
            typeof args.alertOnLowBalance === "boolean" ? args.alertOnLowBalance : undefined;

          this.supervisor.configure({
            lowBalanceThresholdUsd,
            alertOnLowBalance,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "billing_usage_get_metrics",
        description: "Retrieves aggregate transaction telemetry, total USD spent, and query counters.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          const transactions = this.supervisor.getTransactions();
          return {
            success: true,
            metrics,
            transactions,
          };
        },
      },
    ];
  }
}
