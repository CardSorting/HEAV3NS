/**
 * broccoli-heredoc-terminal-substrate.ts
 *
 * In-memory Broccolidb substrate repository maintaining sanitization event logs,
 * safety evaluation verdicts, diagnostic histories, and performance metrics
 * (Phase 110 / ADR-086 / Target #43).
 */

import type {
  HeredocSanitizationLogRecord,
  TerminalExecutionDiagnostics,
  HeredocTerminalWorkspaceSnapshot,
  CommandSafetyClassification,
  HeredocSanitizationResult,
} from "../../../core/contracts/heredoc-terminal.contracts.js";

export class BroccoliHeredocTerminalSubstrate {
  private readonly sanitizationLogs: HeredocSanitizationLogRecord[] = [];
  private readonly diagnosticsLogs: TerminalExecutionDiagnostics[] = [];
  private readonly safetyVerdicts: CommandSafetyClassification[] = [];

  private totalSanitizations = 0;
  private totalMaskedBodies = 0;
  private totalDangerousCommandsBlocked = 0;
  private totalDiagnosticsGenerated = 0;

  private maxLogCapacity = 5000;

  constructor(maxLogCapacity = 5000) {
    this.maxLogCapacity = maxLogCapacity;
  }

  public recordSanitization(result: HeredocSanitizationResult, safety: CommandSafetyClassification): void {
    this.totalSanitizations++;
    this.totalMaskedBodies += result.maskedBodiesCount;
    if (safety.riskLevel === "blocked") {
      this.totalDangerousCommandsBlocked++;
    }

    const logRecord: HeredocSanitizationLogRecord = {
      recordId: `san-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      commandLength: result.originalCommand.length,
      maskedBodiesCount: result.maskedBodiesCount,
      hadAmbiguity: result.hadAmbiguity,
      latencyMs: result.latencyMs,
      riskLevel: safety.riskLevel,
    };

    this.sanitizationLogs.push(logRecord);
    this.safetyVerdicts.push(safety);

    if (this.sanitizationLogs.length > this.maxLogCapacity) {
      this.sanitizationLogs.splice(0, this.sanitizationLogs.length - this.maxLogCapacity);
    }
    if (this.safetyVerdicts.length > this.maxLogCapacity) {
      this.safetyVerdicts.splice(0, this.safetyVerdicts.length - this.maxLogCapacity);
    }
  }

  public recordDiagnostics(diag: TerminalExecutionDiagnostics): void {
    this.totalDiagnosticsGenerated++;
    this.diagnosticsLogs.push(diag);
    if (this.diagnosticsLogs.length > this.maxLogCapacity) {
      this.diagnosticsLogs.splice(0, this.diagnosticsLogs.length - this.maxLogCapacity);
    }
  }

  public getMetrics() {
    return {
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      loggedSanitizationsCount: this.sanitizationLogs.length,
      loggedDiagnosticsCount: this.diagnosticsLogs.length,
    };
  }

  public getRecentLogs(limit = 50): readonly HeredocSanitizationLogRecord[] {
    return this.sanitizationLogs.slice(-limit);
  }

  public getRecentDiagnostics(limit = 50): readonly TerminalExecutionDiagnostics[] {
    return this.diagnosticsLogs.slice(-limit);
  }

  public createSnapshot(snapshotId: string): HeredocTerminalWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      totalSanitizations: this.totalSanitizations,
      totalMaskedBodies: this.totalMaskedBodies,
      totalDangerousCommandsBlocked: this.totalDangerousCommandsBlocked,
      totalDiagnosticsGenerated: this.totalDiagnosticsGenerated,
      recentLogs: [...this.sanitizationLogs],
      recentDiagnostics: [...this.diagnosticsLogs],
    };
  }

  public restoreSnapshot(snapshot: HeredocTerminalWorkspaceSnapshot): void {
    this.totalSanitizations = snapshot.totalSanitizations;
    this.totalMaskedBodies = snapshot.totalMaskedBodies;
    this.totalDangerousCommandsBlocked = snapshot.totalDangerousCommandsBlocked;
    this.totalDiagnosticsGenerated = snapshot.totalDiagnosticsGenerated;

    this.sanitizationLogs.length = 0;
    this.sanitizationLogs.push(...snapshot.recentLogs);

    this.diagnosticsLogs.length = 0;
    this.diagnosticsLogs.push(...snapshot.recentDiagnostics);
  }

  public clear(): void {
    this.sanitizationLogs.length = 0;
    this.diagnosticsLogs.length = 0;
    this.safetyVerdicts.length = 0;
    this.totalSanitizations = 0;
    this.totalMaskedBodies = 0;
    this.totalDangerousCommandsBlocked = 0;
    this.totalDiagnosticsGenerated = 0;
  }
}
