/**
 * broccoli-billing-usage-substrate.ts
 *
 * In-memory Broccolidb repository storing account billing information, top-up balances,
 * debit/credit transaction ledgers, and telemetry (Phase 132 / ADR-108 / Target #65).
 */

import type {
  BillingAccountInfo,
  BillingTransaction,
  BillingUsageConfig,
  BillingUsageMetrics,
  BillingUsageWorkspaceSnapshot,
} from "../../../core/contracts/billing-usage.contracts.js";
import {
  DEFAULT_BILLING_ACCOUNT_INFO,
  DEFAULT_BILLING_USAGE_CONFIG,
} from "../../../core/contracts/billing-usage.contracts.js";

export class BroccoliBillingUsageSubstrate {
  private config: BillingUsageConfig = { ...DEFAULT_BILLING_USAGE_CONFIG };
  private accountInfo: BillingAccountInfo = { ...DEFAULT_BILLING_ACCOUNT_INFO };
  private transactions: BillingTransaction[] = [];
  private metrics: BillingUsageMetrics = {
    totalQueries: 0,
    totalDebits: 0,
    totalCredits: 0,
    totalSpendUsd: 0,
    lastStatus: "free",
  };

  public setConfig(config: Partial<BillingUsageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): BillingUsageConfig {
    return { ...this.config };
  }

  public setAccountInfo(info: Partial<BillingAccountInfo>): void {
    this.accountInfo = { ...this.accountInfo, ...info };
  }

  public getAccountInfo(): BillingAccountInfo {
    return { ...this.accountInfo };
  }

  public addTopup(amountUsd: number, reason?: string): BillingTransaction {
    const validAmount = Math.max(0, amountUsd);
    this.accountInfo.topupRemainingUsd += validAmount;

    const tx: BillingTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type: "topup_credit",
      amountUsd: validAmount,
      planDebitedUsd: 0,
      topupDebitedUsd: 0,
      reason,
    };

    this.transactions.push(tx);
    this.metrics.totalCredits++;
    if (this.transactions.length > 200) {
      this.transactions.shift();
    }
    return tx;
  }

  /**
   * Debits usage against the plan first (expiring monthly allowance), then topup rollover second.
   */
  public debitUsage(amountUsd: number, reason?: string): BillingTransaction {
    const validAmount = Math.max(0, amountUsd);
    let remainingToDebit = validAmount;

    // 1. Debit from plan allowance
    const planDebit = Math.min(this.accountInfo.planRemainingUsd, remainingToDebit);
    this.accountInfo.planRemainingUsd = Math.max(0, this.accountInfo.planRemainingUsd - planDebit);
    remainingToDebit -= planDebit;

    // 2. Debit from topup balance
    const topupDebit = Math.min(this.accountInfo.topupRemainingUsd, remainingToDebit);
    this.accountInfo.topupRemainingUsd = Math.max(0, this.accountInfo.topupRemainingUsd - topupDebit);
    remainingToDebit -= topupDebit;

    const tx: BillingTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type: "debit",
      amountUsd: validAmount,
      planDebitedUsd: planDebit,
      topupDebitedUsd: topupDebit,
      reason,
    };

    this.transactions.push(tx);
    this.metrics.totalDebits++;
    this.metrics.totalSpendUsd += (planDebit + topupDebit);
    if (this.transactions.length > 200) {
      this.transactions.shift();
    }
    return tx;
  }

  public getTransactions(): BillingTransaction[] {
    return [...this.transactions];
  }

  public getMetrics(): BillingUsageMetrics {
    return { ...this.metrics };
  }

  public recordQuery(status: BillingUsageMetrics["lastStatus"]): void {
    this.metrics.totalQueries++;
    this.metrics.lastStatus = status;
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): BillingUsageWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      accountInfo: this.getAccountInfo(),
      transactions: this.getTransactions(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: BillingUsageWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.accountInfo = { ...snapshot.accountInfo };
    this.transactions = [...snapshot.transactions];
    this.metrics = { ...snapshot.metrics };
  }

  public clear(): void {
    this.config = { ...DEFAULT_BILLING_USAGE_CONFIG };
    this.accountInfo = { ...DEFAULT_BILLING_ACCOUNT_INFO };
    this.transactions = [];
    this.metrics = {
      totalQueries: 0,
      totalDebits: 0,
      totalCredits: 0,
      totalSpendUsd: 0,
      lastStatus: "free",
    };
  }
}
