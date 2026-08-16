/**
 * verification-evidence-supervisor.ts
 *
 * Master Verification Evidence Supervisor coordinating evidence recording,
 * stop-gate turn completion evaluation, and epistemic insights reporting (Phase 92 / ADR-044).
 */

import type {
  SessionInsightsReport,
  VerificationEvidenceRecord,
  VerificationStopGateEvaluation,
} from "../../../core/contracts/verification-evidence.contracts.js";
import { DeterministicEvidenceLedger } from "../../../tooling/extensions/evidence/deterministic-evidence-ledger.js";
import { BroccoliEvidenceSubstrate } from "../../../sessions/extensions/evidence/broccoli-evidence-substrate.js";

export class VerificationEvidenceSupervisor {
  private ledger: DeterministicEvidenceLedger;
  private substrate: BroccoliEvidenceSubstrate;

  constructor(
    ledger: DeterministicEvidenceLedger,
    substrate: BroccoliEvidenceSubstrate
  ) {
    this.ledger = ledger;
    this.substrate = substrate;
  }

  /**
   * Records a verification evidence entry.
   */
  recordEvidence(
    entry: Omit<VerificationEvidenceRecord, "id" | "timestamp">
  ): VerificationEvidenceRecord {
    const record = this.ledger.recordEvidence(entry);
    this.substrate.addRecord(record);
    return record;
  }

  /**
   * Tracks a modified file in the active turn.
   */
  trackFileModification(filePath: string): void {
    this.ledger.recordModifiedFile(filePath);
    if (this.ledger.isCodeFile(filePath)) {
      this.substrate.addModifiedFile(filePath);
    }
  }

  /**
   * Evaluates if turn completion is safe or requires a verification nudge.
   */
  checkStopGate(): VerificationStopGateEvaluation {
    return this.ledger.evaluateStopGate();
  }

  /**
   * Generates a comprehensive session verification insights report.
   */
  getInsights(totalFrames: number = 1): SessionInsightsReport {
    return this.ledger.generateInsightsReport(totalFrames);
  }

  /**
   * Returns all recorded evidence.
   */
  getRecords(): readonly VerificationEvidenceRecord[] {
    return this.substrate.getRecords();
  }

  /**
   * Returns all modified code files.
   */
  getModifiedFiles(): readonly string[] {
    return this.substrate.getModifiedFiles();
  }
}
