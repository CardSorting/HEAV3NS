/**
 * transcription.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * Multi-Provider Speech-to-Text Transcription, Diarization & Audio Ingestion
 * (Phase 124 / ADR-100 / Target #57).
 */

export type TranscriptionProvider =
  | "local"
  | "groq"
  | "openai"
  | "mistral"
  | "xai"
  | "elevenlabs"
  | "mock";

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface TranscriptionSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  confidence: number;
  words?: readonly WordTimestamp[];
}

export interface AudioTranscriptionResult {
  success: boolean;
  transcript: string;
  language?: string;
  durationMs: number;
  segments: readonly TranscriptionSegment[];
  provider: TranscriptionProvider;
  cached: boolean;
  audioHash?: string;
  error?: string;
}

export type TranscriptionResult = AudioTranscriptionResult;

export interface TranscriptionConfig {
  defaultProvider: TranscriptionProvider;
  fallbackProviders: readonly TranscriptionProvider[];
  defaultModel: string;
  defaultLanguage: string;
  enableDiarization: boolean;
  enablePunctuation: boolean;
  timeoutMs: number;
}

export interface TranscriptionMetrics {
  totalTranscriptions: number;
  totalAudioDurationMs: number;
  cacheHits: number;
  cacheMisses: number;
  providerUsage: Record<string, number>;
}

export interface CachedTranscriptRecord {
  audioHash: string;
  result: TranscriptionResult;
  timestamp: number;
  hitCount: number;
}

export interface TranscriptionWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  cache: readonly CachedTranscriptRecord[];
  metrics: TranscriptionMetrics;
}

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
  defaultProvider: "mock",
  fallbackProviders: ["local", "groq", "openai"],
  defaultModel: "whisper-1",
  defaultLanguage: "auto",
  enableDiarization: true,
  enablePunctuation: true,
  timeoutMs: 30000,
};
