/**
 * verification-evidence-tool-suite.ts
 *
 * Model tool suite exposing verification evidence recording, stop-gate evaluation, and insights (Phase 92 / ADR-044).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { EvidenceKind, EvidenceScope } from "../../../core/contracts/verification-evidence.contracts.js";
import { VerificationEvidenceSupervisor } from "../../../agents/extensions/evidence/verification-evidence-supervisor.js";

export class VerificationEvidenceToolSuite {
  private supervisor: VerificationEvidenceSupervisor;

  constructor(supervisor: VerificationEvidenceSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "evidence_record",
        description: "Records a verified test, build, typecheck, or lint command execution result.",
        parameters: {
          command: {
            type: "string",
            description: "The verification command executed (e.g., 'npm test', 'tsc --noEmit')",
            required: true,
          },
          kind: {
            type: "string",
            description: "The verification category ('test', 'build', 'typecheck', 'lint', 'manual')",
            required: true,
          },
          scope: {
            type: "string",
            description: "The verification scope ('file', 'package', 'workspace')",
            required: true,
          },
          passed: {
            type: "boolean",
            description: "Whether the verification check passed cleanly",
            required: true,
          },
          exitCode: {
            type: "number",
            description: "Process exit code (0 for success)",
            required: false,
          },
          durationMs: {
            type: "number",
            description: "Command execution duration in milliseconds",
            required: false,
          },
          outputSummary: {
            type: "string",
            description: "Concise summary of test output or diagnostics",
            required: false,
          },
          verifiedPaths: {
            type: "string",
            description: "Comma-separated list of file paths verified by this command",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = typeof args.command === "string" ? args.command : "";
          const kind = (typeof args.kind === "string" ? args.kind : "test") as EvidenceKind;
          const scope = (typeof args.scope === "string" ? args.scope : "workspace") as EvidenceScope;
          const passed = typeof args.passed === "boolean" ? args.passed : true;
          const exitCode = typeof args.exitCode === "number" ? args.exitCode : passed ? 0 : 1;
          const durationMs = typeof args.durationMs === "number" ? args.durationMs : 0;
          const outputSummary = typeof args.outputSummary === "string" ? args.outputSummary : "";
          const rawPaths = typeof args.verifiedPaths === "string" ? args.verifiedPaths : "";
          const verifiedPaths = rawPaths
            ? rawPaths.split(",").map((p) => p.trim()).filter((p) => p.length > 0)
            : [];

          const record = this.supervisor.recordEvidence({
            frameIndex: 1,
            command,
            kind,
            scope,
            passed,
            exitCode,
            durationMs,
            outputSummary,
            verifiedPaths,
          });

          return {
            success: true,
            recordId: record.id,
            passed: record.passed,
            kind: record.kind,
          };
        },
      },
      {
        name: "evidence_stop_check",
        description: "Evaluates if turn completion is safe or if a verification nudge is required.",
        parameters: {},
        execute: async () => {
          const evaluation = this.supervisor.checkStopGate();
          return {
            success: true,
            shouldNudge: evaluation.shouldNudge,
            reason: evaluation.reason,
            unverifiedModifiedFiles: evaluation.unverifiedModifiedFiles,
            latestEvidence: evaluation.latestEvidence,
          };
        },
      },
      {
        name: "evidence_insights_report",
        description: "Generates comprehensive session verification insights, coverage stats, and kind breakdowns.",
        parameters: {
          totalFrames: {
            type: "number",
            description: "Total number of completed frames to evaluate against",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const totalFrames = typeof args.totalFrames === "number" ? args.totalFrames : 1;
          const report = this.supervisor.getInsights(totalFrames);

          return {
            success: true,
            report,
          };
        },
      },
    ];
  }
}
