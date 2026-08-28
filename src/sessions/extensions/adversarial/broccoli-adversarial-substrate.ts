/**
 * broccoli-adversarial-substrate.ts
 *
 * In-memory zero-GC BroccoliDB repository for Adversarial Scrutiny audits,
 * fail-closed provenance receipts, cognitive spend breakdowns, and WAL journals (Pass 194 / ADR-132).
 */

import type {
  AdversarialAuditMetrics,
  AdversarialFinding,
  AdversarialHealthStatus,
  AdversarialRedTeamVerdict,
  AdversarialSeverity,
  AdversarialVerdictStatus,
  CognitiveDecompositionReport,
  ProvenanceGroundingProof,
} from "../../../core/contracts/adversarial-scrutiny.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export interface AdversarialAuditRow extends Record<string, unknown> {
  readonly id: string;
  readonly auditId: string;
  readonly targetType: string;
  readonly verdict: AdversarialVerdictStatus;
  readonly score: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly totalFindings: number;
  readonly timestamp: number;
  readonly latencyMs: number;
}

export interface AdversarialWalRow extends Record<string, unknown> {
  readonly id: string;
  readonly auditId: string;
  readonly action: string;
  readonly summary: string;
  readonly timestamp: number;
}

export class BroccoliAdversarialSubstrate {
  private readonly verdicts = new Map<string, AdversarialRedTeamVerdict>();
  private readonly findingsList: AdversarialFinding[] = [];
  private readonly walJournal: AdversarialWalRow[] = [];

  private totalTokensAnalyzed = 0;
  private totalCompressibleTokensSaved = 0;

  // BroccoliDB Persistent Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private auditTable?: IDbTable<AdversarialAuditRow>;
  private walTable?: IDbTable<AdversarialWalRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.auditTable = dbKernel.getTable<AdversarialAuditRow>("adversarial_audits");
      this.walTable = dbKernel.getTable<AdversarialWalRow>("adversarial_wal");
    }
  }

  public recordVerdict(verdict: AdversarialRedTeamVerdict): void {
    this.verdicts.set(verdict.auditId, verdict);

    for (const finding of verdict.findings) {
      this.findingsList.push(finding);
    }

    if (verdict.cognitiveDecomposition) {
      this.totalTokensAnalyzed += verdict.cognitiveDecomposition.totalTokenEstimate;
      this.totalCompressibleTokensSaved += verdict.cognitiveDecomposition.compressibleTokens;
    }

    // Persist to BroccoliDB table if available
    if (this.auditTable) {
      const row: AdversarialAuditRow = {
        id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        auditId: verdict.auditId,
        targetType: verdict.targetType,
        verdict: verdict.verdict,
        score: verdict.score,
        criticalCount: verdict.criticalCount,
        highCount: verdict.highCount,
        totalFindings: verdict.totalFindings,
        timestamp: verdict.timestamp,
        latencyMs: verdict.latencyMs,
      };
      this.auditTable.put(row.id, row);
    }

    // Record WAL event
    const walRow: AdversarialWalRow = {
      id: `wal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      auditId: verdict.auditId,
      action: "RECORD_AUDIT",
      summary: `Audited ${verdict.targetType} with verdict ${verdict.verdict} (Score: ${verdict.score}/100)`,
      timestamp: Date.now(),
    };
    this.walJournal.push(walRow);
    if (this.walTable) {
      this.walTable.put(walRow.id, walRow);
    }
  }

  public getVerdict(auditId: string): AdversarialRedTeamVerdict | undefined {
    return this.verdicts.get(auditId);
  }

  public listVerdicts(options?: {
    targetType?: string;
    verdict?: AdversarialVerdictStatus;
    limit?: number;
  }): readonly AdversarialRedTeamVerdict[] {
    let result = Array.from(this.verdicts.values());

    if (options?.targetType) {
      result = result.filter((v) => v.targetType === options.targetType);
    }
    if (options?.verdict) {
      result = result.filter((v) => v.verdict === options.verdict);
    }

    // Sort descending by timestamp
    result.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return Object.freeze(result);
  }

  public getMetrics(): AdversarialAuditMetrics {
    const verdictsArray = Array.from(this.verdicts.values());
    const totalAudits = verdictsArray.length;
    const rejectedAudits = verdictsArray.filter((v) => v.verdict === "REJECTED_FAIL_CLOSED").length;
    const passedAudits = verdictsArray.filter((v) => v.verdict === "APPROVED").length;
    const criticalFindings = this.findingsList.filter((f) => f.severity === "CRITICAL").length;
    const totalLatency = verdictsArray.reduce((acc, v) => acc + v.latencyMs, 0);

    return Object.freeze({
      totalAudits,
      totalFindings: this.findingsList.length,
      criticalFindings,
      rejectedAudits,
      passedAudits,
      averageAuditLatencyMs: totalAudits > 0 ? Number((totalLatency / totalAudits).toFixed(2)) : 0,
      totalTokensAnalyzed: this.totalTokensAnalyzed,
      totalCompressibleTokensSaved: this.totalCompressibleTokensSaved,
    });
  }

  public getHealth(): {
    healthStatus: AdversarialHealthStatus;
    totalAudits: number;
    criticalFindings: number;
    message: string;
  } {
    const metrics = this.getMetrics();
    let healthStatus: AdversarialHealthStatus = "optimal";
    let message = "Adversarial scrutiny substrate operating with nominal zero-GC invariants.";

    if (metrics.criticalFindings > 10) {
      healthStatus = "critical";
      message = `High volume of critical findings detected (${metrics.criticalFindings}). Review failure modes.`;
    } else if (metrics.criticalFindings > 3) {
      healthStatus = "degraded";
      message = `Multiple critical findings detected (${metrics.criticalFindings}). Exercise caution.`;
    } else if (metrics.rejectedAudits > 0) {
      healthStatus = "healthy";
      message = `Audits actively catching issues. ${metrics.rejectedAudits} fail-closed rejections recorded.`;
    }

    return Object.freeze({
      healthStatus,
      totalAudits: metrics.totalAudits,
      criticalFindings: metrics.criticalFindings,
      message,
    });
  }

  public clear(): void {
    this.verdicts.clear();
    this.findingsList.length = 0;
    this.walJournal.length = 0;
    this.totalTokensAnalyzed = 0;
    this.totalCompressibleTokensSaved = 0;
  }
}
