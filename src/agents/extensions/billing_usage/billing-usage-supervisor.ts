/**
 * billing-usage-supervisor.ts
 *
 * Master supervisor coordinating dollar-denominated billing state, top-up rollover,
 * debit prioritization, status classification, and dual-bar rendering (Phase 132 / ADR-108 / Target #65).
 */

import type { BroccoliBillingUsageSubstrate } from "../../../sessions/extensions/billing_usage/broccoli-billing-usage-substrate.js";
import type { DeterministicBillingUsageEngine } from "./deterministic-billing-usage-engine.js";
import type {
  BillingAccountInfo,
  BillingTransaction,
  BillingUsageConfig,
  BillingUsageMetrics,
  BillingUsageMetricsReport,
  UsageModelDescriptor,
} from "../../../core/contracts/billing-usage.contracts.js";

export class BillingUsageSupervisor {
  private readonly substrate: BroccoliBillingUsageSubstrate;
  private readonly engine: DeterministicBillingUsageEngine;

  constructor(substrate: BroccoliBillingUsageSubstrate, engine: DeterministicBillingUsageEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<BillingUsageConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): BillingUsageConfig {
    return this.substrate.getConfig();
  }

  public updateAccountInfo(info: Partial<BillingAccountInfo>): void {
    this.substrate.setAccountInfo(info);
  }

  public getAccountInfo(): BillingAccountInfo {
    return this.substrate.getAccountInfo();
  }

  public getUsageModel(): UsageModelDescriptor {
    return this.substrate.getUsageDescriptor();
  }

  public debitUsage(
    amountUsd: number,
    reason?: string
  ): { transaction: BillingTransaction; model: UsageModelDescriptor } {
    const transaction = this.substrate.debitUsage(amountUsd, reason);
    const model = this.getUsageModel();
    return { transaction, model };
  }

  public addTopup(
    amountUsd: number,
    reason?: string
  ): { transaction: BillingTransaction; model: UsageModelDescriptor } {
    const transaction = this.substrate.addTopup(amountUsd, reason);
    const model = this.getUsageModel();
    return { transaction, model };
  }

  public getTransactions(): readonly BillingTransaction[] {
    return this.substrate.getTransactions();
  }

  public getMetrics(): BillingUsageMetricsReport {
    return this.substrate.getMetrics();
  }

  /**
   * Generates a compact human-readable ASCII summary for CLI / TUI surfaces.
   */
  public formatStatusSummary(): string {
    const model = this.getUsageModel();
    const config = this.substrate.getConfig();
    const symbol = config.currencySymbol;

    const lines: string[] = [];
    lines.push(`Account Status: ${model.status.toUpperCase()}`);
    lines.push(`Total Spendable: ${this.engine.formatUsd(model.totalSpendableUsd, symbol)}`);

    if (model.planBar) {
      const barStr = this.engine.renderAsciiBar(model.planBar.fillFraction, 16);
      lines.push(
        `Plan Allowance:  ${this.engine.formatUsd(model.planRemainingUsd, symbol)} / ${this.engine.formatUsd(model.planAllowanceUsd, symbol)} [${barStr}] (${model.planBar.pctUsed}% used)`
      );
      if (model.renewalFormatted) {
        lines.push(`Renews:          ${model.renewalFormatted}`);
      }
    }

    if (model.topupBar) {
      const barStr = this.engine.renderAsciiBar(model.topupBar.fillFraction, 16);
      lines.push(
        `Top-Up Balance:  ${this.engine.formatUsd(model.topupRemainingUsd, symbol)} [${barStr}] (Rolls over)`
      );
    }

    if (model.isLowBalance) {
      lines.push(`[ALERT] Balance is below ${this.engine.formatUsd(config.lowBalanceThresholdUsd, symbol)} threshold!`);
    }

    return lines.join("\n");
  }

  public auditHealth(accountId?: string) {
    return this.substrate.auditHealth(accountId);
  }

  public getGroupedTransactions(groupBy?: any, sortBy?: any, direction?: any) {
    return this.substrate.getGroupedTransactions(groupBy, sortBy, direction);
  }

  public queryDsl(query: any) {
    return this.substrate.queryTransactionsDsl(query);
  }

  public bulkPurge(txIds: readonly string[]) {
    return this.substrate.bulkPurgeTransactions(txIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getSubstrate(): BroccoliBillingUsageSubstrate {
    return this.substrate;
  }
}
