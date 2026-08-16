/**
 * diagnostic-doctor-tool-suite.ts
 *
 * Model tool suite exposing system diagnostics, live subsystem probing, and session salvage (Phase 97 / ADR-049).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { DiagnosticDoctorSupervisor } from "../../../agents/extensions/doctor/diagnostic-doctor-supervisor.js";

export class DiagnosticDoctorToolSuite {
  private supervisor: DiagnosticDoctorSupervisor;

  constructor(supervisor: DiagnosticDoctorSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "doctor_run_diagnostics",
        description: "Runs deterministic health diagnostics across memory, VFS, tools, snapshots, and providers.",
        parameters: {
          includeDetails: {
            type: "boolean",
            description: "Whether to include detailed check diagnostic records",
            required: false,
          },
        },
        execute: async (_args: Record<string, unknown>) => {
          const report = this.supervisor.runDiagnostics();

          return {
            success: true,
            reportId: report.reportId,
            overallHealth: report.overallHealth,
            totalChecks: report.totalChecks,
            healthyCount: report.healthyCount,
            warningCount: report.warningCount,
            criticalCount: report.criticalCount,
            fatalCount: report.fatalCount,
            durationMs: report.durationMs,
          };
        },
      },
      {
        name: "doctor_salvage_session",
        description: "Non-destructively repairs orphaned turns, hanging tool calls, and corrupt payloads in a session transcript.",
        parameters: {
          sessionId: {
            type: "string",
            description: "The unique identifier of the session to salvage",
            required: true,
          },
          rawTranscriptJson: {
            type: "string",
            description: "JSON array string representing the damaged session message transcript",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = typeof args.sessionId === "string" ? args.sessionId : "unknown-session";
          const rawJson = typeof args.rawTranscriptJson === "string" ? args.rawTranscriptJson : "[]";

          let rawTranscript: Record<string, unknown>[] = [];
          try {
            const parsed = JSON.parse(rawJson);
            if (Array.isArray(parsed)) {
              rawTranscript = parsed;
            }
          } catch {
            rawTranscript = [];
          }

          const report = this.supervisor.salvageSession(sessionId, rawTranscript);

          return {
            success: report.success,
            sessionId: report.sessionId,
            totalTurnsExamined: report.totalTurnsExamined,
            repairedTurnsCount: report.repairedTurnsCount,
            repairs: report.repairs,
            salvagedTranscriptLength: report.salvagedTranscript.length,
          };
        },
      },
      {
        name: "doctor_probe_subsystem_health",
        description: "Probes the live operational health status of a specific monolithic subsystem.",
        parameters: {
          subsystemName: {
            type: "string",
            description: "The name of the subsystem to probe (e.g., 'memory', 'vfs', 'snapshots', 'tools')",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const subsystemName = typeof args.subsystemName === "string" ? args.subsystemName : "monolith";
          const probe = this.supervisor.probeSubsystem(subsystemName);

          return {
            success: true,
            checkId: probe.checkId,
            category: probe.category,
            severity: probe.severity,
            message: probe.message,
          };
        },
      },
    ];
  }
}
