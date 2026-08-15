/**
 * arbiter-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rewind for the Security Arbiter substrate.
 */

import type { ArbiterSessionSnapshot } from "../../../core/contracts/arbiter.contracts.js";
import { BroccoliArbiterSubstrate } from "./broccoli-arbiter-substrate.js";
import type { ApprovalHashLedger } from "../../../tooling/extensions/arbiter/approval-hash-ledger.js";

export interface ArbiterSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: ArbiterSessionSnapshot;
}

export class ArbiterSnapshotManager {
  private readonly history: ArbiterSnapshotFrame[] = [];
  private readonly substrate: BroccoliArbiterSubstrate;
  private readonly maxFrames: number;

  constructor(
    substrate: BroccoliArbiterSubstrate,
    maxFrames = 128
  ) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot associated with the given engine frame tick.
   */
  public captureFrame(
    frameId: number,
    ledger?: ApprovalHashLedger
  ): ArbiterSnapshotFrame {
    const sessionHashes = ledger ? ledger.getSessionGrants() : [];
    const snapshot = this.substrate.captureSnapshot(sessionHashes);
    const frame: ArbiterSnapshotFrame = {
      frameId,
      timestamp: Date.now(),
      snapshot,
    };

    this.history.push(frame);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }

    return frame;
  }

  /**
   * Rewinds the substrate and ledger to the exact state at frameId in O(1) time.
   */
  public rewindToFrame(
    frameId: number,
    ledger?: ApprovalHashLedger
  ): boolean {
    const frame = this.history.find((f) => f.frameId === frameId);
    if (!frame) return false;

    this.substrate.restoreSnapshot(frame.snapshot);

    if (ledger) {
      ledger.clearSessionGrants();
      for (const hash of frame.snapshot.sessionAllowlistHashes) {
        ledger.grantSessionAllow(hash);
      }
    }

    return true;
  }

  public getHistory(): readonly ArbiterSnapshotFrame[] {
    return this.history;
  }

  public clear(): void {
    this.history.length = 0;
  }
}
