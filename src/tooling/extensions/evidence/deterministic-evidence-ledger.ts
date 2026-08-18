/**
 * deterministic-evidence-ledger.ts
 *
 * In-memory zero-GC coding verification evidence ledger & stop-gate evaluator (Phase 92 / ADR-044).
 */

import type {
  EvidenceKind,
  EvidenceScope,
  SessionInsightsReport,
  VerificationEvidenceRecord,
  VerificationStopGateEvaluation,
} from "../../../core/contracts/verification-evidence.contracts.js";

const NON_CODE_EXTENSIONS = new Set<string>([
  ".md",
  ".markdown",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".rst",
  ".adoc",
  ".log",
  ".csv",
  ".tsv",
]);

const NON_CODE_FILENAMES = new Set<string>([
  "license",
  "licence",
  "notice",
  "authors",
  "contributors",
  "changelog",
  "codeowners",
  "agents.md",
  "soul.md",
]);

export class DeterministicEvidenceLedger {
  private records: (VerificationEvidenceRecord & { sequence: number })[];
  private modifiedFiles: Map<string, number>;
  private globalSequence: number;

  constructor() {
    this.records = [];
    this.modifiedFiles = new Map<string, number>();
    this.globalSequence = 0;
  }

  /**
   * Returns true if the file path represents actionable source code.
   */
  isCodeFile(filePath: string): boolean {
    const normalized = filePath.trim().toLowerCase();
    const basename = normalized.split(/[/\\]/).pop() ?? "";

    if (NON_CODE_FILENAMES.has(basename)) {
      return false;
    }

    const dotIndex = basename.lastIndexOf(".");
    if (dotIndex !== -1) {
      const ext = basename.substring(dotIndex);
      if (NON_CODE_EXTENSIONS.has(ext)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Records a modified file in the active turn.
   */
  recordModifiedFile(filePath: string): void {
    if (this.isCodeFile(filePath)) {
      this.globalSequence++;
      this.modifiedFiles.set(filePath, this.globalSequence);
    }
  }

  /**
   * Records a verification evidence entry.
   */
  recordEvidence(
    entry: Omit<VerificationEvidenceRecord, "id" | "timestamp">
  ): VerificationEvidenceRecord {
    this.globalSequence++;
    const record: VerificationEvidenceRecord & { sequence: number } = {
      ...entry,
      id: `evid-${this.globalSequence}-${Date.now()}`,
      sequence: this.globalSequence,
      timestamp: Date.now(),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Evaluates if turn completion is safe or if a verification nudge is required.
   */
  evaluateStopGate(): VerificationStopGateEvaluation {
    const unverified: string[] = [];

    for (const [mod, modSeq] of this.modifiedFiles.entries()) {
      const hasVerified = this.records.some(
        (r) =>
          r.passed &&
          r.sequence > modSeq &&
          (r.scope === "workspace" ||
            r.verifiedPaths.some((p) => p === mod || mod.endsWith(p) || p.endsWith(mod)))
      );

      if (!hasVerified) {
        unverified.push(mod);
      }
    }

    const latestEvidence = this.records.length > 0 ? this.records[this.records.length - 1] : undefined;

    if (unverified.length > 0) {
      return {
        shouldNudge: true,
        reason: `Modified ${unverified.length} code file(s) without fresh passing verification evidence.`,
        unverifiedModifiedFiles: unverified,
        latestEvidence,
      };
    }

    return {
      shouldNudge: false,
      reason: "All modified code files are covered by passing verification evidence.",
      unverifiedModifiedFiles: [],
      latestEvidence,
    };
  }

  /**
   * Generates comprehensive session insights report.
   */
  generateInsightsReport(totalFrames: number = 1): SessionInsightsReport {
    let passedCount = 0;
    let failedCount = 0;
    const byKind: Record<EvidenceKind, number> = {
      test: 0,
      build: 0,
      typecheck: 0,
      lint: 0,
      manual: 0,
    };

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
      byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    }

    const stopGate = this.evaluateStopGate();

    return {
      totalFrames,
      totalEvidenceCount: this.records.length,
      passedEvidenceCount: passedCount,
      failedEvidenceCount: failedCount,
      evidenceByKind: byKind,
      unverifiedCodeFiles: stopGate.unverifiedModifiedFiles,
    };
  }

  /**
   * Returns all recorded evidence entries.
   */
  getRecords(): readonly VerificationEvidenceRecord[] {
    return this.records;
  }

  /**
   * Returns all currently modified code files.
   */
  getModifiedCodeFiles(): readonly string[] {
    return Array.from(this.modifiedFiles.keys());
  }

  /**
   * Clears state.
   */
  reset(): void {
    this.records = [];
    this.modifiedFiles.clear();
    this.globalSequence = 0;
  }

  public formatEvidence(record: VerificationEvidenceRecord): string {
    const status = record.passed ? "PASSED" : "FAILED";
    return `[${record.kind.toUpperCase()}:${record.scope.toUpperCase()}] ${record.command} - ${status} (${record.durationMs}ms, exit ${record.exitCode})`;
  }

  public formatEvaluation(evalResult: VerificationStopGateEvaluation): string {
    const nudge = evalResult.shouldNudge ? "NUDGE" : "PASS";
    return `[STOP-GATE:${nudge}] ${evalResult.reason} (${evalResult.unverifiedModifiedFiles.length} unverified files)`;
  }
}
