/**
 * media-source.contracts.ts
 *
 * Core contracts, data types, and invariants for
 * Unified Media Source Resolver, Magic-Byte MIME Perception & Multimodal Ingestion
 * (Phase 122 / ADR-098 / Target #55).
 */

export type MediaSourceOrigin = "data" | "http" | "file" | "local" | "sandbox";

export type MediaKind = "image" | "video" | "audio" | "document" | "unknown";

export interface ResolvedMedia {
  data: Uint8Array;
  mime: string;
  kind: MediaKind;
  origin: MediaSourceOrigin;
  sizeBytes: number;
  width?: number;
  height?: number;
  sha256: string;
}

export interface MediaSourceConfig {
  maxIngestBytes: number;
  allowHttp: boolean;
  allowLocal: boolean;
  permittedKinds: readonly MediaKind[];
}

export interface MediaSourceMetrics {
  totalResolutions: number;
  totalBytesIngested: number;
  mimeCounts: Record<string, number>;
  failedResolutions: number;
}

export interface MediaSourceWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  history: readonly ResolvedMedia[];
  metrics: MediaSourceMetrics;
}

export const DEFAULT_MEDIA_SOURCE_CONFIG: MediaSourceConfig = {
  maxIngestBytes: 50 * 1024 * 1024, // 50MB
  allowHttp: true,
  allowLocal: true,
  permittedKinds: ["image", "video"],
};
