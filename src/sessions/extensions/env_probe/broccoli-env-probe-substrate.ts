/**
 * broccoli-env-probe-substrate.ts
 *
 * In-memory Broccolidb repository for caching toolchain probe descriptors,
 * configuration, metrics, and diagnostic anomalies (Phase 134 / ADR-110 / Target #67).
 */

import type {
  EnvProbeConfig,
  EnvProbeMetrics,
  EnvProbeWorkspaceSnapshot,
  ToolchainProbeDescriptor,
} from "../../../core/contracts/env-probe.contracts.js";
import { DEFAULT_ENV_PROBE_CONFIG } from "../../../core/contracts/env-probe.contracts.js";

export class BroccoliEnvProbeSubstrate {
  private config: EnvProbeConfig = { ...DEFAULT_ENV_PROBE_CONFIG };
  private cachedProbe?: ToolchainProbeDescriptor;
  private metrics: EnvProbeMetrics = {
    totalProbesRun: 0,
    cacheHits: 0,
    anomaliesDetected: 0,
    promptHintsGenerated: 0,
    lastProbeDurationMs: 0,
  };

  public setConfig(config: Partial<EnvProbeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): EnvProbeConfig {
    return { ...this.config };
  }

  public setCachedProbe(probe: ToolchainProbeDescriptor): void {
    this.cachedProbe = { ...probe };
    this.metrics.totalProbesRun++;
    this.metrics.lastProbeDurationMs = probe.probeDurationMs;
    this.metrics.anomaliesDetected += probe.detectedAnomalies.length;
  }

  public getCachedProbe(): ToolchainProbeDescriptor | undefined {
    if (this.cachedProbe) {
      this.metrics.cacheHits++;
      return { ...this.cachedProbe };
    }
    return undefined;
  }

  public invalidateCache(): void {
    this.cachedProbe = undefined;
  }

  public recordPromptHintGenerated(): void {
    this.metrics.promptHintsGenerated++;
  }

  public getMetrics(): EnvProbeMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): EnvProbeWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      cachedProbe: this.cachedProbe ? { ...this.cachedProbe } : undefined,
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: EnvProbeWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.cachedProbe = snapshot.cachedProbe ? { ...snapshot.cachedProbe } : undefined;
    this.metrics = { ...snapshot.metrics };
  }

  public clear(): void {
    this.config = { ...DEFAULT_ENV_PROBE_CONFIG };
    this.cachedProbe = undefined;
    this.metrics = {
      totalProbesRun: 0,
      cacheHits: 0,
      anomaliesDetected: 0,
      promptHintsGenerated: 0,
      lastProbeDurationMs: 0,
    };
  }
}
