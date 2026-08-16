/**
 * wake-word-supervisor.ts
 *
 * Master supervisor coordinating streaming audio intake, detector state machine,
 * voice output pause/resume hooks, and in-memory substrate tracking
 * (Phase 121 / ADR-097 / Target #54).
 */

import type { BroccoliWakeWordSubstrate } from "../../../sessions/extensions/wake_word/broccoli-wake-word-substrate.js";
import type { DeterministicWakeWord } from "./deterministic-wake-word.js";
import type {
  WakeWordConfig,
  WakeWordFrameResult,
  WakeWordMetrics,
  WakeWordState,
} from "../../../core/contracts/wake-word.contracts.js";

export class WakeWordSupervisor {
  private readonly substrate: BroccoliWakeWordSubstrate;
  private readonly detector: DeterministicWakeWord;

  constructor(
    substrate: BroccoliWakeWordSubstrate,
    detector: DeterministicWakeWord
  ) {
    this.substrate = substrate;
    this.detector = detector;
  }

  public feedAudio(chunk: Int16Array | Uint8Array): WakeWordFrameResult {
    const config = this.substrate.getConfig();
    const currentState = this.substrate.getState();

    const result = this.detector.feedPcmFrame(chunk, config, currentState);
    this.substrate.recordFrame(result);

    if (result.triggered) {
      this.substrate.setState("triggered");
    }

    return result;
  }

  public configure(updates: Partial<WakeWordConfig>): void {
    this.substrate.setConfig(updates);
    this.detector.reset();
  }

  public getConfig(): WakeWordConfig {
    return this.substrate.getConfig();
  }

  public startListening(): void {
    this.detector.reset();
    this.substrate.setState("listening");
  }

  public pause(): void {
    this.substrate.setState("paused");
  }

  public resume(): void {
    this.substrate.setState("listening");
  }

  public mute(): void {
    this.substrate.setState("muted");
  }

  public unmute(): void {
    this.substrate.setState("listening");
  }

  public reset(): void {
    this.detector.reset();
    this.substrate.clear();
  }

  public getState(): WakeWordState {
    return this.substrate.getState();
  }

  public getHistory(): readonly WakeWordFrameResult[] {
    return this.substrate.getHistory();
  }

  public getMetrics(): WakeWordMetrics {
    return this.substrate.getMetrics();
  }

  public isDeadMic(): boolean {
    // 125 frames of silence at 80ms/frame corresponds to 10 seconds of zero audio
    return this.detector.getSilentFramesStreak() >= 125;
  }
}
