/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-connection-pool.ts
 *
 * Multi-Tenant Subsystem Connection Pooling & Concurrency Governor for BroccoliDB (Pass 198 / ADR-136).
 * Manages bounded concurrent leases, fair FIFO queueing, and lease lifecycle metrics.
 */

import type {
  BroccoliLeaseHandle,
  BroccoliLeaseMode,
  BroccoliPoolMetrics,
  IBroccoliConnectionPool,
} from "../../../core/contracts/broccolidb.contracts.js";

export interface BroccoliConnectionPoolOptions {
  readonly maxConcurrentLeases?: number;
  readonly defaultLeaseTtlMs?: number;
  readonly maxQueueLength?: number;
}

export class BroccoliConnectionPool implements IBroccoliConnectionPool {
  private readonly maxConcurrentLeases: number;
  private readonly defaultLeaseTtlMs: number;
  private readonly maxQueueLength: number;

  private readonly activeLeases = new Map<string, BroccoliLeaseHandle>();
  private readonly waitingQueue: Array<{
    subsystem: string;
    mode: BroccoliLeaseMode;
    resolve: (handle: BroccoliLeaseHandle) => void;
    reject: (err: Error) => void;
    enqueuedAt: number;
    timeoutTimer?: NodeJS.Timeout;
  }> = [];

  private totalLeasesIssued = 0;
  private peakConcurrency = 0;
  private totalWaitMs = 0;
  private completedLeaseWaits = 0;
  private deadlocksPrevented = 0;

  constructor(options: BroccoliConnectionPoolOptions = {}) {
    this.maxConcurrentLeases = options.maxConcurrentLeases ?? 32;
    this.defaultLeaseTtlMs = options.defaultLeaseTtlMs ?? 5000;
    this.maxQueueLength = options.maxQueueLength ?? 256;
  }

  public async acquireLease(
    subsystem: string,
    mode: BroccoliLeaseMode = "SHARED_READ",
    timeoutMs?: number
  ): Promise<BroccoliLeaseHandle> {
    const ttl = timeoutMs ?? this.defaultLeaseTtlMs;
    const now = Date.now();

    // Check if we can issue immediately
    if (this.canIssueLease(mode)) {
      return this.createAndRegisterLease(subsystem, mode, ttl);
    }

    if (this.waitingQueue.length >= this.maxQueueLength) {
      throw new Error(`BroccoliDB Connection Pool queue full (${this.waitingQueue.length}/${this.maxQueueLength})`);
    }

    const enqueuedAt = now;

    return new Promise<BroccoliLeaseHandle>((resolve, reject) => {
      const queueItem = {
        subsystem,
        mode,
        resolve: (handle: BroccoliLeaseHandle) => {
          this.totalWaitMs += Date.now() - enqueuedAt;
          this.completedLeaseWaits++;
          resolve(handle);
        },
        reject,
        enqueuedAt,
        timeoutTimer: undefined as NodeJS.Timeout | undefined,
      };

      queueItem.timeoutTimer = setTimeout(() => {
        const idx = this.waitingQueue.indexOf(queueItem);
        if (idx !== -1) {
          this.waitingQueue.splice(idx, 1);
          reject(new Error(`Lease acquisition timed out after ${ttl}ms for subsystem '${subsystem}'`));
        }
      }, ttl);

      this.waitingQueue.push(queueItem);
    });
  }

  public releaseLease(leaseId: string): boolean {
    const existing = this.activeLeases.get(leaseId);
    if (!existing) return false;

    this.activeLeases.delete(leaseId);
    this.processWaitingQueue();
    return true;
  }

  public async withLease<T>(
    subsystem: string,
    mode: BroccoliLeaseMode,
    fn: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const handle = await this.acquireLease(subsystem, mode, timeoutMs);
    try {
      return await fn();
    } finally {
      this.releaseLease(handle.leaseId);
    }
  }

  public getMetrics(): BroccoliPoolMetrics {
    let activeReads = 0;
    let activeWrites = 0;

    for (const lease of this.activeLeases.values()) {
      if (lease.mode === "SHARED_READ") activeReads++;
      else activeWrites++;
    }

    const averageWaitMs = this.completedLeaseWaits > 0
      ? this.totalWaitMs / this.completedLeaseWaits
      : 0;

    return {
      activeLeases: this.activeLeases.size,
      activeReads,
      activeWrites,
      waitingQueueLength: this.waitingQueue.length,
      totalLeasesIssued: this.totalLeasesIssued,
      peakConcurrency: this.peakConcurrency,
      averageWaitMs,
      deadlocksPrevented: this.deadlocksPrevented,
    };
  }

  public getActiveLeases(): readonly BroccoliLeaseHandle[] {
    return Array.from(this.activeLeases.values());
  }

  private canIssueLease(mode: BroccoliLeaseMode): boolean {
    if (this.activeLeases.size >= this.maxConcurrentLeases) return false;

    if (mode === "EXCLUSIVE_WRITE") {
      return this.activeLeases.size === 0;
    }

    // SHARED_READ
    for (const lease of this.activeLeases.values()) {
      if (lease.mode === "EXCLUSIVE_WRITE") return false;
    }

    return true;
  }

  private createAndRegisterLease(
    subsystem: string,
    mode: BroccoliLeaseMode,
    ttlMs: number
  ): BroccoliLeaseHandle {
    const now = Date.now();
    const leaseId = `lease_${subsystem}_${++this.totalLeasesIssued}_${Math.random().toString(36).slice(2, 7)}`;
    const handle: BroccoliLeaseHandle = {
      leaseId,
      subsystem,
      mode,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      isActive: true,
    };

    this.activeLeases.set(leaseId, handle);
    if (this.activeLeases.size > this.peakConcurrency) {
      this.peakConcurrency = this.activeLeases.size;
    }

    return handle;
  }

  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) return;

    const next = this.waitingQueue[0];
    if (this.canIssueLease(next.mode)) {
      this.waitingQueue.shift();
      if (next.timeoutTimer) {
        clearTimeout(next.timeoutTimer);
      }
      const handle = this.createAndRegisterLease(next.subsystem, next.mode, this.defaultLeaseTtlMs);
      next.resolve(handle);
    }
  }
}
