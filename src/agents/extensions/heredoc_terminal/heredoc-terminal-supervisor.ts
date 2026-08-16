/**
 * heredoc-terminal-supervisor.ts
 *
 * Master supervisor coordinating pre-execution command sanitization, safety evaluation,
 * script heredoc wrapping, and terminal diagnostics logging (Phase 110 / ADR-086 / Target #43).
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

    this.substrate.recordSanitization(sanitization, safety);

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

  /**
   * Direct access to substrate metrics.
   */
  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getRecentLogs(limit = 50) {
    return this.substrate.getRecentLogs(limit);
  }

  public getRecentDiagnostics(limit = 50) {
    return this.substrate.getRecentDiagnostics(limit);
  }
}
