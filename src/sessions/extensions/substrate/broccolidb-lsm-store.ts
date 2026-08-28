/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-lsm-store.ts
 *
 * Log-Structured Merge-Tree (LSM) Storage Substrate for BroccoliDB (Pass 201 / ADR-139).
 * Implements a Map-backed MemTable, immutable sorted table arrays with Bloom filters,
 * and in-memory compaction with safe tombstone retention.
 */

import type {
  BroccoliLsmCompactionStats,
  BroccoliSsTableMeta,
  IBroccoliLsmStore,
} from "../../../core/contracts/broccolidb.contracts.js";
import { randomUUID } from "node:crypto";

interface SsTableData {
  meta: BroccoliSsTableMeta;
  entries: { key: string; value: unknown; isTombstone: boolean }[];
  sequence: number;
}

export class BroccoliLsmStore implements IBroccoliLsmStore {
  private readonly maxMemTableSize: number;
  private memTable = new Map<string, { value: unknown; isTombstone: boolean; timestamp: number }>();
  private readonly ssTables: SsTableData[] = []; // Newest to oldest
  private nextSequence = 1;

  constructor(maxMemTableSize = 100) {
    if (!Number.isSafeInteger(maxMemTableSize) || maxMemTableSize <= 0) {
      throw new RangeError("maxMemTableSize must be a positive integer");
    }
    this.maxMemTableSize = maxMemTableSize;
  }

  public put(key: string, value: unknown): void {
    if (!key.length) throw new TypeError("key must be non-empty");
    this.memTable.set(key, {
      value,
      isTombstone: false,
      timestamp: Date.now(),
    });

    if (this.memTable.size >= this.maxMemTableSize) {
      void this.flushMemTable();
    }
  }

  public get(key: string): unknown | undefined {
    if (!key.length) throw new TypeError("key must be non-empty");
    // 1. Check active MemTable
    const inMem = this.memTable.get(key);
    if (inMem !== undefined) {
      return inMem.isTombstone ? undefined : inMem.value;
    }

    // 2. Check SSTables (Newest to Oldest)
    const hash = this.hash64(key);
    const bit = 1n << (hash % 64n);

    for (const table of this.ssTables) {
      // Bloom filter negative check
      if ((table.meta.bloomFilterMask & bit) === 0n) {
        continue;
      }

      // Min/Max boundary check
      if (key < table.meta.minKey || key > table.meta.maxKey) {
        continue;
      }

      // Binary search inside SSTable entries
      const entry = this.binarySearch(table.entries, key);
      if (entry !== undefined) {
        return entry.isTombstone ? undefined : entry.value;
      }
    }

    return undefined;
  }

  public delete(key: string): boolean {
    const existing = this.get(key);
    if (existing === undefined) return false;

    this.memTable.set(key, {
      value: undefined,
      isTombstone: true,
      timestamp: Date.now(),
    });

    if (this.memTable.size >= this.maxMemTableSize) {
      void this.flushMemTable();
    }

    return true;
  }

