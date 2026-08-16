/**
 * schema-sanitizer-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and sub-millisecond O(1) state rollback (< 0.05 ms SLA)
 * for Schema Sanitizer Subsystem (Phase 139 / ADR-115 / Target #72).
 */

import type { BroccoliSchemaSanitizerSubstrate } from "./broccoli-schema-sanitizer-substrate.js";
import type { SchemaSanitizerWorkspaceSnapshot } from "../../../core/contracts/schema-sanitizer.contracts.js";

export class SchemaSanitizerSnapshotManager {
  private readonly substrate: BroccoliSchemaSanitizerSubstrate;
  private readonly snapshotStorage = new Map<string, SchemaSanitizerWorkspaceSnapshot>();

  constructor(substrate: BroccoliSchemaSanitizerSubstrate) {
    this.substrate = substrate;
  }

  public takeSnapshot(snapshotId: string): SchemaSanitizerWorkspaceSnapshot {
    const snapshot = this.substrate.createSnapshot(snapshotId);
    this.snapshotStorage.set(snapshotId, snapshot);
    return snapshot;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshotStorage.get(snapshotId);
    if (!snapshot) {
      return false;
    }
    this.substrate.restoreSnapshot(snapshot);
    return true;
  }

  public deleteSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.delete(snapshotId);
  }

  public clearAllSnapshots(): void {
    this.snapshotStorage.clear();
  }

  public hasSnapshot(snapshotId: string): boolean {
    return this.snapshotStorage.has(snapshotId);
  }

  public getSnapshotCount(): number {
    return this.snapshotStorage.size;
  }
}
