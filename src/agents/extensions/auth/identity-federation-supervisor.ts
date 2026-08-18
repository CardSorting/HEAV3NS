/**
 * identity-federation-supervisor.ts
 *
 * Master supervisor coordinating multi-provider identity federation, OAuth2 PKCE device flows,
 * token lease rotation, and subscription tier governance (Phase 98 / ADR-052).
 */

import type {
  AuthProviderId,
  DeviceAuthorizationPending,
  SubscriptionEntitlement,
  SubscriptionTier,
  TokenLeaseRecord,
} from "../../../core/contracts/identity-federation.contracts.js";
import { DeterministicAuthFederator } from "../../../tooling/extensions/auth/deterministic-auth-federator.js";
import { BroccoliAuthSubstrate } from "../../../sessions/extensions/auth/broccoli-auth-substrate.js";

export class IdentityFederationSupervisor {
  private federator: DeterministicAuthFederator;
  private substrate: BroccoliAuthSubstrate;

  constructor(
    federator: DeterministicAuthFederator,
    substrate: BroccoliAuthSubstrate
  ) {
    this.federator = federator;
    this.substrate = substrate;
  }

  /**
   * Initiates a deterministic OAuth2 device authorization flow for an AI provider.
   */
  initiateAuth(
    providerId: AuthProviderId,
    clientId: string = "lumi-joy-client",
    scopes: readonly string[] = ["read", "write", "inference"]
  ): DeviceAuthorizationPending {
    const pending = this.federator.initiateDeviceFlow(providerId, clientId, scopes);
    this.substrate.recordPendingAuth(pending);
    return pending;
  }

  /**
   * Completes device code authorization and stores the active token lease.
   */
  completeDeviceAuth(
    deviceCode: string,
    providerId: AuthProviderId,
    tier: SubscriptionTier = "pro"
  ): TokenLeaseRecord {
    const lease = this.federator.exchangeDeviceCode(deviceCode, providerId, tier);
    this.substrate.recordTokenLease(lease);
    return lease;
  }

  /**
   * Retrieves the active token lease for a provider.
   */
  getActiveLease(providerId: AuthProviderId): TokenLeaseRecord | undefined {
    return this.substrate.getTokenLease(providerId);
  }

  /**
   * Revokes an active token lease for a provider.
   */
  revokeAuth(providerId: AuthProviderId): boolean {
    return this.substrate.revokeTokenLease(providerId);
  }

  /**
   * Verifies and checks entitlements for a specific authenticated provider.
   */
  checkEntitlements(providerId: AuthProviderId): SubscriptionEntitlement {
    const lease = this.substrate.getTokenLease(providerId);
    const tier = lease ? lease.tier : "free";
    return this.federator.getEntitlements(tier);
  }

  /**
   * Refreshes and updates an active token lease for a provider.
   */
  public refreshTokenLease(providerId: AuthProviderId): TokenLeaseRecord | undefined {
    const lease = this.substrate.getTokenLease(providerId);
    if (!lease) {
      return undefined;
    }

    const refreshed = this.federator.refreshTokenLease(lease);
    this.substrate.recordTokenLease(refreshed);
    return refreshed;
  }

  public getAllLeases(): readonly TokenLeaseRecord[] {
    return this.substrate.listLeases();
  }

  public auditHealth() {
    return this.substrate.auditHealth();
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getGroupedLeases(groupBy?: any, sortBy?: any, direction?: any) {
    return this.substrate.getGroupedLeases(groupBy, sortBy, direction);
  }

  public queryDsl(query: any) {
    return this.substrate.queryLeasesDsl(query);
  }

  public bulkPurge(leaseIds: readonly string[]) {
    return this.substrate.bulkPurgeLeases(leaseIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getSubstrate(): BroccoliAuthSubstrate {
    return this.substrate;
  }

  public getFederator(): DeterministicAuthFederator {
    return this.federator;
  }
}
