/**
 * broccoli-evidence-substrate.ts
 *
 * In-memory Broccolidb repository for verification evidence records and modified file ledgers (Phase 92 / ADR-044).
 */

import type {
  VerificationEvidenceRecord,
  VerificationEvidenceWorkspaceSnapshot,
} from "../../../core/contracts/verification-evidence.contracts.js";

export class BroccoliEvidenceSubstrate {
  private records: VerificationEvidenceRecord[];
  private modifiedFiles: Set<string>;

  constructor() {
    this.records = [];
    this.modifiedFiles = new Set<string>();
  }

  addRecord(record: VerificationEvidenceRecord): void {
    this.records.push(record);
  }

  addModifiedFile(filePath: string): void {
    this.modifiedFiles.add(filePath);
  }

  getRecords(): readonly VerificationEvidenceRecord[] {
    return this.records;
  }

  getModifiedFiles(): readonly string[] {
    return Array.from(this.modifiedFiles);
  }

  exportSnapshot(): VerificationEvidenceWorkspaceSnapshot {
    return {
      totalRecords: this.records.length,
      records: [...this.records],
      modifiedCodeFiles: Array.from(this.modifiedFiles),
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: VerificationEvidenceWorkspaceSnapshot): void {
    this.records = [...snapshot.records];
    this.modifiedFiles.clear();
    for (let i = 0; i < snapshot.modifiedCodeFiles.length; i++) {
      this.modifiedFiles.add(snapshot.modifiedCodeFiles[i]);
    }
  }

  clear(): void {
    this.records = [];
    this.modifiedFiles.clear();
  }
}
