/**
 * broccoli-file-safety-substrate.ts
 *
 * In-memory Broccolidb repository storing file safety rules, safe root policies,
 * custom denied paths, audit logs, and evaluation metrics (Phase 126 / ADR-102 / Target #59).
 */

import type {
  FileSafetyMetrics,
  FileSafetyPolicyConfig,
  FileSafetyWorkspaceSnapshot,
} from "../../../core/contracts/file-safety.contracts.js";
import { DEFAULT_FILE_SAFETY_CONFIG } from "../../../core/contracts/file-safety.contracts.js";

export class BroccoliFileSafetySubstrate {
  private config: FileSafetyPolicyConfig = { ...DEFAULT_FILE_SAFETY_CONFIG };
  private totalEvaluations = 0;
  private writesAllowed = 0;
  private writesDenied = 0;
  private readsEvaluated = 0;
  private approvalsRequired = 0;

  public setConfig(config: Partial<FileSafetyPolicyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      safeRoots: config.safeRoots ? [...config.safeRoots] : this.config.safeRoots,
      customDeniedPaths: config.customDeniedPaths ? [...config.customDeniedPaths] : this.config.customDeniedPaths,
      customDeniedPrefixes: config.customDeniedPrefixes ? [...config.customDeniedPrefixes] : this.config.customDeniedPrefixes,
    };
  }

  public getConfig(): FileSafetyPolicyConfig {
    return {
      ...this.config,
      safeRoots: [...this.config.safeRoots],
      customDeniedPaths: [...this.config.customDeniedPaths],
      customDeniedPrefixes: [...this.config.customDeniedPrefixes],
    };
  }

  public addSafeRoot(rootPath: string): void {
    if (rootPath && !this.config.safeRoots.includes(rootPath)) {
      this.config.safeRoots.push(rootPath);
    }
  }

  public addCustomDeniedPath(path: string): void {
    if (path && !this.config.customDeniedPaths.includes(path)) {
      this.config.customDeniedPaths.push(path);
    }
  }

  public addCustomDeniedPrefix(prefix: string): void {
    if (prefix && !this.config.customDeniedPrefixes.includes(prefix)) {
      this.config.customDeniedPrefixes.push(prefix);
    }
  }

  public recordEvaluation(isWrite: boolean, allowed: boolean, requiresApproval: boolean): void {
    this.totalEvaluations++;
    if (isWrite) {
      if (allowed) {
        this.writesAllowed++;
      } else {
        this.writesDenied++;
      }
    } else {
      this.readsEvaluated++;
    }
    if (requiresApproval) {
      this.approvalsRequired++;
    }
  }

  public getMetrics(): FileSafetyMetrics {
    return {
      totalEvaluations: this.totalEvaluations,
      writesAllowed: this.writesAllowed,
      writesDenied: this.writesDenied,
      readsEvaluated: this.readsEvaluated,
      approvalsRequired: this.approvalsRequired,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): FileSafetyWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: FileSafetyWorkspaceSnapshot): void {
    this.config = {
      ...snapshot.config,
      safeRoots: [...snapshot.config.safeRoots],
      customDeniedPaths: [...snapshot.config.customDeniedPaths],
      customDeniedPrefixes: [...snapshot.config.customDeniedPrefixes],
    };
    this.totalEvaluations = snapshot.metrics.totalEvaluations;
    this.writesAllowed = snapshot.metrics.writesAllowed;
    this.writesDenied = snapshot.metrics.writesDenied;
    this.readsEvaluated = snapshot.metrics.readsEvaluated;
    this.approvalsRequired = snapshot.metrics.approvalsRequired;
  }

  public clear(): void {
    this.config = { ...DEFAULT_FILE_SAFETY_CONFIG };
    this.totalEvaluations = 0;
    this.writesAllowed = 0;
    this.writesDenied = 0;
    this.readsEvaluated = 0;
    this.approvalsRequired = 0;
  }
}
