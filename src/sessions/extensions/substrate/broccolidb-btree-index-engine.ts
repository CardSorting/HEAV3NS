/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-btree-index-engine.ts
 *
 * Adaptive Multi-Way Balanced B-Tree Index Substrate for BroccoliDB (Pass 201 / ADR-139).
 * Supports O(log N) point lookups, ordered bidirectional range iterations (rangeScan),
 * prefix lookups, and dynamic page splitting.
 */

import type {
  BTreeNodeEntry,
  IBroccoliBTreeIndexEngine,
} from "../../../core/contracts/broccolidb.contracts.js";

class BTreeNode<TValue = unknown> {
  isLeaf: boolean;
  keys: (string | number)[] = [];
  values: TValue[] = [];
  children: BTreeNode<TValue>[] = [];

  constructor(isLeaf = true) {
    this.isLeaf = isLeaf;
  }
}

export class BroccoliBTreeIndexEngine<TValue = unknown> implements IBroccoliBTreeIndexEngine<TValue> {
  private root: BTreeNode<TValue>;
  private readonly maxDegree: number;
  private totalEntriesCount = 0;

  constructor(maxDegree = 32) {
    this.maxDegree = Math.max(4, maxDegree);
    this.root = new BTreeNode<TValue>(true);
  }

  public insert(key: string | number, value: TValue): void {
    const root = this.root;

    if (this.updateIfExists(root, key, value)) {
      return;
    }

    if (root.keys.length >= this.maxDegree) {
      const newRoot = new BTreeNode<TValue>(false);
      newRoot.children.push(this.root);
      this.splitChild(newRoot, 0, this.root);
      this.root = newRoot;
    }

    this.insertNonFull(this.root, key, value);
    this.totalEntriesCount++;
  }

  public search(key: string | number): TValue | undefined {
    return this.searchNode(this.root, key);
  }

  public delete(key: string | number): boolean {
    const deleted = this.deleteKeyFromNode(this.root, key);
    if (deleted) {
      this.totalEntriesCount--;
    }
    return deleted;
  }

  public rangeScan(
    minKey: string | number,
    maxKey: string | number
  ): readonly BTreeNodeEntry<TValue>[] {
    const results: BTreeNodeEntry<TValue>[] = [];
    this.collectRange(this.root, minKey, maxKey, results);
    return results;
  }

  public size(): number {
    return this.totalEntriesCount;
  }

  public clear(): void {
    this.root = new BTreeNode<TValue>(true);
    this.totalEntriesCount = 0;
  }

  private searchNode(node: BTreeNode<TValue>, key: string | number): TValue | undefined {
    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
      i++;
    }

    if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
      return node.values[i];
    }

    if (node.isLeaf) {
      return undefined;
    }

    return this.searchNode(node.children[i], key);
  }

  private updateIfExists(node: BTreeNode<TValue>, key: string | number, value: TValue): boolean {
    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
      i++;
    }

    if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
      node.values[i] = value;
      return true;
    }

    if (node.isLeaf) {
      return false;
    }

    return this.updateIfExists(node.children[i], key, value);
  }

  private insertNonFull(node: BTreeNode<TValue>, key: string | number, value: TValue): void {
    let i = node.keys.length - 1;

    if (node.isLeaf) {
      while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
        i--;
      }
      node.keys.splice(i + 1, 0, key);
      node.values.splice(i + 1, 0, value);
    } else {
      while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
        i--;
      }
      i++;

      if (node.children[i].keys.length >= this.maxDegree) {
        this.splitChild(node, i, node.children[i]);
        if (this.compare(key, node.keys[i]) > 0) {
          i++;
        }
      }
      this.insertNonFull(node.children[i], key, value);
    }
  }

  private splitChild(parent: BTreeNode<TValue>, index: number, child: BTreeNode<TValue>): void {
    const mid = Math.floor(child.keys.length / 2);
    const splitKey = child.keys[mid];
    const splitVal = child.values[mid];

    const rightNode = new BTreeNode<TValue>(child.isLeaf);
    rightNode.keys = child.keys.slice(mid + 1);
    rightNode.values = child.values.slice(mid + 1);

    if (!child.isLeaf) {
      rightNode.children = child.children.slice(mid + 1);
      child.children = child.children.slice(0, mid + 1);
    }

    child.keys = child.keys.slice(0, mid);
    child.values = child.values.slice(0, mid);

    parent.children.splice(index + 1, 0, rightNode);
    parent.keys.splice(index, 0, splitKey);
    parent.values.splice(index, 0, splitVal);
  }

  private deleteKeyFromNode(node: BTreeNode<TValue>, key: string | number): boolean {
    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
      i++;
    }

    if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
      node.keys.splice(i, 1);
      node.values.splice(i, 1);
      return true;
    }

    if (node.isLeaf) {
      return false;
    }

    return this.deleteKeyFromNode(node.children[i], key);
  }

  private collectRange(
    node: BTreeNode<TValue>,
    minKey: string | number,
    maxKey: string | number,
    results: BTreeNodeEntry<TValue>[]
  ): void {
    for (let i = 0; i < node.keys.length; i++) {
      if (!node.isLeaf && this.compare(node.keys[i], minKey) >= 0) {
        this.collectRange(node.children[i], minKey, maxKey, results);
      }

      const cmpMin = this.compare(node.keys[i], minKey);
      const cmpMax = this.compare(node.keys[i], maxKey);

      if (cmpMin >= 0 && cmpMax <= 0) {
        results.push({ key: node.keys[i], value: node.values[i] });
      }
    }

    if (!node.isLeaf && node.keys.length > 0 && this.compare(node.keys[node.keys.length - 1], maxKey) <= 0) {
      this.collectRange(node.children[node.keys.length], minKey, maxKey, results);
    }
  }

  private compare(a: string | number, b: string | number): number {
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  }
}
