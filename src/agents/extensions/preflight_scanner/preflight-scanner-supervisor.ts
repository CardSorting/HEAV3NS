/**
 * preflight-scanner-supervisor.ts
 *
 * Master supervisor coordinating pre-execution command scanning, policy enforcement,
 * fail-open circuit breakers, and binary supply-chain verification (Phase 113 / ADR-089 / Target #79).
 */

import type { BroccoliPreflightSubstrate } from "../../../sessions/extensions/preflight_scanner/broccoli-preflight-substrate.js";
import type { DeterministicPreflightScanner } from "./deterministic-preflight-scanner.js";
import type {
  PreflightDslQueryFilter,
  PreflightGroupBy,
  PreflightHealthAuditReport,
  PreflightMetrics,
  PreflightMetricsReport,
  PreflightScanResult,
  PreflightScanResultRow,
  PreflightSecurityPolicy,
  PreflightSortBy,
  PreflightSortDirection,
  SupplyChainVerificationResult,
} from "../../../core/contracts/preflight-scanner.contracts.js";

export class PreflightScannerSupervisor {
  private readonly substrate: BroccoliPreflightSubstrate;
  private readonly scanner: DeterministicPreflightScanner;

  constructor(
    substrate: BroccoliPreflightSubstrate,
    scanner: DeterministicPreflightScanner
  ) {
    this.substrate = substrate;
    this.scanner = scanner;
  }

  public getSubstrate(): BroccoliPreflightSubstrate {
    return this.substrate;
  }

  public getScanner(): DeterministicPreflightScanner {
    return this.scanner;
  }

  /**
   * Scan a shell command string prior to execution.
   */
  public scanCommand(command: string): PreflightScanResult {
    const policy = this.substrate.getPolicy();

    // 1. Check Circuit Breaker
    if (this.substrate.isCircuitBreakerTripped()) {
      if (policy.failOpen) {
        const fallbackResult: PreflightScanResult = {
          command,
          verdict: "allow",
          exitCode: 0,
          findings: [],
          scanDurationMs: 0.01,
          policyDecision: "fail_open_fallback",
        };
        this.substrate.recordScan(fallbackResult);
        return fallbackResult;
      } else {
        const blockedResult: PreflightScanResult = {
          command,
          verdict: "block",
          exitCode: 1,
          findings: [
            {
              category: "pipe_to_interpreter",
              severity: "critical",
              description: "Preflight security scanner circuit breaker is tripped and policy is fail-closed",
              matchedPattern: "circuit_breaker_tripped",
              remediation: "Inspect scanner health and call preflight_reset_circuit_breaker to clear.",
            },
          ],
          scanDurationMs: 0.01,
          policyDecision: "blocked",
        };
        this.substrate.recordScan(blockedResult);
        return blockedResult;
      }
    }

    // 2. Perform Threat Scan
    try {
      const result = this.scanner.scanCommand(command, policy);
      this.substrate.recordScan(result);
      this.substrate.recordScannerSuccess();
      return result;
    } catch {
      this.substrate.recordScannerFailure();
      if (policy.failOpen) {
        const errFallback: PreflightScanResult = {
          command,
          verdict: "allow",
          exitCode: 0,
          findings: [],
          scanDurationMs: 0.01,
          policyDecision: "fail_open_fallback",
        };
        this.substrate.recordScan(errFallback);
        return errFallback;
      } else {
        const errBlocked: PreflightScanResult = {
          command,
          verdict: "block",
          exitCode: 1,
          findings: [
            {
              category: "pipe_to_interpreter",
              severity: "critical",
              description: "Preflight scanner operational failure and policy is fail-closed",
              matchedPattern: "scanner_error",
              remediation: "Inspect error log or set failOpen to true.",
            },
          ],
          scanDurationMs: 0.01,
          policyDecision: "blocked",
        };
        this.substrate.recordScan(errBlocked);
        return errBlocked;
      }
    }
  }

  /**
   * Verify supply-chain binary provenance and Cosign workflow signatures.
   */
  public verifyBinaryProvenance(params: {
    binaryPath: string;
    content: string | Buffer;
    expectedSha256: string;
    cosignIssuer?: string;
    cosignIdentity?: string;
    allowedRepoPrefix?: string;
  }): SupplyChainVerificationResult {
    return this.scanner.verifySupplyChainProvenance(params);
  }

  /**
   * Configure security policy.
   */
  public configurePolicy(policy: Partial<PreflightSecurityPolicy>): PreflightSecurityPolicy {
    this.substrate.setPolicy(policy);
    return this.substrate.getPolicy();
  }

  /**
   * Get active security policy.
   */
  public getPolicy(): PreflightSecurityPolicy {
    return this.substrate.getPolicy();
  }

  /**
   * Get security scanner status & metrics.
   */
  public getSecurityStatus() {
    const policy = this.substrate.getPolicy();
    const metrics = this.substrate.getMetrics();
    const recentScans = this.substrate.getRecentScans(5);

    return {
      policy,
      metrics,
      circuitBreakerTripped: this.substrate.isCircuitBreakerTripped(),
      recentScans,
    };
  }

  public getMetrics(): PreflightMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): PreflightMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public auditHealth(): PreflightHealthAuditReport {
    return this.substrate.auditHealth();
  }

  /**
   * Reset circuit breaker.
   */
  public resetCircuitBreaker(): void {
    this.substrate.resetCircuitBreaker();
  }

  /**
   * Get recent scan history.
   */
  public getScanHistory(limit = 20): readonly PreflightScanResult[] {
    return this.substrate.getRecentScans(limit);
  }

  public getGroupedScans(groupBy?: PreflightGroupBy, sortBy?: PreflightSortBy, direction?: PreflightSortDirection) {
    return this.substrate.getGroupedScans(groupBy, sortBy, direction);
  }

  public queryDsl(query: PreflightDslQueryFilter | string): readonly PreflightScanResultRow[] {
    return this.substrate.queryScansDsl(query);
  }

  public bulkPurge(ids: readonly string[]) {
    return this.substrate.bulkPurgeScans(ids);
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
}
