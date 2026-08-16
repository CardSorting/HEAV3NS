/**
 * deterministic-env-probe-engine.ts
 *
 * Pure TypeScript deterministic engine for toolchain diagnostic sensing,
 * PEP-668 inspection, and single-line prompt hint generation (Phase 134 / ADR-110 / Target #67).
 */

import type {
  ToolchainAnomalyCategory,
  ToolchainProbeDescriptor,
} from "../../../core/contracts/env-probe.contracts.js";

export class DeterministicEnvProbeEngine {
  /**
   * Analyzes probe raw inputs and classifies toolchain anomalies.
   */
  public analyzeToolchain(params: {
    pythonPath?: string;
    pipPath?: string;
    pythonVersion?: string;
    isPep668Managed?: boolean;
    hasActiveVenv?: boolean;
    venvPath?: string;
    nodeVersion?: string;
    packageManager?: string;
    probeDurationMs: number;
  }): ToolchainProbeDescriptor {
    const anomalies: ToolchainAnomalyCategory[] = [];

    // 1. PEP 668 Externally Managed
    if (params.isPep668Managed && !params.hasActiveVenv) {
      anomalies.push("pep668_managed");
    }

    // 2. Missing pip
    if (params.pythonPath && !params.pipPath) {
      anomalies.push("pip_missing");
    }

    // 3. Python vs Pip path mismatch
    if (params.pythonPath && params.pipPath) {
      const pyDir = params.pythonPath.substring(0, params.pythonPath.lastIndexOf("/"));
      const pipDir = params.pipPath.substring(0, params.pipPath.lastIndexOf("/"));
      if (pyDir !== pipDir) {
        anomalies.push("python_path_mismatch");
      }
    }

    // 4. Missing package manager when node is present
    if (params.nodeVersion && !params.packageManager) {
      anomalies.push("package_manager_missing");
    }

    // 5. No active venv in complex environment
    if (params.pythonPath && !params.hasActiveVenv && params.isPep668Managed) {
      anomalies.push("no_active_venv");
    }

    const diagnosticHint = this.formatDiagnosticHint(anomalies, params);

    return {
      pythonPath: params.pythonPath,
      pipPath: params.pipPath,
      pythonVersion: params.pythonVersion,
      isPep668Managed: !!params.isPep668Managed,
      hasActiveVenv: !!params.hasActiveVenv,
      venvPath: params.venvPath,
      nodeVersion: params.nodeVersion,
      packageManager: params.packageManager,
      detectedAnomalies: anomalies,
      diagnosticHint,
      probeDurationMs: params.probeDurationMs,
      timestamp: Date.now(),
    };
  }

  /**
   * Generates at most ONE concise single-line hint string for the system prompt.
   * If no anomalies exist, returns "" (0 token overhead).
   */
  public formatDiagnosticHint(
    anomalies: ToolchainAnomalyCategory[],
    info: {
      pythonPath?: string;
      pipPath?: string;
      isPep668Managed?: boolean;
      packageManager?: string;
    }
  ): string {
    if (anomalies.length === 0) {
      return "";
    }

    if (anomalies.includes("pep668_managed")) {
      return "Note: System Python is PEP 668 externally-managed; use 'uv pip' or 'python3 -m venv' for installs.";
    }

    if (anomalies.includes("pip_missing")) {
      return "Note: System python3 has no standalone 'pip'; run via 'python3 -m pip' or create a venv.";
    }

    if (anomalies.includes("python_path_mismatch")) {
      return `Note: 'pip' and 'python3' resolve to different directories (${info.pipPath} vs ${info.pythonPath}); invoke via 'python3 -m pip'.`;
    }

    if (anomalies.includes("package_manager_missing")) {
      return "Note: Node.js runtime detected without npm/pnpm/yarn; check PATH before running frontend scripts.";
    }

    return "Note: Non-standard local toolchain configuration detected; verify package manager paths before installing dependencies.";
  }
}
