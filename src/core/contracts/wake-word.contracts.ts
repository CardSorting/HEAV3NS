/**
 * wake-word.contracts.ts
 *
 * Core contracts, data types, and invariants for
 * Streaming Acoustic Wake-Word Detection, Ring-Buffer Audio Engine & Hands-Free Trigger
 * (Phase 121 / ADR-097 / Target #54).
 */

export type WakeWordEngineProvider = "openwakeword" | "sherpa" | "porcupine" | "heuristic";

export type WakeWordState = "idle" | "listening" | "triggered" | "paused" | "muted";

export interface WakeWordConfig {
  enabled: boolean;
  provider: WakeWordEngineProvider;
  phrase: string;
  sensitivity: number;
  confirmationFrames: number;
  cooldownSeconds: number;
}

export interface WakeWordFrameResult {
  triggered: boolean;
  state: WakeWordState;
  score: number;
  rmsEnergy: number;
  peakAmplitude: number;
  silent: boolean;
  consecutiveHits: number;
  phrase?: string;
  timestamp: number;
}

export interface WakeWordMetrics {
  framesProcessed: number;
  triggersCount: number;
  falsePositiveRejections: number;
  averageRms: number;
  silentFramesCount: number;
}

export interface WakeWordWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  state: WakeWordState;
  config: WakeWordConfig;
  history: readonly WakeWordFrameResult[];
  metrics: WakeWordMetrics;
}

export const DEFAULT_WAKE_WORD_CONFIG: WakeWordConfig = {
  enabled: true,
  provider: "openwakeword",
  phrase: "hey lumi",
  sensitivity: 0.6,
  confirmationFrames: 3,
  cooldownSeconds: 2.0,
};
