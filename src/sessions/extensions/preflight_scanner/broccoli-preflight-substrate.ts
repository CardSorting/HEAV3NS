/**
 * broccoli-preflight-substrate.ts
 *
 * In-memory Broccolidb repository maintaining pre-flight command security scan history,
 * active threat findings, security policy configurations, and circuit breaker metrics
 * (Phase 113 / ADR-089 / Target #46).
 */

import type {
  PreflightScanResult,
  PreflightSecurityPolicy,
  PreflightWorkspaceSnapshot,
} from "../../../core/contracts/preflight-scanner.contracts.js";

export class BroccoliPreflightSubstrate {
  private readonly scanHistory: PreflightScanResult[] = [];
  private policy: PreflightSecurityPolicy = {
    enabled: true,
    failOpen: true,
    timeoutMs: 5000,
    circuitBreakerLimit: 3,
    blockedCategories: [
      "pipe_to_interpreter",
      "base64_execution",
      "terminal_injection",
      "credential_scraping",
      "dangerous_permission",
      "homograph_url",
    ],
  };

  private consecutiveFailures = 0;
  private breakerTripped = false;
  private totalScans = 0;
  private totalBlocked = 0;
  private totalWarned = 0;

  // Policy Management
  public getPolicy(): PreflightSecurityPolicy {
    return { ...this.policy, blockedCategories: [...this.policy.blockedCategories] };
  }

  public setPolicy(policy: Partial<PreflightSecurityPolicy>): void {
    this.policy = {
      ...this.policy,
      ...policy,
      blockedCategories: policy.blockedCategories
        ? [...policy.blockedCategories]
        : [...this.policy.blockedCategories],
    };
  }

  // Scan History
  public recordScan(result: PreflightScanResult): void {
    this.scanHistory.push(result);
    this.totalScans++;
    if (result.verdict === "block") {
      this.totalBlocked++;
    } else if (result.verdict === "warn") {
      this.totalWarned++;
    }
  }

  public getScanHistory(): readonly PreflightScanResult[] {
    return [...this.scanHistory];
  }

  public getRecentScans(limit = 10): readonly PreflightScanResult[] {
    return this.scanHistory.slice(-limit);
  }

  // Circuit Breaker Operations
  public recordScannerSuccess(): void {
    this.consecutiveFailures = 0;
    this.breakerTripped = false;
  }

  public recordScannerFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.policy.circuitBreakerLimit) {
      this.breakerTripped = true;
    }
  }

  public isCircuitBreakerTripped(): boolean {
    return this.breakerTripped;
  }

  public resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.breakerTripped = false;
  }

  // Metrics
  public getMetrics() {
    return {
      totalScans: this.totalScans,
      totalBlocked: this.totalBlocked,
      totalWarned: this.totalWarned,
      historyCount: this.scanHistory.length,
      consecutiveFailures: this.consecutiveFailures,
      breakerTripped: this.breakerTripped,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): PreflightWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      policy: { ...this.policy, blockedCategories: [...this.policy.blockedCategories] },
      scanHistory: [...this.scanHistory],
      breakerTripped: this.breakerTripped,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  public restoreSnapshot(snapshot: PreflightWorkspaceSnapshot): void {
    this.policy = {
      ...snapshot.policy,
      blockedCategories: [...snapshot.policy.blockedCategories],
    };
    this.scanHistory.length = 0;
    this.scanHistory.push(...snapshot.scanHistory);
    this.breakerTripped = snapshot.breakerTripped;
    this.consecutiveFailures = snapshot.consecutiveFailures;
  }

  public clear(): void {
    this.scanHistory.length = 0;
    this.consecutiveFailures = 0;
    this.breakerTripped = false;
    this.totalScans = 0;
    this.totalBlocked = 0;
    this.totalWarned = 0;
  }
}
