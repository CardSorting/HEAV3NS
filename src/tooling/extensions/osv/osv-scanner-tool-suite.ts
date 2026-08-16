/**
 * osv-scanner-tool-suite.ts
 *
 * Model tool definitions exposing OSV Malware Scanning & Pre-Flight Package Firewall
 * (Phase 128 / ADR-104 / Target #61).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { OsvScannerSupervisor } from "../../../agents/extensions/osv/osv-scanner-supervisor.js";
import type { PackageEcosystem } from "../../../core/contracts/osv-scanner.contracts.js";

export class OsvScannerToolSuite {
  private readonly supervisor: OsvScannerSupervisor;

  constructor(supervisor: OsvScannerSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "osv_scan_package",
        description:
          "Scans a specific package name, ecosystem, and optional version against the OSV malware advisory database.",
        parameters: {
          name: {
            type: "string",
            description: "Package name (e.g. 'express', '@modelcontextprotocol/server-filesystem').",
            required: true,
          },
          ecosystem: {
            type: "string",
            description: "Package ecosystem (e.g. 'npm', 'PyPI', 'crates.io', 'Go').",
            required: true,
          },
          version: {
            type: "string",
            description: "Optional specific package version.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const name = String(args.name || "").trim();
          const ecosystem = (String(args.ecosystem || "npm").trim()) as PackageEcosystem;
          const version = typeof args.version === "string" && args.version.trim() ? args.version.trim() : undefined;

          if (!name) {
            return {
              success: false,
              error: "Package name is required",
            };
          }

          const result = await this.supervisor.scanPackage({
            name,
            ecosystem,
            version,
            rawToken: version ? `${name}@${version}` : name,
          });

          return {
            success: true,
            result,
          };
        },
      },
      {
        name: "osv_check_command",
        description:
          "Pre-flight parses a shell/MCP command line string and evaluates if any referenced packages contain malware.",
        parameters: {
          command: {
            type: "string",
            description: "Command executable binary name (e.g. 'npx', 'uvx').",
            required: true,
          },
          args: {
            type: "string",
            description: "Command arguments string or JSON array.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = String(args.command || "").trim();
          let rawArgs: string[] = [];
          if (Array.isArray(args.args)) {
            rawArgs = args.args.map((a) => String(a));
          } else if (typeof args.args === "string" && args.args.trim()) {
            const trimmed = args.args.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
              try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) rawArgs = parsed.map((a) => String(a));
              } catch {
                rawArgs = trimmed.split(/\s+/);
              }
            } else {
              rawArgs = trimmed.split(/\s+/);
            }
          }

          const result = await this.supervisor.checkCommand(command, rawArgs);

          return {
            success: true,
            inspected: result !== undefined,
            result: result || {
              allowed: true,
              reason: "Command does not match a monitored package manager ecosystem",
            },
          };
        },
      },
      {
        name: "osv_clear_cache",
        description: "Clears the in-memory advisory verdict cache.",
        parameters: {},
        execute: async () => {
          this.supervisor.clearCache();
          return {
            success: true,
            message: "OSV advisory verdict cache cleared successfully",
          };
        },
      },
      {
        name: "osv_configure",
        description: "Configures scanning parameters, cache TTL, and fail-open settings.",
        parameters: {
          cacheTtlMs: {
            type: "number",
            description: "Cache time-to-live in milliseconds.",
            required: false,
          },
          blockMalwareOnly: {
            type: "boolean",
            description: "Whether to only block confirmed malware (MAL-*) vs all CVEs.",
            required: false,
          },
          failOpen: {
            type: "boolean",
            description: "Whether to allow packages to run when network errors occur.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const cacheTtlMs = typeof args.cacheTtlMs === "number" ? args.cacheTtlMs : undefined;
          const blockMalwareOnly = typeof args.blockMalwareOnly === "boolean" ? args.blockMalwareOnly : undefined;
          const failOpen = typeof args.failOpen === "boolean" ? args.failOpen : undefined;

          this.supervisor.configure({
            cacheTtlMs,
            blockMalwareOnly,
            failOpen,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "osv_get_metrics",
        description: "Retrieves aggregate statistics on package scans, cache hits, and malware blocks.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
