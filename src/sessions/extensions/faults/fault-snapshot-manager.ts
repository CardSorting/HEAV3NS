import type {
  FaultTaxonomyStateSnapshot,
  IFaultSnapshotManager,
} from "../../../core/contracts/fault.contracts.js";
import type { BroccoliFaultSubstrate } from "./broccoli-fault-substrate.js";

/**
 * Deterministic Fault Taxonomy Snapshot Manager.
 *
 * Implements frame-perfect binary snapshotting and O(1) state restoration for
 * the fault taxonomy and provider health states in Broccolidb.
 */
export class FaultSnapshotManager implements IFaultSnapshotManager {
  private readonly substrate: BroccoliFaultSubstrate;

  constructor(substrate: BroccoliFaultSubstrate) {
    this.substrate = substrate;
  }

  createSnapshot(tick: number): FaultTaxonomyStateSnapshot {
    const healthRecords = this.substrate.listProviderHealth();
    return {
      providerHealth: healthRecords.map((r) => ({ ...r })),
      totalClassifiedFaults: this.substrate.getTotalFaultCount(),
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: FaultTaxonomyStateSnapshot): void {
    this.substrate.clear();
    this.substrate.setTotalFaultCount(snapshot.totalClassifiedFaults);
    for (const record of snapshot.providerHealth) {
      if (record.consecutiveFailures > 0 && record.lastFaultCategory) {
        this.substrate.recordFault(record.provider, record.lastFaultCategory);
      } else {
        this.substrate.recordSuccess(record.provider);
      }
    }
  }
}
