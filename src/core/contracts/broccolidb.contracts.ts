/**
 * broccolidb.contracts.ts
 *
 * Core data contracts for the Deterministic Hybrid In-Memory + Handrolled BroccoliDB Kernel
 * (Phase 71 / ADR-120).
 *
 * Establishes the typed interfaces for L1 Reactive Tables, L2 Append-Only Write-Ahead Log (WAL),
 * L3 Sharded Content-Addressable Storage (CAS), L4 Double-Buffered Checkpointing,
 * and the Unified 4-Pillar Forensic Diagnostic Probe.
 */

export type DbDurabilityMode = "SYNCHRONOUS" | "MICRO_BATCHED" | "SPECULATIVE";

export type WalOperationType = "INSERT" | "UPDATE" | "DELETE" | "CHECKPOINT" | "ROLLBACK";

export interface WalFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly op: WalOperationType;
  readonly table: string;
  readonly recordId: string;
  readonly payload?: Record<string, unknown>;
  readonly checksum: string; // SHA-256 integrity hash
  readonly previousFrameHash?: string; // Cryptographic chaining
}

export interface DbQueryOptions {
  readonly where?: Record<string, unknown>;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: string;
  readonly sortOrder?: "asc" | "desc";
}

export interface IDbTable<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly name: string;
  get(id: string): T | undefined;
  getAll(): readonly T[];
  put(id: string, record: T): T;
  delete(id: string): boolean;
  query(options?: DbQueryOptions): readonly T[];
  createIndex(field: keyof T & string): void;
  count(): number;
  clear(): void;
  createSnapshot(): Map<string, T>;
  restoreSnapshot(snapshot: Map<string, T>): void;
}

export interface CasBlobDescriptor {
  readonly hash: string;
  readonly sizeBytes: number;
  readonly compressedSizeBytes: number;
  readonly isCompressed: boolean;
  readonly createdAt: number;
  readonly shard: string;
}

export interface CasStorageStats {
  readonly totalBlobs: number;
  readonly totalRawBytes: number;
  readonly totalStoredBytes: number;
  readonly compressionSavingsPct: number;
  readonly corruptCount: number;
  readonly quarantinedBlobs: readonly string[];
}

export interface TimelineCheckpointRecord {
  readonly checkpointId: string;
  readonly timestamp: number;
  readonly frameIndex: number;
  readonly label: string;
  readonly tableCount: number;
  readonly totalRecords: number;
  readonly snapshotHash: string;
}

export interface DbHealthReport {
  readonly status: "HEALTHY" | "DEGRADED" | "CORRUPTED";
  readonly timestamp: number;
  readonly pillars: {
    readonly diskInvariants: {
      readonly valid: boolean;
      readonly baseDir: string;
      readonly diskUsageBytes: number;
      readonly writeable: boolean;
    };
    readonly casIntegrity: {
      readonly totalBlobs: number;
      readonly corruptCount: number;
      readonly compressionSavingsPct: number;
      readonly healthy: boolean;
    };
    readonly walJournal: {
      readonly totalFrames: number;
      readonly uncommittedFrames: number;
      readonly lastSyncTimestamp: number;
      readonly healthy: boolean;
    };
    readonly tableConsistency: {
      readonly tableCount: number;
      readonly totalRecords: number;
      readonly indexParity: boolean;
      readonly healthy: boolean;
    };
  };
  readonly actionableRecommendations: readonly string[];
}

export interface IBroccoliDatabaseKernel {
  readonly workspaceRoot: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  flush(): Promise<void>;
  getTable<T extends Record<string, unknown> = Record<string, unknown>>(name: string): IDbTable<T>;
  transaction<R>(fn: () => Promise<R>): Promise<R>;
  checkpoint(label?: string): Promise<TimelineCheckpointRecord>;
  rollback(checkpointId: string): Promise<boolean>;
  listCheckpoints(): readonly TimelineCheckpointRecord[];
  health(): Promise<DbHealthReport>;
  storeBlob(content: Buffer | string): Promise<string>;
  readBlob(hash: string): Promise<Buffer | null>;
  gc(): Promise<number>;
}
