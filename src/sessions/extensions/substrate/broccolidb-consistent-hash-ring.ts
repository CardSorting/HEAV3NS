/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-consistent-hash-ring.ts
 *
 * Distributed Consistent Hash Ring with Virtual Nodes for BroccoliDB (Pass 201 / ADR-139).
 * Uniformly partitions key space across 128 vnodes per physical node with minimal K/N rebalancing.
 */

import type {
  HashRingNode,
  IBroccoliConsistentHashRing,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliConsistentHashRing implements IBroccoliConsistentHashRing {
  private readonly vnodesPerNode: number;
  private readonly ring = new Map<number, HashRingNode>(); // token -> node
  private sortedTokens: number[] = [];
  private readonly nodes = new Map<string, HashRingNode>();

  constructor(vnodesPerNode = 128) {
    this.vnodesPerNode = vnodesPerNode;
  }

  public addNode(node: HashRingNode): void {
    this.nodes.set(node.nodeId, node);
    const weight = node.weight ?? 1.0;
    const count = Math.max(1, Math.floor(this.vnodesPerNode * weight));

    for (let i = 0; i < count; i++) {
      const vnodeKey = `${node.nodeId}#vnode_${i}`;
      const token = this.hash(vnodeKey);
      this.ring.set(token, node);
    }

    this.rebuildSortedTokens();
  }

  public removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) return false;
    this.nodes.delete(nodeId);

    for (const [token, node] of Array.from(this.ring.entries())) {
      if (node.nodeId === nodeId) {
        this.ring.delete(token);
      }
    }

    this.rebuildSortedTokens();
    return true;
  }

  public getNode(key: string): HashRingNode | undefined {
    if (this.sortedTokens.length === 0) return undefined;

    const token = this.hash(key);
    let low = 0;
    let high = this.sortedTokens.length - 1;

    if (token > this.sortedTokens[high]) {
      return this.ring.get(this.sortedTokens[0]);
    }

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedTokens[mid] >= token) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    const matchedToken = this.sortedTokens[low];
    return this.ring.get(matchedToken);
  }

  public getNodesForKey(key: string, replicaCount = 3): readonly HashRingNode[] {
    if (this.nodes.size === 0) return [];
    if (replicaCount >= this.nodes.size) {
      return Array.from(this.nodes.values());
    }

    const token = this.hash(key);
    const matchedNodes: HashRingNode[] = [];
    const seenNodeIds = new Set<string>();

    let idx = this.findTokenIndex(token);

    for (let i = 0; i < this.sortedTokens.length; i++) {
      const ringIdx = (idx + i) % this.sortedTokens.length;
      const node = this.ring.get(this.sortedTokens[ringIdx]);
      if (node && !seenNodeIds.has(node.nodeId)) {
        seenNodeIds.add(node.nodeId);
        matchedNodes.push(node);
        if (matchedNodes.length >= replicaCount) {
          break;
        }
      }
    }

    return matchedNodes;
  }

  public getAllNodes(): readonly HashRingNode[] {
    return Array.from(this.nodes.values());
  }

  public getVirtualNodeCount(): number {
    return this.ring.size;
  }

  private findTokenIndex(token: number): number {
    let low = 0;
    let high = this.sortedTokens.length - 1;

    if (token > this.sortedTokens[high]) {
      return 0;
    }

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedTokens[mid] >= token) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    return low;
  }

  private rebuildSortedTokens(): void {
    this.sortedTokens = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  private hash(key: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }
}
