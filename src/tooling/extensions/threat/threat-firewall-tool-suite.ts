/**
 * threat-firewall-tool-suite.ts
 *
 * Model tool surface for Threat Pattern Scanner & Security Firewall (Phase 86 / ADR-038).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ThreatTrustLevel } from "../../../core/contracts/threat.contracts.js";
import { ThreatFirewallSupervisor } from "../../../agents/extensions/threat/threat-firewall-supervisor.js";

export class ThreatFirewallToolSuite {
  private readonly supervisor: ThreatFirewallSupervisor;

  constructor(supervisor: ThreatFirewallSupervisor) {
    this.supervisor = supervisor;
  }

  public getSupervisor(): ThreatFirewallSupervisor {
    return this.supervisor;
  }


  public getTools(): ToolDefinition[] {
    return [
      {
        name: "scan_threat_payload",
        description: "Scans a code snippet, shell command, or prompt payload for security threats including prompt injection, data exfiltration, and destructive commands.",
        parameters: {
          payload: { type: "string", required: true, description: "The text payload to scan" },
          trustLevel: { type: "string", description: "'builtin' | 'trusted' | 'community' | 'agent' (default: 'community')" },
          location: { type: "string", description: "Optional location/file descriptor" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const payload = String(args.payload || "").trim();
          if (!payload) return { success: false, error: "payload parameter is required" };

          const trustLevel = (typeof args.trustLevel === "string" ? args.trustLevel : "community") as ThreatTrustLevel;
          const location = typeof args.location === "string" ? args.location : undefined;

          const scanResult = this.supervisor.scan(payload, trustLevel, location);

          return {
            success: true,
            clean: scanResult.clean,
            verdict: scanResult.verdict,
            findings: scanResult.findings,
            bytesScanned: scanResult.bytesScanned,
            scanDurationMs: scanResult.scanDurationMs,
          };
        },
      },
      {
        name: "threat_firewall_status",
        description: "Queries the threat firewall security audit logs, threat findings, and scan statistics.",
        parameters: {
          limit: { type: "number", description: "Maximum number of recent findings to return (default: 10)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const limit = typeof args.limit === "number" ? args.limit : 10;
          const stats = this.supervisor.getStats();
          const findings = this.supervisor.listFindings(limit);
          const recentScans = this.supervisor.listScans(limit);

          return {
            success: true,
            stats,
            findings,
            recentScans,
          };
        },
      },
    ];
  }
}