  public scan(
    startKey?: string,
    endKey?: string,
    limit = 100
  ): ReadonlyArray<{ readonly key: string; readonly value: unknown }> {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("limit must be a non-negative integer");
    if (limit === 0) return [];
    if (startKey !== undefined && endKey !== undefined && startKey > endKey) {
      throw new RangeError("startKey cannot be greater than endKey");
    }
    const merged = new Map<string, { value: unknown; isTombstone: boolean }>();

    // Add SSTables from oldest to newest
    for (let i = this.ssTables.length - 1; i >= 0; i--) {
      for (const entry of this.ssTables[i].entries) {
        merged.set(entry.key, { value: entry.value, isTombstone: entry.isTombstone });
      }
    }

    // Overlay active MemTable
    for (const [k, v] of this.memTable.entries()) {
      merged.set(k, { value: v.value, isTombstone: v.isTombstone });
    }

    // Sort and filter keys
    const sortedKeys = Array.from(merged.keys()).sort();
    const results: { key: string; value: unknown }[] = [];

    for (const k of sortedKeys) {
      if (startKey && k < startKey) continue;
      if (endKey && k > endKey) continue;

      const item = merged.get(k)!;
      if (!item.isTombstone) {
        results.push({ key: k, value: item.value });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  public async flushMemTable(): Promise<BroccoliSsTableMeta | null> {
    if (this.memTable.size === 0) return null;

    const sortedEntries = Array.from(this.memTable.entries())
      .map(([k, v]) => ({ key: k, value: v.value, isTombstone: v.isTombstone }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const minKey = sortedEntries[0].key;
    const maxKey = sortedEntries[sortedEntries.length - 1].key;
    let bloomFilterMask = 0n;

    for (const e of sortedEntries) {
      const hash = this.hash64(e.key);
      bloomFilterMask |= (1n << (hash % 64n));
    }

    const tableId = `sstable_${randomUUID()}`;
    const meta: BroccoliSsTableMeta = {
      tableId,
      level: 0,
      recordCount: sortedEntries.length,
      minKey,
      maxKey,
      bloomFilterMask,
      createdAt: Date.now(),
      sizeBytes: JSON.stringify(sortedEntries).length,
    };

    this.ssTables.unshift({ meta, entries: sortedEntries, sequence: this.nextSequence++ });
    this.memTable.clear();

    return meta;
  }

  public async compact(level = 0): Promise<BroccoliLsmCompactionStats> {
    if (!Number.isSafeInteger(level) || level < 0) throw new RangeError("level must be a non-negative integer");
    const startTime = Date.now();
    const candidateTables = this.ssTables
      .filter((t) => t.meta.level === level)
      .sort((a, b) => b.sequence - a.sequence);

    if (candidateTables.length < 2) {
      return {
        compactedTablesCount: 0,
        inputRecordsCount: 0,
        outputRecordsCount: 0,
        purgedTombstonesCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const merged = new Map<string, { value: unknown; isTombstone: boolean }>();
    let inputRecordsCount = 0;

    for (const table of candidateTables) {
      for (const entry of table.entries) {
        inputRecordsCount++;
        // Earlier in candidateTables is newer
        if (!merged.has(entry.key)) {
          merged.set(entry.key, { value: entry.value, isTombstone: entry.isTombstone });
        }
      }
    }

    const candidateIds = new Set(candidateTables.map((t) => t.meta.tableId));
    const remaining = this.ssTables.filter((t) => !candidateIds.has(t.meta.tableId));

    // A tombstone can only be removed when no uncompacted table still contains
    // an older value for that key. Otherwise a point read would resurrect it.
    let purgedTombstonesCount = 0;
    const compactedEntries: { key: string; value: unknown; isTombstone: boolean }[] = [];

    for (const [k, v] of merged.entries()) {
      if (v.isTombstone && !this.tablesContainKey(remaining, k)) {
        purgedTombstonesCount++;
      } else {
        compactedEntries.push({ key: k, value: v.value, isTombstone: false });
        if (v.isTombstone) compactedEntries[compactedEntries.length - 1].isTombstone = true;
      }
    }

    compactedEntries.sort((a, b) => a.key.localeCompare(b.key));

    if (compactedEntries.length > 0) {
      let bloomFilterMask = 0n;
      for (const e of compactedEntries) {
        const hash = this.hash64(e.key);
        bloomFilterMask |= (1n << (hash % 64n));
      }

      const tableId = `sstable_l${level + 1}_${randomUUID()}`;
      const meta: BroccoliSsTableMeta = {
        tableId,
        level: level + 1,
        recordCount: compactedEntries.length,
        minKey: compactedEntries[0].key,
        maxKey: compactedEntries[compactedEntries.length - 1].key,
        bloomFilterMask,
        createdAt: Date.now(),
        sizeBytes: JSON.stringify(compactedEntries).length,
      };

      remaining.push({
        meta,
        entries: compactedEntries,
        sequence: Math.max(...candidateTables.map((table) => table.sequence)),
      });
    }

    this.ssTables.length = 0;
    this.ssTables.push(...remaining.sort((a, b) => b.sequence - a.sequence));

    return {
      compactedTablesCount: candidateTables.length,
      inputRecordsCount,
      outputRecordsCount: compactedEntries.length,
      purgedTombstonesCount,
      durationMs: Date.now() - startTime,
    };
  }

  public getMemTableSize(): number {
    return this.memTable.size;
  }

  public getSsTableMetas(): readonly BroccoliSsTableMeta[] {
    return this.ssTables.map((t) => t.meta);
  }

  private binarySearch(
    entries: { key: string; value: unknown; isTombstone: boolean }[],
    key: string
  ): { key: string; value: unknown; isTombstone: boolean } | undefined {
    let low = 0;
    let high = entries.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cmp = entries[mid].key.localeCompare(key);
      if (cmp === 0) return entries[mid];
      if (cmp < 0) low = mid + 1;
      else high = mid - 1;
    }

    return undefined;
  }

  private tablesContainKey(tables: readonly SsTableData[], key: string): boolean {
    return tables.some(
      (table) =>
        key >= table.meta.minKey &&
        key <= table.meta.maxKey &&
        this.binarySearch(table.entries, key) !== undefined
    );
  }

  private hash64(str: string): bigint {
    let h = 1125899906842597n;
    for (let i = 0; i < str.length; i++) {
      h = (h ^ BigInt(str.charCodeAt(i))) * 1099511628211n;
    }
    return h < 0n ? -h : h;
  }
}
