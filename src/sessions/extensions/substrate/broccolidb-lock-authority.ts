/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-lock-authority.ts
 *
 * Distributed Microsecond Lock Authority & Deadlock-Free Multi-Resource Locking for BroccoliDB (Pass 198 / ADR-136).
 * Enforces shared/exclusive lock hierarchies, TTL auto-expiration, and deterministic batch ordering.
 */

import type {
  BroccoliLockHandle,
  BroccoliLockMode,
  IBroccoliLockAuthority,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliLockAuthority implements IBroccoliLockAuthority {
  private readonly locks = new Map<string, BroccoliLockHandle>(); // lockId -> handle
  private readonly resourceLocks = new Map<string, Set<string>>(); // resourceKey -> Set<lockId>
  private totalLocksIssued = 0;

  public async acquireLock(
    resourceKey: string,
    ownerId: string,
    mode: BroccoliLockMode = "EXCLUSIVE_WRITE",
    ttlMs = 10000
  ): Promise<BroccoliLockHandle> {
    this.cleanExpiredLocks();

    const existingLockIds = this.resourceLocks.get(resourceKey);
    if (existingLockIds && existingLockIds.size > 0) {
      for (const id of existingLockIds) {
        const lock = this.locks.get(id);
        if (!lock) continue;

        if (lock.ownerId === ownerId && lock.mode === mode) {
          // Reentrant lock extension
          return lock;
        }

        if (lock.mode === "EXCLUSIVE_WRITE" || mode === "EXCLUSIVE_WRITE") {
          throw new Error(`Resource '${resourceKey}' is locked in ${lock.mode} mode by owner '${lock.ownerId}'`);
        }
      }
    }

    const now = Date.now();
    const lockId = `lock_${resourceKey.replace(/[^a-zA-Z0-9]/g, "_")}_${++this.totalLocksIssued}`;
    const handle: BroccoliLockHandle = {
      lockId,
      resourceKey,
      ownerId,
      mode,
      acquiredAt: now,
      expiresAt: now + ttlMs,
    };

    this.locks.set(lockId, handle);
    if (!this.resourceLocks.has(resourceKey)) {
      this.resourceLocks.set(resourceKey, new Set());
    }
    this.resourceLocks.get(resourceKey)!.add(lockId);

    return handle;
  }

  public async acquireAll(
    resourceKeys: readonly string[],
    ownerId: string,
    mode: BroccoliLockMode = "EXCLUSIVE_WRITE",
    ttlMs = 10000
  ): Promise<readonly BroccoliLockHandle[]> {
    // Deterministic sorting to eliminate circular wait / dining philosophers deadlocks
    const sortedKeys = Array.from(new Set(resourceKeys)).sort();
    const acquired: BroccoliLockHandle[] = [];

    try {
      for (const key of sortedKeys) {
        const handle = await this.acquireLock(key, ownerId, mode, ttlMs);
        acquired.push(handle);
      }
      return acquired;
    } catch (err: unknown) {
      // Rollback all locks in the batch on any failure
      for (const handle of acquired) {
        this.releaseLock(handle.lockId);
      }
      throw err;
    }
  }

  public releaseLock(lockId: string): boolean {
    const handle = this.locks.get(lockId);
    if (!handle) return false;

    this.locks.delete(lockId);
    const keyLocks = this.resourceLocks.get(handle.resourceKey);
    if (keyLocks) {
      keyLocks.delete(lockId);
      if (keyLocks.size === 0) {
        this.resourceLocks.delete(handle.resourceKey);
      }
    }

    return true;
  }

  public releaseAllForOwner(ownerId: string): number {
    let releasedCount = 0;
    for (const [id, handle] of this.locks.entries()) {
      if (handle.ownerId === ownerId) {
        this.releaseLock(id);
        releasedCount++;
      }
    }
    return releasedCount;
  }

  public isLocked(resourceKey: string): boolean {
    this.cleanExpiredLocks();
    const keyLocks = this.resourceLocks.get(resourceKey);
    return Boolean(keyLocks && keyLocks.size > 0);
  }

  public getActiveLocks(): readonly BroccoliLockHandle[] {
    this.cleanExpiredLocks();
    return Array.from(this.locks.values());
  }

  private cleanExpiredLocks(): void {
    const now = Date.now();
    for (const [id, handle] of this.locks.entries()) {
      if (handle.expiresAt <= now) {
        this.releaseLock(id);
      }
    }
  }
}
