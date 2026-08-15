import type {
  CredentialStateSnapshot,
  ICredentialSnapshotManager,
  IBroccoliCredentialSubstrate,
  CredentialRotationStrategy,
} from "../../../core/contracts/credential.contracts.js";

/**
 * Frame-perfect binary snapshot and rollback manager for credential pools.
 */
export class CredentialSnapshotManager implements ICredentialSnapshotManager {
  private substrate: IBroccoliCredentialSubstrate;
  private currentStrategy: CredentialRotationStrategy = "least_utilized";
  private totalRotations = 0;

  constructor(substrate: IBroccoliCredentialSubstrate) {
    this.substrate = substrate;
  }

  setSubstrate(substrate: IBroccoliCredentialSubstrate): void {
    this.substrate = substrate;
  }

  setStrategy(strategy: CredentialRotationStrategy): void {
    this.currentStrategy = strategy;
  }

  createSnapshot(tick: number): CredentialStateSnapshot {
    const accounts = this.substrate.listAccounts();
    return {
      accounts: accounts.map((a) => ({
        ...a,
        tokenBucket: { ...a.tokenBucket },
      })),
      strategy: this.currentStrategy,
      totalRotations: this.totalRotations,
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: CredentialStateSnapshot): void {
    this.substrate.clear();
    for (const acc of snapshot.accounts) {
      this.substrate.addAccount({
        ...acc,
        tokenBucket: { ...acc.tokenBucket },
      });
    }
    this.currentStrategy = snapshot.strategy;
    this.totalRotations = snapshot.totalRotations;
  }
}
