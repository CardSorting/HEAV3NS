/**
 * @file LUMI-NEW/src/relay/relay-server.ts
 * @description Hardened Enterprise VM Relay Server & WebSocket Streaming Gateway powered by BroccoliDB.
 *
 * Architecture & Security Hardening:
 * 1. Zero-Trust Security & API Key Authentication:
 *    - Constant-time timing-safe credential verification (crypto.timingSafeEqual) against side-channel attacks.
 *    - Hardware-grade AES-256-GCM envelope decryption for encrypted shard fleets (.galx-shards.json) with AAD binding.
 *    - 2 MB maximum payload guardrail (HTTP 413) & 10s Slowloris read timeout.
 * 2. Multi-Tenant Token-Bucket Rate Governor:
 *    - Per-tenant / per-key continuous leaky bucket with burst absorption and Retry-After headers.
 * 3. BroccoliDB Zenith-Tier Storage & Crash-Resilient Checkpointing:
 *    - relay_jobs: Sub-microsecond secondary indexes on status, model, shardId, and sorted createdAtMs.
 *    - relay_tokens: Sub-microsecond indexed lookups for Last-Event-ID token replay with native TTL auto-eviction.
 *    - relay_idempotency: Atomic Idempotent Stream Attachment via SHA-256 promptHash collapsing.
 *    - relay_shards: SWRR quota tracking & sliding 3-hour window meter.
 *    - Atomic file checkpointing (.broccolidb/relay-snapshot.json.tmp -> rename) for zero-corruption state recovery.
 * 4. Circuit Breakers & Outlier Detection:
 *    - 3-strike shard isolation on 5xx/429/TLS failures with 60s cooldown and AWS full-jitter backoff.
 * 5. Two-Tier Disconnect Protocol:
 *    - 15s Reconnect Grace Window for dirty drops vs instant <5ms wire abort for clean cancellations (Figma / Liveblocks).
 * 6. Dual-Heartbeat & Dead-Peer Detection:
 *    - Discord-style full-jitter WS pings with 5s pong deadline; instant TCP RST termination (ws.terminate()).
 *    - Periodic SSE comment heartbeats (: ping\n\n) to permanently defeat Cloudflare 100s idle timeouts.
 * 7. 7-Layer WebSocket Timeout Hierarchy (Connect, Model-Adaptive TTFT, EWMA ITL Gap, Intra-Chunk, Grace, Proxy Keepalive, Wall-Time).
 * 8. Downstream Backpressure Flow Control with High-Water Mark Bounded RingBuffer (Slack Flannel pattern).
 * 9. Graceful Drain on SIGTERM/SIGINT with 30s in-flight completion window.
 * 10. Authority Boundary:
 *    - JobQueue governs only bounded relay-delivery lifecycle; it is not authoritative agent-execution state.
 *    - Governed executions arrive as supervisor-authorized intents; WS/SSE remain projections and observations.
 */

import * as http from 'node:http';
import * as url from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { BroccoliDbTable } from '../sessions/extensions/substrate/broccolidb-table.js';

// ============================================================================
// CONFIGURATION & TIMEOUT TAXONOMY (Layer 0 through Layer 6)
// ============================================================================

export interface RelayConfig {
  port: number;
  host: string;
  wsEndpoint: string;
  shardsJsonPath?: string;
  stateSnapshotPath: string;
  masterSecret?: string;
  apiKeys?: string[];
  maxPayloadBytes: number;
  httpBodyTimeoutMs: number;
  // Multi-Tenant Rate Governance
  tenantRateLimitPerSec: number;
  tenantBurstCapacity: number;
  // 7-Layer Timeout Hierarchy & Anti-Fragility
  wsConnectTimeoutMs: number;          // Layer 0: TCP + TLS + Upgrade handshake budget (15s)
  wsTtftTimeoutMs: number;             // Layer 1: Time-To-First-Token base ceiling (60s)
  deepReasoningTtftMultiplier: number; // Layer 1: Multiplier for high-effort reasoning (2.0 = 120s)
  reasoningActivityExtensionMs: number;// Layer 1: Extension on receiving thinking progress (15s)
  itlGapThresholdMs: number;           // Layer 2: Inter-token latency stall trigger (8s)
  itlConsecutiveLimit: number;         // Layer 2: Hard abort after N consecutive ITL gaps (3)
  wsIntraChunkTimeoutMs: number;       // Layer 3: Silence between chunks (45s) - RESETS ON EVERY CHUNK
  clientDisconnectGraceMs: number;     // Layer 4: Wi-Fi glitch / cellular handoff grace window (15s)
  sseKeepaliveIntervalMs: number;      // Layer 5: SSE comment heartbeat interval (: ping\n\n) (15s)
  wsDeadPeerPingIntervalMs: number;    // Layer 5: Outbound WS ping interval with jitter (20s)
  wsDeadPeerPongTimeoutMs: number;     // Layer 5: WS pong ACK timeout before eviction (5s)
  jobMaxWallTimeMs: number;            // Layer 6: Absolute safety wall-clock cap (300s / 5 min)
  // Anti-Fragile Failover & Recovery
  maxUpstreamRetries: number;          // In-flight shard failovers before failing job (3)
  retryBaseDelayMs: number;            // Base backoff delay for retries (500ms)
  retryMaxDelayMs: number;             // Backoff ceiling for full jitter (5000ms)
  deDuplicationOverlapWindowChars: number; // Suffix window length for overlap reconciliation (128 chars)
  // Memory & Buffer Limits
  jobTokenRetentionMs: number;         // Post-completion buffer retention (10 min)
  maxBufferedTokensPerJob: number;     // Ring-buffer high-water mark
  busMaxListenersPerJob: number;       // Maximum SSE subscribers admitted per job
  maxPendingFramesPerSubscriber: number; // Per-subscriber outbound queue cap
  subscriberDrainTimeoutMs: number;    // Evict a subscriber that never drains
  drainTimeoutMs: number;              // Graceful shutdown drain deadline (30s)
  idempotencyTtlMs: number;            // Prompt deduplication TTL (120s)
  snapshotIntervalMs: number;          // Periodic disk checkpoint interval (60s)
}

const DEFAULT_CONFIG: RelayConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  wsEndpoint: process.env.CODEX_WS_ENDPOINT || 'wss://chatgpt.com/backend-api/codex/responses',
  shardsJsonPath: process.env.GALX_SHARDS_JSON_PATH || path.join(process.cwd(), '.galx-shards.json'),
  stateSnapshotPath: process.env.RELAY_STATE_SNAPSHOT_PATH || path.join(process.cwd(), '.broccolidb', 'relay-snapshot.json'),
  masterSecret: process.env.GALX_VAULT_MASTER_SECRET || process.env.GALX_VAULT_KEY,
  apiKeys: process.env.RELAY_API_KEYS ? process.env.RELAY_API_KEYS.split(',').map((k) => k.trim()) : undefined,
  maxPayloadBytes: parseInt(process.env.MAX_PAYLOAD_BYTES || '2097152', 10), // 2 MB
  httpBodyTimeoutMs: parseInt(process.env.HTTP_BODY_TIMEOUT_MS || '10000', 10), // 10s
  tenantRateLimitPerSec: parseFloat(process.env.TENANT_RATE_LIMIT_PER_SEC || '50.0'),
  tenantBurstCapacity: parseInt(process.env.TENANT_BURST_CAPACITY || '100', 10),
  wsConnectTimeoutMs: parseInt(process.env.WS_CONNECT_TIMEOUT_MS || '15000', 10),
  wsTtftTimeoutMs: parseInt(process.env.WS_TTFT_TIMEOUT_MS || '60000', 10),
  deepReasoningTtftMultiplier: parseFloat(process.env.DEEP_REASONING_TTFT_MULTIPLIER || '2.0'),
  reasoningActivityExtensionMs: parseInt(process.env.REASONING_ACTIVITY_EXTENSION_MS || '15000', 10),
  itlGapThresholdMs: parseInt(process.env.ITL_GAP_THRESHOLD_MS || '8000', 10),
  itlConsecutiveLimit: parseInt(process.env.ITL_CONSECUTIVE_LIMIT || '3', 10),
  wsIntraChunkTimeoutMs: parseInt(process.env.WS_INTRA_CHUNK_TIMEOUT_MS || '45000', 10),
  clientDisconnectGraceMs: parseInt(process.env.CLIENT_DISCONNECT_GRACE_MS || '15000', 10),
  sseKeepaliveIntervalMs: parseInt(process.env.SSE_KEEPALIVE_INTERVAL_MS || '15000', 10),
  wsDeadPeerPingIntervalMs: parseInt(process.env.WS_DEAD_PEER_PING_INTERVAL_MS || '20000', 10),
  wsDeadPeerPongTimeoutMs: parseInt(process.env.WS_DEAD_PEER_PONG_TIMEOUT_MS || '5000', 10),
  jobMaxWallTimeMs: parseInt(process.env.JOB_MAX_WALL_TIME_MS || '300000', 10),
  maxUpstreamRetries: parseInt(process.env.MAX_UPSTREAM_RETRIES || '3', 10),
  retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '500', 10),
  retryMaxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '5000', 10),
  deDuplicationOverlapWindowChars: parseInt(process.env.DEDUPLICATION_OVERLAP_WINDOW_CHARS || '128', 10),
  jobTokenRetentionMs: parseInt(process.env.JOB_TOKEN_RETENTION_MS || '600000', 10),
  maxBufferedTokensPerJob: parseInt(process.env.MAX_BUFFERED_TOKENS_PER_JOB || '10000', 10),
  busMaxListenersPerJob: parseInt(process.env.BUS_MAX_LISTENERS_PER_JOB || '50', 10),
  maxPendingFramesPerSubscriber: parseInt(process.env.MAX_PENDING_FRAMES_PER_SUBSCRIBER || '256', 10),
  subscriberDrainTimeoutMs: parseInt(process.env.SUBSCRIBER_DRAIN_TIMEOUT_MS || '5000', 10),
  drainTimeoutMs: parseInt(process.env.DRAIN_TIMEOUT_MS || '30000', 10),
  idempotencyTtlMs: parseInt(process.env.IDEMPOTENCY_TTL_MS || '120000', 10),
  snapshotIntervalMs: parseInt(process.env.SNAPSHOT_INTERVAL_MS || '60000', 10),
};

// ============================================================================
// BROCCOLIDB DATA CONTRACTS & SCHEMAS
// ============================================================================

export interface JobRecord extends Record<string, unknown> {
  id: string;
  model: string;
  prompt: string;
  promptHash: string;
  tenantId: string;
  status: 'queued' | 'running' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  createdAtMs: number;
  startedAtMs?: number;
  completedAtMs?: number;
  shardId?: string;
  seqCounter: number;
  isDetached: boolean;
  error?: string;
  estimatedTokens: number;
  messagesJson: string;
  reasoningEffort?: string;
  retryCount?: number;
  failoverCount?: number;
  lastShardId?: string;
}

export interface JobTokenRecord extends Record<string, unknown> {
  id: string; // `${jobId}_${seqNo}`
  jobId: string;
  seqNo: number;
  text: string;
  isFinal: boolean;
  timestampMs: number;
}

export interface IdempotencyRecord extends Record<string, unknown> {
  id: string; // promptHash
  jobId: string;
  createdAtMs: number;
}

export interface ShardRecord extends Record<string, unknown> {
  id: string; // shardId
  accountId: string;
  accessToken: string;
  status: 'active' | 'exhausted' | 'cooldown';
  consecutiveFailures: number;
  lastUsedAtMs: number;
  inFlight: number;
  slidingWindowTimestamps: number[];
}

interface TransientJobSession {
  abortController: AbortController;
  graceTimer?: NodeJS.Timeout;
  upstreamWs?: any;
  connectTimer?: NodeJS.Timeout;
  ttftTimer?: NodeJS.Timeout;
  intraChunkTimer?: NodeJS.Timeout;
  wallTimer?: NodeJS.Timeout;
  wsPingTimer?: NodeJS.Timeout;
  heartbeatAckTimeoutTimer?: NodeJS.Timeout;
  downstreamFailoverKeepaliveTimer?: NodeJS.Timeout;
  lastChunkAtMs: number;
  ewmaItlMs: number;
  consecutiveItlStalls: number;
  retryCount: number;
  lastSeenAliveMs: number;
  activeTtftDeadlineMs: number;
  currentShardId?: string;
  activeAttemptId: number;
}

interface TransportAttempt {
  id: number;
  shardId: string;
  hasReceivedFirstToken: boolean;
  heartbeatPending: boolean;
  completionObserved: boolean;
  isFirstChunkAfterFailover: boolean;
  priorFailoverSuffix?: string;
}

