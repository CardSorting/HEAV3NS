/**
 * env-probe.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Toolchain Environment Diagnostic Prober,
 * Prompt Hint Generator & Non-Blocking Substrate Subsystem (Phase 134 / ADR-110 / Target #67).
 */

export type ToolchainRuntimeKind = "python" | "node" | "rust" | "go" | "system";

export type ToolchainAnomalyCategory =
  | "pep668_managed"
  | "pip_missing"
  | "python_path_mismatch"
  | "node_mismatch"
  | "package_manager_missing"
  | "no_active_venv";

export interface ToolchainProbeDescriptor {
  pythonPath?: string;
  pipPath?: string;
  pythonVersion?: string;
  isPep668Managed: boolean;
  hasActiveVenv: boolean;
  venvPath?: string;
  nodeVersion?: string;
  packageManager?: string;
  detectedAnomalies: ToolchainAnomalyCategory[];
  diagnosticHint: string;
  probeDurationMs: number;
  timestamp: number;
}

export interface EnvProbeConfig {
  enabled: boolean;
  probeTimeoutMs: number;
  skipRemoteBackends: boolean;
  detectPython: boolean;
  detectNode: boolean;
  detectRust: boolean;
}

export interface EnvProbeMetrics {
  totalProbesRun: number;
  cacheHits: number;
  anomaliesDetected: number;
  promptHintsGenerated: number;
  lastProbeDurationMs: number;
}

export interface EnvProbeWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: EnvProbeConfig;
  cachedProbe?: ToolchainProbeDescriptor;
  metrics: EnvProbeMetrics;
}

export const DEFAULT_ENV_PROBE_CONFIG: EnvProbeConfig = {
  enabled: true,
  probeTimeoutMs: 500,
  skipRemoteBackends: true,
  detectPython: true,
  detectNode: true,
  detectRust: true,
};
