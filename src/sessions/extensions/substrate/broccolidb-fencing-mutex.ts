/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 134: Zero-Dependency Broccoli Fencing Mutex Engine
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/MutexService.ts).
 * Manages fault-tolerant distributed locking using Sovereign Fencing Tokens, automatic lock annexation
 * for stale processes, and heartbeat timers. Zero external npm dependencies.
 */

export interface FencingLockRecord {
  resourceId: string;
  ownerId: string;
  fencingToken: number;
  acquiredAt: number;
  ttlMs: number;
}

export class BroccoliFencingMutexEngine {
  private readonly locks = new Map<string, FencingLockRecord>();
  private readonly heartbeats = new Map<string, NodeJS.Timeout>();
  private globalFencingCounter = Date.now();

  /**
   * Acquires a lock on a shared resource with a Sovereign Fencing Token.
   */
  public acquireLock(resourceId: string, ownerId: string, ttlMs: number = 30_000): FencingLockRecord | null {
    const existing = this.locks.get(resourceId);
    const now = Date.now();

    if (existing) {
      if (now - existing.acquiredAt < existing.ttlMs && existing.ownerId !== ownerId) {
        return null; // Lock held and valid
      }
      // Stale or owned lock -> annex lock
      this.releaseLock(resourceId, existing.ownerId);
    }

    this.globalFencingCounter += 1;
    const record: FencingLockRecord = {
      resourceId,
      ownerId,
      fencingToken: this.globalFencingCounter,
      acquiredAt: now,
      ttlMs,
    };

    this.locks.get(resourceId);
    this.locks.set(resourceId, record);

    const timer = setInterval(() => {
      const lock = this.locks.get(resourceId);
      if (lock && lock.ownerId === ownerId) {
        lock.acquiredAt = Date.now();
      } else {
        clearInterval(timer);
        this.heartbeats.delete(resourceId);
      }
    }, Math.max(1000, Math.floor(ttlMs / 3)));

    this.heartbeats.set(resourceId, timer);

    return record;
  }

  /**
   * Releases a resource lock.
   */
  public releaseLock(resourceId: string, ownerId: string): boolean {
    const existing = this.locks.get(resourceId);
    if (!existing || existing.ownerId !== ownerId) {
      return false;
    }

    const timer = this.heartbeats.get(resourceId);
    if (timer) {
      clearInterval(timer);
      this.heartbeats.delete(resourceId);
    }

    this.locks.delete(resourceId);
    return true;
  }

  /**
   * Validates if a fencing token is current for a resource.
   */
  public isTokenValid(resourceId: string, fencingToken: number): boolean {
    const existing = this.locks.get(resourceId);
    return existing !== undefined && existing.fencingToken === fencingToken;
  }

  /**
   * Shuts down all active heartbeat timers.
   */
  public shutdown(): void {
    for (const timer of this.heartbeats.values()) {
      clearInterval(timer);
    }
    this.heartbeats.clear();
    this.locks.clear();
  }
}
