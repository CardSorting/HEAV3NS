/**
 * audio-container.contracts.ts
 *
 * Core contracts, enums, interfaces, and constants for Audio Container Magic-Byte Sniffer,
 * Streaming Audio Cache & Voice Extension Repair Subsystem (Phase 114 / ADR-090 / Target #47).
 */

export type AudioContainerId =
  | "ogg"
  | "flac"
  | "wav"
  | "mp3"
  | "aac"
  | "m4a"
  | "mp4"
  | "webm";

export type AudioMimeType =
  | "audio/ogg"
  | "audio/flac"
  | "audio/wav"
  | "audio/mpeg"
  | "audio/aac"
  | "audio/mp4"
  | "audio/webm"
  | "video/mp4";

export const CONTAINER_TO_EXT: Readonly<Record<AudioContainerId, string>> = {
  m4a: ".m4a",
  mp4: ".mp4",
  ogg: ".ogg",
  flac: ".flac",
  wav: ".wav",
  mp3: ".mp3",
  aac: ".aac",
  webm: ".webm",
};

export const CONTAINER_TO_MIME: Readonly<Record<AudioContainerId, AudioMimeType>> = {
  ogg: "audio/ogg",
  flac: "audio/flac",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "audio/webm",
};

export const MP4_AUDIO_BRANDS: readonly string[] = ["m4a ", "m4b "];

export interface AudioContainerDescriptor {
  readonly containerId: AudioContainerId;
  readonly canonicalExtension: string;
  readonly mimeType: AudioMimeType;
  readonly isAudioOnly: boolean;
  readonly magicByteDescription: string;
}

export interface AudioSniffResult {
  readonly containerId?: AudioContainerId;
  readonly canonicalExtension: string;
  readonly mimeType?: AudioMimeType;
  readonly recognized: boolean;
  readonly repairedExtension?: string;
  readonly isRepaired: boolean;
  readonly confidence: number;
}

export interface AudioCacheEntry {
  readonly cacheKey: string;
  readonly originalPathOrUrl: string;
  readonly containerId: AudioContainerId;
  readonly extension: string;
  readonly mimeType: AudioMimeType;
  readonly sizeBytes: number;
  readonly timestamp: number;
  readonly payloadBase64?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AudioWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly cachedEntries: readonly AudioCacheEntry[];
  readonly metrics: {
    readonly totalSniffs: number;
    readonly totalRepairs: number;
    readonly totalCachedBytes: number;
  };
}
