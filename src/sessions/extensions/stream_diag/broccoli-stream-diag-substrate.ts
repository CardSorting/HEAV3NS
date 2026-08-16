/**
 * broccoli-stream-diag-substrate.ts
 *
 * In-memory Broccolidb repository storing stream attempts, drop events,
 * upstream header records, and performance metrics (Phase 130 / ADR-106 / Target #63).
 */

import type {
  StreamDiagConfig,
  StreamDiagnosticAttempt,
  StreamDiagMetrics,
  StreamDiagWorkspaceSnapshot,
  StreamDropEvent,
} from "../../../core/contracts/stream-diag.contracts.js";
import { DEFAULT_STREAM_DIAG_CONFIG } from "../../../core/contracts/stream-diag.contracts.js";

export class BroccoliStreamDiagSubstrate {
  private config: StreamDiagConfig = { ...DEFAULT_STREAM_DIAG_CONFIG };
  private attempts = new Map<string, StreamDiagnosticAttempt>();
  private dropEvents: StreamDropEvent[] = [];
  private metrics: StreamDiagMetrics = {
    totalStreams: 0,
    completedStreams: 0,
    droppedStreams: 0,
    retriedStreams: 0,
    totalBytesStreamed: 0,
    totalChunksStreamed: 0,
    avgTtfbMs: 0,
    avgStreamDurationMs: 0,
  };

  public setConfig(config: Partial<StreamDiagConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): StreamDiagConfig {
    return { ...this.config };
  }

  public recordAttempt(attempt: StreamDiagnosticAttempt): void {
    if (this.attempts.size >= this.config.maxTrackedAttempts) {
      const firstKey = this.attempts.keys().next().value;
      if (firstKey) this.attempts.delete(firstKey);
    }
    this.attempts.set(attempt.attemptId, { ...attempt, headers: { ...attempt.headers } });
    this.recalculateMetrics();
  }

  public getAttempt(attemptId: string): StreamDiagnosticAttempt | undefined {
    const a = this.attempts.get(attemptId);
    return a ? { ...a, headers: { ...a.headers } } : undefined;
  }

  public getAllAttempts(): StreamDiagnosticAttempt[] {
    return Array.from(this.attempts.values()).map((a) => ({
      ...a,
      headers: { ...a.headers },
    }));
  }

  public recordDropEvent(event: StreamDropEvent): void {
    this.dropEvents.push({ ...event, upstreamHeaders: { ...event.upstreamHeaders } });
    if (this.dropEvents.length > this.config.maxDropEvents) {
      this.dropEvents.shift();
    }
    this.metrics.droppedStreams++;
    this.metrics.retriedStreams++;
  }

  public getDropEvents(): StreamDropEvent[] {
    return this.dropEvents.map((e) => ({
      ...e,
      upstreamHeaders: { ...e.upstreamHeaders },
    }));
  }

  public recordStreamSuccess(bytes: number, chunks: number, ttfbMs?: number, elapsedMs = 0): void {
    this.metrics.totalStreams++;
    this.metrics.completedStreams++;

    if (ttfbMs !== undefined) {
      const prevTotal = this.metrics.avgTtfbMs * (this.metrics.completedStreams - 1);
      this.metrics.avgTtfbMs = (prevTotal + ttfbMs) / this.metrics.completedStreams;
    }

    const prevDurationTotal = this.metrics.avgStreamDurationMs * (this.metrics.completedStreams - 1);
    this.metrics.avgStreamDurationMs = (prevDurationTotal + elapsedMs) / this.metrics.completedStreams;
  }

  private recalculateMetrics(): void {
    let totalBytes = 0;
    let totalChunks = 0;
    for (const a of this.attempts.values()) {
      totalBytes += a.bytes;
      totalChunks += a.chunks;
    }
    this.metrics.totalBytesStreamed = totalBytes;
    this.metrics.totalChunksStreamed = totalChunks;
  }

  public getMetrics(): StreamDiagMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): StreamDiagWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      attempts: this.getAllAttempts(),
      dropEvents: this.getDropEvents(),
    };
  }

  public restoreSnapshot(snapshot: StreamDiagWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.attempts.clear();
    for (let i = 0; i < snapshot.attempts.length; i++) {
      const a = snapshot.attempts[i];
      this.attempts.set(a.attemptId, { ...a, headers: { ...a.headers } });
    }
    this.dropEvents = snapshot.dropEvents.map((e) => ({
      ...e,
      upstreamHeaders: { ...e.upstreamHeaders },
    }));
  }

  public clear(): void {
    this.config = { ...DEFAULT_STREAM_DIAG_CONFIG };
    this.attempts.clear();
    this.dropEvents = [];
    this.metrics = {
      totalStreams: 0,
      completedStreams: 0,
      droppedStreams: 0,
      retriedStreams: 0,
      totalBytesStreamed: 0,
      totalChunksStreamed: 0,
      avgTtfbMs: 0,
      avgStreamDurationMs: 0,
    };
  }
}
