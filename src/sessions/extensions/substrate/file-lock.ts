

/**
 * FileLockManager & LruCache.
 * Absorbed from packages/utils (Pass 20 / ADR-012).
 *
 * Provides atomic file lock lease locks and an LRU cache for frame snapshot caching.
 */
export class FileLockManager {
  private readonly lockedPaths: Set<string> = new Set();

  async acquireLock(filePath: string): Promise<boolean> {
    if (this.lockedPaths.has(filePath)) {
      return false;
    }
    this.lockedPaths.add(filePath);
    return true;
  }

  async releaseLock(filePath: string): Promise<void> {
    this.lockedPaths.delete(filePath);
  }
}

export class LruCache<K, V> {
  private readonly cache: Map<K, V> = new Map();
  private readonly capacity: number;

  constructor(capacity = 100) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    // Re-insert to refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest (first) entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  size(): number {
    return this.cache.size;
  }
}
