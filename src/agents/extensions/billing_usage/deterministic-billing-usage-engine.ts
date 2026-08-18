/**
 * deterministic-billing-usage-engine.ts
 *
 * Pure TypeScript USD Precision Math, Renewal Date Formatter, Dual Usage Bar Calculator
 * & Account Status Classifier (Phase 132 / ADR-108 / Target #65).
 */

import type {
  AccountStatus,
  BillingAccountInfo,
  BillingUsageConfig,
  UsageBarDescriptor,
  UsageModelDescriptor,
} from "../../../core/contracts/billing-usage.contracts.js";

export class DeterministicBillingUsageEngine {
  /**
   * Formats a finite number as USD string "$X.YY".
   */
  public formatUsd(value: number | undefined | null, symbol = "$"): string {
    if (value === undefined || value === null || !Number.isFinite(value)) {
      return `${symbol}0.00`;
    }
    return `${symbol}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Formats an ISO timestamp or date into a human readable string, e.g. "Jul 24, 2026".
   */
  public formatRenews(isoString?: string): string | undefined {
    if (!isoString || typeof isoString !== "string" || !isoString.trim()) {
      return undefined;
    }
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) {
        return isoString;
      }
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    } catch {
      return isoString;
    }
  }

  /**
   * Builds the dual usage model (plan bar + topup bar) from account info and config.
   */
  public buildUsageModel(
    accountInfo: BillingAccountInfo,
    config: BillingUsageConfig
  ): UsageModelDescriptor {
    const planAllowance = Math.max(0, accountInfo.planAllowanceUsd || 0);
    const planRemaining = Math.max(0, accountInfo.planRemainingUsd || 0);
    const planSpent = Math.max(0, planAllowance - planRemaining);
    const topupRemaining = Math.max(0, accountInfo.topupRemainingUsd || 0);
    const totalSpendable = planRemaining + topupRemaining;

    // Classify account status
    let status: AccountStatus = "free";
    if (accountInfo.isPaidPlan) {
      if (totalSpendable <= 0) {
        status = "exhausted";
      } else if (totalSpendable < config.lowBalanceThresholdUsd) {
        status = "low_balance";
      } else {
        status = "active_paid";
      }
    } else {
      if (topupRemaining > 0) {
        status = topupRemaining < config.lowBalanceThresholdUsd ? "low_balance" : "active_paid";
      } else {
        status = "free";
      }
    }

    const isLowBalance = (status === "low_balance" || status === "exhausted");

    // Plan Bar
    let planBar: UsageBarDescriptor | undefined = undefined;
    if (accountInfo.isPaidPlan && planAllowance > 0) {
      const pctUsed = Math.min(100, Math.max(0, Math.round((planSpent / planAllowance) * 100)));
      const fillFraction = Math.min(1.0, Math.max(0.0, planRemaining / planAllowance));
      planBar = {
        kind: "plan",
        remainingUsd: planRemaining,
        totalUsd: planAllowance,
        spentUsd: planSpent,
        pctUsed,
        fillFraction,
      };
    }

    // Top-up Bar
    let topupBar: UsageBarDescriptor | undefined = undefined;
    if (topupRemaining > 0) {
      topupBar = {
        kind: "topup",
        remainingUsd: topupRemaining,
        totalUsd: topupRemaining,
        spentUsd: 0,
        fillFraction: 1.0,
      };
    }

    return {
      status,
      planAllowanceUsd: planAllowance,
      planRemainingUsd: planRemaining,
      planSpentUsd: planSpent,
      topupRemainingUsd: topupRemaining,
      totalSpendableUsd: totalSpendable,
      renewalIso: accountInfo.periodEndIso,
      renewalFormatted: this.formatRenews(accountInfo.periodEndIso),
      isLowBalance,
      planBar,
      topupBar,
    };
  }

  /**
   * Renders an ASCII usage bar representation for CLI/TUI surfaces.
   */
  public renderAsciiBar(fraction: number, width = 20, fillGlyph = "█", emptyGlyph = "░"): string {
    const clamped = Math.min(1.0, Math.max(0.0, fraction));
    const fillCount = Math.round(clamped * width);
    const emptyCount = width - fillCount;
    return fillGlyph.repeat(fillCount) + emptyGlyph.repeat(emptyCount);
  }

  /**
   * Calculates a two-tier priority debit across plan allowance first, then top-up balance.
   */
  public calculateDebit(
    accountInfo: BillingAccountInfo,
    amountUsd: number
  ): {
    success: boolean;
    planDebitedUsd: number;
    topupDebitedUsd: number;
    newPlanRemainingUsd: number;
    newTopupRemainingUsd: number;
    error?: string;
  } {
    if (amountUsd <= 0) {
      return {
        success: true,
        planDebitedUsd: 0,
        topupDebitedUsd: 0,
        newPlanRemainingUsd: accountInfo.planRemainingUsd,
        newTopupRemainingUsd: accountInfo.topupRemainingUsd,
      };
    }

    const currentPlan = Math.max(0, accountInfo.planRemainingUsd);
    const currentTopup = Math.max(0, accountInfo.topupRemainingUsd);
    const totalSpendable = currentPlan + currentTopup;

    if (amountUsd > totalSpendable) {
      return {
        success: false,
        planDebitedUsd: 0,
        topupDebitedUsd: 0,
        newPlanRemainingUsd: currentPlan,
        newTopupRemainingUsd: currentTopup,
        error: `Insufficient funds: requested $${amountUsd.toFixed(4)}, but total spendable is only $${totalSpendable.toFixed(4)}`,
      };
    }

    let planDebited = 0;
    let topupDebited = 0;

    if (currentPlan >= amountUsd) {
      planDebited = amountUsd;
    } else {
      planDebited = currentPlan;
      topupDebited = amountUsd - currentPlan;
    }

    return {
      success: true,
      planDebitedUsd: Number(planDebited.toFixed(4)),
      topupDebitedUsd: Number(topupDebited.toFixed(4)),
      newPlanRemainingUsd: Number((currentPlan - planDebited).toFixed(4)),
      newTopupRemainingUsd: Number((currentTopup - topupDebited).toFixed(4)),
    };
  }

  /**
   * Calculates balance after applying a top-up credit.
   */
  public calculateTopup(
    accountInfo: BillingAccountInfo,
    creditUsd: number
  ): { newTopupRemainingUsd: number } {
    const currentTopup = Math.max(0, accountInfo.topupRemainingUsd);
    return {
      newTopupRemainingUsd: Number((currentTopup + Math.max(0, creditUsd)).toFixed(4)),
    };
  }

  /**
   * Calculates balance after refreshing monthly plan allowance.
   */
  public calculatePlanRefresh(
    accountInfo: BillingAccountInfo,
    newAllowanceUsd?: number
  ): { newPlanRemainingUsd: number; newPlanAllowanceUsd: number } {
    const allowance = newAllowanceUsd !== undefined ? Math.max(0, newAllowanceUsd) : accountInfo.planAllowanceUsd;
    return {
      newPlanAllowanceUsd: allowance,
      newPlanRemainingUsd: allowance,
    };
  }
}
