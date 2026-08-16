/**
 * secret-redaction-tool-suite.ts
 *
 * Model tool suite exposing secret redaction, query masking, and path safety inspection (Phase 95 / ADR-047).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { SecretRedactionSupervisor } from "../../../agents/extensions/redaction/secret-redaction-supervisor.js";

export class SecretRedactionToolSuite {
  private supervisor: SecretRedactionSupervisor;

  constructor(supervisor: SecretRedactionSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "secret_redact_text",
        description: "Scans and redacts API keys, credentials, JWTs, query secrets, and connection URIs from input text.",
        parameters: {
          text: {
            type: "string",
            description: "The text to scan and redact",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = typeof args.text === "string" ? args.text : "";
          const result = this.supervisor.redactText(text);

          return {
            success: true,
            sanitizedText: result.sanitizedText,
            totalRedactions: result.totalRedactions,
            matchesCount: result.matches.length,
          };
        },
      },
      {
        name: "path_safety_check",
        description: "Evaluates if a file path is sensitive, denied, or requires interactive approval.",
        parameters: {
          targetPath: {
            type: "string",
            description: "The file path to evaluate",
            required: true,
          },
          mode: {
            type: "string",
            description: "Access mode: 'read' or 'write'",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const targetPath = typeof args.targetPath === "string" ? args.targetPath : "";
          const mode = args.mode === "write" ? "write" : "read";
          const decision = this.supervisor.evaluatePathSafety(targetPath, mode);

          return {
            success: true,
            action: decision.action,
            reason: decision.reason,
            canonicalPath: decision.canonicalPath,
            isSensitive: decision.isSensitive,
          };
        },
      },
      {
        name: "secret_redaction_status",
        description: "Queries current secret redaction metrics, match logs, and blocked access attempts.",
        parameters: {},
        execute: async () => {
          const matches = this.supervisor.getMatches();
          const blocked = this.supervisor.getBlockedAccessAttempts();

          return {
            success: true,
            totalMatches: matches.length,
            totalBlockedAccessAttempts: blocked.length,
            matches,
            blocked,
          };
        },
      },
    ];
  }
}
