/**
 * otlp-snapshot-manager.ts
 *
 * Frame-perfect snapshot manager for the OpenTelemetry (OTLP) Subsystem (Phase 98 / ADR-128).
 * Ensures O(1) rollback guarantees (<0.05ms p95) under the AKD-DSO Monolith architecture.
 */

import type { OtlpSubstrateSnapshot } from "../../../core/contracts/otlp.contracts.js";
import { BroccoliOtlpSubstrate } from "./broccoli-otlp-substrate.js";

export class OtlpSnapshotManager {
  private readonly substrate: BroccoliOtlpSubstrate;
  private readonly frames = new Map<number, OtlpSubstrateSnapshot>();

  constructor(substrate: BroccoliOtlpSubstrate) {
    this.substrate = substrate;
  }

  public captureFrame(frameId: number): void {
    this.frames.set(frameId, this.substrate.exportSnapshot());
  }

  public createSnapshot(frameId?: number): OtlpSubstrateSnapshot {
    const snap = this.substrate.exportSnapshot();
    if (typeof frameId === "number") {
      this.frames.set(frameId, snap);
    }
    return snap;
  }

  public rewindToFrame(frameId: number): boolean {
    const snapshot = this.frames.get(frameId);
    if (!snapshot) return false;
    this.substrate.importSnapshot(snapshot);
    return true;
  }

  public restoreSnapshot(snapshotOrFrameId: OtlpSubstrateSnapshot | number): boolean {
    if (typeof snapshotOrFrameId === "number") {
      return this.rewindToFrame(snapshotOrFrameId);
    }
    if (snapshotOrFrameId && typeof snapshotOrFrameId === "object") {
      this.substrate.importSnapshot(snapshotOrFrameId);
      return true;
    }
    return false;
  }

  public pruneFramesBefore(frameId: number): void {
    for (const id of this.frames.keys()) {
      if (id < frameId) {
        this.frames.delete(id);
      }
    }
  }

  public hasFrame(frameId: number): boolean {
    return this.frames.has(frameId);
  }

  public clear(): void {
    this.frames.clear();
  }
}
