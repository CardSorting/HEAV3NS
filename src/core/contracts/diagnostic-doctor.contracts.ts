/**
 * diagnostic-doctor.contracts.ts
 *
 * Core contracts for Diagnostic Doctor, Live Health Probing, Orphaned Session Salvage,
 * and State Integrity Substrate (Phase 97 / ADR-049).
 */

export type DiagnosticSeverity = "healthy" | "warning" | "critical" | "fatal";

export type DiagnosticCheckCategory = "memory" | "vfs" | "tools" | "providers" | "snapshots" | "integrity";

export interface DiagnosticCheckResult {
  readonly checkId: string;
  readonly category: DiagnosticCheckCategory;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface SystemDiagnosticReport {
  readonly reportId: string;
  readonly overallHealth: DiagnosticSeverity;
  readonly totalChecks: number;
  readonly healthyCount: number;
  readonly warningCount: number;
  readonly criticalCount: number;
  readonly fatalCount: number;
  readonly checks: readonly DiagnosticCheckResult[];
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface OrphanedTurnRepairItem {
  readonly turnIndex: number;
  readonly issue: "missing_assistant_response" | "dangling_tool_call" | "corrupt_payload";
  readonly repairedContent: string;
  readonly actionTaken: string;
}

export interface SessionSalvageReport {
  readonly sessionId: string;
  readonly totalTurnsExamined: number;
  readonly repairedTurnsCount: number;
  readonly repairs: readonly OrphanedTurnRepairItem[];
  readonly salvagedTranscript: readonly Record<string, unknown>[];
  readonly success: boolean;
  readonly timestamp: number;
}

export interface DoctorWorkspaceSnapshot {
  readonly totalReports: number;
  readonly latestReport?: SystemDiagnosticReport;
  readonly totalSalvages: number;
  readonly activeSalvages: readonly SessionSalvageReport[];
  readonly timestamp: number;
}
