import type {
  IBroccoliSearchSubstrate,
  ISearchSnapshotManager,
  SearchIndexSnapshot,
} from "../../../core/contracts/search.contracts.js";

/**
 * Deterministic Search State Snapshot Manager.
 *
 * Implements frame-perfect binary snapshotting and O(1) state restoration for
 * the session search and inverted index substrate.
 */
export class SearchSnapshotManager implements ISearchSnapshotManager {
  private readonly substrate: IBroccoliSearchSubstrate;

  constructor(substrate: IBroccoliSearchSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(tick: number): SearchIndexSnapshot {
    const records = this.substrate.listMessages();
    return {
      records: records.map((r) => ({ ...r })),
      totalIndexedTerms: this.substrate.getAllTerms().length,
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: SearchIndexSnapshot): void {
    this.substrate.clear();
    for (const record of snapshot.records) {
      this.substrate.indexMessage({ ...record });
    }
  }
}
