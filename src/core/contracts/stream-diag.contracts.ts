/**
 * stream-diag.contracts.ts
 *
 * Core contracts, interfaces, and invariants for LLM Stream Diagnostics,
 * Upstream Edge Forensic Header Capture & Exception Chain Breadcrumbs
 * (Phase 130 / ADR-106 / Target #63).
 */

export interface StreamDiagnosticAttempt {
  attemptId: string;
  provider: string;
  model: string;
  startedAt: number;
  firstChunkAt?: number;
  ttfbMs?: number;
  chunks: number;
  bytes: number;
  httpStatus?: number;
  headers: Record<string, string>;
  errorSummary?: string;
  exceptionChain?: string;
  elapsedMs: number;
  subagentId?: string;
  delegateDepth: number;
  midToolCall: boolean;
  status: "streaming" | "completed" | "dropped" | "retrying";
}

export interface StreamDropEvent {
  eventId: string;
  attemptId: string;
  timestamp: number;
  kind: "drop" | "drop mid tool-call";
  provider: string;
  model: string;
  attempt: number;
  maxAttempts: number;
  subagentId?: string;
  delegateDepth: number;
  httpStatus?: number;
  bytes: number;
  chunks: number;
  elapsedMs: number;
  ttfbMs?: number;
  upstreamHeaders: Record<string, string>;
  errorSummary: string;
  exceptionChain: string;
  userFacingMessage: string;
}

export interface StreamDiagConfig {
  monitoredHeaders: string[];
  maxTrackedAttempts: number;
  maxDropEvents: number;
  maxExceptionDepth: number;
  maxHeaderValueLength: number;
}

export interface StreamDiagMetrics {
  totalStreams: number;
  completedStreams: number;
  droppedStreams: number;
  retriedStreams: number;
  totalBytesStreamed: number;
  totalChunksStreamed: number;
  avgTtfbMs: number;
  avgStreamDurationMs: number;
}

export interface StreamDiagWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: StreamDiagConfig;
  metrics: StreamDiagMetrics;
  attempts: StreamDiagnosticAttempt[];
  dropEvents: StreamDropEvent[];
}

export const STREAM_DIAG_DEFAULT_HEADERS = [
  "cf-ray",
  "cf-cache-status",
  "x-openrouter-provider",
  "x-openrouter-model",
  "x-openrouter-id",
  "x-request-id",
  "x-vercel-id",
  "via",
  "server",
  "x-forwarded-for",
];

export const DEFAULT_STREAM_DIAG_CONFIG: StreamDiagConfig = {
  monitoredHeaders: [...STREAM_DIAG_DEFAULT_HEADERS],
  maxTrackedAttempts: 100,
  maxDropEvents: 50,
  maxExceptionDepth: 4,
  maxHeaderValueLength: 120,
};
