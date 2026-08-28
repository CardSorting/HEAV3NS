/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-deadlock-detector.ts
 *
 * Distributed Wait-For Graph (WFG) Deadlock Detector for BroccoliDB (Pass 201 / ADR-139).
 * Maintains a dynamic directed graph of transaction lock wait dependencies,
 * executing DFS cycle detection to identify circular deadlocks and select victim transactions.
 */

import type {
  DeadlockDetectionResult,
  DeadlockEdge,
  IBroccoliDeadlockDetector,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliDeadlockDetector implements IBroccoliDeadlockDetector {
  private readonly edges = new Map<string, DeadlockEdge[]>();
  private readonly txStartTimes = new Map<string, number>();

  public addWaitFor(waitingTxId: string, holdingTxId: string, resourceKey: string): void {
    if (waitingTxId === holdingTxId) return;

    if (!this.txStartTimes.has(waitingTxId)) {
      this.txStartTimes.set(waitingTxId, Date.now());
    }
    if (!this.txStartTimes.has(holdingTxId)) {
      this.txStartTimes.set(holdingTxId, Date.now());
    }

    let txEdges = this.edges.get(waitingTxId);
    if (!txEdges) {
      txEdges = [];
      this.edges.set(waitingTxId, txEdges);
    }

    const exists = txEdges.some(
      (e) => e.holdingTxId === holdingTxId && e.resourceKey === resourceKey
    );
    if (!exists) {
      txEdges.push({
        waitingTxId,
        holdingTxId,
        resourceKey,
        timestamp: Date.now(),
      });
    }
  }

  public removeWaitFor(waitingTxId: string, holdingTxId: string, resourceKey?: string): void {
    const txEdges = this.edges.get(waitingTxId);
    if (!txEdges) return;

    const filtered = txEdges.filter(
      (e) => !(e.holdingTxId === holdingTxId && (!resourceKey || e.resourceKey === resourceKey))
    );

    if (filtered.length === 0) {
      this.edges.delete(waitingTxId);
    } else {
      this.edges.set(waitingTxId, filtered);
    }
  }

  public removeTx(txId: string): void {
    this.edges.delete(txId);
    this.txStartTimes.delete(txId);

    for (const [waitingTx, edgeList] of Array.from(this.edges.entries())) {
      const remaining = edgeList.filter((e) => e.holdingTxId !== txId);
      if (remaining.length === 0) {
        this.edges.delete(waitingTx);
      } else {
        this.edges.set(waitingTx, remaining);
      }
    }
  }

  public detectDeadlock(): DeadlockDetectionResult {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const pathStack: string[] = [];

    for (const txId of Array.from(this.edges.keys())) {
      if (!visited.has(txId)) {
        const cycle = this.findCycleDfs(txId, visited, recStack, pathStack);
        if (cycle) {
          let victimTxId = cycle[0];
          let maxStart = -1;

          for (const cTx of cycle) {
            const start = this.txStartTimes.get(cTx) ?? 0;
            if (start >= maxStart) {
              maxStart = start;
              victimTxId = cTx;
            }
          }

          return {
            hasDeadlock: true,
            cycle,
            victimTxId,
          };
        }
      }
    }

    return { hasDeadlock: false };
  }

  public getActiveWaitEdges(): readonly DeadlockEdge[] {
    const allEdges: DeadlockEdge[] = [];
    for (const edgeList of this.edges.values()) {
      allEdges.push(...edgeList);
    }
    return allEdges;
  }

  private findCycleDfs(
    currentTx: string,
    visited: Set<string>,
    recStack: Set<string>,
    pathStack: string[]
  ): string[] | null {
    visited.add(currentTx);
    recStack.add(currentTx);
    pathStack.push(currentTx);

    const neighbors = this.edges.get(currentTx) ?? [];

    for (const edge of neighbors) {
      const nextTx = edge.holdingTxId;

      if (!visited.has(nextTx)) {
        const cycle = this.findCycleDfs(nextTx, visited, recStack, pathStack);
        if (cycle) return cycle;
      } else if (recStack.has(nextTx)) {
        const cycleStartIndex = pathStack.indexOf(nextTx);
        if (cycleStartIndex !== -1) {
          return pathStack.slice(cycleStartIndex);
        }
      }
    }

    pathStack.pop();
    recStack.delete(currentTx);
    return null;
  }
}
