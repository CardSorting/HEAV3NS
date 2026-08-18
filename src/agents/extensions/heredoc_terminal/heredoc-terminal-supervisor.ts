/**
 * heredoc-terminal-supervisor.ts
 *
 * Master supervisor coordinating pre-execution command sanitization, safety evaluation,
 * script heredoc wrapping, actionable terminal diagnostics, SLA health audits, and rollback recovery
 * (Phase 110 / ADR-086 / Target #86).
 */

import type { BroccoliHeredocTerminalSubstrate } from "../../../sessions/extensions/heredoc_terminal/broccoli-heredoc-terminal-substrate.js";
import type { DeterministicHeredocSanitizer } from "./deterministic-heredoc-sanitizer.js";
import type { TerminalDiagnosticsEngine } from "./terminal-diagnostics-engine.js";
import type {
  HeredocSanitizationResult,
  CommandSafetyClassification,
  ScriptHeredocOptions,
  ScriptHeredocResult,
  TerminalExecutionDiagnostics,
  HeredocTerminalHealthAuditReport,
  HeredocTerminalMetricsReport,
  HeredocTerminalGroupedLane,
  HeredocTerminalGroupBy,
  HeredocTerminalSortBy,
  HeredocTerminalSortDirection,
  HeredocTerminalDslQueryFilter,
  HeredocSanitizationRow,
  HeredocTerminalBulkMutationResult,
  HeredocTerminalConfig,
} from "../../../core/contracts/heredoc-terminal.contracts.js";

export class HeredocTerminalSupervisor {
  private readonly substrate: BroccoliHeredocTerminalSubstrate;
  private readonly sanitizer: DeterministicHeredocSanitizer;
  private readonly diagnosticsEngine: TerminalDiagnosticsEngine;

  constructor(
    substrate: BroccoliHeredocTerminalSubstrate,
    sanitizer: DeterministicHeredocSanitizer,
    diagnosticsEngine: TerminalDiagnosticsEngine
  ) {
    this.substrate = substrate;
    this.sanitizer = sanitizer;
    this.diagnosticsEngine = diagnosticsEngine;
  }

  /**
   * Pre-execution hook: Sanitize heredocs and evaluate safety.
   */
  public preProcessCommand(command: string): {
    sanitization: HeredocSanitizationResult;
    safety: CommandSafetyClassification;
  } {
    const sanitization = this.sanitizer.stripInertHeredocBodies(command);
    const safety = this.sanitizer.classifyCommandSafety(command);

    this.substrate.recordResult(sanitization, safety);

    return { sanitization, safety };
  }

  /**
   * Synthesize multi-line script heredoc command.
   */
  public synthesizeScript(scriptContent: string, options: ScriptHeredocOptions = {}): ScriptHeredocResult {
    return this.sanitizer.synthesizeScriptHeredoc(scriptContent, options);
  }

  /**
   * Post-execution hook: Diagnose exit code and stderr.
   */
  public postProcessExecution(
    exitCode: number,
    stdout: string,
    stderr: string,
    executionTimeMs?: number
  ): TerminalExecutionDiagnostics {
    const diagnostics = this.diagnosticsEngine.diagnose(exitCode, stdout, stderr, executionTimeMs);
    if (exitCode !== 0) {
      this.substrate.recordDiagnostics(diagnostics);
    }
    return diagnostics;
  }

  // ---------------------------------------------------------------------------
  // Substrate Telemetry, Health, and Swimlane Queries
  // ---------------------------------------------------------------------------

  public auditHealth(): HeredocTerminalHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getMetricsReport(): HeredocTerminalMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getRecentLogs(limit = 50) {
    return this.substrate.getRecentLogs(limit);
  }

  public getRecentDiagnostics(limit = 50) {
    return this.substrate.getRecentDiagnostics(limit);
  }

  public getGroupedRecords(
    groupBy: HeredocTerminalGroupBy = "riskLevel",
    sortBy: HeredocTerminalSortBy = "timestamp",
    direction: HeredocTerminalSortDirection = "desc"
  ): readonly HeredocTerminalGroupedLane[] {
    return this.substrate.getGroupedRecords(groupBy, sortBy, direction);
  }

  public queryDsl(query: HeredocTerminalDslQueryFilter | string): readonly HeredocSanitizationRow[] {
    return this.substrate.queryRecordsDsl(query);
  }

  public bulkPurge(recordIds: readonly string[]): HeredocTerminalBulkMutationResult {
    return this.substrate.bulkPurgeRecords(recordIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportHtml();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdown();
  }

  public exportCsv(): string {
    return this.substrate.exportCsv();
  }

  public getConfig(): HeredocTerminalConfig {
    return this.substrate.getConfig();
  }

  public configure(patch: Partial<HeredocTerminalConfig>): void {
    this.substrate.updateConfig(patch);
  }
}