type JobBusEvent =
  | { type: 'job:transport_token'; jobId: string; attemptId: number; shardId: string; text: string; timestampMs: number }
  | { type: 'job:transport_completed'; jobId: string; attemptId: number; shardId: string }
  | { type: 'job:token'; jobId: string; token: JobTokenRecord }
  | { type: 'job:reasoning'; jobId: string; text: string }
  | { type: 'job:keepalive'; jobId: string; text: string }
  | { type: 'job:transport_drop'; jobId: string; attemptId: number; shardId: string; reason: string; isQuotaError?: boolean }
  | { type: 'job:done'; jobId: string }
  | { type: 'job:error'; jobId: string; reason: string }
  | { type: 'job:cancelled'; jobId: string; reason?: string }
  | { type: 'relay:drained' };

type JobBusEventOf<T extends JobBusEvent['type']> = Extract<JobBusEvent, { type: T }>;

interface BusSubscriber {
  res: http.ServerResponse;
  tail: Promise<void>;
  pendingFrames: number;
  closed: boolean;
}

/**
 * Pub/sub plane. Public publication always crosses a microtask boundary.
 * Tokens are committed before fan-out and every SSE subscriber owns an
 * independent ordered write chain.
 */
class JobEventBus extends EventEmitter {
  private readonly subscribers = new Map<string, Set<BusSubscriber>>();
  private pendingDispatches = 0;
  private pendingWrites = 0;
  private readonly idleWaiters = new Set<() => void>();
  private readonly jobsTable: BroccoliDbTable<JobRecord>;
  private readonly tokensTable: BroccoliDbTable<JobTokenRecord>;
  private readonly config: RelayConfig;
  private readonly countEvent: () => void;
  private readonly countSlowDrain: () => void;

