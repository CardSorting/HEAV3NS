/**
 * preflight-tool-suite.ts
 *
 * Model tool definitions exposing Pre-Exec Security Scanner, Supply-Chain Provenance
 * Verification & Pre-Flight Threat Gate to agents and CLI (Phase 113 / ADR-089 / Target #46).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { PreflightScannerSupervisor } from "../../../agents/extensions/preflight_scanner/preflight-scanner-supervisor.js";
import type { PreflightThreatCategory } from "../../../core/contracts/preflight-scanner.contracts.js";

export class PreflightToolSuite {
  private readonly supervisor: PreflightScannerSupervisor;

  constructor(supervisor: PreflightScannerSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "preflight_scan_command",
        description:
          "Scans a shell command prior to execution for content-level security threats (pipe-to-interpreter, base64 payload execution, homograph URLs, dangerous permissions, terminal injection).",
        parameters: {
          command: {
            type: "string",
            description: "The full shell command string to scan.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = typeof args.command === "string" ? args.command : "";
          const result = this.supervisor.scanCommand(command);
          return {
            success: true,
            command: result.command,
            verdict: result.verdict,
            exitCode: result.exitCode,
            policyDecision: result.policyDecision,
            findings: result.findings,
            scanDurationMs: result.scanDurationMs,
          };
        },
      },
      {
        name: "preflight_verify_binary_signature",
        description:
          "Verifies the cryptographic supply-chain provenance (SHA-256 checksum and Cosign GitHub Actions workflow identity) of a downloaded binary or payload.",
        parameters: {
          binary_path: {
            type: "string",
            description: "Path to the binary file.",
            required: true,
          },
          content_base64: {
            type: "string",
            description: "Base64 encoded binary content or payload string.",
            required: true,
          },
          expected_sha256: {
            type: "string",
            description: "Expected 64-character hexadecimal SHA-256 checksum.",
            required: true,
          },
          cosign_issuer: {
            type: "string",
            description: "Optional OIDC token issuer (e.g. 'https://token.actions.githubusercontent.com').",
            required: false,
          },
          cosign_identity: {
            type: "string",
            description: "Optional Cosign release workflow identity URI.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const binaryPath = typeof args.binary_path === "string" ? args.binary_path : "";
          const contentBase64 = typeof args.content_base64 === "string" ? args.content_base64 : "";
          const expectedSha256 = typeof args.expected_sha256 === "string" ? args.expected_sha256 : "";
          const cosignIssuer = typeof args.cosign_issuer === "string" ? args.cosign_issuer : undefined;
          const cosignIdentity = typeof args.cosign_identity === "string" ? args.cosign_identity : undefined;

          const buffer = Buffer.from(contentBase64, "base64");
          const result = this.supervisor.verifyBinaryProvenance({
            binaryPath,
            content: buffer,
            expectedSha256,
            cosignIssuer,
            cosignIdentity,
          });

          return {
            success: result.verified,
            result,
          };
        },
      },
      {
        name: "preflight_inspect_threat_rules",
        description:
          "Inspects all active threat detection categories, threat severities, and defensive rules in the pre-flight scanner.",
        parameters: {},
        execute: async () => {
          const categories: PreflightThreatCategory[] = [
            "pipe_to_interpreter",
            "base64_execution",
            "dangerous_permission",
            "terminal_injection",
            "credential_scraping",
            "suspicious_downloader",
            "homograph_url",
          ];
          return {
            success: true,
            activeCategories: categories,
            policy: this.supervisor.getPolicy(),
          };
        },
      },
      {
        name: "preflight_configure_policy",
        description:
          "Configures scanner parameters including fail-open/fail-closed behavior, timeout, and blocked category lists.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether the preflight scanner is active.",
            required: false,
          },
          fail_open: {
            type: "boolean",
            description: "If true, operational scanner errors will allow the command to proceed with a warning.",
            required: false,
          },
          timeout_ms: {
            type: "number",
            description: "Timeout in milliseconds for scanner evaluation.",
            required: false,
          },
          blocked_categories_json: {
            type: "string",
            description: "JSON array of threat category strings to strictly block.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const update: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") update.enabled = args.enabled;
          if (typeof args.fail_open === "boolean") update.failOpen = args.fail_open;
          if (typeof args.timeout_ms === "number") update.timeoutMs = args.timeout_ms;
          if (typeof args.blocked_categories_json === "string") {
            try {
              update.blockedCategories = JSON.parse(args.blocked_categories_json);
            } catch {
              return { success: false, error: "Invalid JSON format in blocked_categories_json" };
            }
          }

          const updatedPolicy = this.supervisor.configurePolicy(update);
          return {
            success: true,
            policy: updatedPolicy,
          };
        },
      },
      {
        name: "preflight_get_security_status",
        description:
          "Retrieves aggregate pre-flight security metrics, scan history count, blocked count, and circuit breaker status.",
        parameters: {},
        execute: async () => {
          const status = this.supervisor.getSecurityStatus();
          return {
            success: true,
            status,
          };
        },
      },
    ];
  }
}
