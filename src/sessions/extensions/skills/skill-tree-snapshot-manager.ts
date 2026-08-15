import * as crypto from "node:crypto";
import type {
  ISkillTreeSnapshotManager,
  IBroccoliSkillTreeSubstrate,
  SkillNodeManifest,
} from "../../../core/contracts/skills.contracts.js";

interface SnapshotRecord {
  snapshotId: string;
  tickIndex: number;
  timestamp: number;
  nodes: readonly SkillNodeManifest[];
}

export class SkillTreeSnapshotManager implements ISkillTreeSnapshotManager {
  private readonly substrate: IBroccoliSkillTreeSubstrate;
  private readonly snapshots = new Map<string, SnapshotRecord>();
  private readonly history: Array<{ snapshotId: string; tickIndex: number; timestamp: number }> = [];

  constructor(substrate: IBroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(tickIndex: number): string {
    const timestamp = Date.now();
    const snapshotId = `snap-skill-${tickIndex}-${crypto.randomBytes(4).toString("hex")}`;
    const nodes = this.substrate.getAllNodes().map((n) => ({ ...n }));

    const record: SnapshotRecord = {
      snapshotId,
      tickIndex,
      timestamp,
      nodes: Object.freeze(nodes),
    };

    this.snapshots.set(snapshotId, record);
    this.history.push({ snapshotId, tickIndex, timestamp });

    return snapshotId;
  }

  restoreSnapshot(snapshotId: string): boolean {
    const record = this.snapshots.get(snapshotId);
    if (!record) return false;

    this.substrate.initialize(record.nodes);
    return true;
  }

  rollbackLastMutation(): boolean {
    if (this.history.length === 0) return false;
    const last = this.history[this.history.length - 1];
    return this.restoreSnapshot(last.snapshotId);
  }

  getSnapshotHistory(): readonly { snapshotId: string; tickIndex: number; timestamp: number }[] {
    return Object.freeze([...this.history]);
  }
}
