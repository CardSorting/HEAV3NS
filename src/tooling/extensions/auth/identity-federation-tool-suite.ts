/**
 * identity-federation-tool-suite.ts
 *
 * Model tool suite exposing OAuth2 PKCE device flows, token lease verification, and entitlement checks (Phase 98 / ADR-052).
 */

import type { AuthProviderId } from "../../../core/contracts/identity-federation.contracts.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { IdentityFederationSupervisor } from "../../../agents/extensions/auth/identity-federation-supervisor.js";

export class IdentityFederationToolSuite {
  private supervisor: IdentityFederationSupervisor;

  constructor(supervisor: IdentityFederationSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "auth_initiate_device_flow",
        description: "Initiates an OAuth2 PKCE device authorization flow for an AI model provider.",
        parameters: {
          providerId: {
            type: "string",
            description: "Provider identifier ('nous', 'openai', 'anthropic', 'copilot', or 'custom')",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const pending = this.supervisor.initiateAuth(providerId);

          return {
            success: true,
            providerId,
            userCode: pending.userCode,
            verificationUri: pending.verificationUri,
            verificationUriComplete: pending.verificationUriComplete,
            expiresIn: pending.expiresIn,
            interval: pending.interval,
          };
        },
      },
      {
        name: "auth_verify_token_lease",
        description: "Verifies the validity, remaining lifetime, and scopes of an active provider token lease.",
        parameters: {
          providerId: {
            type: "string",
            description: "Provider identifier to inspect ('nous', 'openai', 'anthropic', 'copilot', 'custom')",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const lease = this.supervisor.getActiveLease(providerId);

          if (!lease) {
            return {
              success: true,
              providerId,
              authenticated: false,
              message: `No active authentication token lease found for '${providerId}'.`,
            };
          }

          const now = Date.now();
          const valid = lease.expiresAt > now;
          const remainingSeconds = Math.max(0, Math.floor((lease.expiresAt - now) / 1000));

          return {
            success: true,
            providerId,
            authenticated: valid,
            leaseId: lease.leaseId,
            tier: lease.tier,
            scope: lease.scope,
            expiresInSeconds: remainingSeconds,
          };
        },
      },
      {
        name: "auth_check_entitlement",
        description: "Queries quota limits and feature entitlements for a provider based on its subscription tier.",
        parameters: {
          providerId: {
            type: "string",
            description: "Provider identifier to check entitlements for ('nous', 'openai', 'anthropic', 'copilot', 'custom')",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const providerId = (typeof args.providerId === "string" ? args.providerId : "nous") as AuthProviderId;
          const entitlement = this.supervisor.checkEntitlements(providerId);

          return {
            success: true,
            providerId,
            tier: entitlement.tier,
            maxTokensPerTurn: entitlement.maxTokensPerTurn,
            maxContextBudget: entitlement.maxContextBudget,
            parallelToolsAllowed: entitlement.parallelToolsAllowed,
            customFineTunesAllowed: entitlement.customFineTunesAllowed,
            priorityInference: entitlement.priorityInference,
          };
        },
      },
    ];
  }
}
