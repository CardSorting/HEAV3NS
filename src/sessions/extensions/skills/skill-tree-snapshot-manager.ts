import * as crypto from "node:crypto";
import type {
  ISkillTreeSnapshotManager,
  IBroccoliSkillTreeSubstrate,
  SkillNodeManifest,
  SkillSnapshotDiffResult,
} from "../../../core/contracts/skills.contracts.js";

interface SnapshotRecord {
  snapshotId: string;
  tickIndex: number;
  timestamp: number;
  nodes: readonly SkillNodeManifest[];
  nodeMap: Map<string, SkillNodeManifest>;
}

export class SkillTreeSnapshotManager implements ISkillTreeSnapshotManager {
  private readonly substrate: IBroccoliSkillTreeSubstrate;
  private readonly snapshots = new Map<string, SnapshotRecord>();
  private readonly history: Array<{ snapshotId: string; tickIndex: number; timestamp: number }> = [];
  private static readonly MAX_SNAPSHOTS = 100;

  constructor(substrate: IBroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
  }

  public createSnapshot(tickIndex: number): string {
    const timestamp = Date.now();
    const snapshotId = `snap-skill-${tickIndex}-${crypto.randomBytes(4).toString("hex")}`;
    const allNodes = this.substrate.getAllNodes();
    const nodes = allNodes.map((n) => Object.freeze({ ...n }));
    const nodeMap = new Map<string, SkillNodeManifest>();
    for (const n of nodes) {
      nodeMap.set(n.id.toLowerCase(), n);
    }

    const record: SnapshotRecord = {
      snapshotId,
      tickIndex,
      timestamp,
      nodes: Object.freeze(nodes),
      nodeMap,
    };

    if (this.snapshots.size >= SkillTreeSnapshotManager.MAX_SNAPSHOTS) {
      const oldest = this.history.shift();
      if (oldest) this.snapshots.delete(oldest.snapshotId);
    }

    this.snapshots.set(snapshotId, record);
    this.history.push({ snapshotId, tickIndex, timestamp });

    return snapshotId;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const record = this.snapshots.get(snapshotId);
    if (!record) return false;

    this.substrate.initialize(record.nodes);
    return true;
  }

  public rollbackLastMutation(): boolean {
    if (this.history.length === 0) return false;
    const last = this.history[this.history.length - 1];
    return this.restoreSnapshot(last.snapshotId);
  }

  public getSnapshotHistory(): readonly { snapshotId: string; tickIndex: number; timestamp: number }[] {
    return Object.freeze([...this.history]);
  }

  public diffSnapshots(snapshotAId: string, snapshotBId: string): SkillSnapshotDiffResult | undefined {
    const snapA = this.snapshots.get(snapshotAId);
    const snapB = this.snapshots.get(snapshotBId);
    if (!snapA || !snapB) return undefined;

    const addedNodeIds: string[] = [];
    const removedNodeIds: string[] = [];
    const modifiedNodes: Array<{ skillId: string; masteryDelta: number; fitnessDelta: number }> = [];

    // Check additions and modifications (B relative to A)
    for (const [id, nodeB] of snapB.nodeMap.entries()) {
      const nodeA = snapA.nodeMap.get(id);
      if (!nodeA) {
        addedNodeIds.push(nodeB.id);
      } else if (nodeA.masteryScore !== nodeB.masteryScore || nodeA.fitnessScore !== nodeB.fitnessScore) {
        modifiedNodes.push({
          skillId: nodeB.id,
          masteryDelta: nodeB.masteryScore - nodeA.masteryScore,
          fitnessDelta: Number((nodeB.fitnessScore - nodeA.fitnessScore).toFixed(3)),
        });
      }
    }

    // Check removals
    for (const [id, nodeA] of snapA.nodeMap.entries()) {
      if (!snapB.nodeMap.has(id)) {
        removedNodeIds.push(nodeA.id);
      }
    }

    return {
      snapshotAId,
      snapshotBId,
      addedNodeIds: Object.freeze(addedNodeIds),
      removedNodeIds: Object.freeze(removedNodeIds),
      modifiedNodes: Object.freeze(modifiedNodes),
    };
  }
}
