/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-mvcc-engine.ts
 *
 * Multi-Version Concurrency Control (MVCC) Engine with Snapshot Isolation for BroccoliDB (Pass 199 / ADR-137).
 * Allows readers and writers to operate concurrently without blocking, maintaining immutable version chains and vacuuming dead tuples.
 */

import type {
  BroccoliMvccTransaction,
  BroccoliRecordVersion,
  IBroccoliMvccEngine,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliMvccEngine implements IBroccoliMvccEngine {
  private currentTxSeq = 0;
  private readonly transactions = new Map<number, BroccoliMvccTransaction>();
  // table -> recordId -> version chain (newest to oldest)
  private readonly versionChains = new Map<string, Map<string, BroccoliRecordVersion<Record<string, unknown>>[]>>();

  public beginTransaction(
    isolationLevel: "SNAPSHOT_ISOLATION" | "READ_COMMITTED" = "SNAPSHOT_ISOLATION"
  ): BroccoliMvccTransaction {
    const txId = ++this.currentTxSeq;
    const tx: BroccoliMvccTransaction = {
      txId,
      startedAt: Date.now(),
      isolationLevel,
      status: "ACTIVE",
      writtenRecords: [],
    };
    this.transactions.set(txId, tx);
    return tx;
  }

  public commitTransaction(txId: number): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== "ACTIVE") return false;

    (tx as any).status = "COMMITTED";
    return true;
  }

  public rollbackTransaction(txId: number): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== "ACTIVE") return false;

    (tx as any).status = "ROLLED_BACK";

    // Remove uncommitted versions created by this tx
    for (const item of tx.writtenRecords) {
      const tableMap = this.versionChains.get(item.table);
      if (!tableMap) continue;
      const chain = tableMap.get(item.recordId);
      if (!chain) continue;

      const filtered = chain.filter((v) => v.txId !== txId);
      if (filtered.length === 0) {
        tableMap.delete(item.recordId);
      } else {
        tableMap.set(item.recordId, filtered);
      }
    }

    return true;
  }

  public readRecord<T extends Record<string, unknown>>(
    table: string,
    recordId: string,
    txId: number
  ): T | undefined {
    const tableMap = this.versionChains.get(table);
    if (!tableMap) return undefined;

    const chain = tableMap.get(recordId);
    if (!chain || chain.length === 0) return undefined;

    for (const version of chain) {
      // 1. If created by current transaction
      if (version.txId === txId) {
        if (version.isDeleted) return undefined;
        return version.data as T;
      }

      // 2. If created by another transaction, must be committed and created at or before txId
      if (this.isTxCommitted(version.txId) && version.txId <= txId) {
        const isDeletedForCurrentTx =
          version.deletedTxId === txId ||
          (version.deletedTxId !== undefined &&
            this.isTxCommitted(version.deletedTxId) &&
            version.deletedTxId <= txId);

        if (isDeletedForCurrentTx) {
          return undefined;
        }

        if (version.isDeleted) return undefined;
        return version.data as T;
      }
    }

    return undefined;
  }

  private isTxCommitted(txId: number): boolean {
    const tx = this.transactions.get(txId);
    return tx ? tx.status === "COMMITTED" : true;
  }

  public writeRecord<T extends Record<string, unknown>>(
    table: string,
    recordId: string,
    data: T,
    txId: number
  ): void {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== "ACTIVE") {
      throw new Error(`Cannot write to inactive transaction ${txId}`);
    }

    if (!this.versionChains.has(table)) {
      this.versionChains.set(table, new Map());
    }

    const tableMap = this.versionChains.get(table)!;
    if (!tableMap.has(recordId)) {
      tableMap.set(recordId, []);
    }

    const chain = tableMap.get(recordId)!;

    // Mark previous visible version as deleted by this txId
    if (chain.length > 0 && !chain[0].deletedTxId) {
      (chain[0] as any).deletedTxId = txId;
    }

    const newVersion: BroccoliRecordVersion<Record<string, unknown>> = {
      recordId,
      txId,
      createdAt: Date.now(),
      isDeleted: false,
      data: { ...data },
    };

    // Prepend to chain (newest first)
    chain.unshift(newVersion);
    (tx.writtenRecords as any[]).push({ table, recordId });
  }

  public deleteRecord(table: string, recordId: string, txId: number): void {
    const tx = this.transactions.get(txId);
    if (!tx || tx.status !== "ACTIVE") {
      throw new Error(`Cannot delete in inactive transaction ${txId}`);
    }

    const tableMap = this.versionChains.get(table);
    if (!tableMap) return;

    const chain = tableMap.get(recordId);
    if (!chain || chain.length === 0) return;

    if (!chain[0].deletedTxId) {
      (chain[0] as any).deletedTxId = txId;
    }

    const deleteVersion: BroccoliRecordVersion<Record<string, unknown>> = {
      recordId,
      txId,
      createdAt: Date.now(),
      isDeleted: true,
    };

    chain.unshift(deleteVersion);
    (tx.writtenRecords as any[]).push({ table, recordId });
  }

  public vacuum(minActiveTxId?: number): number {
    const threshold = minActiveTxId ?? this.getOldestActiveTxId() ?? (this.currentTxSeq + 1);
    let purgedCount = 0;

    for (const tableMap of this.versionChains.values()) {
      for (const [recordId, chain] of Array.from(tableMap.entries())) {
        const retained: BroccoliRecordVersion<Record<string, unknown>>[] = [];

        for (const v of chain) {
          // If this version was deleted by a transaction older than or at threshold, it is invisible to all active snapshots
          if (v.deletedTxId !== undefined && v.deletedTxId <= threshold) {
            purgedCount++;
            continue;
          }

          // If this is a deleted tombstone older than or at threshold
          if (v.isDeleted && v.txId <= threshold) {
            purgedCount++;
            continue;
          }

          retained.push(v);
        }

        if (retained.length === 0 || retained.every((v) => v.isDeleted)) {
          tableMap.delete(recordId);
        } else {
          tableMap.set(recordId, retained);
        }
      }
    }

    return purgedCount;
  }

  public getActiveTransactions(): readonly BroccoliMvccTransaction[] {
    return Array.from(this.transactions.values()).filter((t) => t.status === "ACTIVE");
  }

  private getOldestActiveTxId(): number | undefined {
    let minId: number | undefined;
    for (const tx of this.transactions.values()) {
      if (tx.status === "ACTIVE") {
        if (minId === undefined || tx.txId < minId) {
          minId = tx.txId;
        }
      }
    }
    return minId;
  }
}
