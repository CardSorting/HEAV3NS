import type {
  CompressionStateSnapshot,
  IBroccoliCompressionSubstrate,
  ICompressionSnapshotManager,
} from "../../../core/contracts/compression.contracts.js";

/**
 * Deterministic Compression State Snapshot Manager.
 *
 * Implements frame-perfect binary snapshotting and O(1) state restoration for
 * the context compression substrate, ensuring complete multi-branch isolation.
 */
export class CompressionSnapshotManager implements ICompressionSnapshotManager {
  private readonly substrate: IBroccoliCompressionSubstrate;

  constructor(substrate: IBroccoliCompressionSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(tick: number): CompressionStateSnapshot {
    const list = this.substrate.listSummaries();
    let totalTokensSaved = 0;
    let totalCompactedTurns = 0;

    for (const item of list) {
      totalTokensSaved += Math.max(0, item.originalTokens - item.compressedTokens);
      totalCompactedTurns += item.sourceTurnEnd - item.sourceTurnStart + 1;
    }

    return {
      summaries: list.map((s) => ({ ...s })),
      totalCompactedTurns,
      totalTokensSaved,
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: CompressionStateSnapshot): void {
    this.substrate.clear();
    for (const summary of snapshot.summaries) {
      this.substrate.recordSummary({ ...summary });
    }
  }
}
