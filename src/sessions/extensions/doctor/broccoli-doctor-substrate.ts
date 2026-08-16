/**
 * broccoli-doctor-substrate.ts
 *
 * In-memory Broccolidb repository for diagnostic reports, session salvage audit records,
 * and live health probe metrics (Phase 97 / ADR-049).
 */

import type {
  DoctorWorkspaceSnapshot,
  SessionSalvageReport,
  SystemDiagnosticReport,
} from "../../../core/contracts/diagnostic-doctor.contracts.js";

export class BroccoliDoctorSubstrate {
  private reports: SystemDiagnosticReport[];
  private salvages: SessionSalvageReport[];

  constructor() {
    this.reports = [];
    this.salvages = [];
  }

  recordReport(report: SystemDiagnosticReport): void {
    this.reports.push(report);
    if (this.reports.length > 100) {
      this.reports.shift();
    }
  }

  getLatestReport(): SystemDiagnosticReport | undefined {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : undefined;
  }

  recordSalvage(salvage: SessionSalvageReport): void {
    this.salvages.push(salvage);
    if (this.salvages.length > 200) {
      this.salvages.shift();
    }
  }

  getSalvages(): readonly SessionSalvageReport[] {
    return this.salvages;
  }

  exportSnapshot(): DoctorWorkspaceSnapshot {
    return {
      totalReports: this.reports.length,
      latestReport: this.getLatestReport(),
      totalSalvages: this.salvages.length,
      activeSalvages: [...this.salvages],
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: DoctorWorkspaceSnapshot): void {
    this.reports = snapshot.latestReport ? [snapshot.latestReport] : [];
    this.salvages = [...snapshot.activeSalvages];
  }

  clear(): void {
    this.reports = [];
    this.salvages = [];
  }
}
