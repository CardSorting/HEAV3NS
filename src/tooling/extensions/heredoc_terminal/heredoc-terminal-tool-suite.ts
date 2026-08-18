/**
 * heredoc-terminal-tool-suite.ts
 *
 * 30 Specialized Model Tool Definitions exposing Conservative Heredoc Sanitization, Script Synthesis,
 * Command Safety Analysis, Failure Diagnostics, DSL Query, and Multi-Format Exports (Phase 110 / ADR-086 / Target #86).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { HeredocTerminalSupervisor } from "../../../agents/extensions/heredoc_terminal/heredoc-terminal-supervisor.js";
import { DeterministicHeredocSanitizer } from "../../../agents/extensions/heredoc_terminal/deterministic-heredoc-sanitizer.js";
import { TerminalDiagnosticsEngine } from "../../../agents/extensions/heredoc_terminal/terminal-diagnostics-engine.js";
import type { HeredocTerminalSnapshotManager } from "../../../sessions/extensions/heredoc_terminal/heredoc-terminal-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  HeredocInterpreterType,
  HeredocTerminalGroupBy,
  HeredocTerminalSortBy,
  HeredocTerminalSortDirection,
} from "../../../core/contracts/heredoc-terminal.contracts.js";

export class HeredocTerminalToolSuite {
  private readonly supervisor: HeredocTerminalSupervisor;
  private readonly sanitizer: DeterministicHeredocSanitizer;
  private readonly diagnosticsEngine: TerminalDiagnosticsEngine;
  private readonly snapshotManager?: HeredocTerminalSnapshotManager;

  constructor(
    supervisor: HeredocTerminalSupervisor,
    sanitizer?: DeterministicHeredocSanitizer,
    diagnosticsEngine?: TerminalDiagnosticsEngine,
    snapshotManager?: HeredocTerminalSnapshotManager
  ) {
    this.supervisor = supervisor;
    this.sanitizer = sanitizer || new DeterministicHeredocSanitizer();
    this.diagnosticsEngine = diagnosticsEngine || new TerminalDiagnosticsEngine();
    this.snapshotManager = snapshotManager;
  }

  public getTools(): ToolDefinition[] {
    return [
      // 1. terminal_sanitize_heredoc
      {
        name: "terminal_sanitize_heredoc",
        description:
          "Masks inert heredoc bodies in a shell command with equivalent newlines while keeping real shell operators visible to security scanners.",
        parameters: {
          command: { type: "string", description: "The raw shell command string to sanitize and mask.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = typeof args.command === "string" ? args.command : "";
          const { sanitization, safety } = this.supervisor.preProcessCommand(command);
          return {
            success: true,
            sanitizedCommand: sanitization.sanitizedCommand,
            maskedBodiesCount: sanitization.maskedBodiesCount,
            hasHeredocs: sanitization.hasHeredocs,
            hadAmbiguity: sanitization.hadAmbiguity,
            riskLevel: safety.riskLevel,
            isSafe: safety.isSafe,
          };
        },
      },
      // 2. terminal_synthesize_heredoc
      {
        name: "terminal_synthesize_heredoc",
        description:
          "Synthesizes a safe, canonical quoted heredoc wrapper command to execute multi-line scripts cleanly without quoting errors.",
        parameters: {
          script: { type: "string", description: "The multi-line script content to wrap.", required: true },
          interpreter: { type: "string", description: "Target script interpreter runtime.", required: false },
          delimiter: { type: "string", description: "Optional delimiter (default: EOF).", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const script = typeof args.script === "string" ? args.script : "";
          const interpreter = typeof args.interpreter === "string" ? (args.interpreter as HeredocInterpreterType) : undefined;
          const delimiter = typeof args.delimiter === "string" ? args.delimiter : undefined;
          const result = this.supervisor.synthesizeScript(script, { interpreter, delimiter });
          return { success: true, synthesizedCommandLine: result.synthesizedCommandLine, interpreter: result.interpreter };
        },
      },
      // 3. terminal_analyze_command_safety
      {
        name: "terminal_analyze_command_safety",
        description: "Evaluates the safety and risk level of a shell command.",
        parameters: {
          command: { type: "string", description: "The command string to evaluate.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = typeof args.command === "string" ? args.command : "";
          const { safety } = this.supervisor.preProcessCommand(command);
          return { success: true, isSafe: safety.isSafe, riskLevel: safety.riskLevel, reason: safety.reason };
        },
      },
      // 4. terminal_diagnose_command_failure
      {
        name: "terminal_diagnose_command_failure",
        description: "Analyzes command exit code, stdout, and stderr to diagnose root cause and generate hints.",
        parameters: {
          exit_code: { type: "number", description: "The process exit code.", required: true },
          stdout: { type: "string", description: "Standard output captured.", required: true },
          stderr: { type: "string", description: "Standard error output captured.", required: true },
        },
        execute: async (args: Record<string, unknown>) => {
          const exitCode = typeof args.exit_code === "number" ? args.exit_code : 1;
          const stdout = typeof args.stdout === "string" ? args.stdout : "";
          const stderr = typeof args.stderr === "string" ? args.stderr : "";
          const diag = this.supervisor.postProcessExecution(exitCode, stdout, stderr);
          return { success: true, isRecoverable: diag.isRecoverable, rootCauseSummary: diag.rootCauseSummary, primaryHint: diag.primaryHint };
        },
      },
      // 5. terminal_inspect_heredoc_metrics
      {
        name: "terminal_inspect_heredoc_metrics",
        description: "Retrieves telemetry metrics and recent logs.",
        parameters: { limit: { type: "number", description: "Limit recent logs.", required: false } },
        execute: async (args: Record<string, unknown>) => {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          return {
            success: true,
            metrics: this.supervisor.getMetrics(),
            recentLogs: this.supervisor.getRecentLogs(limit),
            recentDiagnostics: this.supervisor.getRecentDiagnostics(limit),
          };
        },
      },
      // 6. heredoc_terminal_get_metrics_report
      {
        name: "heredoc_terminal_get_metrics_report",
        description: "Retrieves full structured telemetry and breakdown metrics report.",
        parameters: {},
        execute: async () => ({ success: true, report: this.supervisor.getMetricsReport() }),
      },
      // 7. heredoc_terminal_audit_health
      {
        name: "heredoc_terminal_audit_health",
        description: "Performs full SLA health and security posture audit.",
        parameters: {},
        execute: async () => ({ success: true, health: this.supervisor.auditHealth() }),
      },
      // 8. heredoc_terminal_configure
      {
        name: "heredoc_terminal_configure",
        description: "Updates configuration settings dynamically.",
        parameters: {
          enable_strict_fork_bomb_guard: { type: "boolean", description: "Toggle fork bomb guard.", required: false },
          max_log_history: { type: "number", description: "Max log history.", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          this.supervisor.configure({
            ...(typeof args.enable_strict_fork_bomb_guard === "boolean"
              ? { enableStrictForkBombGuard: args.enable_strict_fork_bomb_guard }
              : {}),
            ...(typeof args.max_log_history === "number" ? { maxLogHistory: args.max_log_history } : {}),
          });
          return { success: true, config: this.supervisor.getConfig() };
        },
      },
      // 9. heredoc_terminal_get_config
      {
        name: "heredoc_terminal_get_config",
        description: "Retrieves the active configuration.",
        parameters: {},
        execute: async () => ({ success: true, config: this.supervisor.getConfig() }),
      },
      // 10. heredoc_terminal_clear
      {
        name: "heredoc_terminal_clear",
        description: "Clears all stored sanitization logs and diagnostic records.",
        parameters: {},
        execute: async () => {
          this.supervisor.configure({});
          return { success: true };
        },
      },
      // 11. heredoc_terminal_list_recent_logs
      {
        name: "heredoc_terminal_list_recent_logs",
        description: "Lists recent sanitization logs.",
        parameters: { limit: { type: "number", description: "Max count.", required: false } },
        execute: async (args: Record<string, unknown>) => ({
          success: true,
          logs: this.supervisor.getRecentLogs(typeof args.limit === "number" ? args.limit : 50),
        }),
      },
      // 12. heredoc_terminal_list_recent_diagnostics
      {
        name: "heredoc_terminal_list_recent_diagnostics",
        description: "Lists recent diagnostic records.",
        parameters: { limit: { type: "number", description: "Max count.", required: false } },
        execute: async (args: Record<string, unknown>) => ({
          success: true,
          diagnostics: this.supervisor.getRecentDiagnostics(typeof args.limit === "number" ? args.limit : 50),
        }),
      },
      // 13. heredoc_terminal_group_and_sort
      {
        name: "heredoc_terminal_group_and_sort",
        description: "Groups and sorts sanitization records into multi-criteria swimlanes.",
        parameters: {
          group_by: { type: "string", description: "riskLevel | category | hasHeredocs", required: false },
          sort_by: { type: "string", description: "timestamp | latencyMs | commandLength", required: false },
          direction: { type: "string", description: "asc | desc", required: false },
        },
        execute: async (args: Record<string, unknown>) => {
          const lanes = this.supervisor.getGroupedRecords(
            args.group_by as HeredocTerminalGroupBy,
            args.sort_by as HeredocTerminalSortBy,
            args.direction as HeredocTerminalSortDirection
          );
          return { success: true, lanes };
        },
      },
      // 14. heredoc_terminal_search_dsl
      {
        name: "heredoc_terminal_search_dsl",
        description: "Executes natural query DSL search over sanitization records.",
        parameters: { query: { type: "string", description: "DSL query string (e.g. risk:blocked is:heredoc).", required: true } },
        execute: async (args: Record<string, unknown>) => ({
          success: true,
          records: this.supervisor.queryDsl(typeof args.query === "string" ? args.query : ""),
        }),
      },
      // 15. heredoc_terminal_render_dashboard
      {
        name: "heredoc_terminal_render_dashboard",
        description: "Renders responsive ANSI CLI dashboard string.",
        parameters: {},
        execute: async () => {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const ansi = BroccoliViewRenderer.renderHeredocTerminalDashboard({
            totalSanitizations: metrics.totalSanitizations,
            totalMaskedBodies: metrics.totalMaskedBodies,
            totalDangerousCommandsBlocked: metrics.totalDangerousCommandsBlocked,
            healthStatus: health.healthStatus,
          });
          return { success: true, dashboard: ansi };
        },
      },
      // 16. heredoc_terminal_render_card
      {
        name: "heredoc_terminal_render_card",
        description: "Renders an interactive ANSI CLI command record card.",
        parameters: { record_id: { type: "string", description: "Record ID.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          const id = typeof args.record_id === "string" ? args.record_id : "";
          const logs = this.supervisor.getRecentLogs(100);
          const log = logs.find((l) => l.recordId === id);
          if (!log) return { success: false, error: `Record ${id} not found` };
          const card = BroccoliViewRenderer.renderHeredocSanitizationCard({
            recordId: log.recordId,
            riskLevel: log.riskLevel,
            hasHeredocs: log.maskedBodiesCount > 0,
            maskedBodiesCount: log.maskedBodiesCount,
            originalCommandPreview: "Preview",
          });
          return { success: true, card };
        },
      },
      // 17. heredoc_terminal_export_html_view
      {
        name: "heredoc_terminal_export_html_view",
        description: "Exports single-page interactive HTML dashboard.",
        parameters: {},
        execute: async () => ({ success: true, html: this.supervisor.exportHtml() }),
      },
      // 18. heredoc_terminal_export_markdown_report
      {
        name: "heredoc_terminal_export_markdown_report",
        description: "Exports Markdown diagnostic summary report.",
        parameters: {},
        execute: async () => ({ success: true, markdown: this.supervisor.exportMarkdown() }),
      },
      // 19. heredoc_terminal_export_csv_report
      {
        name: "heredoc_terminal_export_csv_report",
        description: "Exports CSV audit ledger.",
        parameters: {},
        execute: async () => ({ success: true, csv: this.supervisor.exportCsv() }),
      },
      // 20. heredoc_terminal_bulk_purge
      {
        name: "heredoc_terminal_bulk_purge",
        description: "Purges multiple records by ID in an atomic mutation.",
        parameters: { record_ids: { type: "string", description: "Comma-separated record IDs.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          const ids = typeof args.record_ids === "string" ? args.record_ids.split(",").map((s) => s.trim()) : [];
          return { success: true, result: this.supervisor.bulkPurge(ids) };
        },
      },
      // 21. heredoc_terminal_undo
      {
        name: "heredoc_terminal_undo",
        description: "Undoes the last mutation on the substrate.",
        parameters: {},
        execute: async () => ({ success: true, reverted: this.supervisor.undo() }),
      },
      // 22. heredoc_terminal_redo
      {
        name: "heredoc_terminal_redo",
        description: "Redoes the previously undone mutation.",
        parameters: {},
        execute: async () => ({ success: true, reapplied: this.supervisor.redo() }),
      },
      // 23. heredoc_terminal_capture_snapshot
      {
        name: "heredoc_terminal_capture_snapshot",
        description: "Captures a frame snapshot for sub-millisecond rollback.",
        parameters: { frame_number: { type: "number", description: "Optional frame number.", required: false } },
        execute: async (args: Record<string, unknown>) => {
          if (!this.snapshotManager) return { success: false, error: "Snapshot manager not attached" };
          const snap = this.snapshotManager.captureSnapshot(typeof args.frame_number === "number" ? args.frame_number : undefined);
          return { success: true, snapshotId: snap.snapshotId };
        },
      },
      // 24. heredoc_terminal_restore_snapshot
      {
        name: "heredoc_terminal_restore_snapshot",
        description: "Restores state from frame number.",
        parameters: { frame_number: { type: "number", description: "Frame number to restore.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          if (!this.snapshotManager) return { success: false, error: "Snapshot manager not attached" };
          const res = this.snapshotManager.restoreFrameSnapshot(typeof args.frame_number === "number" ? args.frame_number : 0);
          return { success: res.success, latencyMs: res.latencyMs };
        },
      },
      // 25. heredoc_terminal_format_sanitization
      {
        name: "heredoc_terminal_format_sanitization",
        description: "Formats a sanitization result into a clean one-line status string.",
        parameters: { command: { type: "string", description: "Command to sanitize & format.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          const cmd = typeof args.command === "string" ? args.command : "";
          const { sanitization } = this.supervisor.preProcessCommand(cmd);
          return { success: true, formatted: this.sanitizer.formatSanitizationResult(sanitization) };
        },
      },
      // 26. heredoc_terminal_format_safety
      {
        name: "heredoc_terminal_format_safety",
        description: "Formats a command safety evaluation into a status tag.",
        parameters: { command: { type: "string", description: "Command to evaluate.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          const cmd = typeof args.command === "string" ? args.command : "";
          const { safety } = this.supervisor.preProcessCommand(cmd);
          return { success: true, formatted: this.sanitizer.formatSafetyClassification(safety) };
        },
      },
      // 27. heredoc_terminal_format_diagnostics
      {
        name: "heredoc_terminal_format_diagnostics",
        description: "Formats exit code diagnostics into a concise string.",
        parameters: { exit_code: { type: "number", description: "Exit code.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          const diag = this.diagnosticsEngine.diagnose(typeof args.exit_code === "number" ? args.exit_code : 1, "", "Error");
          return { success: true, formatted: this.diagnosticsEngine.formatTerminalDiagnostics(diag) };
        },
      },
      // 28. heredoc_terminal_mask_simple_quotes
      {
        name: "heredoc_terminal_mask_simple_quotes",
        description: "Blanks inert quoted spans in a command without erasing active shell substitutions.",
        parameters: { command: { type: "string", description: "Shell command string.", required: true } },
        execute: async (args: Record<string, unknown>) => ({
          success: true,
          masked: this.sanitizer.maskSimpleQuotes(typeof args.command === "string" ? args.command : ""),
        }),
      },
      // 29. heredoc_terminal_is_inert_consumer
      {
        name: "heredoc_terminal_is_inert_consumer",
        description: "Checks if a command is an allowlisted inert heredoc consumer.",
        parameters: { command: { type: "string", description: "Command to test.", required: true } },
        execute: async (args: Record<string, unknown>) => ({
          success: true,
          isInert: this.sanitizer.isInertHeredocConsumer(typeof args.command === "string" ? args.command : ""),
        }),
      },
      // 30. heredoc_terminal_test_dangerous_patterns
      {
        name: "heredoc_terminal_test_dangerous_patterns",
        description: "Checks if a command matches any known dangerous fork-bomb or disk wipe patterns.",
        parameters: { command: { type: "string", description: "Command to test.", required: true } },
        execute: async (args: Record<string, unknown>) => {
          const cmd = typeof args.command === "string" ? args.command : "";
          const classification = this.sanitizer.classifyCommandSafety(cmd);
          return {
            success: true,
            isDangerous: !classification.isSafe,
            matchedPatterns: classification.matchedDangerousPatterns,
            riskLevel: classification.riskLevel,
          };
        },
      },
    ];
  }
}
