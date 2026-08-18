/**
 * diagnostic-doctor-supervisor.ts
 *
 * Master supervisor coordinating system diagnostic audits, live subsystem probing,
 * orphaned session transcript salvage, and state integrity validation (Phase 97 / ADR-049).
 */

import type {
  DiagnosticCheckResult,
  SessionSalvageReport,
  SystemDiagnosticReport,
} from "../../../core/contracts/diagnostic-doctor.contracts.js";
import { DeterministicDiagnosticDoctor } from "../../../tooling/extensions/doctor/deterministic-diagnostic-doctor.js";
import { BroccoliDoctorSubstrate } from "../../../sessions/extensions/doctor/broccoli-doctor-substrate.js";

export class DiagnosticDoctorSupervisor {
  private doctor: DeterministicDiagnosticDoctor;
  private substrate: BroccoliDoctorSubstrate;

  constructor(
    doctor: DeterministicDiagnosticDoctor,
    substrate: BroccoliDoctorSubstrate
  ) {
    this.doctor = doctor;
    this.substrate = substrate;
  }

  /**
   * Executes a full system diagnostic audit and records the resulting report.
   */
  runDiagnostics(systemContext?: Record<string, unknown>): SystemDiagnosticReport {
    const report = this.doctor.runDiagnosticChecks(systemContext);
    this.substrate.recordReport(report);
    return report;
  }

  /**
   * Probes the health of a specific named subsystem.
   */
  probeSubsystem(subsystemName: string): DiagnosticCheckResult {
    return this.doctor.probeSubsystemHealth(subsystemName);
  }

  /**
   * Non-destructively repairs and salvages an orphaned or corrupted session transcript.
   */
  salvageSession(
    sessionId: string,
    rawTranscript: readonly Record<string, unknown>[]
  ): SessionSalvageReport {
    const salvage = this.doctor.salvageSessionTranscript(sessionId, rawTranscript);
    this.substrate.recordSalvage(salvage);
    return salvage;
  }

  /**
   * Retrieves the latest system diagnostic report.
   */
  getLatestReport(): SystemDiagnosticReport | undefined {
    return this.substrate.getLatestReport();
  }

  /**
   * Retrieves all session salvage audit records.
   */
  public getSalvages(): readonly SessionSalvageReport[] {
    return this.substrate.getSalvages();
  }

  public getAllReports(): readonly SystemDiagnosticReport[] {
    return this.substrate.listReports();
  }

  public auditHealth() {
    return this.substrate.auditHealth();
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getGroupedReports(groupBy?: any, sortBy?: any, direction?: any) {
    return this.substrate.getGroupedReports(groupBy, sortBy, direction);
  }

  public queryDsl(query: any) {
    return this.substrate.queryReportsDsl(query);
  }

  public bulkPurge(reportIds: readonly string[]) {
    return this.substrate.bulkPurgeReports(reportIds);
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

  public getSubstrate(): BroccoliDoctorSubstrate {
    return this.substrate;
  }
}