  constructor(
    jobsTable: BroccoliDbTable<JobRecord>,
    tokensTable: BroccoliDbTable<JobTokenRecord>,
    config: RelayConfig,
    countEvent: () => void,
    countSlowDrain: () => void,
  ) {
    super();
    for (const [name, value] of Object.entries({
      busMaxListenersPerJob: config.busMaxListenersPerJob,
      maxPendingFramesPerSubscriber: config.maxPendingFramesPerSubscriber,
      subscriberDrainTimeoutMs: config.subscriberDrainTimeoutMs,
    })) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive safe integer`);
      }
    }
    this.jobsTable = jobsTable;
    this.tokensTable = tokensTable;
    this.config = config;
    this.countEvent = countEvent;
    this.countSlowDrain = countSlowDrain;
    this.setMaxListeners(config.busMaxListenersPerJob);
  }

  public onEvent<T extends JobBusEvent['type']>(
    type: T,
    listener: (event: JobBusEventOf<T>) => void,
  ): this {
    return super.on(type, listener);
  }

  public publish(event: JobBusEvent): void {
    this.pendingDispatches++;
    queueMicrotask(() => {
      try {
        this.countEvent();
        this.dispatch(event);
        super.emit(event.type, event);
      } finally {
        this.pendingDispatches--;
        this.resolveIdleIfNeeded();
      }
    });
  }

  public subscribe(jobId: string, res: http.ServerResponse): () => void {
    const jobSubscribers = this.subscribers.get(jobId) ?? new Set<BusSubscriber>();
    if (jobSubscribers.size >= this.config.busMaxListenersPerJob) {
      throw new Error('job_subscriber_limit_exceeded');
    }

    const subscriber: BusSubscriber = {
      res,
      tail: Promise.resolve(),
      pendingFrames: 0,
      closed: false,
    };
    jobSubscribers.add(subscriber);
    this.subscribers.set(jobId, jobSubscribers);

    const unsubscribe = () => this.removeSubscriber(jobId, subscriber, false);
    res.once('close', unsubscribe);
    res.once('error', unsubscribe);
    return unsubscribe;
  }

  public replay(jobId: string, res: http.ServerResponse, afterSeqNo: number, onReplayed: () => void): void {
    const subscriber = [...(this.subscribers.get(jobId) ?? [])].find((entry) => entry.res === res);
    if (!subscriber) return;
    const tokens = this.tokensTable.query({
      where: { jobId },
      sortBy: 'seqNo',
      sortOrder: 'asc',
    });
    for (const token of tokens) {
      if (token.seqNo <= afterSeqNo) continue;
      this.enqueue(jobId, subscriber, this.formatToken(jobId, token), false);
      onReplayed();
    }
  }

  public subscriberCount(jobId: string): number {
    return this.subscribers.get(jobId)?.size ?? 0;
  }

  public sendToSubscriber(jobId: string, res: http.ServerResponse, frame: string, closeAfter = false): void {
    const subscriber = [...(this.subscribers.get(jobId) ?? [])].find((entry) => entry.res === res);
    if (subscriber) this.enqueue(jobId, subscriber, frame, closeAfter);
  }

  public whenIdle(): Promise<void> {
    if (this.pendingDispatches === 0 && this.pendingWrites === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }

  private dispatch(event: JobBusEvent): void {
    if (event.type === 'job:token') {
      this.tokensTable.put(event.token.id, event.token, { ttlMs: this.config.jobTokenRetentionMs });
      this.fanOut(event.jobId, this.formatToken(event.jobId, event.token));
      return;
    }
    if (event.type === 'job:reasoning') {
      const job = this.jobsTable.get(event.jobId);
      if (!job) return;
      const payload = JSON.stringify({
        id: job.id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: job.model,
        choices: [{ index: 0, delta: { reasoning_content: event.text }, finish_reason: null }],
      });
      this.fanOut(event.jobId, `data: ${payload}\n\n`);
      return;
    }
    if (event.type === 'job:keepalive') {
      this.fanOut(event.jobId, event.text);
      return;
    }
    if (event.type === 'job:done') {
      this.fanOut(event.jobId, 'data: [DONE]\n\n', true);
      return;
    }
    if (event.type === 'job:error') {
      this.fanOut(event.jobId, `event: error\ndata: ${JSON.stringify({ error: event.reason })}\n\n`, true);
      return;
    }
    if (event.type === 'job:cancelled') {
      this.fanOut(
        event.jobId,
        `event: cancelled\ndata: ${JSON.stringify({ status: 'cancelled', reason: event.reason })}\n\n`,
        true,
      );
    }
  }

  private formatToken(jobId: string, token: JobTokenRecord): string {
    const job = this.jobsTable.get(jobId);
    const payload = JSON.stringify({
      id: jobId,
      object: 'chat.completion.chunk',
      created: Math.floor(token.timestampMs / 1000),
      model: job?.model ?? 'unknown',
      choices: [{
        index: 0,
        delta: token.text ? { content: token.text } : {},
        finish_reason: token.isFinal ? 'stop' : null,
      }],
      seqNo: token.seqNo,
    });
    return `id: ${token.seqNo}\ndata: ${payload}\n\n`;
  }

  private fanOut(jobId: string, frame: string, closeAfter = false): void {
    for (const subscriber of [...(this.subscribers.get(jobId) ?? [])]) {
      this.enqueue(jobId, subscriber, frame, closeAfter);
    }
  }

  private enqueue(jobId: string, subscriber: BusSubscriber, frame: string, closeAfter: boolean): void {
    if (subscriber.closed || subscriber.res.writableEnded) {
      this.removeSubscriber(jobId, subscriber, false);
      return;
    }
    if (subscriber.pendingFrames >= this.config.maxPendingFramesPerSubscriber) {
      this.removeSubscriber(jobId, subscriber, true);
      return;
    }

    subscriber.pendingFrames++;
    this.pendingWrites++;
    subscriber.tail = subscriber.tail
      .then(async () => {
        if (subscriber.closed || subscriber.res.writableEnded) return;
        if (!subscriber.res.write(frame)) {
          this.countSlowDrain();
          await this.waitForDrainOrClose(jobId, subscriber);
        }
        if (closeAfter && !subscriber.closed && !subscriber.res.writableEnded) {
          subscriber.res.end();
          this.removeSubscriber(jobId, subscriber, false);
        }
      })
      .catch(() => this.removeSubscriber(jobId, subscriber, true))
      .finally(() => {
        subscriber.pendingFrames--;
        this.pendingWrites--;
        this.resolveIdleIfNeeded();
      });
  }

  private waitForDrainOrClose(jobId: string, subscriber: BusSubscriber): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        subscriber.res.off('drain', finish);
        subscriber.res.off('close', finish);
        subscriber.res.off('error', finish);
        resolve();
      };
      timer = setTimeout(() => {
        this.removeSubscriber(jobId, subscriber, true);
        finish();
      }, this.config.subscriberDrainTimeoutMs);
      subscriber.res.once('drain', finish);
      subscriber.res.once('close', finish);
      subscriber.res.once('error', finish);
    });
  }

  private removeSubscriber(jobId: string, subscriber: BusSubscriber, close: boolean): void {
    if (subscriber.closed) return;
    subscriber.closed = true;
    const jobSubscribers = this.subscribers.get(jobId);
    jobSubscribers?.delete(subscriber);
    if (jobSubscribers?.size === 0) this.subscribers.delete(jobId);
    if (close && !subscriber.res.writableEnded) subscriber.res.end();
  }

  private resolveIdleIfNeeded(): void {
    if (this.pendingDispatches !== 0 || this.pendingWrites !== 0) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }
}

/**
 * Relay queue-plane lifecycle coordinator. This owns only the operational
 * lifecycle of a bounded relay delivery job; authoritative evolving agent
 * execution state belongs to the upstream ExecutionSupervisor and ledger.
 */
class JobQueue {
  private readonly jobsTable: BroccoliDbTable<JobRecord>;
  private readonly bus: JobEventBus;

  constructor(
    jobsTable: BroccoliDbTable<JobRecord>,
    bus: JobEventBus,
  ) {
    this.jobsTable = jobsTable;
    this.bus = bus;
  }

  public enqueue(job: JobRecord): JobRecord {
    if (this.jobsTable.get(job.id)) throw new Error(`job_already_exists_${job.id}`);
    return this.jobsTable.put(job.id, { ...job, status: 'queued' });
  }

  public restore(job: JobRecord): JobRecord {
    return this.jobsTable.put(job.id, job);
  }

  public acquireForDispatch(jobId: string, shardId: string, retryCount: number): JobRecord | undefined {
    const job = this.jobsTable.get(jobId);
    if (!job || this.isTerminal(job.status)) return undefined;
    return this.jobsTable.put(jobId, {
      ...job,
      shardId,
      lastShardId: shardId,
      status: job.seqCounter > 0 ? 'streaming' : 'running',
      startedAtMs: job.startedAtMs || Date.now(),
      retryCount,
    });
  }

  public recordToken(jobId: string): { job: JobRecord; seqNo: number } | undefined {
    const job = this.jobsTable.get(jobId);
    if (!job || this.isTerminal(job.status)) return undefined;
    const seqNo = job.seqCounter + 1;
    const updated = this.jobsTable.put(jobId, { ...job, status: 'streaming', seqCounter: seqNo });
    return { job: updated, seqNo };
  }

  public updateForFailover(jobId: string, updates: Partial<JobRecord>): JobRecord | undefined {
    const job = this.jobsTable.get(jobId);
    if (!job || this.isTerminal(job.status)) return undefined;
    return this.jobsTable.put(jobId, { ...job, ...updates });
  }

  public setDetached(jobId: string, isDetached: boolean): JobRecord | undefined {
    const job = this.jobsTable.get(jobId);
    if (!job || this.isTerminal(job.status)) return undefined;
    return this.jobsTable.put(jobId, { ...job, isDetached });
  }

  public markComplete(jobId: string): boolean {
    return this.transitionTerminal(jobId, 'completed', undefined);
  }

  public markFailed(jobId: string, reason: string): boolean {
    return this.transitionTerminal(jobId, 'failed', reason);
  }

  public markCancelled(jobId: string, reason?: string): boolean {
    return this.transitionTerminal(jobId, 'cancelled', reason);
  }

  public activeCount(): number {
    return this.jobsTable.getAll().filter(
      (job) => job.status === 'queued' || job.status === 'running' || job.status === 'streaming',
    ).length;
  }

  private transitionTerminal(
    jobId: string,
    status: Extract<JobRecord['status'], 'completed' | 'failed' | 'cancelled'>,
    reason?: string,
  ): boolean {
    const job = this.jobsTable.get(jobId);
    if (!job || this.isTerminal(job.status)) return false;
    const activeBefore = this.activeCount();
    this.jobsTable.put(jobId, {
      ...job,
      status,
      error: reason,
      completedAtMs: Date.now(),
    });
    if (status === 'completed') this.bus.publish({ type: 'job:done', jobId });
    if (status === 'failed') this.bus.publish({ type: 'job:error', jobId, reason: reason ?? 'unknown_failure' });
    if (status === 'cancelled') this.bus.publish({ type: 'job:cancelled', jobId, reason });
    if (activeBefore > 0 && this.activeCount() === 0) this.bus.publish({ type: 'relay:drained' });
    return true;
  }

  private isTerminal(status: JobRecord['status']): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
  }
}

// ============================================================================
// STREAM SUFFIX-PREFIX OVERLAP RECONCILIATION (Figma / Liveblocks / CRDT Pattern)
// ============================================================================

export function reconcileOverlap(suffix: string, incoming: string, maxOverlapLen = 128): string {
  if (!suffix || !incoming) return incoming;

  // 1. Direct identical match: entire chunk was a duplicate echo from continuation prompt
  if (suffix.endsWith(incoming)) {
    return '';
  }

  const checkLen = Math.min(suffix.length, incoming.length, maxOverlapLen);

  // 2. Greedy character-level suffix-prefix overlap search
  for (let k = checkLen; k > 0; k--) {
    const incomingPrefix = incoming.slice(0, k);
    if (suffix.endsWith(incomingPrefix)) {
      return incoming.slice(k);
    }
  }

  // 3. Word-boundary fuzzy overlap search (handling trailing space variations)
  const suffixWords = suffix.trim().split(/\s+/);
  const incomingWords = incoming.trimStart().split(/\s+/);
  for (let w = Math.min(suffixWords.length, incomingWords.length, 6); w > 0; w--) {
    const sSub = suffixWords.slice(-w).join(' ');
    const iSub = incomingWords.slice(0, w).join(' ');
    if (sSub === iSub) {
      const matchIdx = incoming.indexOf(iSub);
      if (matchIdx !== -1) {
        return incoming.slice(matchIdx + iSub.length).replace(/^[\s]+/, ' ');
      }
    }
  }

  return incoming;
}

// ============================================================================
// CRYPTOGRAPHIC ENVELOPE DECRYPTION (AES-256-GCM + HKDF)
// ============================================================================

function decryptShardPayload(
  enc: { ciphertext: string; iv: string; tag: string; keyVersion?: string },
  masterSecret: string,
  tenantUid: string,
  shardId: string,
  provider = 'openai'
): Record<string, any> | null {
  try {
    const key = Buffer.from(
      crypto.hkdfSync(
        'sha256',
        Buffer.from(masterSecret, 'utf-8'),
        Buffer.from('galx-vault-salt-2026', 'utf-8'),
        Buffer.from(`galx-shard-isolation-${enc.keyVersion || 'v1'}`, 'utf-8'),
        32
      )
    );

    const iv = Buffer.from(enc.iv, 'hex');
    const tag = Buffer.from(enc.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    const aad = Buffer.from(`${tenantUid}:${shardId}:${provider}`, 'utf-8');
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(enc.ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// ============================================================================
// HARDENED RELAY SERVER POWERED BY BROCCOLIDB
// ============================================================================

export class GalxaiRelayServer extends EventEmitter {
  private config: RelayConfig;
  private server: http.Server;

  // BroccoliDB Zenith-Tier Tables
  private readonly jobsTable: BroccoliDbTable<JobRecord>;
  private readonly tokensTable: BroccoliDbTable<JobTokenRecord>;
  private readonly idempotencyTable: BroccoliDbTable<IdempotencyRecord>;
  private readonly shardsTable: BroccoliDbTable<ShardRecord>;
  private readonly jobBus: JobEventBus;
  private readonly jobQueue: JobQueue;

  // Multi-Tenant Rate Governor (Token Bucket)
  private readonly tenantBuckets = new Map<string, { tokens: number; lastRefillMs: number }>();

  // Ephemeral In-Flight Sessions
  private readonly sessions = new Map<string, TransientJobSession>();
  private isDraining = false;
  private snapshotIntervalTimer?: NodeJS.Timeout;

  // Prometheus Telemetry Counters
  private metrics = {
    totalJobsSubmitted: 0,
    totalJobsCompleted: 0,
    totalJobsCancelled: 0,
    totalJobsFailed: 0,
    totalAttachedDuplicates: 0,
    totalTokensEmitted: 0,
    totalTokensServedFromBuffer: 0,
    totalReconnections: 0,
    totalGracePeriodsEntered: 0,
    totalGraceReconnectionsWon: 0,
    totalZombieLeashAborts: 0,
    totalItlStallsDetected: 0,
    totalTtftDeadlocks: 0,
    totalRateLimitDrops: 0,
    totalAuthFailures: 0,
    totalUpstreamRetries: 0,
    totalMidStreamFailoversWon: 0,
    totalShardCooldownEjections: 0,
    totalDeadPeerRecoveries: 0,
    totalReasoningChunksReceived: 0,
    totalHeartbeatAckMisses: 0,
    totalOverlapReconciliationsWon: 0,
    totalDownstreamFailoverKeepalivesSent: 0,
    totalProactiveRateLimitCooldowns: 0,
    totalBusEventsEmitted: 0,
    totalSlowSubscriberDrains: 0,
    totalImageJobsSubmitted: 0,
    totalImageJobsCompleted: 0,
    totalImageJobsFailed: 0,
    startTimeMs: Date.now(),
  };

  constructor(config: Partial<RelayConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!Number.isSafeInteger(this.config.drainTimeoutMs) || this.config.drainTimeoutMs <= 0) {
      throw new TypeError('drainTimeoutMs must be a positive safe integer');
    }
    this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));

    // Initialize BroccoliDB Tables with Secondary & Sorted Indexes
    this.jobsTable = new BroccoliDbTable<JobRecord>('relay_jobs');
    this.jobsTable.createIndex('status');
    this.jobsTable.createIndex('model');
    this.jobsTable.createIndex('shardId');
    this.jobsTable.createSortedIndex('createdAtMs');

    this.tokensTable = new BroccoliDbTable<JobTokenRecord>('relay_tokens');
    this.tokensTable.createIndex('jobId');
    this.tokensTable.createSortedIndex('seqNo');

    this.idempotencyTable = new BroccoliDbTable<IdempotencyRecord>('relay_idempotency');

    this.shardsTable = new BroccoliDbTable<ShardRecord>('relay_shards');
    this.shardsTable.createIndex('status');
    this.shardsTable.createSortedIndex('inFlight');

    this.jobBus = new JobEventBus(
      this.jobsTable,
      this.tokensTable,
      this.config,
      () => { this.metrics.totalBusEventsEmitted++; },
      () => { this.metrics.totalSlowSubscriberDrains++; },
    );
    this.jobQueue = new JobQueue(this.jobsTable, this.jobBus);
    this.jobBus.onEvent('job:transport_token', (event) => this.handleTransportToken(event));
    this.jobBus.onEvent('job:transport_completed', (event) => this.handleTransportCompleted(event));
    this.jobBus.onEvent('job:transport_drop', (event) => this.handleTransportDrop(event));

    // Subscribe to BroccoliDB CDC Stream for Reactive Job Lifecycle Logging
    this.jobsTable.subscribe((change) => {
      if (change.operation === 'UPDATE' && change.after?.status === 'completed') {
        this.emit('job:completed', change.after);
      }
    });

    this.recoverStateSnapshot();
    this.loadShardFleet();
    this.startPeriodicSnapshot();
  }

  // --------------------------------------------------------------------------
  // ZERO-TRUST SECURITY: AUTHENTICATION & RATE GOVERNANCE
  // --------------------------------------------------------------------------

  private verifyAuthorization(req: http.IncomingMessage): boolean {
    if (!this.config.apiKeys || this.config.apiKeys.length === 0) {
      return true; // Open access in dev/local mode
    }

    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-galx-api-key'] as string;
    let providedToken = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (apiKeyHeader) {
      providedToken = apiKeyHeader.trim();
    }

    if (!providedToken) {
      this.metrics.totalAuthFailures++;
      return false;
    }

    // Timing-Safe Constant-Time Verification against configured keys
    const providedBuffer = Buffer.from(providedToken, 'utf-8');
    for (const validKey of this.config.apiKeys) {
      const validBuffer = Buffer.from(validKey, 'utf-8');
      if (providedBuffer.length === validBuffer.length && crypto.timingSafeEqual(providedBuffer, validBuffer)) {
        return true;
      }
    }

    this.metrics.totalAuthFailures++;
    return false;
  }

  private checkTenantRateLimit(tenantId: string): boolean {
    const now = Date.now();
    let bucket = this.tenantBuckets.get(tenantId);

    if (!bucket) {
      bucket = { tokens: this.config.tenantBurstCapacity, lastRefillMs: now };
      this.tenantBuckets.set(tenantId, bucket);
    } else {
      const elapsedSec = (now - bucket.lastRefillMs) / 1000;
      bucket.tokens = Math.min(
        this.config.tenantBurstCapacity,
        bucket.tokens + elapsedSec * this.config.tenantRateLimitPerSec
      );
      bucket.lastRefillMs = now;
    }

    if (bucket.tokens >= 1.0) {
      bucket.tokens -= 1.0;
      return true;
    }

    this.metrics.totalRateLimitDrops++;
    return false;
  }

  // --------------------------------------------------------------------------
  // SHARD FLEET MANAGEMENT (Governed by BroccoliDB + Vault Decryption)
  // --------------------------------------------------------------------------

  private loadShardFleet(): void {
    if (process.env.OPENAI_ACCESS_TOKEN || process.env.CODEX_ACCESS_TOKEN) {
      const token = (process.env.OPENAI_ACCESS_TOKEN || process.env.CODEX_ACCESS_TOKEN)!;
      const accountId = process.env.CHATGPT_ACCOUNT_ID || 'acc_env_direct';
      this.shardsTable.put('shard_env_primary', {
        id: 'shard_env_primary',
        accountId,
        accessToken: token,
        status: 'active',
        consecutiveFailures: 0,
        lastUsedAtMs: 0,
        inFlight: 0,
        slidingWindowTimestamps: [],
      });
      return;
    }

    const paths = [
      this.config.shardsJsonPath,
      path.join(process.cwd(), '.galx-shards.json'),
      path.join(os.homedir(), '.codex', 'auth.json'),
      path.join(os.homedir(), '.lumi', 'config.json'),
    ].filter(Boolean) as string[];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            for (const item of data) {
              let token = item.accessToken || item.token;
              let accountId = item.accountId || item.account_id || 'acc_default';

              // If shard contains an encrypted payload, decrypt using Master Secret
              if (!token && (item.encryptedPayload || item.encryptedSecrets) && this.config.masterSecret) {
                const enc = item.encryptedPayload || item.encryptedSecrets;
                const dec = decryptShardPayload(
                  enc,
                  this.config.masterSecret,
                  item.userId || 'usr_galx_master',
                  item.id,
                  item.provider || 'openai'
                );
                if (dec) {
                  token = dec.accessToken || dec.apiKey;
                  accountId = dec.accountId || accountId;
                }
              }

              if (token) {
                const id = item.id || `shard_${Math.random().toString(36).slice(2, 8)}`;
                this.shardsTable.put(id, {
                  id,
                  accountId,
                  accessToken: token,
                  status: item.status === 'exhausted' ? 'exhausted' : 'active',
                  consecutiveFailures: 0,
                  lastUsedAtMs: item.lastUsedAtMs || 0,
                  inFlight: 0,
                  slidingWindowTimestamps: item.slidingWindowTimestamps || [],
                });
              }
            }
          } else if (data.tokens || data.access_token) {
            const token = data.tokens?.access_token || data.access_token;
            const accountId = data.tokens?.account_id || data.account_id || 'acc_default';
            if (token) {
              this.shardsTable.put('shard_local_auth', {
                id: 'shard_local_auth',
                accountId,
                accessToken: token,
                status: 'active',
                consecutiveFailures: 0,
                lastUsedAtMs: 0,
                inFlight: 0,
                slidingWindowTimestamps: [],
              });
            }
          }
        } catch {}
      }
    }

    if (this.shardsTable.count() === 0) {
      this.shardsTable.put('shard_dev_fallback', {
        id: 'shard_dev_fallback',
        accountId: 'acc_dev_fallback',
        accessToken: 'mock_dev_token',
        status: 'active',
        consecutiveFailures: 0,
        lastUsedAtMs: 0,
        inFlight: 0,
        slidingWindowTimestamps: [],
      });
    }
  }

  private tuneSocket(ws: any): void {
    try {
      const sock = ws._socket || ws.socket || (ws._client && ws._client._socket);
      if (sock) {
        if (typeof sock.setNoDelay === 'function') {
          sock.setNoDelay(true); // Disable Nagle's algorithm for sub-millisecond token dispatch
        }
        if (typeof sock.setKeepAlive === 'function') {
          sock.setKeepAlive(true, 10_000); // 10s transport TCP keep-alive probe
        }
      }
    } catch {}
  }

  private safeCloseSocket(ws: any, code = 1000, reason = 'Normal closure'): void {
    if (!ws) return;
    try {
      // Detach listeners to prevent memory leaks and zombie callback re-entry
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (typeof ws.removeAllListeners === 'function') {
        ws.removeAllListeners();
      }
      if (typeof ws.terminate === 'function') {
        ws.terminate();
      } else if (typeof ws.close === 'function') {
        ws.close(code, reason);
      }
    } catch {}
  }

  private acquireHealthyShard(excludeShardId?: string): ShardRecord | null {
    const now = Date.now();
    const threeHoursAgo = now - 3 * 3600 * 1000;
    const allShards = this.shardsTable.getAll();

    let candidate: ShardRecord | null = null;
    let minScore = Infinity;

    // Phase 1: Search active healthy shards (excluding failed shard if possible)
    for (const shard of allShards) {
      if (excludeShardId && shard.id === excludeShardId && allShards.length > 1) {
        continue;
      }

      let currentStatus = shard.status;
      // Circuit Breaker: Auto-recover from cooldown after 60s
      if (currentStatus === 'cooldown' && now - shard.lastUsedAtMs > 60_000) {
        currentStatus = 'active';
      }
      if (currentStatus !== 'active') continue;

      const activeTimestamps = (shard.slidingWindowTimestamps || []).filter((t: number) => t > threeHoursAgo);
      if (activeTimestamps.length >= 40) {
        this.shardsTable.put(shard.id, { ...shard, status: 'exhausted', slidingWindowTimestamps: activeTimestamps });
        continue;
      }

      // Smooth Weighted Round-Robin (SWRR) Score: inFlight * 100 + windowUsage
      const score = shard.inFlight * 100 + activeTimestamps.length;
      if (score < minScore) {
        minScore = score;
        candidate = { ...shard, status: currentStatus, slidingWindowTimestamps: activeTimestamps };
      }
    }

    // Phase 2: Half-Open Circuit Breaker Probe if all shards are exhausted/cooling down
    if (!candidate && allShards.length > 0) {
      let oldestCooldownShard: ShardRecord | null = null;
      let oldestCooldownTime = Infinity;

      for (const shard of allShards) {
        if (shard.status === 'cooldown' || shard.status === 'exhausted') {
          if (shard.lastUsedAtMs < oldestCooldownTime) {
            oldestCooldownTime = shard.lastUsedAtMs;
            oldestCooldownShard = shard;
          }
        }
      }

      if (oldestCooldownShard) {
        console.warn(`[CircuitBreaker:Half-Open] All shards cooling down; selecting oldest candidate ${oldestCooldownShard.id} as probe`);
        candidate = { ...oldestCooldownShard, status: 'active', consecutiveFailures: 1 };
      }
    }

    if (candidate) {
      const updated: ShardRecord = {
        ...candidate,
        inFlight: candidate.inFlight + 1,
        lastUsedAtMs: now,
        slidingWindowTimestamps: [...candidate.slidingWindowTimestamps, now],
      };
      this.shardsTable.put(candidate.id, updated);
      return updated;
    }
    return null;
  }

  private recordShardFailure(shardId: string): void {
    const shard = this.shardsTable.get(shardId);
    if (!shard) return;

    const failures = shard.consecutiveFailures + 1;
    // Circuit Breaker Trips on 3 consecutive failures
    const shouldTrip = failures >= 3;

    this.shardsTable.put(shardId, {
      ...shard,
      inFlight: Math.max(0, shard.inFlight - 1),
      consecutiveFailures: failures,
      status: shouldTrip ? 'cooldown' : shard.status,
      lastUsedAtMs: Date.now(),
    });
  }

  private releaseShard(shardId: string): void {
    const shard = this.shardsTable.get(shardId);
    if (shard && shard.inFlight > 0) {
      this.shardsTable.put(shardId, {
        ...shard,
        inFlight: Math.max(0, shard.inFlight - 1),
        consecutiveFailures: 0, // Reset failure count on clean completion
      });
    }
  }

  // --------------------------------------------------------------------------
  // HTTP INGRESS ROUTER
  // --------------------------------------------------------------------------

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method?.toUpperCase() || 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Last-Event-ID, X-Requested-With, X-Tenant-Id, X-Galx-Api-Key');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/health' || pathname === '/health/ready' || pathname === '/health/live') {
      this.handleHealth(res);
      return;
    }

    if (pathname === '/metrics') {
      this.handleMetrics(res);
      return;
    }

    // Zero-Trust Authorization Gate
    if (!this.verifyAuthorization(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Unauthorized: Invalid or missing API key', code: 'unauthorized' } }));
      return;
    }

    // Multi-Tenant Rate Limiting Gate
    const tenantId = (req.headers['x-tenant-id'] as string) || req.socket.remoteAddress || 'tenant_default';
    if (!this.checkTenantRateLimit(tenantId)) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': '1',
      });
      res.end(JSON.stringify({ error: { message: 'Rate limit exceeded. Please retry in 1s.', code: 'rate_limited' } }));
      return;
    }

    if (this.isDraining && method === 'POST') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Relay server is draining for reload', code: 'server_draining' } }));
      return;
    }

    if (method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
      await this.handleChatCompletions(req, res, tenantId);
      return;
    }

    if (method === 'POST' && (pathname === '/v1/images/generations' || pathname === '/images/generations')) {
      await this.handleImageGenerations(req, res, tenantId);
      return;
    }

    const streamMatch = pathname.match(/^\/v1\/jobs\/([^/]+)\/stream$/);
    if (method === 'GET' && streamMatch) {
      const jobId = streamMatch[1];
      this.handleJobStream(jobId, req, res, parsedUrl.query);
      return;
    }

    const jobMatch = pathname.match(/^\/v1\/jobs\/([^/]+)$/);
    if (method === 'GET' && jobMatch) {
      const jobId = jobMatch[1];
      this.handleJobStatus(jobId, res);
      return;
    }

    const cancelMatch = pathname.match(/^\/v1\/jobs\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancelMatch) {
      const jobId = cancelMatch[1];
      this.handleJobCancel(jobId, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Route not found: ${method} ${pathname}`, code: 'not_found' } }));
  }

  // --------------------------------------------------------------------------
  // ATOMIC IDEMPOTENT ATTACHMENT & HTTP 202 ASYNC DECOUPLING
  // --------------------------------------------------------------------------

  private async handleChatCompletions(req: http.IncomingMessage, res: http.ServerResponse, tenantId: string): Promise<void> {
    let bodyText = '';
    let totalBytes = 0;
    let bodyExceeded = false;

    // Slowloris & Body Read Timeout (10s)
    const bodyTimeout = setTimeout(() => {
      if (!res.writableEnded) {
        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Request body read timeout', code: 'request_timeout' } }));
      }
      req.destroy();
    }, this.config.httpBodyTimeoutMs);

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > this.config.maxPayloadBytes) {
        bodyExceeded = true;
        clearTimeout(bodyTimeout);
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Payload Too Large: Maximum allowed body is 2 MB', code: 'payload_too_large' } }));
        req.destroy();
        return;
      }
      bodyText += chunk;
    });

    req.on('end', () => {
      clearTimeout(bodyTimeout);
      if (bodyExceeded) return;

      try {
        const body = bodyText.trim() ? JSON.parse(bodyText) : {};
        const requestedModel = body.model || 'gpt-5.6-terra';
        // ChatGPT session tokens support gpt-5.6-terra, gpt-5.6-luna; map sol -> terra for OAuth scope compliance
        const model = requestedModel === 'gpt-5.6-sol' ? 'gpt-5.6-terra' : requestedModel;
        const messages = body.messages || [{ role: 'user', content: 'Hello' }];
        const prompt = messages[messages.length - 1]?.content || '';
        const reasoningEffort = body.reasoning_effort || body.reasoningEffort || 'medium';

        // Atomic Idempotent Stream Attachment via BroccoliDB
        const promptHash = crypto.createHash('sha256').update(`${model}:${JSON.stringify(messages)}`).digest('hex');
        const existingIdempotency = this.idempotencyTable.get(promptHash);

        if (existingIdempotency) {
          const existingJob = this.jobsTable.get(existingIdempotency.jobId);
          if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running' || existingJob.status === 'streaming')) {
            this.metrics.totalAttachedDuplicates++;
            const streamUrl = `/v1/jobs/${existingJob.id}/stream`;
            res.writeHead(202, {
              'Content-Type': 'application/json',
              'Location': streamUrl,
              'X-Attached-Stream': 'true',
              'X-Galx-Job-Id': existingJob.id,
              'X-Galx-Queue-Position': '0',
              'X-Galx-Eta-Ms': '150000',
            });
            res.end(JSON.stringify({
              id: existingJob.id,
              object: 'chat.completion.job',
              status: existingJob.status,
              model: existingJob.model,
              streamUrl,
              isAttachedDuplicate: true,
              queuePosition: 0,
              estimatedWaitSec: 150,
              createdAt: Math.floor(existingJob.createdAtMs / 1000),
            }));
            return;
          }
        }

        // Register Fresh Job in BroccoliDB
        const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
        const jobRecord: JobRecord = {
          id: jobId,
          model,
          prompt,
          promptHash,
          tenantId,
          messagesJson: JSON.stringify(messages),
          reasoningEffort,
          status: 'queued',
          createdAtMs: Date.now(),
          seqCounter: 0,
          isDetached: false,
          estimatedTokens: body.max_tokens || 3500,
        };

        this.jobQueue.enqueue(jobRecord);
        this.idempotencyTable.put(promptHash, { id: promptHash, jobId, createdAtMs: Date.now() }, { ttlMs: this.config.idempotencyTtlMs });

        const session: TransientJobSession = {
          abortController: new AbortController(),
          lastChunkAtMs: 0,
          ewmaItlMs: 0,
          consecutiveItlStalls: 0,
          retryCount: 0,
          lastSeenAliveMs: Date.now(),
          activeTtftDeadlineMs: this.config.wsTtftTimeoutMs,
          activeAttemptId: 0,
        };

        // Layer 6: Absolute Wall Clock Ceiling (300s) attached to session across failovers
        session.wallTimer = setTimeout(() => {
          if (this.jobQueue.markFailed(jobId, 'job_wall_time_exceeded')) this.metrics.totalJobsFailed++;
          if (session.downstreamFailoverKeepaliveTimer) {
            clearInterval(session.downstreamFailoverKeepaliveTimer);
            session.downstreamFailoverKeepaliveTimer = undefined;
          }
          session.abortController.abort(new Error('Job wall time exceeded 300s'));
          this.safeCloseSocket(session.upstreamWs);
          if (session.currentShardId) {
            this.releaseShard(session.currentShardId);
          }
        }, this.config.jobMaxWallTimeMs);

        this.sessions.set(jobId, session);

        this.metrics.totalJobsSubmitted++;
        this.dispatchJobToUpstream(jobId);

        const streamUrl = `/v1/jobs/${jobId}/stream`;
        res.writeHead(202, {
          'Content-Type': 'application/json',
          'Location': streamUrl,
          'X-Galx-Job-Id': jobId,
          'X-Galx-Queue-Position': '0',
          'X-Galx-Eta-Ms': '150000',
        });
        res.end(JSON.stringify({
          id: jobId,
          object: 'chat.completion.job',
          status: 'queued',
          model,
          streamUrl,
          isAttachedDuplicate: false,
          queuePosition: 0,
          estimatedWaitSec: 150,
          createdAt: Math.floor(jobRecord.createdAtMs / 1000),
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'invalid_request' } }));
      }
    });
  }

  // --------------------------------------------------------------------------
  // LIVE WIRE IMAGE GENERATION & SYNTHESIS GATEWAY
  // --------------------------------------------------------------------------

  private async handleImageGenerations(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    _tenantId: string
  ): Promise<void> {
    let bodyText = '';
    let totalBytes = 0;
    let bodyExceeded = false;

    const bodyTimeout = setTimeout(() => {
      if (!res.writableEnded) {
        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Request body read timeout', code: 'request_timeout' } }));
      }
      req.destroy();
    }, this.config.httpBodyTimeoutMs);

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > this.config.maxPayloadBytes) {
        bodyExceeded = true;
        clearTimeout(bodyTimeout);
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Payload Too Large: Maximum allowed body is 2 MB', code: 'payload_too_large' } }));
        req.destroy();
        return;
      }
      bodyText += chunk;
    });

    req.on('end', async () => {
      clearTimeout(bodyTimeout);
      if (bodyExceeded) return;

      try {
        const body = bodyText.trim() ? JSON.parse(bodyText) : {};
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Missing required parameter: prompt', code: 'missing_prompt' } }));
          return;
        }

        const requestedModel = body.model || 'gpt-5.6-terra';
        // Map any DALL-E / GPT-Image alias to gpt-5.6-terra for Codex OAuth backend compatibility
        const model = (requestedModel === 'gpt-5.6-sol' || requestedModel.startsWith('dall-e') || requestedModel.startsWith('gpt-image'))
          ? 'gpt-5.6-terra'
          : requestedModel;

        const idempotencyKey = (req.headers['idempotency-key'] as string) || body.idempotency_key;
        if (idempotencyKey) {
          const cached = this.idempotencyTable.get(idempotencyKey);
          if (cached && (cached as any).imageResponse) {
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'X-Galx-Idempotency-Hit': 'true',
            });
            res.end(JSON.stringify((cached as any).imageResponse));
            return;
          }
        }

        this.metrics.totalImageJobsSubmitted++;

        // Acquire authoritative healthy shard from SWRR pool
        const shard = this.acquireHealthyShard();
        if (!shard) {
          this.metrics.totalImageJobsFailed++;
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              message: 'All shards are currently exhausted or cooling down. Please retry shortly.',
              code: 'all_shards_exhausted',
            },
          }));
          return;
        }

        try {
          let synthesisResult: { b64_json: string; revised_prompt?: string };

          // Dual Dispatch: If shard has standard OpenAI API key (sk-...), dispatch to OpenAI REST
          if (shard.accessToken.startsWith('sk-') && !shard.accountId.startsWith('acc_')) {
            synthesisResult = await this.synthesizeImageViaOpenAiRest(prompt, body, shard.accessToken);
          } else {
            // Live Wire Codex WebSocket Synthesis (ChatGPT Plus/Pro OAuth Tokens)
            synthesisResult = await this.synthesizeImageViaCodex(prompt, model, shard);
          }

          this.releaseShard(shard.id);
          this.metrics.totalImageJobsCompleted++;

          const responseData = {
            created: Math.floor(Date.now() / 1000),
            data: [
              {
                b64_json: synthesisResult.b64_json,
                revised_prompt: synthesisResult.revised_prompt || prompt,
              },
            ],
            model: requestedModel,
          };

          if (idempotencyKey) {
            this.idempotencyTable.put(idempotencyKey, {
              id: idempotencyKey,
              jobId: `img_${Date.now()}`,
              createdAtMs: Date.now(),
              imageResponse: responseData,
            } as any, { ttlMs: this.config.idempotencyTtlMs });
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Galx-Shard-Id': shard.id,
          });
          res.end(JSON.stringify(responseData));
        } catch (err: any) {
          this.recordShardFailure(shard.id);
          this.metrics.totalImageJobsFailed++;
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              message: `Image synthesis failed: ${err.message || 'Upstream synthesis error'}`,
              code: 'upstream_image_synthesis_failed',
            },
          }));
        }
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, code: 'invalid_request' } }));
      }
    });
  }

  private synthesizeImageViaCodex(
    prompt: string,
    model: string,
    shard: ShardRecord
  ): Promise<{ b64_json: string; revised_prompt?: string }> {
    return new Promise((resolve, reject) => {
      const WebSocketClass = (globalThis as any).WebSocket;
      if (!WebSocketClass) {
        return reject(new Error('WebSocket runtime is missing in environment'));
      }

      const wsHeaders: Record<string, string> = {
        Authorization: `Bearer ${shard.accessToken}`,
        'User-Agent': 'Codex-CLI/0.150.1 (darwin; arm64)',
        'X-Codex-Originator': 'codex_cli',
        'OpenAI-Beta': 'responses_websockets=2026-02-06',
        'X-OpenAI-Product-Sku': 'codex',
        'ChatGPT-Account-Id': shard.accountId,
      };

      let ws: any;
      let settled = false;
      let pingInterval: NodeJS.Timeout | null = null;
      let watchdogTimer: NodeJS.Timeout | null = null;

      let b64Result = '';
      let revisedPrompt = '';

      const cleanup = () => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        if (ws) {
          this.safeCloseSocket(ws, 1000, 'Image synthesis complete');
        }
      };

      const finishSuccess = (b64: string, revised?: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ b64_json: b64, revised_prompt: revised });
      };

      const finishError = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      // Watchdog timeout (90s ceiling for neural visual synthesis)
      watchdogTimer = setTimeout(() => {
        finishError(new Error('Upstream visual synthesis timed out after 90s'));
      }, 90_000);

      try {
        ws = new WebSocketClass(this.config.wsEndpoint, { headers: wsHeaders });
        this.tuneSocket(ws);
      } catch (err: any) {
        return finishError(err);
      }

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          try {
            if (typeof ws.ping === 'function') {
              ws.ping();
            }
          } catch {}
        }, 15_000);

        const initPayload = {
          type: 'response.create',
          model: model || 'gpt-5.6-terra',
          input: [
            {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: prompt,
                },
              ],
            },
          ],
          tools: [
            {
              type: 'image_generation',
            },
          ],
        };

        try {
          ws.send(JSON.stringify(initPayload));
        } catch (err: any) {
          finishError(new Error(`Failed to send initial image request frame: ${err.message}`));
        }
      };

      ws.onmessage = (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data?.toString?.('utf-8');
          if (!raw) return;
          const frame = JSON.parse(raw);

          // Capture image result from completed image_generation_call output item
          if (frame.type === 'response.output_item.done' && frame.item?.type === 'image_generation_call') {
            if (frame.item.result) {
              b64Result = frame.item.result;
            }
            if (frame.item.revised_prompt) {
              revisedPrompt = frame.item.revised_prompt;
            }
          }

          if (frame.type === 'response.completed' || frame.type === 'response.done') {
            if (b64Result) {
              finishSuccess(b64Result, revisedPrompt);
            } else {
              finishError(new Error('Codex completed stream without returning image data'));
            }
          }

          if (frame.type === 'error' || (frame.type === 'response.failed' && frame.response?.error)) {
            const errorMsg = frame.error?.message || frame.response?.error?.message || JSON.stringify(frame);
            finishError(new Error(`Codex WebSocket error: ${errorMsg}`));
          }
        } catch (err: any) {
          // Ignore partial non-JSON frames
        }
      };

      ws.onerror = (err: any) => {
        finishError(new Error(`Codex WebSocket transport error: ${err.message || 'connection failed'}`));
      };

      ws.onclose = (event: any) => {
        if (!settled) {
          if (b64Result) {
            finishSuccess(b64Result, revisedPrompt);
          } else {
            finishError(new Error(`Codex WebSocket closed prematurely (code: ${event?.code || 1006}, reason: ${event?.reason || 'none'})`));
          }
        }
      };
    });
  }

  private async synthesizeImageViaOpenAiRest(
    prompt: string,
    body: Record<string, unknown>,
    apiKey: string
  ): Promise<{ b64_json: string; revised_prompt?: string }> {
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        model: body.model || 'dall-e-3',
        size: body.size || '1024x1024',
        quality: body.quality || 'standard',
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI REST returned ${resp.status}: ${errText}`);
    }

    const data = await resp.json() as any;
    const item = data.data?.[0];
    if (!item?.b64_json) {
      throw new Error('OpenAI REST response did not contain b64_json');
    }

    return {
      b64_json: item.b64_json,
      revised_prompt: item.revised_prompt,
    };
  }

  // --------------------------------------------------------------------------
  // RESUMABLE SSE STREAM BUS (W3C Last-Event-ID + BroccoliDB Replay)
  // --------------------------------------------------------------------------

  private handleJobStream(
    jobId: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    query: Record<string, string | string[] | undefined>
  ): void {
    const job = this.jobsTable.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Job ${jobId} not found`, code: 'job_not_found' } }));
      return;
    }

    const session = this.sessions.get(jobId);

    if (job.isDetached && session?.graceTimer) {
      clearTimeout(session.graceTimer);
      session.graceTimer = undefined;
      this.jobQueue.setDetached(jobId, false);
      this.metrics.totalGraceReconnectionsWon++;
      this.metrics.totalReconnections++;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Galx-Transport': 'broccolidb-resumable-sse-bus',
    });

    const lastEventIdHeader = req.headers['last-event-id'];
    const lastEventIdQuery = query['last_event_id'] as string;
    const lastSeqNo = parseInt((lastEventIdHeader || lastEventIdQuery || '0') as string, 10) || 0;

    let unsubscribe: () => void;
    try {
      unsubscribe = this.jobBus.subscribe(jobId, res);
    } catch {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'job_subscriber_limit_exceeded' })}\n\n`);
      res.end();
      return;
    }
    this.jobBus.replay(jobId, res, lastSeqNo, () => this.metrics.totalTokensServedFromBuffer++);

    if (job.status === 'completed') {
      this.jobBus.sendToSubscriber(jobId, res, 'data: [DONE]\n\n', true);
      return;
    }
    if (job.status === 'failed') {
      this.jobBus.sendToSubscriber(
        jobId,
        res,
        `event: error\ndata: ${JSON.stringify({ error: job.error || job.status })}\n\n`,
        true,
      );
      return;
    }
    if (job.status === 'cancelled') {
      this.jobBus.sendToSubscriber(
        jobId,
        res,
        `event: cancelled\ndata: ${JSON.stringify({ status: 'cancelled', reason: job.error })}\n\n`,
        true,
      );
      return;
    }

    // Edge Keepalive Heartbeats (: ping\n\n) to defeat Cloudflare 100s idle drops
    const keepaliveTimer = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(keepaliveTimer);
        return;
      }
      this.jobBus.sendToSubscriber(jobId, res, ': ping\n\n');
    }, this.config.sseKeepaliveIntervalMs);

    // Two-Tier Disconnect Protocol: 15s Grace Window for dirty drops
    req.on('close', () => {
      clearInterval(keepaliveTimer);
      unsubscribe();
      if (session) {
        if (this.jobBus.subscriberCount(jobId) === 0) {
          const latestJob = this.jobsTable.get(jobId);
          if (latestJob && (latestJob.status === 'running' || latestJob.status === 'streaming')) {
            this.jobQueue.setDetached(jobId, true);
            this.metrics.totalGracePeriodsEntered++;

            session.graceTimer = setTimeout(() => {
              const currentJob = this.jobsTable.get(jobId);
              if (currentJob && currentJob.isDetached && this.jobBus.subscriberCount(jobId) === 0) {
                // Hard Abort on Grace Window Expiry (Anti-Zombie Leash)
                this.metrics.totalZombieLeashAborts++;
                if (this.jobQueue.markCancelled(jobId, 'client_disconnect_grace_expired')) {
                  this.metrics.totalJobsCancelled++;
                }
                session.abortController.abort(new Error('Client disconnect grace window expired'));
                this.safeCloseSocket(session.upstreamWs);
                if (currentJob.shardId) {
                  this.releaseShard(currentJob.shardId);
                }
              }
            }, this.config.clientDisconnectGraceMs);
          }
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // UPSTREAM CODEX WEBSOCKET CLIENT & 7-LAYER TIMEOUT CONTROLLER
  // --------------------------------------------------------------------------

  private async dispatchJobToUpstream(jobId: string): Promise<void> {
    const session = this.sessions.get(jobId);
    if (!session) return;
    if (session.abortController.signal.aborted) return;
    const queuedJob = this.jobsTable.get(jobId);
    if (!queuedJob) return;

    // Acquire healthy shard (exclude previously failed shard if possible)
    const shard = this.acquireHealthyShard(session.currentShardId);
    if (!shard) {
      if (this.jobQueue.markFailed(jobId, 'all_shards_exhausted')) this.metrics.totalJobsFailed++;
      return;
    }

    session.currentShardId = shard.id;
    session.lastSeenAliveMs = Date.now();
    const job = this.jobQueue.acquireForDispatch(jobId, shard.id, session.retryCount);
    if (!job) {
      this.releaseShard(shard.id);
      return;
    }
    const attempt: TransportAttempt = {
      id: ++session.activeAttemptId,
      shardId: shard.id,
      hasReceivedFirstToken: false,
      heartbeatPending: false,
      completionObserved: false,
      isFirstChunkAfterFailover: false,
    };

    await this._openUpstreamTransport(job, shard, attempt);
  }

  private async _openUpstreamTransport(
    job: JobRecord,
    shard: ShardRecord,
    attempt: TransportAttempt,
  ): Promise<void> {
    const session = this.sessions.get(job.id);
    if (!session || session.abortController.signal.aborted || session.activeAttemptId !== attempt.id) return;

    const WebSocketClass = (globalThis as any).WebSocket;
    if (!WebSocketClass) {
      if (session.downstreamFailoverKeepaliveTimer) {
        clearInterval(session.downstreamFailoverKeepaliveTimer);
        session.downstreamFailoverKeepaliveTimer = undefined;
      }
      this.jobBus.publish({
        type: 'job:transport_drop',
        jobId: job.id,
        attemptId: attempt.id,
        shardId: shard.id,
        reason: 'websocket_runtime_missing',
      });
      return;
    }

    const messages: Array<{ role: string; content: any }> = JSON.parse(job.messagesJson || '[]');
    const inputList: Array<{ type: string; role: string; content: Array<{ type: string; text: string }> }> = [];
    let instructions = '';
    for (const msg of messages) {
      const textContent = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
        ? msg.content.map((c: any) => (typeof c === 'string' ? c : c?.text || JSON.stringify(c))).join('\n')
        : (msg.content ? JSON.stringify(msg.content) : '');

      if (msg.role === 'system') {
        instructions = instructions ? `${instructions}\n\n${textContent}` : textContent;
      } else {
        inputList.push({
          type: 'message',
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'input_text', text: textContent }],
        });
      }
    }

    const wsHeaders: Record<string, string> = {
      Authorization: `Bearer ${shard.accessToken}`,
      'User-Agent': 'Codex-CLI/0.150.1 (darwin; arm64)',
      'X-Codex-Originator': 'codex_cli',
      'OpenAI-Beta': 'responses_websockets=2026-02-06',
      'X-OpenAI-Product-Sku': 'codex',
      'ChatGPT-Account-Id': shard.accountId,
    };

    const cleanupTimers = () => {
      if (session.connectTimer) clearTimeout(session.connectTimer);
      if (session.ttftTimer) clearTimeout(session.ttftTimer);
      if (session.intraChunkTimer) clearTimeout(session.intraChunkTimer);
      if (session.wsPingTimer) clearInterval(session.wsPingTimer);
      if (session.heartbeatAckTimeoutTimer) clearTimeout(session.heartbeatAckTimeoutTimer);
      if (session.downstreamFailoverKeepaliveTimer) {
        clearInterval(session.downstreamFailoverKeepaliveTimer);
        session.downstreamFailoverKeepaliveTimer = undefined;
      }
    };

    // Calculate Adaptive TTFT ceiling based on reasoning effort and model
    const calculateTtftCeiling = (): number => {
      let base = this.config.wsTtftTimeoutMs;
      const effort = job.reasoningEffort?.toLowerCase() || '';
      const model = job.model?.toLowerCase() || '';
      if (effort === 'high' || model.includes('o3') || model.includes('deep') || model.includes('sol')) {
        return Math.max(base * this.config.deepReasoningTtftMultiplier, 120_000);
      }
      if (effort === 'low') {
        return Math.min(base, 30_000);
      }
      return base; // 60,000ms
    };

    session.activeTtftDeadlineMs = calculateTtftCeiling();

    // Transport failure publication. Retry and terminal policy runs from the
    // bus consumer after this WebSocket callback has returned.
    let failoverTriggered = false;
    const triggerFailover = (reason: string, isQuotaError = false, closeCode = 1006) => {
      if (failoverTriggered) return;
      failoverTriggered = true;

      cleanupTimers();
      this.safeCloseSocket(ws, closeCode, `Failover: ${reason}`);
      this.jobBus.publish({
        type: 'job:transport_drop',
        jobId: job.id,
        attemptId: attempt.id,
        shardId: shard.id,
        reason,
        isQuotaError,
      });
    };

    // Layer 0: WebSocket Handshake Timeout (15s)
    session.connectTimer = setTimeout(() => {
      triggerFailover('ws_connect_handshake_timeout');
    }, this.config.wsConnectTimeoutMs);

    let ws: any;
    try {
      ws = new WebSocketClass(this.config.wsEndpoint, { headers: wsHeaders });
      session.upstreamWs = ws;
      this.tuneSocket(ws);
    } catch (err: any) {
      triggerFailover(`ws_init_error: ${err.message}`);
      return;
    }

    const refreshChunkTimer = () => {
      if (session.intraChunkTimer) clearTimeout(session.intraChunkTimer);
      session.intraChunkTimer = setTimeout(() => {
        triggerFailover('intra_chunk_silence_timeout');
      }, this.config.wsIntraChunkTimeoutMs);
    };

    const resetTtftTimer = (durationMs: number) => {
      if (session.ttftTimer) clearTimeout(session.ttftTimer);
      session.ttftTimer = setTimeout(() => {
        this.metrics.totalTtftDeadlocks++;
        triggerFailover('ttft_deadlock_timeout');
      }, durationMs);
    };

    ws.onopen = () => {
      if (session.activeAttemptId !== attempt.id) {
        this.safeCloseSocket(ws, 1000, 'Superseded transport attempt');
        return;
      }
      if (session.connectTimer) clearTimeout(session.connectTimer);
      this.tuneSocket(ws);
      session.lastSeenAliveMs = Date.now();
      attempt.heartbeatPending = false;

      // Handle RFC 6455 protocol-level pongs from Node.js 'ws'
      if (typeof (ws as any).on === 'function') {
        (ws as any).on('pong', () => {
          attempt.heartbeatPending = false;
          session.lastSeenAliveMs = Date.now();
          if (session.heartbeatAckTimeoutTimer) {
            clearTimeout(session.heartbeatAckTimeoutTimer);
            session.heartbeatAckTimeoutTimer = undefined;
          }
        });
      }

      // Layer 1: Adaptive TTFT Deadlock Timer (Calibrated by Reasoning Effort)
      resetTtftTimer(session.activeTtftDeadlineMs);

      // Layer 5: Discord Gateway Heartbeat ACK (OP 1 / OP 11) Protocol
      const jitterMs = Math.floor(Math.random() * 3000);
      session.wsPingTimer = setInterval(() => {
        if (session.abortController.signal.aborted || failoverTriggered) return;

        // Discord Heartbeat ACK Verification: If previous heartbeat was NOT acked, verify actual silence
        if (attempt.heartbeatPending) {
          const timeSinceLastActivity = Date.now() - session.lastSeenAliveMs;
          if (timeSinceLastActivity < this.config.wsIntraChunkTimeoutMs) {
            attempt.heartbeatPending = false;
          } else {
            this.metrics.totalHeartbeatAckMisses++;
            this.metrics.totalDeadPeerRecoveries++;
            console.warn(`[AntiFragileRelay] Shard ${shard.id} Heartbeat ACK Miss (zombie peer detected). Evicting with code 4000...`);
            triggerFailover('discord_heartbeat_ack_miss', false, 4000);
            return;
          }
        }

        // Arm pending heartbeat ACK flag
        attempt.heartbeatPending = true;

        try {
          if (typeof ws.ping === 'function') {
            ws.ping();
          } else if (typeof ws.send === 'function') {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        } catch {
          triggerFailover('ws_ping_send_error');
          return;
        }

        // Pong ACK Deadline Watchdog (Only evict if genuinely silent)
        session.heartbeatAckTimeoutTimer = setTimeout(() => {
          if (session.abortController.signal.aborted || failoverTriggered) return;
          if (attempt.heartbeatPending) {
            const timeSinceLastActivity = Date.now() - session.lastSeenAliveMs;
            if (timeSinceLastActivity < this.config.wsIntraChunkTimeoutMs) {
              attempt.heartbeatPending = false;
              return;
            }
            this.metrics.totalDeadPeerRecoveries++;
            console.warn(`[AntiFragileRelay] Shard ${shard.id} pong deadline expired (${this.config.wsDeadPeerPongTimeoutMs}ms); evicting dead peer.`);
            triggerFailover('dead_peer_pong_timeout', false, 4000);
          }
        }, this.config.wsDeadPeerPongTimeoutMs);
      }, this.config.wsDeadPeerPingIntervalMs + jitterMs);

      const createPayload: Record<string, any> = {
        type: 'response.create',
        model: job.model,
        input: inputList,
        stream: true,
      };
      if (instructions) createPayload.instructions = instructions;
      if (job.reasoningEffort && job.reasoningEffort !== 'none') {
        createPayload.reasoning = { effort: job.reasoningEffort };
      }

      try {
        ws.send(JSON.stringify(createPayload));
      } catch (err: any) {
        triggerFailover(`ws_send_payload_error: ${err.message}`);
      }
    };

    ws.onmessage = (event: any) => {
      try {
        if (session.activeAttemptId !== attempt.id) return;
        session.lastSeenAliveMs = Date.now();
        // Clear pending heartbeat on ANY frame arrival from upstream
        attempt.heartbeatPending = false;
        if (session.heartbeatAckTimeoutTimer) {
          clearTimeout(session.heartbeatAckTimeoutTimer);
          session.heartbeatAckTimeoutTimer = undefined;
        }
        // Stop downstream failover keepalive ticker if running
        if (session.downstreamFailoverKeepaliveTimer) {
          clearInterval(session.downstreamFailoverKeepaliveTimer);
          session.downstreamFailoverKeepaliveTimer = undefined;
        }

        const raw = typeof event.data === 'string' ? event.data : event.data.toString();
        const data = JSON.parse(raw);

        // Ping / Pong Protocol
        if (data.type === 'ping') {
          try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
          return;
        }
        if (data.type === 'pong' || data.type === 'response.pong') {
          attempt.heartbeatPending = false;
          session.lastSeenAliveMs = Date.now();
          if (session.heartbeatAckTimeoutTimer) {
            clearTimeout(session.heartbeatAckTimeoutTimer);
            session.heartbeatAckTimeoutTimer = undefined;
          }
          return;
        }

        // Dynamic Reasoning / Thinking Delta Handling
        if (data.type === 'response.reasoning.delta' || data.type === 'response.reasoning_text.delta') {
          this.metrics.totalReasoningChunksReceived++;
          // Active thinking in progress -> extend TTFT deadlock timer dynamically
          if (!attempt.hasReceivedFirstToken) {
            resetTtftTimer(this.config.reasoningActivityExtensionMs);
          }
          refreshChunkTimer();

          if (data.delta) {
            this.jobBus.publish({ type: 'job:reasoning', jobId: job.id, text: String(data.delta) });
          }
          return;
        }

        // Proactive Rate-Limit Handling via OpenAI Responses Wire Frames
        if (data.type === 'rate_limits.updated' && Array.isArray(data.rate_limits)) {
          for (const limit of data.rate_limits) {
            if (limit.remaining === 0) {
              this.metrics.totalProactiveRateLimitCooldowns++;
              console.warn(`[AntiFragileRelay] Proactive rate-limit trigger on shard ${shard.id} (${limit.name} remaining=0). Cooling down shard proactively...`);
              const currentShard = this.shardsTable.get(shard.id);
              if (currentShard) {
                this.shardsTable.put(shard.id, {
                  ...currentShard,
                  status: 'cooldown',
                  lastUsedAtMs: Date.now(),
                });
              }
              break;
            }
          }
          if (!attempt.hasReceivedFirstToken) {
            resetTtftTimer(this.config.reasoningActivityExtensionMs);
          }
          return;
        }

        // Progress / Keepalive Events
        if (data.type === 'response.in_progress' || data.type === 'response.output_item.added' || data.type === 'response.created') {
          if (!attempt.hasReceivedFirstToken) {
            resetTtftTimer(this.config.reasoningActivityExtensionMs);
          }
          return;
        }

        // Output Token Chunk Arrival (Text, Audio, Tool Arguments)
        const isOutputDelta = data.type === 'response.output_text.delta' ||
          data.type === 'response.audio.delta' ||
          data.type === 'response.function_call_arguments.delta';

        if (isOutputDelta && data.delta) {
          let chunkText = typeof data.delta === 'string' ? data.delta : (data.delta.text || '');

          // Figma / Liveblocks Suffix-Prefix Overlap Reconciliation
          if (attempt.isFirstChunkAfterFailover && attempt.priorFailoverSuffix) {
            const originalLength = chunkText.length;
            chunkText = reconcileOverlap(attempt.priorFailoverSuffix, chunkText, this.config.deDuplicationOverlapWindowChars);
            attempt.isFirstChunkAfterFailover = false;
            attempt.priorFailoverSuffix = undefined;

            if (chunkText.length < originalLength) {
              this.metrics.totalOverlapReconciliationsWon++;
              console.log(`[AntiFragileRelay] Overlap reconciliation won: trimmed ${originalLength - chunkText.length} duplicate characters.`);
            }

            if (!chunkText || chunkText.length === 0) {
              // Pure duplicate echo chunk; wait for next non-duplicate chunk
              return;
            }
            data.delta = chunkText;
          }

          const now = Date.now();

          if (!attempt.hasReceivedFirstToken) {
            attempt.hasReceivedFirstToken = true;
            if (session.ttftTimer) clearTimeout(session.ttftTimer);
          }

          // Layer 2: Inter-Token Latency (ITL) Watchdog
          if (session.lastChunkAtMs > 0) {
            const itlGap = now - session.lastChunkAtMs;
            session.ewmaItlMs = session.ewmaItlMs === 0 ? itlGap : 0.15 * itlGap + 0.85 * session.ewmaItlMs;

            if (itlGap > this.config.itlGapThresholdMs) {
              session.consecutiveItlStalls++;
              this.metrics.totalItlStallsDetected++;
              if (session.consecutiveItlStalls >= this.config.itlConsecutiveLimit) {
                console.warn(`[AntiFragileRelay] Job ${job.id}: 3 consecutive ITL stall violations. Triggering handover...`);
                triggerFailover('consecutive_itl_stalls_exceeded');
                return;
              }
            } else {
              session.consecutiveItlStalls = 0;
            }
          }
          session.lastChunkAtMs = now;

          // Layer 3: Reset Intra-Chunk Timer
          refreshChunkTimer();

          // The socket reports an observation only. Sequence allocation and
          // relay-job projection happen asynchronously after this callback.
          this.jobBus.publish({
            type: 'job:transport_token',
            jobId: job.id,
            attemptId: attempt.id,
            shardId: shard.id,
            text: chunkText,
            timestampMs: now,
          });
          return;
        }

        // Completion Arrival (response.completed or response.done)
        if (data.type === 'response.completed' || data.type === 'response.done') {
          attempt.completionObserved = true;
          cleanupTimers();
          if (session.wallTimer) clearTimeout(session.wallTimer);
          this.jobBus.publish({
            type: 'job:transport_completed',
            jobId: job.id,
            attemptId: attempt.id,
            shardId: shard.id,
          });
          return;
        }

        // Upstream Error Frame (429 Rate Limit / 5xx Overloaded)
        if (data.type === 'error') {
          const isQuotaOrRateLimit = data.code === 429 || data.message?.includes('rate_limit') || data.message?.includes('quota');
          console.warn(`[AntiFragileRelay] Upstream returned error frame on shard ${shard.id}:`, JSON.stringify(data));
          triggerFailover(`upstream_error_${data.code || 'generic'}`, isQuotaOrRateLimit);
          return;
        }
      } catch (err: any) {
        console.error('[BroccoliDB Relay] Error parsing WebSocket frame:', err.message);
      }
    };

    ws.onerror = (err: any) => {
      if (session.activeAttemptId !== attempt.id) return;
      triggerFailover(`ws_socket_error: ${err.message || 'unknown'}`);
    };

    ws.onclose = (event: any) => {
      if (session.activeAttemptId !== attempt.id || failoverTriggered) return;
      if (attempt.completionObserved) {
        cleanupTimers();
        return;
      }
      const currentJob = this.jobsTable.get(job.id);
      if (
        currentJob &&
        currentJob.status !== 'completed' &&
        currentJob.status !== 'cancelled' &&
        currentJob.status !== 'failed'
      ) {
        const isQuota = event?.code === 4029 || event?.code === 1008;
        triggerFailover(`ws_abnormal_closure_${event?.code || 'unknown'}`, isQuota);
      } else {
        cleanupTimers();
        this.releaseShard(shard.id);
      }
    };
  }

  // --------------------------------------------------------------------------
  // ANTI-FRAGILE MID-STREAM SHARD FAILOVER & CONTEXT CONTINUATION
  // --------------------------------------------------------------------------

  private handleTransportToken(event: JobBusEventOf<'job:transport_token'>): void {
    const session = this.sessions.get(event.jobId);
    if (!session || session.abortController.signal.aborted || session.activeAttemptId !== event.attemptId) return;
    const allocation = this.jobQueue.recordToken(event.jobId);
    if (!allocation) return;
    const token: JobTokenRecord = {
      id: `${event.jobId}_${allocation.seqNo}`,
      jobId: event.jobId,
      seqNo: allocation.seqNo,
      text: event.text,
      isFinal: false,
      timestampMs: event.timestampMs,
    };
    this.metrics.totalTokensEmitted++;
    this.jobBus.publish({ type: 'job:token', jobId: event.jobId, token });
  }

  private handleTransportCompleted(event: JobBusEventOf<'job:transport_completed'>): void {
    const session = this.sessions.get(event.jobId);
    if (!session || session.activeAttemptId !== event.attemptId) return;
    if (this.jobQueue.markComplete(event.jobId)) {
      this.metrics.totalJobsCompleted++;
      this.releaseShard(event.shardId);
    }
  }

  private handleTransportDrop(event: JobBusEventOf<'job:transport_drop'>): void {
    const session = this.sessions.get(event.jobId);
    if (!session || session.abortController.signal.aborted || session.activeAttemptId !== event.attemptId) return;
    const job = this.jobsTable.get(event.jobId);
    if (
      !job ||
      job.status === 'completed' ||
      job.status === 'cancelled' ||
      job.status === 'failed'
    ) {
      return;
    }

    if (event.isQuotaError) {
      this.metrics.totalShardCooldownEjections++;
      const shard = this.shardsTable.get(event.shardId);
      if (shard) {
        this.shardsTable.put(event.shardId, {
          ...shard,
          inFlight: Math.max(0, shard.inFlight - 1),
          status: 'cooldown',
          lastUsedAtMs: Date.now(),
        });
      }
    } else {
      this.recordShardFailure(event.shardId);
    }

    if (session.retryCount >= this.config.maxUpstreamRetries) {
      if (this.jobQueue.markFailed(event.jobId, `retries_exhausted_${event.reason}`)) {
        this.metrics.totalJobsFailed++;
      }
      return;
    }

    session.retryCount++;
    this.metrics.totalUpstreamRetries++;
    const baseDelay = this.config.retryBaseDelayMs * Math.pow(2, session.retryCount - 1);
    const jitter = Math.floor(Math.random() * baseDelay);
    const backoffMs = Math.min(this.config.retryMaxDelayMs, baseDelay + jitter);
    console.warn(
      `[AntiFragileRelay] Upstream failure (${event.reason}) on shard ${event.shardId}. ` +
      `Scheduling queue-owned recovery ${session.retryCount}/${this.config.maxUpstreamRetries} in ${backoffMs}ms...`,
    );
    setTimeout(() => {
      if (!session.abortController.signal.aborted && session.activeAttemptId === event.attemptId) {
        void this.performInFlightFailover(event.jobId, event.reason, event.shardId);
      }
    }, backoffMs);
  }

  private async performInFlightFailover(jobId: string, reason: string, failedShardId: string): Promise<void> {
    const session = this.sessions.get(jobId);
    if (!session || session.abortController.signal.aborted) return;

    const currentJob = this.jobsTable.get(jobId);
    if (
      !currentJob ||
      currentJob.status === 'cancelled' ||
      currentJob.status === 'completed' ||
      currentJob.status === 'failed'
    ) {
      return;
    }

    // Slack Flannel Downstream Failover Keepalive: Send immediate SSE comment to reset proxy idle timers
    this.metrics.totalDownstreamFailoverKeepalivesSent++;
    this.jobBus.publish({
      type: 'job:keepalive',
      jobId,
      text: `: transit_failover_in_progress reason=${reason}\n\n`,
    });

    // Start 1s keepalive heartbeat ticker during shard handover
    if (session.downstreamFailoverKeepaliveTimer) clearInterval(session.downstreamFailoverKeepaliveTimer);
    session.downstreamFailoverKeepaliveTimer = setInterval(() => {
      if (session.abortController.signal.aborted) {
        if (session.downstreamFailoverKeepaliveTimer) {
          clearInterval(session.downstreamFailoverKeepaliveTimer);
          session.downstreamFailoverKeepaliveTimer = undefined;
        }
        return;
      }
      this.metrics.totalDownstreamFailoverKeepalivesSent++;
      this.jobBus.publish({ type: 'job:keepalive', jobId, text: ': transit_failover_in_progress\n\n' });
    }, 1000);

    // 1. Acquire alternative healthy shard
    const newShard = this.acquireHealthyShard(failedShardId);
    if (!newShard) {
      console.warn(`[AntiFragileRelay] In-flight failover failed: No alternate healthy shards available.`);
      if (session.downstreamFailoverKeepaliveTimer) {
        clearInterval(session.downstreamFailoverKeepaliveTimer);
        session.downstreamFailoverKeepaliveTimer = undefined;
      }
      if (this.jobQueue.markFailed(jobId, `all_shards_exhausted_during_failover_${reason}`)) {
        this.metrics.totalJobsFailed++;
      }
      return;
    }

    this.metrics.totalMidStreamFailoversWon++;
    console.log(`[AntiFragileRelay] Seamless failover engaged for job ${jobId}: ${failedShardId} -> ${newShard.id} (Tokens emitted so far: ${currentJob.seqCounter})`);

    // 2. Prepare payload
    const jobUpdates: Partial<JobRecord> = {
      shardId: newShard.id,
      failoverCount: (currentJob.failoverCount || 0) + 1,
      status: currentJob.seqCounter > 0 ? 'streaming' : 'running',
    };
    let priorFailoverSuffix: string | undefined;

    // If tokens have already been emitted, augment conversation with partial assistant response + continuation prompt
    if (currentJob.seqCounter > 0) {
      const emittedTokens = this.tokensTable.query({
        where: { jobId },
        sortBy: 'seqNo',
        sortOrder: 'asc',
      });
      const accumulatedText = emittedTokens.map((t) => t.text).join('');

      // Arm Figma / Liveblocks Overlap Reconciliation for first chunk from new shard
      priorFailoverSuffix = accumulatedText.slice(-this.config.deDuplicationOverlapWindowChars);

      try {
        const originalMessages: Array<{ role: string; content: string }> = JSON.parse(currentJob.messagesJson || '[]');
        const resumedMessages = [
          ...originalMessages,
          { role: 'assistant', content: accumulatedText },
          {
            role: 'user',
            content: '[TRANSIT_FAILOVER_DIRECTIVE]: An upstream network connection interrupted your output stream. Please continue the response seamlessly from the exact word/character where you stopped above. Do not repeat any prior text.',
          },
        ];
        jobUpdates.messagesJson = JSON.stringify(resumedMessages);
      } catch {
        // Fallback to original messages
      }
    }

    const updatedJob = this.jobQueue.updateForFailover(jobId, jobUpdates);
    if (!updatedJob) {
      this.releaseShard(newShard.id);
      return;
    }
    session.currentShardId = newShard.id;
    const attempt: TransportAttempt = {
      id: ++session.activeAttemptId,
      shardId: newShard.id,
      hasReceivedFirstToken: false,
      heartbeatPending: false,
      completionObserved: false,
      isFirstChunkAfterFailover: priorFailoverSuffix !== undefined,
      priorFailoverSuffix,
    };

    // 3. Open exactly the acquired replacement shard. No second acquisition.
    await this._openUpstreamTransport(updatedJob, newShard, attempt);
  }

  // --------------------------------------------------------------------------
  // CLEAN CANCEL & JOB STATUS
  // --------------------------------------------------------------------------

  private handleJobStatus(jobId: string, res: http.ServerResponse): void {
    const job = this.jobsTable.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Job ${jobId} not found`, code: 'job_not_found' } }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: job.id,
      model: job.model,
      status: job.status,
      tokensGenerated: job.seqCounter,
      createdAt: Math.floor(job.createdAtMs / 1000),
      durationMs: ((job.completedAtMs as number) || Date.now()) - job.createdAtMs,
      streamUrl: `/v1/jobs/${job.id}/stream`,
      error: job.error || null,
    }));
  }

  private handleJobCancel(jobId: string, res: http.ServerResponse): void {
    const job = this.jobsTable.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Job ${jobId} not found`, code: 'job_not_found' } }));
      return;
    }

    const session = this.sessions.get(jobId);
    if (session?.graceTimer) clearTimeout(session.graceTimer);

    const cancelled = this.jobQueue.markCancelled(jobId, 'user_cancelled');
    if (cancelled) this.metrics.totalJobsCancelled++;

    if (cancelled && session) {
      if (session.wallTimer) clearTimeout(session.wallTimer);
      if (session.downstreamFailoverKeepaliveTimer) {
        clearInterval(session.downstreamFailoverKeepaliveTimer);
        session.downstreamFailoverKeepaliveTimer = undefined;
      }
      session.abortController.abort(new Error('User cancelled job'));
      this.safeCloseSocket(session.upstreamWs);
    }

    if (cancelled && job.shardId) {
      this.releaseShard(job.shardId);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: job.id,
      status: cancelled ? 'cancelled' : this.jobsTable.get(jobId)?.status,
      tokensGenerated: job.seqCounter,
      refunded: cancelled,
    }));
  }

  // --------------------------------------------------------------------------
  // ATOMIC CHECKPOINTING & CRASH RECOVERY (RocksDB / Redis Snapshot Pattern)
  // --------------------------------------------------------------------------

  private saveStateSnapshot(): void {
    try {
      const snapDir = path.dirname(this.config.stateSnapshotPath);
      if (!fs.existsSync(snapDir)) {
        fs.mkdirSync(snapDir, { recursive: true });
      }

      const activeJobs = this.jobsTable.getAll().filter(
        (j) => j.status === 'queued' || j.status === 'running' || j.status === 'streaming'
      );

      const snapshot = {
        timestampMs: Date.now(),
        jobs: activeJobs,
        shards: this.shardsTable.getAll(),
        metrics: this.metrics,
      };

      const tmpPath = `${this.config.stateSnapshotPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.config.stateSnapshotPath); // Atomic POSIX rename
    } catch (err: any) {
      console.error('[BroccoliDB Relay] Snapshot checkpoint failed:', err.message);
    }
  }

  private recoverStateSnapshot(): void {
    if (!fs.existsSync(this.config.stateSnapshotPath)) return;

    try {
      const raw = fs.readFileSync(this.config.stateSnapshotPath, 'utf-8');
      const snap = JSON.parse(raw);

      if (Array.isArray(snap.jobs)) {
        for (const job of snap.jobs) {
          // Recover crashed jobs as reconnectable
          this.jobQueue.restore({
            ...job,
            isDetached: true,
            error: 'server_restarted_reconnectable',
          });
        }
        console.log(`[BroccoliDB Relay] Recovered ${snap.jobs.length} in-flight jobs from checkpoint snapshot.`);
      }
    } catch {}
  }

  private startPeriodicSnapshot(): void {
    this.snapshotIntervalTimer = setInterval(() => {
      this.saveStateSnapshot();
    }, this.config.snapshotIntervalMs);
    this.snapshotIntervalTimer.unref?.();
  }

  // --------------------------------------------------------------------------
  // HEALTH & OBSERVABILITY
  // --------------------------------------------------------------------------

  private handleHealth(res: http.ServerResponse): void {
    const mem = process.memoryUsage();
    const activeJobs = this.jobsTable.getAll().filter(
      (record) => record.status === 'running' || record.status === 'streaming'
    );
    const allShards = this.shardsTable.getAll();

    const healthData = {
      status: 'ok',
      version: '2.6.0',
      storageEngine: 'BroccoliDB Zenith Tier',
      uptimeSec: Math.floor((Date.now() - this.metrics.startTimeMs) / 1000),
      shards: {
        total: allShards.length,
        active: allShards.filter((s) => s.status === 'active').length,
        exhausted: allShards.filter((s) => s.status === 'exhausted').length,
        cooldown: allShards.filter((s) => s.status === 'cooldown').length,
      },
      jobs: {
        active: activeJobs.length,
        totalSubmitted: this.metrics.totalJobsSubmitted,
        totalCompleted: this.metrics.totalJobsCompleted,
        attachedDuplicates: this.metrics.totalAttachedDuplicates,
      },
      antiFragility: {
        totalUpstreamRetries: this.metrics.totalUpstreamRetries,
        totalMidStreamFailoversWon: this.metrics.totalMidStreamFailoversWon,
        totalShardCooldownEjections: this.metrics.totalShardCooldownEjections,
        totalDeadPeerRecoveries: this.metrics.totalDeadPeerRecoveries,
        totalReasoningChunksReceived: this.metrics.totalReasoningChunksReceived,
        totalHeartbeatAckMisses: this.metrics.totalHeartbeatAckMisses,
        totalOverlapReconciliationsWon: this.metrics.totalOverlapReconciliationsWon,
        totalDownstreamFailoverKeepalivesSent: this.metrics.totalDownstreamFailoverKeepalivesSent,
        totalProactiveRateLimitCooldowns: this.metrics.totalProactiveRateLimitCooldowns,
        totalBusEventsEmitted: this.metrics.totalBusEventsEmitted,
        totalSlowSubscriberDrains: this.metrics.totalSlowSubscriberDrains,
      },
      security: {
        authEnabled: !!(this.config.apiKeys && this.config.apiKeys.length > 0),
        rateGovernorActive: true,
        maxPayloadBytes: this.config.maxPayloadBytes,
      },
      broccolidb: {
        jobsTableCount: this.jobsTable.count(),
        tokensTableCount: this.tokensTable.count(),
        idempotencyTableCount: this.idempotencyTable.count(),
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData, null, 2));
  }

  private handleMetrics(res: http.ServerResponse): void {
    const activeJobs = this.jobsTable.getAll().filter(
      (record) => record.status === 'running' || record.status === 'streaming'
    );

    const lines = [
      '# HELP galxai_relay_jobs_in_flight Current active inference jobs',
      '# TYPE galxai_relay_jobs_in_flight gauge',
      `galxai_relay_jobs_in_flight ${activeJobs.length}`,
      '# HELP galxai_relay_jobs_submitted_total Total jobs submitted',
      '# TYPE galxai_relay_jobs_submitted_total counter',
      `galxai_relay_jobs_submitted_total ${this.metrics.totalJobsSubmitted}`,
      '# HELP galxai_relay_jobs_completed_total Total jobs completed',
      '# TYPE galxai_relay_jobs_completed_total counter',
      `galxai_relay_jobs_completed_total ${this.metrics.totalJobsCompleted}`,
      '# HELP galxai_relay_attached_duplicates_total Duplicate prompts attached to in-flight stream',
      '# TYPE galxai_relay_attached_duplicates_total counter',
      `galxai_relay_attached_duplicates_total ${this.metrics.totalAttachedDuplicates}`,
      '# HELP galxai_relay_tokens_emitted_total Total tokens emitted over wire',
      '# TYPE galxai_relay_tokens_emitted_total counter',
      `galxai_relay_tokens_emitted_total ${this.metrics.totalTokensEmitted}`,
      '# HELP galxai_relay_tokens_buffer_replayed_total Tokens served from BroccoliDB resume buffer',
      '# TYPE galxai_relay_tokens_buffer_replayed_total counter',
      `galxai_relay_tokens_buffer_replayed_total ${this.metrics.totalTokensServedFromBuffer}`,
      '# HELP galxai_relay_reconnections_total Total client stream reconnections',
      '# TYPE galxai_relay_reconnections_total counter',
      `galxai_relay_reconnections_total ${this.metrics.totalReconnections}`,
      '# HELP galxai_relay_grace_reconnections_total Reconnections saved by grace window',
      '# TYPE galxai_relay_grace_reconnections_total counter',
      `galxai_relay_grace_reconnections_total ${this.metrics.totalGraceReconnectionsWon}`,
      '# HELP galxai_relay_zombie_leash_aborts_total Total zombie upstream aborts',
      '# TYPE galxai_relay_zombie_leash_aborts_total counter',
      `galxai_relay_zombie_leash_aborts_total ${this.metrics.totalZombieLeashAborts}`,
      '# HELP galxai_relay_itl_stalls_total Total ITL stalls flagged',
      '# TYPE galxai_relay_itl_stalls_total counter',
      `galxai_relay_itl_stalls_total ${this.metrics.totalItlStallsDetected}`,
      '# HELP galxai_relay_ttft_deadlocks_total Total TTFT deadlocks detected',
      '# TYPE galxai_relay_ttft_deadlocks_total counter',
      `galxai_relay_ttft_deadlocks_total ${this.metrics.totalTtftDeadlocks}`,
      '# HELP galxai_relay_upstream_retries_total Total in-flight upstream failover retries',
      '# TYPE galxai_relay_upstream_retries_total counter',
      `galxai_relay_upstream_retries_total ${this.metrics.totalUpstreamRetries}`,
      '# HELP galxai_relay_midstream_failovers_won_total Seamless mid-stream failovers without client error',
      '# TYPE galxai_relay_midstream_failovers_won_total counter',
      `galxai_relay_midstream_failovers_won_total ${this.metrics.totalMidStreamFailoversWon}`,
      '# HELP galxai_relay_shard_cooldown_ejections_total Shards ejected to cooldown due to 429 or quota exhaustion',
      '# TYPE galxai_relay_shard_cooldown_ejections_total counter',
      `galxai_relay_shard_cooldown_ejections_total ${this.metrics.totalShardCooldownEjections}`,
      '# HELP galxai_relay_dead_peer_recoveries_total Half-open or dead TCP peer connections evicted',
      '# TYPE galxai_relay_dead_peer_recoveries_total counter',
      `galxai_relay_dead_peer_recoveries_total ${this.metrics.totalDeadPeerRecoveries}`,
      '# HELP galxai_relay_reasoning_chunks_received_total Reasoning delta progress frames processed',
      '# TYPE galxai_relay_reasoning_chunks_received_total counter',
      `galxai_relay_reasoning_chunks_received_total ${this.metrics.totalReasoningChunksReceived}`,
      '# HELP galxai_relay_heartbeat_ack_misses_total Discord-style Heartbeat ACK misses detecting dead peers',
      '# TYPE galxai_relay_heartbeat_ack_misses_total counter',
      `galxai_relay_heartbeat_ack_misses_total ${this.metrics.totalHeartbeatAckMisses}`,
      '# HELP galxai_relay_overlap_reconciliations_won_total LLM continuation overlaps deduplicated without stutter',
      '# TYPE galxai_relay_overlap_reconciliations_won_total counter',
      `galxai_relay_overlap_reconciliations_won_total ${this.metrics.totalOverlapReconciliationsWon}`,
      '# HELP galxai_relay_failover_keepalives_sent_total Downstream SSE failover keepalive comment frames sent',
      '# TYPE galxai_relay_failover_keepalives_sent_total counter',
      `galxai_relay_failover_keepalives_sent_total ${this.metrics.totalDownstreamFailoverKeepalivesSent}`,
      '# HELP galxai_relay_proactive_rate_limit_cooldowns_total Proactive shard cooldown transitions triggered by rate_limits.updated',
      '# TYPE galxai_relay_proactive_rate_limit_cooldowns_total counter',
      `galxai_relay_proactive_rate_limit_cooldowns_total ${this.metrics.totalProactiveRateLimitCooldowns}`,
      '# HELP galxai_relay_bus_events_emitted_total Events dispatched through the asynchronous job bus',
      '# TYPE galxai_relay_bus_events_emitted_total counter',
      `galxai_relay_bus_events_emitted_total ${this.metrics.totalBusEventsEmitted}`,
      '# HELP galxai_relay_slow_subscriber_drains_total Subscriber writes that entered independent drain handling',
      '# TYPE galxai_relay_slow_subscriber_drains_total counter',
      `galxai_relay_slow_subscriber_drains_total ${this.metrics.totalSlowSubscriberDrains}`,
      '# HELP galxai_relay_rate_limit_drops_total Total requests dropped by token bucket rate limiter',
      '# TYPE galxai_relay_rate_limit_drops_total counter',
      `galxai_relay_rate_limit_drops_total ${this.metrics.totalRateLimitDrops}`,
      '# HELP galxai_relay_auth_failures_total Total 401 unauthorized requests',
      '# TYPE galxai_relay_auth_failures_total counter',
      `galxai_relay_auth_failures_total ${this.metrics.totalAuthFailures}`,
      '# HELP galxai_relay_broccolidb_tokens_count Active token records in BroccoliDB',
      '# TYPE galxai_relay_broccolidb_tokens_count gauge',
      `galxai_relay_broccolidb_tokens_count ${this.tokensTable.count()}`,
    ];

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(lines.join('\n') + '\n');
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE CONTROLS (START & GRACEFUL DRAIN)
  // --------------------------------------------------------------------------

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`[BroccoliDB Relay] Listening on http://${this.config.host}:${this.config.port}`);
        console.log(`[BroccoliDB Relay] Shards enrolled: ${this.shardsTable.count()} | Target WS: ${this.config.wsEndpoint}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    console.log('[BroccoliDB Relay] Entering graceful drain mode...');
    this.isDraining = true;
    if (this.snapshotIntervalTimer) clearInterval(this.snapshotIntervalTimer);

    const drained = await this.waitForQueueDrain(this.config.drainTimeoutMs);
    if (!drained) {
      console.warn('[BroccoliDB Relay] Drain deadline expired; terminating remaining active jobs.');
      for (const [jobId, session] of this.sessions) {
        const job = this.jobsTable.get(jobId);
        if (!job || (job.status !== 'queued' && job.status !== 'running' && job.status !== 'streaming')) continue;
        if (this.jobQueue.markFailed(jobId, 'relay_drain_timeout')) this.metrics.totalJobsFailed++;
        if (session.downstreamFailoverKeepaliveTimer) {
          clearInterval(session.downstreamFailoverKeepaliveTimer);
          session.downstreamFailoverKeepaliveTimer = undefined;
        }
        session.abortController.abort(new Error('Relay drain timeout'));
        this.safeCloseSocket(session.upstreamWs);
        if (session.currentShardId) this.releaseShard(session.currentShardId);
      }
    }
    await this.jobBus.whenIdle();

    // Save final state snapshot before exit
    this.saveStateSnapshot();

    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('[BroccoliDB Relay] HTTP listener closed cleanly.');
        resolve();
      });
    });
  }

  private waitForQueueDrain(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (drained: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.jobBus.removeListener('relay:drained', onDrained);
        resolve(drained);
      };
      const onDrained = () => finish(true);
      this.jobBus.once('relay:drained', onDrained);
      const timer = setTimeout(() => finish(false), timeoutMs);

      // Subscribe before checking to avoid losing the final transition between
      // an empty-state check and listener installation.
      if (this.jobQueue.activeCount() === 0) finish(true);
    });
  }
}

// ----------------------------------------------------------------------------
// ENTRYPOINT EXECUTION
// ----------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const relay = new GalxaiRelayServer();

  const shutdown = async (signal: string) => {
    console.log(`\n[BroccoliDB Relay] Received ${signal}`);
    await relay.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  relay.start().catch((err) => {
    console.error('[BroccoliDB Relay] Fatal startup error:', err);
    process.exit(1);
  });
}
