/**
 * deadline-supervisor.ts
 *
 * Master supervisor coordinating unified deadlines, bounded wall-clock execution,
 * global Emergency Stop (ESTOP) lifecycle, and new work gating (Phase 125 / ADR-101 / Target #58).
 */

import type { BroccoliDeadlineSubstrate } from "../../../sessions/extensions/deadline/broccoli-deadline-substrate.js";
import type { DeterministicDeadlineEngine } from "./deterministic-deadline-engine.js";
import type {
  BoundedResult,
  DeadlineConfig,
  DeadlineMetrics,
  EstopState,
} from "../../../core/contracts/deadline.contracts.js";

export class DeadlineSupervisor {
  private readonly substrate: BroccoliDeadlineSubstrate;
  private readonly engine: DeterministicDeadlineEngine;

  constructor(
    substrate: BroccoliDeadlineSubstrate,
    engine: DeterministicDeadlineEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<DeadlineConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): DeadlineConfig {
    return this.substrate.getConfig();
  }

  /**
   * Evaluates if new work is permitted or blocked by active ESTOP.
   */
  public canStartNewWork(baseDir?: string): { allowed: boolean; reason?: string } {
    const config = this.substrate.getConfig();
    if (!config.enforceEstopOnNewWork) {
      return { allowed: true };
    }

    const state = this.getEstopState(baseDir);
    if (state.engaged) {
      this.substrate.recordEstopRejection();
      return {
        allowed: false,
        reason: `LUMI is currently paused (ESTOP engaged): ${state.reason || "Emergency Stop"}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Executes a task within a strict bounded deadline lease.
   */
  public async runBounded<T>(
    fn: () => Promise<T>,
    timeoutMs?: number,
    baseDir?: string
  ): Promise<BoundedResult<T>> {
    // 1. Check if new work is blocked by ESTOP
    const workCheck = this.canStartNewWork(baseDir);
    if (!workCheck.allowed) {
      return {
        success: false,
        error: workCheck.reason,
        durationMs: 0,
        outcome: "estopped",
        timedOut: false,
      };
    }

    const config = this.substrate.getConfig();
    const resolvedTimeout = this.engine.resolveTimeout(timeoutMs, config.defaultTimeoutMs);

    this.substrate.recordExecutionStart();
    const result = await this.engine.runBoundedAsync(fn, resolvedTimeout);
    this.substrate.recordExecutionEnd(result.timedOut);

    return result;
  }

  /**
   * Engages global Emergency Stop across memory and optional filesystem sentinel.
   */
  public engageEstop(reason?: string, engagedBy = "operator", baseDir?: string): EstopState {
    const config = this.substrate.getConfig();
    this.substrate.setEstop(true, reason, engagedBy);

    if (baseDir) {
      this.engine.writeFsSentinel(baseDir, true, reason, config.sentinelFilename);
    }

    return this.substrate.getEstopState();
  }

  /**
   * Lifts global Emergency Stop.
   */
  public disengageEstop(baseDir?: string): boolean {
    const config = this.substrate.getConfig();
    this.substrate.setEstop(false);

    if (baseDir) {
      this.engine.writeFsSentinel(baseDir, false, undefined, config.sentinelFilename);
    }

    return true;
  }

  /**
   * Retrieves active ESTOP state (merging in-memory and filesystem sentinel).
   */
  public getEstopState(baseDir?: string): EstopState {
    const memState = this.substrate.getEstopState();
    if (memState.engaged) {
      return memState;
    }

    if (baseDir) {
      const config = this.substrate.getConfig();
      const fsState = this.engine.checkFsSentinel(baseDir, config.sentinelFilename);
      if (fsState.engaged) {
        this.substrate.setEstop(true, fsState.reason, fsState.engagedBy);
        return fsState;
      }
    }

    return memState;
  }

  public isEstopEngaged(baseDir?: string): boolean {
    return this.getEstopState(baseDir).engaged;
  }

  public getMetrics(): DeadlineMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
