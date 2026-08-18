/**
 * identity-federation-tool-suite.ts
 *
 * Model tool surface for OAuth2 PKCE Identity Federation & Token Lease Vault (Phase 98 / ADR-052 / Target #69):
 * 30 specialized model tools for initiating PKCE flows, verifying device codes, managing token leases,
 * resolving tier entitlements, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  AuthProviderId,
  IdentityFederationGroupBy,
  IdentityFederationSortBy,
  IdentityFederationSortDirection,
  SubscriptionTier,
} from "../../../core/contracts/identity-federation.contracts.js";
import { IdentityFederationSupervisor } from "../../../agents/extensions/auth/identity-federation-supervisor.js";
import { AuthSnapshotManager } from "../../../sessions/extensions/auth/auth-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class IdentityFederationToolSuite {
  private readonly supervisor: IdentityFederationSupervisor;
  private readonly snapshotManager: AuthSnapshotManager;

  constructor(supervisor: IdentityFederationSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new AuthSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "auth_initiate_device_flow",
        description: "Initiates an OAuth2 PKCE device authorization flow for an AI model provider.",
        parameters: {
          providerId: { type: "string", required: true, description: "Provider identifier ('nous', 'openai', 'anthropic', 'copilot', 'custom')" },
          clientId: { type: "string", description: "OAuth client ID" },
          scopes: { type: "string", description: "Comma-separated requested OAuth scopes" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_initiate_device_flow", args);
        },
      },
      {
        name: "auth_complete_device_auth",
        description: "Completes device code authorization and stores the active token lease.",
        parameters: {
          deviceCode: { type: "string", required: true, description: "Device code from initiate step" },
          providerId: { type: "string", required: true, description: "Provider identifier" },
          tier: { type: "string", description: "Subscription tier ('free', 'pro', 'team', 'enterprise')" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_complete_device_auth", args);
        },
      },
      {
        name: "auth_verify_token_lease",
        description: "Verifies the validity, remaining lifetime, and scopes of an active provider token lease.",
        parameters: {
          providerId: { type: "string", required: true, description: "Provider identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_verify_token_lease", args);
        },
      },
      {
        name: "auth_get_lease",
        description: "Retrieves a token lease by lease ID.",
        parameters: {
          leaseId: { type: "string", required: true, description: "Lease ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_get_lease", args);
        },
      },
      {
        name: "auth_list_leases",
        description: "Lists all active and stored token leases.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_list_leases", args);
        },
      },
      {
        name: "auth_revoke_lease",
        description: "Revokes an active token lease by provider or lease ID.",
        parameters: {
          providerId: { type: "string", description: "Provider identifier" },
          leaseId: { type: "string", description: "Lease ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_revoke_lease", args);
        },
      },
      {
        name: "auth_refresh_lease",
        description: "Refreshes an active token lease for a provider.",
        parameters: {
          providerId: { type: "string", required: true, description: "Provider identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_refresh_lease", args);
        },
      },
      {
        name: "auth_check_entitlements",
        description: "Checks subscription tier quotas, max tokens, and inference privileges.",
        parameters: {
          providerId: { type: "string", required: true, description: "Provider identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_check_entitlements", args);
        },
      },
      {
        name: "auth_generate_pkce",
        description: "Generates an RFC 7636 PKCE S256 code verifier and code challenge pair.",
        parameters: {
          seed: { type: "number", description: "Optional deterministic seed" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_generate_pkce", args);
        },
      },
      {
        name: "auth_list_pending",
        description: "Lists all currently pending device code authorizations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_list_pending", args);
        },
      },
      {
        name: "auth_get_pending",
        description: "Retrieves a pending device authorization by device code.",
        parameters: {
          deviceCode: { type: "string", required: true, description: "Device code" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_get_pending", args);
        },
      },
      {
        name: "auth_remove_pending",
        description: "Cancels and removes a pending device authorization.",
        parameters: {
          deviceCode: { type: "string", required: true, description: "Device code" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_remove_pending", args);
        },
      },
      {
        name: "auth_audit_health",
        description: "Audits identity federation health, expired leases, and pending auth counts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_audit_health", args);
        },
      },
      {
        name: "auth_get_metrics",
        description: "Fetches token lease metrics, tier distribution, and issuance statistics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_get_metrics", args);
        },
      },
      {
        name: "auth_group_and_sort",
        description: "Organizes token leases into multi-criteria swimlanes (provider, tier, expiry_status).",
        parameters: {
          groupBy: { type: "string", description: "Group by: provider, tier, expiry_status" },
          sortBy: { type: "string", description: "Sort by: issuedAt, expiresAt, providerId, tier" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_group_and_sort", args);
        },
      },
      {
        name: "auth_search_dsl",
        description: "Searches token leases using Natural Query DSL (e.g. 'provider:nous tier:pro active:true').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_search_dsl", args);
        },
      },
      {
        name: "auth_render_dashboard",
        description: "Renders an ANSI CLI summary card with active leases and health posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_render_dashboard", args);
        },
      },
      {
        name: "auth_render_lease_card",
        description: "Renders an interactive ANSI CLI token lease descriptor card.",
        parameters: {
          providerId: { type: "string", required: true, description: "Provider identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_render_lease_card", args);
        },
      },
      {
        name: "auth_export_html",
        description: "Exports token leases and federated identity status to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_export_html", args);
        },
      },
      {
        name: "auth_export_markdown",
        description: "Exports identity federation summary to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_export_markdown", args);
        },
      },
      {
        name: "auth_export_csv",
        description: "Exports token leases to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_export_csv", args);
        },
      },
      {
        name: "auth_bulk_purge",
        description: "Atomically purges multiple token leases.",
        parameters: {
          leaseIdsJson: { type: "string", required: true, description: "JSON array of lease IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_bulk_purge", args);
        },
      },
      {
        name: "auth_undo",
        description: "Reverts the last auth lease mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_undo", args);
        },
      },
      {
        name: "auth_redo",
        description: "Re-applies the last undone auth mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_redo", args);
        },
      },
      {
        name: "auth_capture_snapshot",
        description: "Captures a frame-perfect snapshot of auth workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_capture_snapshot", args);
        },
      },
      {
        name: "auth_restore_snapshot",
        description: "Restores auth workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_restore_snapshot", args);
        },
      },
      {
        name: "auth_format_lease",
        description: "Formats a token lease into human-readable string.",
        parameters: {
          providerId: { type: "string", required: true, description: "Provider identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_format_lease", args);
        },
      },
      {
        name: "auth_format_device",
        description: "Formats a pending device authorization into human-readable string.",
        parameters: {
          deviceCode: { type: "string", required: true, description: "Device code" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_format_device", args);
        },
      },
      {
        name: "auth_format_entitlement",
        description: "Formats subscription entitlement quotas into human-readable string.",
        parameters: {
          tier: { type: "string", required: true, description: "Tier ('free', 'pro', 'team', 'enterprise')" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_format_entitlement", args);
        },
      },
      {
        name: "auth_clear_all",
        description: "Clears all stored token leases and pending authorizations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("auth_clear_all", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "auth_initiate_device_flow": {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const clientId = typeof args.clientId === "string" ? args.clientId : "lumi-joy-client";
          const scopes = Array.isArray(args.scopes) ? args.scopes : ["read", "write", "inference"];
          const pending = this.supervisor.initiateAuth(providerId, clientId, scopes);
          return {
            success: true,
            providerId,
            userCode: pending.userCode,
            verificationUri: pending.verificationUri,
            verificationUriComplete: pending.verificationUriComplete,
            expiresIn: pending.expiresIn,
            interval: pending.interval,
          };
        }

        case "auth_complete_device_auth": {
          const deviceCode = String(args.deviceCode || "");
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const tier = (typeof args.tier === "string" ? args.tier : "pro") as SubscriptionTier;
          const lease = this.supervisor.completeDeviceAuth(deviceCode, providerId, tier);
          return { success: true, lease };
        }

        case "auth_verify_token_lease": {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const lease = this.supervisor.getActiveLease(providerId);
          if (!lease) {
            return { success: false, valid: false, error: `No active token lease found for provider '${providerId}'` };
          }
          const valid = lease.expiresAt > Date.now();
          return {
            success: true,
            valid,
            providerId: lease.providerId,
            tier: lease.tier,
            scope: lease.scope,
            expiresAt: lease.expiresAt,
            expiresInSeconds: Math.max(0, Math.floor((lease.expiresAt - Date.now()) / 1000)),
          };
        }

        case "auth_get_lease": {
          const leaseId = String(args.leaseId || "");
          const lease = this.supervisor.getSubstrate().getLease(leaseId);
          if (!lease) return { success: false, error: `Lease '${leaseId}' not found` };
          return { success: true, lease };
        }

        case "auth_list_leases": {
          const leases = this.supervisor.getAllLeases();
          return { success: true, count: leases.length, leases };
        }

        case "auth_revoke_lease": {
          if (typeof args.leaseId === "string") {
            const ok = this.supervisor.getSubstrate().revokeLease(args.leaseId);
            return { success: ok };
          }
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const ok = this.supervisor.revokeAuth(providerId);
          return { success: ok };
        }

        case "auth_refresh_lease": {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const refreshed = this.supervisor.refreshTokenLease(providerId);
          if (!refreshed) return { success: false, error: `No lease to refresh for provider '${providerId}'` };
          return { success: true, refreshed };
        }

        case "auth_check_entitlements": {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const entitlements = this.supervisor.checkEntitlements(providerId);
          return { success: true, providerId, entitlements };
        }

        case "auth_generate_pkce": {
          const seed = typeof args.seed === "number" ? args.seed : undefined;
          const pair = this.supervisor.getFederator().generatePkcePair(seed);
          return { success: true, ...pair };
        }

        case "auth_list_pending": {
          const pending = this.supervisor.getSubstrate().listPendingAuths();
          return { success: true, count: pending.length, pending };
        }

        case "auth_get_pending": {
          const deviceCode = String(args.deviceCode || "");
          const pending = this.supervisor.getSubstrate().getPendingAuth(deviceCode);
          if (!pending) return { success: false, error: `Pending auth '${deviceCode}' not found` };
          return { success: true, pending };
        }

        case "auth_remove_pending": {
          const deviceCode = String(args.deviceCode || "");
          const ok = this.supervisor.getSubstrate().removePendingAuth(deviceCode);
          return { success: ok };
        }

        case "auth_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "auth_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "auth_group_and_sort": {
          const groupBy = (args.groupBy as IdentityFederationGroupBy) || "provider";
          const sortBy = (args.sortBy as IdentityFederationSortBy) || "issuedAt";
          const direction = (args.direction as IdentityFederationSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedLeases(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "auth_search_dsl": {
          const query = String(args.query || "");
          const leases = this.supervisor.queryDsl(query);
          return { success: true, count: leases.length, leases };
        }

        case "auth_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const leases = this.supervisor.getAllLeases();
          const rendered = BroccoliViewRenderer.renderIdentityFederationDashboard({
            activeLeases: metrics.activeLeaseCount,
            pendingAuths: health.pendingAuthorizationsCount,
            expiredLeases: health.expiredLeasesCount,
            healthStatus: health.healthStatus,
            providers: leases.map((l) => l.providerId),
          });
          return { success: true, rendered };
        }

        case "auth_render_lease_card": {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const lease = this.supervisor.getActiveLease(providerId);
          if (!lease) return { success: false, error: `No active lease for provider '${providerId}'` };
          const rendered = BroccoliViewRenderer.renderTokenLeaseCard({
            leaseId: lease.leaseId,
            providerId: lease.providerId,
            tier: lease.tier,
            scope: lease.scope,
            expiresAt: lease.expiresAt,
          });
          return { success: true, rendered };
        }

        case "auth_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "auth_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "auth_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "auth_bulk_purge": {
          const idsJson = String(args.leaseIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "leaseIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "auth_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "auth_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "auth_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "auth_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "auth_format_lease": {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const lease = this.supervisor.getActiveLease(providerId);
          if (!lease) return { success: false, error: `No active lease for provider '${providerId}'` };
          const formatted = this.supervisor.getFederator().formatTokenLease(lease);
          return { success: true, formatted };
        }

        case "auth_format_device": {
          const deviceCode = String(args.deviceCode || "");
          const pending = this.supervisor.getSubstrate().getPendingAuth(deviceCode);
          if (!pending) return { success: false, error: `Pending auth '${deviceCode}' not found` };
          const formatted = this.supervisor.getFederator().formatDeviceAuth(pending);
          return { success: true, formatted };
        }

        case "auth_format_entitlement": {
          const tier = (typeof args.tier === "string" ? args.tier : "pro") as SubscriptionTier;
          const entitlement = this.supervisor.getFederator().getEntitlements(tier);
          const formatted = this.supervisor.getFederator().formatEntitlement(entitlement);
          return { success: true, formatted, entitlement };
        }

        case "auth_clear_all": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
