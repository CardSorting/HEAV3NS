/**
 * broccoli-auth-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for federated identities, token leases,
 * and OAuth2 PKCE device authorizations (Phase 98 / ADR-052 / Target #69).
 */

import type {
  AuthAuditRow,
  AuthProviderId,
  AuthWorkspaceSnapshot,
  DeviceAuthorizationPending,
  DeviceAuthRow,
  IBroccoliAuthSubstrate,
  IdentityFederationBulkMutationResult,
  IdentityFederationDslQueryFilter,
  IdentityFederationGroupBy,
  IdentityFederationGroupedLane,
  IdentityFederationHealthAuditReport,
  IdentityFederationHealthStatus,
  IdentityFederationMetricsReport,
  IdentityFederationMutationUndoRecord,
  IdentityFederationSortBy,
  IdentityFederationSortDirection,
  SubscriptionTier,
  SubscriptionTierRow,
  TokenLeaseRecord,
  TokenLeaseRow,
} from "../../../core/contracts/identity-federation.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliAuthSubstrate implements IBroccoliAuthSubstrate {
  private activeLeases = new Map<string, TokenLeaseRecord>(); // Keyed by leaseId
  private providerToLeaseId = new Map<AuthProviderId, string>();
  private pendingAuths = new Map<string, DeviceAuthorizationPending>();
  private readonly auditLogs: AuthAuditRow[] = [];

  private readonly undoStack: IdentityFederationMutationUndoRecord[] = [];
  private readonly redoStack: IdentityFederationMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private leasesTable?: IDbTable<TokenLeaseRow>;
  private deviceAuthsTable?: IDbTable<DeviceAuthRow>;
  private tiersTable?: IDbTable<SubscriptionTierRow>;
  private auditsTable?: IDbTable<AuthAuditRow>;

  constructor(dbKernel?: IBroccoliDatabaseKernel) {
    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.leasesTable = dbKernel.getTable<TokenLeaseRow>("token_leases");
      this.deviceAuthsTable = dbKernel.getTable<DeviceAuthRow>("device_auths");
      this.tiersTable = dbKernel.getTable<SubscriptionTierRow>("subscription_tiers");
      this.auditsTable = dbKernel.getTable<AuthAuditRow>("auth_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: IdentityFederationMutationUndoRecord["mutationType"], prev: AuthWorkspaceSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliAuthSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    this.redoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.previousSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.previousSnapshot);
    this.recordAuditRow("system", "undo", "system", `Reverted ${record.mutationType}`);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    this.undoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.nextSnapshot);
    this.recordAuditRow("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Token Lease Repository Operations
  // ---------------------------------------------------------------------------

  public recordLease(lease: TokenLeaseRecord): void {
    const prev = this.exportSnapshot();
    this.activeLeases.set(lease.leaseId, lease);
    this.providerToLeaseId.set(lease.providerId, lease.leaseId);

    if (this.leasesTable) {
      this.leasesTable.put(lease.leaseId, {
        id: lease.leaseId,
        leaseId: lease.leaseId,
        providerId: lease.providerId,
        accessToken: lease.accessToken,
        refreshToken: lease.refreshToken,
        tokenType: lease.tokenType,
        scope: lease.scope,
        issuedAt: lease.issuedAt,
        expiresAt: lease.expiresAt,
        userId: lease.userId,
        tier: lease.tier,
        timestamp: lease.issuedAt,
      });
    }

    this.pushUndoRecord("issue_lease", prev);
    this.recordAuditRow(lease.leaseId, "issue_lease", "system", `Provider: ${lease.providerId} (${lease.tier})`);
  }

  public recordTokenLease(lease: TokenLeaseRecord): void {
    this.recordLease(lease);
  }

  public getLease(leaseId: string): TokenLeaseRecord | undefined {
    return this.activeLeases.get(leaseId);
  }

  public getTokenLease(providerId: AuthProviderId): TokenLeaseRecord | undefined {
    return this.getLeaseByProvider(providerId);
  }

  public getLeaseByProvider(providerId: AuthProviderId): TokenLeaseRecord | undefined {
    const leaseId = this.providerToLeaseId.get(providerId);
    return leaseId ? this.activeLeases.get(leaseId) : undefined;
  }

  public listLeases(): readonly TokenLeaseRecord[] {
    return Array.from(this.activeLeases.values());
  }

  public getAllLeases(): readonly TokenLeaseRecord[] {
    return this.listLeases();
  }

  public revokeLease(leaseId: string): boolean {
    const lease = this.activeLeases.get(leaseId);
    if (!lease) return false;

    const prev = this.exportSnapshot();
    this.activeLeases.delete(leaseId);
    if (this.providerToLeaseId.get(lease.providerId) === leaseId) {
      this.providerToLeaseId.delete(lease.providerId);
    }

    if (this.leasesTable) {
      this.leasesTable.delete(leaseId);
    }

    this.pushUndoRecord("revoke_lease", prev);
    this.recordAuditRow(leaseId, "revoke_lease", "system", `Revoked lease for provider: ${lease.providerId}`);
    return true;
  }

  public revokeTokenLease(providerId: AuthProviderId): boolean {
    const lease = this.getLeaseByProvider(providerId);
    if (!lease) return false;
    return this.revokeLease(lease.leaseId);
  }

  // ---------------------------------------------------------------------------
  // Device Flow Pending Operations
  // ---------------------------------------------------------------------------

  public recordPendingAuth(pending: DeviceAuthorizationPending): void {
    this.pendingAuths.set(pending.deviceCode, pending);

    if (this.deviceAuthsTable) {
      this.deviceAuthsTable.put(pending.deviceCode, {
        id: pending.deviceCode,
        deviceCode: pending.deviceCode,
        userCode: pending.userCode,
        verificationUri: pending.verificationUri,
        verificationUriComplete: pending.verificationUriComplete,
        expiresIn: pending.expiresIn,
        interval: pending.interval,
        createdAt: pending.createdAt,
      });
    }
  }

  public getPendingAuth(deviceCode: string): DeviceAuthorizationPending | undefined {
    return this.pendingAuths.get(deviceCode);
  }

  public removePendingAuth(deviceCode: string): boolean {
    const deleted = this.pendingAuths.delete(deviceCode);
    if (deleted && this.deviceAuthsTable) {
      this.deviceAuthsTable.delete(deviceCode);
    }
    return deleted;
  }

  public listPendingAuths(): readonly DeviceAuthorizationPending[] {
    return Array.from(this.pendingAuths.values());
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): IdentityFederationHealthAuditReport {
    const now = Date.now();
    const all = Array.from(this.activeLeases.values());
    const expiredCount = all.filter((l) => l.expiresAt <= now).length;
    const activeCount = all.length - expiredCount;
    const pendingCount = this.pendingAuths.size;

    let healthStatus: IdentityFederationHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (expiredCount > 0) {
      healthStatus = "degraded";
      recommendations.push(`${expiredCount} token lease(s) have expired. Trigger background token refresh.`);
    }

    if (pendingCount > 10) {
      recommendations.push(`High number of pending device code authorizations (${pendingCount}). Inspect for abandoned logins.`);
    }

    if (all.length === 0) {
      healthStatus = "healthy";
      recommendations.push("No active token leases registered. Login with `auth_login_device` to authenticate providers.");
    }

    return {
      totalActiveLeases: activeCount,
      expiredLeasesCount: expiredCount,
      pendingAuthorizationsCount: pendingCount,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): IdentityFederationMetricsReport {
    const all = Array.from(this.activeLeases.values());
    const tierDistribution: Record<SubscriptionTier, number> = {
      free: 0,
      pro: 0,
      team: 0,
      enterprise: 0,
    };

    for (const lease of all) {
      if (tierDistribution[lease.tier] !== undefined) {
        tierDistribution[lease.tier]++;
      }
    }

    return {
      totalLeasesIssued: all.length,
      totalAuthorizationsInitiated: this.pendingAuths.size + all.length,
      totalAuthorizationsExchanged: all.length,
      totalTokensRefreshed: 0,
      activeLeaseCount: all.length,
      tierDistribution,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedLeases(
    groupBy: IdentityFederationGroupBy = "provider",
    sortBy: IdentityFederationSortBy = "issuedAt",
    direction: IdentityFederationSortDirection = "desc"
  ): readonly IdentityFederationGroupedLane[] {
    const lanes = new Map<string, TokenLeaseRecord[]>();
    const now = Date.now();

    for (const lease of this.activeLeases.values()) {
      let key = "default";
      switch (groupBy) {
        case "provider":
          key = lease.providerId;
          break;
        case "tier":
          key = lease.tier;
          break;
        case "expiry_status":
          key = lease.expiresAt > now ? "Active" : "Expired";
          break;
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(lease);
    }

    const result: IdentityFederationGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "issuedAt") cmp = b.issuedAt - a.issuedAt;
        else if (sortBy === "expiresAt") cmp = b.expiresAt - a.expiresAt;
        else if (sortBy === "providerId") cmp = a.providerId.localeCompare(b.providerId);
        else if (sortBy === "tier") cmp = a.tier.localeCompare(b.tier);
        return direction === "asc" ? -cmp : cmp;
      });

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        leases: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryLeasesDsl(query: IdentityFederationDslQueryFilter | string): readonly TokenLeaseRecord[] {
    const parsed: IdentityFederationDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const now = Date.now();

    return Array.from(this.activeLeases.values()).filter((l) => {
      if (parsed.providerId && l.providerId !== parsed.providerId) return false;
      if (parsed.tier && l.tier !== parsed.tier) return false;
      if (parsed.activeOnly && l.expiresAt <= now) return false;

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${l.leaseId} ${l.providerId} ${l.tier} ${l.scope} ${l.userId || ""}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): IdentityFederationDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let providerId: AuthProviderId | undefined;
    let tier: SubscriptionTier | undefined;
    let activeOnly: boolean | undefined;

    for (const tok of tokens) {
      if (tok.startsWith("provider:")) {
        providerId = tok.slice(9) as AuthProviderId;
      } else if (tok.startsWith("tier:")) {
        tier = tok.slice(5) as SubscriptionTier;
      } else if (tok.startsWith("active:")) {
        activeOnly = tok.slice(7).toLowerCase() === "true";
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      providerId,
      tier,
      activeOnly,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgeLeases(leaseIds: readonly string[]): IdentityFederationBulkMutationResult {
    const prev = this.exportSnapshot();
    const toPurge = new Set(leaseIds);
    let modified = 0;

    for (const id of toPurge) {
      const lease = this.activeLeases.get(id);
      if (lease) {
        this.activeLeases.delete(id);
        if (this.providerToLeaseId.get(lease.providerId) === id) {
          this.providerToLeaseId.delete(lease.providerId);
        }
        modified++;
      }
    }

    this.pushUndoRecord("bulk_purge", prev);
    return {
      matchedCount: leaseIds.length,
      modifiedCount: modified,
      affectedLeaseIds: leaseIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const leases = Array.from(this.activeLeases.values());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Identity Federation & Token Lease Vault</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #0284c7; color: #bae6fd; }
  </style>
</head>
<body>
  <h1>🔐 LUMI Identity Federation & Token Lease Vault</h1>
  <p style="color: #94a3b8;">OAuth2 PKCE Device Flow, Multi-Provider Identity Federation & Subscription Governance (Phase 98 / Target #69)</p>
  
  <div class="grid">
    <div class="card"><div>Active Leases</div><div class="metric-val">${metrics.activeLeaseCount}</div></div>
    <div class="card"><div>Pending Logins</div><div class="metric-val" style="color:#eab308;">${health.pendingAuthorizationsCount}</div></div>
    <div class="card"><div>Expired Leases</div><div class="metric-val" style="color:#ef4444;">${health.expiredLeasesCount}</div></div>
    <div class="card"><div>Health Status</div><div class="metric-val" style="color:${health.healthStatus === 'optimal' ? '#22c55e' : '#eab308'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Federated Token Leases</h2>
  <table>
    <thead>
      <tr>
        <th>Lease ID</th>
        <th>Provider</th>
        <th>Tier</th>
        <th>Scope</th>
        <th>Expires At</th>
      </tr>
    </thead>
    <tbody>
      ${leases.map((l) => `
        <tr>
          <td><code>${l.leaseId}</code></td>
          <td><span class="badge">${l.providerId.toUpperCase()}</span></td>
          <td><strong>${l.tier.toUpperCase()}</strong></td>
          <td>${l.scope}</td>
          <td>${new Date(l.expiresAt).toISOString()}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();
    const leases = Array.from(this.activeLeases.values());

    let md = `# LUMI Identity Federation & Token Lease Vault Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Active Leases:** \`${metrics.activeLeaseCount}\` | **Pending Auth:** \`${health.pendingAuthorizationsCount}\`\n\n`;
    md += `## Tier Distribution\n`;
    md += `- **Free:** ${metrics.tierDistribution.free}\n`;
    md += `- **Pro:** ${metrics.tierDistribution.pro}\n`;
    md += `- **Team:** ${metrics.tierDistribution.team}\n`;
    md += `- **Enterprise:** ${metrics.tierDistribution.enterprise}\n\n`;

    md += `## Active Token Leases (${leases.length})\n\n`;
    md += `| Lease ID | Provider | Tier | Expires At |\n`;
    md += `|---|---|---|---|\n`;
    for (const l of leases) {
      md += `| \`${l.leaseId}\` | \`${l.providerId}\` | ${l.tier.toUpperCase()} | ${new Date(l.expiresAt).toISOString()} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "leaseId,providerId,tier,tokenType,issuedAt,expiresAt,userId\n";
    const rows = Array.from(this.activeLeases.values()).map((l) => {
      return `"${l.leaseId}","${l.providerId}","${l.tier}","${l.tokenType}",${l.issuedAt},${l.expiresAt},"${l.userId || ""}"`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

  public exportSnapshot(): AuthWorkspaceSnapshot {
    return {
      totalTokens: this.activeLeases.size,
      activeLeases: Array.from(this.activeLeases.values()),
      pendingAuthorizations: Array.from(this.pendingAuths.values()),
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: AuthWorkspaceSnapshot): void {
    this.activeLeases.clear();
    this.providerToLeaseId.clear();
    for (const lease of snapshot.activeLeases) {
      this.activeLeases.set(lease.leaseId, lease);
      this.providerToLeaseId.set(lease.providerId, lease.leaseId);
    }

    this.pendingAuths.clear();
    for (const pending of snapshot.pendingAuthorizations) {
      this.pendingAuths.set(pending.deviceCode, pending);
    }
  }

  private recordAuditRow(leaseId: string, action: string, operator: string, details: string): void {
    const row: AuthAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${leaseId}`,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row as any);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
    }
  }

  public clear(): void {
    this.activeLeases.clear();
    this.providerToLeaseId.clear();
    this.pendingAuths.clear();
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
