/**
 * broccoli-auth-substrate.ts
 *
 * In-memory Broccolidb repository for federated identities, token leases, and device authorizations (Phase 98 / ADR-052).
 */

import type {
  AuthProviderId,
  AuthWorkspaceSnapshot,
  DeviceAuthorizationPending,
  TokenLeaseRecord,
} from "../../../core/contracts/identity-federation.contracts.js";

export class BroccoliAuthSubstrate {
  private activeLeases: Map<AuthProviderId, TokenLeaseRecord>;
  private pendingAuths: Map<string, DeviceAuthorizationPending>;

  constructor() {
    this.activeLeases = new Map<AuthProviderId, TokenLeaseRecord>();
    this.pendingAuths = new Map<string, DeviceAuthorizationPending>();
  }

  recordPendingAuth(pending: DeviceAuthorizationPending): void {
    this.pendingAuths.set(pending.deviceCode, pending);
  }

  getPendingAuth(deviceCode: string): DeviceAuthorizationPending | undefined {
    return this.pendingAuths.get(deviceCode);
  }

  recordTokenLease(lease: TokenLeaseRecord): void {
    this.activeLeases.set(lease.providerId, lease);
  }

  getTokenLease(providerId: AuthProviderId): TokenLeaseRecord | undefined {
    return this.activeLeases.get(providerId);
  }

  revokeTokenLease(providerId: AuthProviderId): boolean {
    return this.activeLeases.delete(providerId);
  }

  getAllLeases(): readonly TokenLeaseRecord[] {
    return Array.from(this.activeLeases.values());
  }

  exportSnapshot(): AuthWorkspaceSnapshot {
    return {
      totalTokens: this.activeLeases.size,
      activeLeases: Array.from(this.activeLeases.values()),
      pendingAuthorizations: Array.from(this.pendingAuths.values()),
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: AuthWorkspaceSnapshot): void {
    this.activeLeases.clear();
    for (let i = 0; i < snapshot.activeLeases.length; i++) {
      const lease = snapshot.activeLeases[i];
      this.activeLeases.set(lease.providerId, lease);
    }

    this.pendingAuths.clear();
    for (let i = 0; i < snapshot.pendingAuthorizations.length; i++) {
      const pending = snapshot.pendingAuthorizations[i];
      this.pendingAuths.set(pending.deviceCode, pending);
    }
  }

  clear(): void {
    this.activeLeases.clear();
    this.pendingAuths.clear();
  }
}
