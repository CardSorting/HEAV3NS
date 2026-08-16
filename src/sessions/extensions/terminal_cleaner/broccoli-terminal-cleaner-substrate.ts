/**
 * broccoli-terminal-cleaner-substrate.ts
 *
 * In-memory Broccolidb repository for caching terminal cleaner configuration,
 * sanitization metrics, and binary asset safeguards (Phase 136 / ADR-112 / Target #69).
 */

import type {
  TerminalCleanerConfig,
  TerminalCleanerMetrics,
  TerminalCleanerWorkspaceSnapshot,
} from "../../../core/contracts/terminal-cleaner.contracts.js";
import { DEFAULT_TERMINAL_CLEANER_CONFIG } from "../../../core/contracts/terminal-cleaner.contracts.js";

export class BroccoliTerminalCleanerSubstrate {
  private config: TerminalCleanerConfig = { ...DEFAULT_TERMINAL_CLEANER_CONFIG };
  private metrics: TerminalCleanerMetrics = {
    totalStringsCleaned: 0,
    ansiSequencesStripped: 0,
    controlCharsFiltered: 0,
    opaqueDocumentWritesBlocked: 0,
    fastPathPasses: 0,
  };

  public setConfig(config: Partial<TerminalCleanerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): TerminalCleanerConfig {
    return { ...this.config };
  }

  public recordClean(params: {
    ansiStrippedCount?: number;
    controlFilteredCount?: number;
    fastPath?: boolean;
  }): void {
    this.metrics.totalStringsCleaned++;
    if (params.fastPath) {
      this.metrics.fastPathPasses++;
    }
    if (params.ansiStrippedCount) {
      this.metrics.ansiSequencesStripped += params.ansiStrippedCount;
    }
    if (params.controlFilteredCount) {
      this.metrics.controlCharsFiltered += params.controlFilteredCount;
    }
  }

  public recordBlockedOpaqueWrite(): void {
    this.metrics.opaqueDocumentWritesBlocked++;
  }

  public getMetrics(): TerminalCleanerMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): TerminalCleanerWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: TerminalCleanerWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
  }

  public clear(): void {
    this.config = { ...DEFAULT_TERMINAL_CLEANER_CONFIG };
    this.metrics = {
      totalStringsCleaned: 0,
      ansiSequencesStripped: 0,
      controlCharsFiltered: 0,
      opaqueDocumentWritesBlocked: 0,
      fastPathPasses: 0,
    };
  }
}
