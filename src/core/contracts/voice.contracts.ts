/**
 * voice.contracts.ts
 *
 * Core data contracts for the Deterministic Voice Mode, Speech Perception & Real-Time Audio Streaming Substrate (Phase 79 / ADR-031).
 */

export type AudioFormat = "wav" | "mp3" | "ogg" | "pcm" | "opus";

export type AudioSampleRate = 8000 | 16000 | 22050 | 24000 | 44100 | 48000;

export type VoiceProvider = "edge" | "openai" | "elevenlabs" | "groq" | "mistral" | "local";

export interface VoiceProfile {
  readonly id: string;
  readonly name: string;
  readonly provider: VoiceProvider;
  readonly language: string;
  readonly gender?: "male" | "female" | "neutral";
  readonly sampleRate: AudioSampleRate;
}

export interface AudioChunk {
  readonly chunkIndex: number;
  readonly data: Uint8Array;
  readonly timestamp: number;
  readonly isFinal: boolean;
}

export interface TranscriptionWord {
  readonly word: string;
  readonly start: number;
  readonly end: number;
}

export interface TranscriptionResult {
  readonly text: string;
  readonly language: string;
  readonly durationSeconds: number;
  readonly confidence: number;
  readonly words?: readonly TranscriptionWord[];
}

export interface SpeechSynthesisResult {
  readonly audioData: Uint8Array;
  readonly format: AudioFormat;
  readonly durationSeconds: number;
  readonly sampleRate: AudioSampleRate;
  readonly byteLength: number;
}

export interface VadDecision {
  readonly isSpeech: boolean;
  readonly energyRms: number;
  readonly dbFs: number;
  readonly threshold: number;
  readonly frameTimestamp: number;
}

export interface VoiceSessionState {
  readonly sessionId: string;
  readonly activeVoice: VoiceProfile;
  readonly isRecording: boolean;
  readonly isPlaying: boolean;
  readonly bufferedAudioBytes: number;
  readonly transcriptHistory: readonly string[];
  readonly lastUpdated: number;
}

export interface VoiceWorkspaceSnapshot {
  readonly activeSessions: readonly VoiceSessionState[];
  readonly registeredVoices: readonly VoiceProfile[];
  readonly totalTranscripts: number;
  readonly timestamp: number;
}
