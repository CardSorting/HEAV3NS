/**
 * broccoli-cost-substrate.ts
 *
 * In-memory Broccolidb repository for model pricing catalogs, per-turn usage ledgers,
 * and session budget metrics (Phase 90 / ADR-042).
 */

import type {
  CostGovernanceWorkspaceSnapshot,
  TokenUsageLedgerEntry,
} from "../../../core/contracts/cost-governance.contracts.js";

export class BroccoliCostSubstrate {
  private ledger: TokenUsageLedgerEntry[];
  private totalTokens: number;
  private totalPromptTokens: number;
  private totalCompletionTokens: number;
  private totalCachedPromptTokens: number;
  private totalCostMicroCents: number;
  private hardCapBreached: boolean;

  constructor() {
    this.ledger = [];
    this.totalTokens = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCachedPromptTokens = 0;
    this.totalCostMicroCents = 0;
    this.hardCapBreached = false;
  }

  recordTurnUsage(entry: TokenUsageLedgerEntry): void {
    this.ledger.push(entry);
    this.totalPromptTokens += entry.promptTokens;
    this.totalCompletionTokens += entry.completionTokens;
    this.totalCachedPromptTokens += entry.cachedPromptTokens;
    this.totalTokens = this.totalPromptTokens + this.totalCompletionTokens;
    this.totalCostMicroCents += entry.estimatedCostMicroCents;

    if (this.ledger.length > 500) {
      this.ledger.shift();
    }
  }

  setHardCapBreached(breached: boolean): void {
    this.hardCapBreached = breached;
  }

  getTotalMicroCents(): number {
    return this.totalCostMicroCents;
  }

  listLedger(limit: number = 20): readonly TokenUsageLedgerEntry[] {
    return this.ledger.slice(-limit);
  }

  exportSnapshot(): CostGovernanceWorkspaceSnapshot {
    const totalCostUsd = Number((this.totalCostMicroCents / 1_000_000).toFixed(6));
    const formattedTotalCostLabel =
      totalCostUsd < 0.01
        ? totalCostUsd <= 0
          ? "$0.00"
          : `~$${totalCostUsd.toFixed(4)}`
        : `~$${totalCostUsd.toFixed(2)}`;

    return {
      totalTokens: this.totalTokens,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalCachedPromptTokens: this.totalCachedPromptTokens,
      totalCostMicroCents: this.totalCostMicroCents,
      totalCostUsd,
      formattedTotalCostLabel,
      totalTurns: this.ledger.length,
      hardCapBreached: this.hardCapBreached,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: CostGovernanceWorkspaceSnapshot): void {
    this.totalTokens = snapshot.totalTokens;
    this.totalPromptTokens = snapshot.totalPromptTokens;
    this.totalCompletionTokens = snapshot.totalCompletionTokens;
    this.totalCachedPromptTokens = snapshot.totalCachedPromptTokens;
    this.totalCostMicroCents = snapshot.totalCostMicroCents;
    this.hardCapBreached = snapshot.hardCapBreached;
    this.ledger = this.ledger.slice(0, snapshot.totalTurns);
  }

  clear(): void {
    this.ledger = [];
    this.totalTokens = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCachedPromptTokens = 0;
    this.totalCostMicroCents = 0;
    this.hardCapBreached = false;
  }
}
