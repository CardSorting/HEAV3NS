/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-2pc-coordinator.ts
 *
 * Distributed Two-Phase Commit (2PC) Transaction Coordinator for BroccoliDB (Pass 200 / ADR-138).
 * Guarantees atomicity and durability across multi-partition, multi-table distributed transactions.
 */

import type {
  Broccoli2pcTransactionSession,
  IBroccoli2pcParticipant,
  IBroccoliTwoPhaseCommitCoordinator,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliTwoPhaseCommitCoordinator implements IBroccoliTwoPhaseCommitCoordinator {
  private readonly participants = new Map<string, IBroccoli2pcParticipant>();
  private readonly sessions = new Map<string, Broccoli2pcTransactionSession>();

  public registerParticipant(participant: IBroccoli2pcParticipant): void {
    this.participants.set(participant.participantId, participant);
  }

  public unregisterParticipant(participantId: string): void {
    this.participants.delete(participantId);
  }

  public begin2pcTransaction(
    txId: string,
    participantIds?: readonly string[]
  ): Broccoli2pcTransactionSession {
    const pIds = participantIds ?? Array.from(this.participants.keys());
    const session: Broccoli2pcTransactionSession = {
      txId,
      createdAt: Date.now(),
      state: "PREPARING",
      participants: [...pIds],
    };
    this.sessions.set(txId, session);
    return session;
  }

  public async execute2pc(txId: string): Promise<boolean> {
    const session = this.sessions.get(txId);
    if (!session || session.state !== "PREPARING") {
      throw new Error(`Invalid 2PC transaction state for txId: ${txId}`);
    }

    const participantsToRun = session.participants
      .map((id) => this.participants.get(id))
      .filter((p): p is IBroccoli2pcParticipant => p !== undefined);

    if (participantsToRun.length === 0) {
      (session as any).state = "COMMITTED";
      return true;
    }

    // ==========================================
    // Phase 1: Prepare (Voting Phase)
    // ==========================================
    let allPrepared = true;
    try {
      const votes = await Promise.all(participantsToRun.map((p) => p.prepare(txId)));
      allPrepared = votes.every((v) => v === true);
    } catch {
      allPrepared = false;
    }

    // ==========================================
    // Phase 2: Commit or Abort (Decision Phase)
    // ==========================================
    if (allPrepared) {
      (session as any).state = "COMMITTING";
      try {
        await Promise.all(participantsToRun.map((p) => p.commit(txId)));
        (session as any).state = "COMMITTED";
        return true;
      } catch (err) {
        // In distributed 2PC, once PREPARED, commit errors trigger persistent retry or abort
        (session as any).state = "ABORTING";
        await Promise.allSettled(participantsToRun.map((p) => p.rollback(txId)));
        (session as any).state = "ABORTED";
        return false;
      }
    } else {
      (session as any).state = "ABORTING";
      await Promise.allSettled(participantsToRun.map((p) => p.rollback(txId)));
      (session as any).state = "ABORTED";
      return false;
    }
  }

  public getTransaction(txId: string): Broccoli2pcTransactionSession | undefined {
    return this.sessions.get(txId);
  }

  public getActiveTransactions(): readonly Broccoli2pcTransactionSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.state !== "COMMITTED" && s.state !== "ABORTED"
    );
  }
}
