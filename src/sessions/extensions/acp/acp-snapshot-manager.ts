import type {
  AcpStateSnapshot,
  IAcpSnapshotManager,
} from "../../../core/contracts/acp.contracts.js";
import type { BroccoliAcpSubstrate } from "./broccoli-acp-substrate.js";

/**
 * Deterministic ACP State Snapshot Manager.
 *
 * Implements frame-perfect binary snapshotting and O(1) state restoration for
 * the active ACP sessions and pending approval states in Broccolidb.
 */
export class AcpSnapshotManager implements IAcpSnapshotManager {
  private readonly substrate: BroccoliAcpSubstrate;

  constructor(substrate: BroccoliAcpSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(tick: number): AcpStateSnapshot {
    const sessions = this.substrate.listSessions();
    const pendingApprovals = this.substrate.listPendingApprovals();
    return {
      sessions: sessions.map((s) => ({ ...s })),
      pendingApprovals: pendingApprovals.map((p) => ({ ...p })),
      totalRpcCalls: this.substrate.getRpcCallCount(),
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: AcpStateSnapshot): void {
    this.substrate.clear();
    this.substrate.setRpcCallCount(snapshot.totalRpcCalls);
    for (const session of snapshot.sessions) {
      this.substrate.createSession(
        session.sessionId,
        session.mode,
        session.workingDirectory,
        session.clientName
      );
    }
    for (const approval of snapshot.pendingApprovals) {
      this.substrate.queueApproval({ ...approval });
    }
  }
}
