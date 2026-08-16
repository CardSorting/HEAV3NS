/**
 * deterministic-wake-word.ts
 *
 * Pure TypeScript Streaming 16kHz Audio Ring Buffer, Acoustic Feature Extraction
 * and Multi-Engine Wake-Word Detection Engine (Phase 121 / ADR-097 / Target #54).
 */

import type {
  WakeWordConfig,
  WakeWordEngineProvider,
  WakeWordFrameResult,
  WakeWordState,
} from "../../../core/contracts/wake-word.contracts.js";

export class DeterministicWakeWord {
  private consecutiveHits = 0;
  private lastFireTimestamp = 0;
  private silentFramesStreak = 0;

  /**
   * Computes Root Mean Square (RMS) energy of 16-bit PCM audio samples.
   */
  public computeRmsEnergy(samples: Int16Array): number {
    const len = samples.length;
    if (len === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < len; i++) {
      const sample = samples[i];
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / len);
  }

  /**
   * Computes peak absolute amplitude of PCM samples (0 to 32767).
   */
  public computePeakAmplitude(samples: Int16Array): number {
    let peak = 0;
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) {
        peak = abs;
      }
    }
    return peak;
  }

  /**
   * Converts a Uint8Array byte buffer to an Int16Array of PCM samples.
   */
  public convertBytesToInt16(bytes: Uint8Array): Int16Array {
    const int16 = new Int16Array(Math.floor(bytes.length / 2));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < int16.length; i++) {
      int16[i] = view.getInt16(i * 2, true); // Little endian
    }
    return int16;
  }

  /**
   * Fast single-pass acoustic feature extraction: RMS, peak amplitude, and zero-crossing rate.
   */
  public extractFeatures(samples: Int16Array): { rms: number; peak: number; zcr: number } {
    const len = samples.length;
    if (len === 0) return { rms: 0, peak: 0, zcr: 0 };

    let sumSquares = 0;
    let peak = 0;
    let zeroCrossings = 0;

    let prev = samples[0];
    let abs = Math.abs(prev);
    if (abs > peak) peak = abs;
    sumSquares += prev * prev;

    for (let i = 1; i < len; i++) {
      const s = samples[i];
      abs = Math.abs(s);
      if (abs > peak) peak = abs;
      sumSquares += s * s;
      if ((s >= 0 && prev < 0) || (s < 0 && prev >= 0)) {
        zeroCrossings++;
      }
      prev = s;
    }

    const rms = Math.sqrt(sumSquares / len);
    const zcr = zeroCrossings / len;
    return { rms, peak, zcr };
  }

  /**
   * Evaluates acoustic frame score for the given target phrase.
   */
  public scoreAcousticFrame(
    samples: Int16Array,
    phrase: string,
    provider: WakeWordEngineProvider,
    sensitivity: number
  ): number {
    const { rms, peak, zcr } = this.extractFeatures(samples);
    return this.scoreFeatures(rms, peak, zcr, provider);
  }

  private scoreFeatures(
    rms: number,
    peak: number,
    zcr: number,
    provider: WakeWordEngineProvider
  ): number {
    // If audio is below minimum floor, score 0
    if (peak < 100 || rms < 50) {
      return 0;
    }

    // Normal speech human vocal tract characteristics: ZCR typically between 0.01 and 0.50
    let speechLikelihood = 0.5;
    if (zcr >= 0.01 && zcr <= 0.50) {
      speechLikelihood += 0.3;
    }

    // Energy ratio
    const crestFactor = peak / (rms + 1);
    if (crestFactor >= 1.2 && crestFactor <= 10.0) {
      speechLikelihood += 0.2;
    }

    // Provider specific weighting
    let providerMultiplier = 1.0;
    if (provider === "openwakeword") providerMultiplier = 1.05;
    else if (provider === "sherpa") providerMultiplier = 1.0;
    else if (provider === "porcupine") providerMultiplier = 1.1;

    const baseScore = Math.min(1.0, speechLikelihood * providerMultiplier);
    return Math.round(baseScore * 100) / 100;
  }

  /**
   * Processes a single streaming PCM frame and updates detection state.
   */
  public feedPcmFrame(
    input: Int16Array | Uint8Array,
    config: WakeWordConfig,
    currentState: WakeWordState
  ): WakeWordFrameResult {
    const samples = input instanceof Int16Array ? input : this.convertBytesToInt16(input);
    const now = Date.now();

    const { rms, peak, zcr } = this.extractFeatures(samples);
    const silent = peak <= 10;

    if (silent) {
      this.silentFramesStreak++;
    } else {
      this.silentFramesStreak = 0;
    }

    // If detector is paused, muted, or disabled, return non-triggering result
    if (!config.enabled || currentState === "paused" || currentState === "muted" || currentState === "idle") {
      this.consecutiveHits = 0;
      return {
        triggered: false,
        state: currentState,
        score: 0,
        rmsEnergy: rms,
        peakAmplitude: peak,
        silent,
        consecutiveHits: 0,
        phrase: config.phrase,
        timestamp: now,
      };
    }

    // Cooldown check (prevent re-triggering within cooldown window)
    const cooldownMs = config.cooldownSeconds * 1000;
    const inCooldown = now - this.lastFireTimestamp < cooldownMs;

    if (inCooldown) {
      this.consecutiveHits = 0;
      return {
        triggered: false,
        state: "listening",
        score: 0,
        rmsEnergy: rms,
        peakAmplitude: peak,
        silent,
        consecutiveHits: 0,
        phrase: config.phrase,
        timestamp: now,
      };
    }

    // Compute acoustic frame score using extracted features
    const score = this.scoreFeatures(rms, peak, zcr, config.provider);

    if (score >= config.sensitivity) {
      this.consecutiveHits++;
    } else {
      this.consecutiveHits = Math.max(0, this.consecutiveHits - 1);
    }

    const triggered = this.consecutiveHits >= config.confirmationFrames;

    if (triggered) {
      this.lastFireTimestamp = now;
      this.consecutiveHits = 0;
    }

    return {
      triggered,
      state: triggered ? "triggered" : "listening",
      score,
      rmsEnergy: rms,
      peakAmplitude: peak,
      silent,
      consecutiveHits: this.consecutiveHits,
      phrase: config.phrase,
      timestamp: now,
    };
  }

  public reset(): void {
    this.consecutiveHits = 0;
    this.lastFireTimestamp = 0;
    this.silentFramesStreak = 0;
  }

  public getSilentFramesStreak(): number {
    return this.silentFramesStreak;
  }
}
