import type {
  SoulSnapshot,
  SoulManifest,
  SoulBookmark,
} from "../../../core/contracts/soul.contracts.js";
import { BroccoliSoulSubstrate } from "./broccoli-soul-substrate.js";
import { DeterministicSoulParser } from "../../../tooling/extensions/soul/deterministic-soul-parser.js";

/**
 * SoulSnapshotManager.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Coordinates frame-level binary state snapshots and named semantic bookmarks of the active soul substrate,
 * enabling deterministic O(1) rollbacks and checkpoint restoring without filesystem thrashing.
 */
export class SoulSnapshotManager {
  private readonly substrate: BroccoliSoulSubstrate;
  private readonly parser: DeterministicSoulParser;
  private readonly snapshotHistory: SoulSnapshot[] = [];
  private readonly bookmarks = new Map<string, SoulBookmark>();
  private readonly maxSnapshots = 50;

  constructor(
    substrate: BroccoliSoulSubstrate,
    parser = new DeterministicSoulParser()
  ) {
    this.substrate = substrate;
    this.parser = parser;
  }

  /**
   * Captures an immutable snapshot of the active soul manifest at the current frame tick.
   */
  createSnapshot(frameIndex?: number): SoulSnapshot {
    const manifest = this.substrate.getActiveManifest();
    const frame = frameIndex ?? this.substrate.getCurrentTick();
    const checksum = this.parser.computeSoulHash(manifest);

    const snapshot: SoulSnapshot = Object.freeze({
      frameIndex: frame,
      timestamp: Date.now(),
      manifest,
      checksum,
    });

    this.snapshotHistory.push(snapshot);
    if (this.snapshotHistory.length > this.maxSnapshots) {
      this.snapshotHistory.shift();
    }

    return snapshot;
  }

  /**
   * Creates a named semantic bookmark of the current state.
   */
  createBookmark(label: string, description = "", tags: readonly string[] = []): SoulBookmark {
    const manifest = this.substrate.getActiveManifest();
    const bookmark: SoulBookmark = Object.freeze({
      id: `bm-${Date.now()}-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      label,
      description,
      tags: Object.freeze([...tags]),
      createdAt: Date.now(),
      manifest,
      frameTick: this.substrate.getCurrentTick(),
    });

    this.bookmarks.set(bookmark.id, bookmark);
    this.bookmarks.set(label.toLowerCase(), bookmark);
    return bookmark;
  }

  /**
   * Lists all stored named bookmarks, optionally filtered by tag.
   */
  listBookmarks(tag?: string): readonly SoulBookmark[] {
    const unique = new Map<string, SoulBookmark>();
    for (const bm of this.bookmarks.values()) {
      unique.set(bm.id, bm);
    }
    const all = Array.from(unique.values());
    if (!tag) return Object.freeze(all);
    return Object.freeze(all.filter((b) => b.tags.includes(tag) || b.tags.some((t) => t.toLowerCase() === tag.toLowerCase())));
  }

  /**
   * Restores active soul state from a named bookmark.
   */
  restoreBookmark(bookmarkIdOrLabel: string): boolean {
    const key = bookmarkIdOrLabel.toLowerCase();
    const bookmark = this.bookmarks.get(bookmarkIdOrLabel) || this.bookmarks.get(key);
    if (!bookmark) return false;

    this.substrate.setActiveManifest(bookmark.manifest);
    return true;
  }

  /**
   * Deletes a named bookmark.
   */
  deleteBookmark(bookmarkIdOrLabel: string): boolean {
    const key = bookmarkIdOrLabel.toLowerCase();
    const bookmark = this.bookmarks.get(bookmarkIdOrLabel) || this.bookmarks.get(key);
    if (!bookmark) return false;

    this.bookmarks.delete(bookmark.id);
    this.bookmarks.delete(bookmark.label.toLowerCase());
    return true;
  }

  /**
   * Restores the active soul substrate state to a previously captured snapshot or frame index.
   */
  restoreSnapshot(snapshotOrFrame: SoulSnapshot | number): boolean {
    let targetSnapshot: SoulSnapshot | undefined;
    if (typeof snapshotOrFrame === "number") {
      targetSnapshot = this.snapshotHistory.find((s) => s.frameIndex === snapshotOrFrame);
    } else {
      targetSnapshot = snapshotOrFrame;
    }

    if (!targetSnapshot) return false;

    const computedChecksum = this.parser.computeSoulHash(targetSnapshot.manifest);
    if (computedChecksum !== targetSnapshot.checksum) {
      return false; // Snapshot corrupted
    }

    this.substrate.setActiveManifest(targetSnapshot.manifest);
    return true;
  }

  /**
   * Rolls back the last mutation in O(1) time by popping the previous snapshot.
   */
  rollbackLastMutation(): { success: boolean; rolledBackTo?: SoulManifest; error?: string } {
    if (this.snapshotHistory.length < 2) {
      return { success: false, error: "No previous snapshot available for rollback" };
    }

    // Pop the current state snapshot
    this.snapshotHistory.pop();
    // Retrieve the previous snapshot
    const targetSnapshot = this.snapshotHistory[this.snapshotHistory.length - 1];
    if (!targetSnapshot) {
      return { success: false, error: "Failed to access previous snapshot" };
    }

    const restored = this.restoreSnapshot(targetSnapshot);
    if (!restored) {
      return { success: false, error: "Snapshot integrity checksum verification failed" };
    }

    return {
      success: true,
      rolledBackTo: targetSnapshot.manifest,
    };
  }

  getSnapshotCount(): number {
    return this.snapshotHistory.length;
  }

  clear(): void {
    this.snapshotHistory.length = 0;
    this.bookmarks.clear();
  }
}

