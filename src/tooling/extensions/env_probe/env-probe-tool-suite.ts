/**
 * env-probe-tool-suite.ts
 *
 * Model tool definitions exposing Toolchain Environment Probing & Prompt Hints
 * (Phase 134 / ADR-110 / Target #67).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { EnvProbeSupervisor } from "../../../agents/extensions/env_probe/env-probe-supervisor.js";

export class EnvProbeToolSuite {
  private readonly supervisor: EnvProbeSupervisor;

  constructor(supervisor: EnvProbeSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "env_probe_inspect",
        description: "Inspects the detected local runtime toolchain, package managers, and detected environment anomalies.",
        parameters: {},
        execute: async () => {
          const probe = this.supervisor.getCachedProbe();
          return {
            success: true,
            hasCachedProbe: !!probe,
            probe,
          };
        },
      },
      {
        name: "env_probe_refresh",
        description: "Executes a fresh toolchain diagnostic probe and updates the substrate cache.",
        parameters: {
          pythonPath: {
            type: "string",
            description: "Custom Python binary path to probe.",
            required: false,
          },
          pipPath: {
            type: "string",
            description: "Custom pip binary path to probe.",
            required: false,
          },
          isPep668Managed: {
            type: "boolean",
            description: "Whether the system Python is PEP 668 externally managed.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const pythonPath = typeof args.pythonPath === "string" ? args.pythonPath : "/usr/bin/python3";
          const pipPath = typeof args.pipPath === "string" ? args.pipPath : "/usr/bin/pip";
          const isPep668Managed = typeof args.isPep668Managed === "boolean" ? args.isPep668Managed : false;

          const probe = this.supervisor.executeProbe({
            pythonPath,
            pipPath,
            isPep668Managed,
            probeDurationMs: 2,
          });

          return {
            success: true,
            probe,
          };
        },
      },
      {
        name: "env_probe_generate_prompt_hint",
        description: "Generates the single-line token-optimized system prompt diagnostic hint (0 tokens if clean).",
        parameters: {
          platform: {
            type: "string",
            description: "Target platform/backend (e.g. 'cli', 'docker', 'telegram').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const platform = typeof args.platform === "string" ? args.platform : "cli";
          const hint = this.supervisor.getSystemPromptHint(platform);
          return {
            success: true,
            platform,
            hint,
            tokenOverhead: hint.length === 0 ? 0 : Math.ceil(hint.length / 4),
          };
        },
      },
      {
        name: "env_probe_configure",
        description: "Configures environment probe timeouts, enabled language runtime checks, and remote sandbox bypasses.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether environment diagnostic probing is enabled.",
            required: false,
          },
          skipRemoteBackends: {
            type: "boolean",
            description: "Whether to skip probe on remote execution sandboxes.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;
          const skipRemoteBackends =
            typeof args.skipRemoteBackends === "boolean" ? args.skipRemoteBackends : undefined;

          this.supervisor.configure({
            enabled,
            skipRemoteBackends,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "env_probe_get_metrics",
        description: "Retrieves probe cache hits, run durations, and anomaly telemetry.",
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
