/**
 * broccoli-wake-word-substrate.ts
 *
 * In-memory Broccolidb repository storing active wake-word detector state,
 * trigger events, acoustic frame statistics, and detection metrics
 * (Phase 121 / ADR-097 / Target #54).
 */

import type {
  WakeWordConfig,
  WakeWordFrameResult,
  WakeWordMetrics,
  WakeWordState,
  WakeWordWorkspaceSnapshot,
} from "../../../core/contracts/wake-word.contracts.js";
import { DEFAULT_WAKE_WORD_CONFIG } from "../../../core/contracts/wake-word.contracts.js";

export class BroccoliWakeWordSubstrate {
  private state: WakeWordState = "idle";
  private config: WakeWordConfig = { ...DEFAULT_WAKE_WORD_CONFIG };
  private readonly history: WakeWordFrameResult[] = [];
  private framesProcessed = 0;
  private triggersCount = 0;
  private falsePositiveRejections = 0;
  private totalRmsAccumulated = 0;
  private silentFramesCount = 0;

  public setState(state: WakeWordState): void {
    this.state = state;
  }

  public getState(): WakeWordState {
    return this.state;
  }

  public setConfig(config: Partial<WakeWordConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): WakeWordConfig {
    return { ...this.config };
  }

  public recordFrame(result: WakeWordFrameResult): void {
    this.framesProcessed++;
    this.totalRmsAccumulated += result.rmsEnergy;

    if (result.silent) {
      this.silentFramesCount++;
    }

    if (result.triggered) {
      this.triggersCount++;
      this.history.push(result);
      if (this.history.length > 500) {
        this.history.shift();
      }
    } else if (result.score >= this.config.sensitivity && result.consecutiveHits < this.config.confirmationFrames) {
      this.falsePositiveRejections++;
    }
  }

  public getHistory(): readonly WakeWordFrameResult[] {
    return this.history;
  }

  public getMetrics(): WakeWordMetrics {
    const averageRms = this.framesProcessed > 0 ? this.totalRmsAccumulated / this.framesProcessed : 0;
    return {
      framesProcessed: this.framesProcessed,
      triggersCount: this.triggersCount,
      falsePositiveRejections: this.falsePositiveRejections,
      averageRms: Math.round(averageRms * 100) / 100,
      silentFramesCount: this.silentFramesCount,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): WakeWordWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      state: this.state,
      config: { ...this.config },
      history: [...this.history],
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: WakeWordWorkspaceSnapshot): void {
    this.state = snapshot.state;
    this.config = { ...snapshot.config };
    this.history.length = 0;
    this.history.push(...snapshot.history);

    this.framesProcessed = snapshot.metrics.framesProcessed;
    this.triggersCount = snapshot.metrics.triggersCount;
    this.falsePositiveRejections = snapshot.metrics.falsePositiveRejections;
    this.silentFramesCount = snapshot.metrics.silentFramesCount;
    this.totalRmsAccumulated = snapshot.metrics.averageRms * this.framesProcessed;
  }

  public clear(): void {
    this.state = "idle";
    this.history.length = 0;
    this.framesProcessed = 0;
    this.triggersCount = 0;
    this.falsePositiveRejections = 0;
    this.totalRmsAccumulated = 0;
    this.silentFramesCount = 0;
  }
}
