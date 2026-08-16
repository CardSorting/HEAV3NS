/**
 * Model Tool Suite for Native Nous Portal Provider Operations
 * Subsystem: Target #73 / ADR-116
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { NousPortalSupervisor } from "../../../agents/extensions/nous_portal/nous-portal-supervisor.js";

export class NousPortalToolSuite {
  private readonly supervisor: NousPortalSupervisor;

  constructor(supervisor: NousPortalSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "nous_portal_status",
        description: "Inspect active Nous Portal authentication status, subscription plan, credits, and tool-pool coverage.",
        parameters: {},
        execute: async () => {
          const account = this.supervisor.getAccount();
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            account,
            metrics,
          };
        },
      },
      {
        name: "nous_portal_start_login",
        description: "Initiate OAuth device-code login flow for the Nous Portal.",
        parameters: {
          portalUrl: {
            type: "string",
            description: "Optional custom Nous Portal URL (defaults to https://portal.nousresearch.com).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const portalUrl = typeof args.portalUrl === "string" ? args.portalUrl : undefined;
          const session = this.supervisor.startDeviceLogin(portalUrl);
          return {
            success: true,
            message: `Please open ${session.verificationUriComplete || session.verificationUri} and enter code: ${session.userCode}`,
            session,
          };
        },
      },
      {
        name: "nous_portal_complete_login",
        description: "Exchange the device code for Nous Portal JWT session credentials.",
        parameters: {
          deviceCode: {
            type: "string",
            description: "The device code returned by nous_portal_start_login.",
            required: true,
          },
          email: {
            type: "string",
            description: "Optional email associated with the account.",
            required: false,
          },
          plan: {
            type: "string",
            description: "Optional plan name (e.g. Pro Tier 3).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const deviceCode = String(args.deviceCode || "");
          const email = typeof args.email === "string" ? args.email : undefined;
          const plan = typeof args.plan === "string" ? args.plan : undefined;
          const res = this.supervisor.completeDeviceLogin(deviceCode, {
            email,
            plan,
          });
          return res;
        },
      },
      {
        name: "nous_portal_list_models",
        description: "List all models available via the Nous Portal provider (cached or locally registered).",
        parameters: {
          forceFresh: {
            type: "boolean",
            description: "If true, bypasses cache and queries the live Nous inference API /models endpoint.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (args.forceFresh === true) {
            const fetchRes = await this.supervisor.fetchRemoteModels({ forceFresh: true });
            return fetchRes;
          }
          const models = this.supervisor.listModels();
          return {
            success: true,
            count: models.length,
            models,
            cached: true,
          };
        },
      },
      {
        name: "nous_portal_fetch_models",
        description: "Dynamically fetch the live model catalog directly from the Nous Portal inference API endpoint.",
        parameters: {
          inferenceBaseUrl: {
            type: "string",
            description: "Optional custom inference base URL (defaults to https://inference-api.nousresearch.com/v1).",
            required: false,
          },
          apiKey: {
            type: "string",
            description: "Optional API key or JWT token for authorization.",
            required: false,
          },
          timeoutMs: {
            type: "number",
            description: "Optional request timeout in milliseconds.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const inferenceBaseUrl = typeof args.inferenceBaseUrl === "string" ? args.inferenceBaseUrl : undefined;
          const apiKey = typeof args.apiKey === "string" ? args.apiKey : undefined;
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
          const res = await this.supervisor.fetchRemoteModels({
            inferenceBaseUrl,
            apiKey,
            timeoutMs,
            forceFresh: true,
          });
          return res;
        },
      },
      {
        name: "nous_portal_check_tool_pool",
        description: "Check if a specific tool category is covered under the free Nous tool pool entitlement.",
        parameters: {
          category: {
            type: "string",
            description: "The category to check (e.g. firecrawl, fal, fal-video, openai-audio, browser-use, modal).",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const category = String(args.category || "");
          const res = this.supervisor.checkToolPool(category);
          return {
            success: true,
            category,
            ...res,
          };
        },
      },
    ];
  }
}
