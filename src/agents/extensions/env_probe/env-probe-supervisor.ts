/**
 * env-probe-supervisor.ts
 *
 * Master supervisor coordinating toolchain probing, cached prompt hint retrieval,
 * remote sandbox bypasses, and anomaly indexing (Phase 134 / ADR-110 / Target #67).
 */

import type { BroccoliEnvProbeSubstrate } from "../../../sessions/extensions/env_probe/broccoli-env-probe-substrate.js";
import type { DeterministicEnvProbeEngine } from "./deterministic-env-probe-engine.js";
import type {
  EnvProbeConfig,
  EnvProbeMetrics,
  ToolchainProbeDescriptor,
} from "../../../core/contracts/env-probe.contracts.js";

const REMOTE_PLATFORMS = new Set([
  "docker",
  "singularity",
  "modal",
  "daytona",
  "ssh",
  "managed_modal",
  "vercel_sandbox",
]);

export class EnvProbeSupervisor {
  private readonly substrate: BroccoliEnvProbeSubstrate;
  private readonly engine: DeterministicEnvProbeEngine;

  constructor(substrate: BroccoliEnvProbeSubstrate, engine: DeterministicEnvProbeEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<EnvProbeConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): EnvProbeConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): EnvProbeMetrics {
    return this.substrate.getMetrics();
  }

  public getCachedProbe(): ToolchainProbeDescriptor | undefined {
    return this.substrate.getCachedProbe();
  }

  public invalidateCache(): void {
    this.substrate.invalidateCache();
  }

  /**
   * Executes a probe operation and updates the substrate cache.
   */
  public executeProbe(params: {
    pythonPath?: string;
    pipPath?: string;
    pythonVersion?: string;
    isPep668Managed?: boolean;
    hasActiveVenv?: boolean;
    venvPath?: string;
    nodeVersion?: string;
    packageManager?: string;
    probeDurationMs?: number;
  }): ToolchainProbeDescriptor {
    const duration = params.probeDurationMs ?? 5;
    const descriptor = this.engine.analyzeToolchain({
      ...params,
      probeDurationMs: duration,
    });

    this.substrate.setCachedProbe(descriptor);
    return descriptor;
  }

  /**
   * Generates a single-line system prompt hint.
   * Returns "" (0 tokens) if the environment is clean or on a remote sandbox.
   */
  public getSystemPromptHint(platform = "cli"): string {
    const config = this.substrate.getConfig();
    if (!config.enabled) {
      return "";
    }

    if (config.skipRemoteBackends && REMOTE_PLATFORMS.has(platform.toLowerCase())) {
      return "";
    }

    let probe = this.substrate.getCachedProbe();
    if (!probe) {
      // Default clean probe fallback if not yet executed
      probe = this.executeProbe({
        pythonPath: "/usr/bin/python3",
        pipPath: "/usr/bin/pip",
        pythonVersion: "3.12.0",
        isPep668Managed: false,
        hasActiveVenv: false,
        nodeVersion: "v20.10.0",
        packageManager: "npm",
        probeDurationMs: 1,
      });
    }

    this.substrate.recordPromptHintGenerated();
    return probe.diagnosticHint;
  }
}
