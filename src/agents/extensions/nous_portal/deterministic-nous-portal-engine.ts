/**
 * Deterministic Nous Portal Provider Bridge, Product Attribution & JWT / Device Code Engine
 * Reference: hermes-agent-main/agent/portal_tags.py, hermes_cli/nous_account.py, hermes_cli/auth.py
 * Subsystem: Target #73 / ADR-116
 */

import {
  DEFAULT_NOUS_INFERENCE_URL,
  DEFAULT_NOUS_PORTAL_URL,
} from "../../../core/contracts/nous-portal.contracts.js";
import type {
  NousPortalAccountInfo,
  NousPortalCompletionResponse,
  NousPortalDeviceCodeSession,
  NousPortalModelSpec,
  NousPortalRequestPayload,
  NousPortalTokenResponse,
} from "../../../core/contracts/nous-portal.contracts.js";
import { BroccoliNousPortalSubstrate } from "../../../sessions/extensions/nous_portal/broccoli-nous-portal-substrate.js";

export class DeterministicNousPortalEngine {
  private readonly substrate: BroccoliNousPortalSubstrate;
  private readonly clientVersion: string = "0.1.0";
  private readonly productName: string = "lumi-joy";

  constructor(substrate: BroccoliNousPortalSubstrate) {
    this.substrate = substrate;
  }

  /**
   * Generates canonical Nous Portal product-attribution tags.
   * Format: ["product=lumi-joy", "client=lumi-client-v<version>", "conversation=<sessionId>"]
   */
  generateAttributionTags(sessionId?: string): string[] {
    const tags = [
      `product=${this.productName}`,
      `client=lumi-client-v${this.clientVersion}`,
    ];
    if (sessionId && sessionId.trim().length > 0) {
      tags.push(`conversation=${sessionId.trim()}`);
    }
    return tags;
  }

  /**
   * Initiates a deterministic device-code login session for the Nous Portal.
   */
  initiateDeviceLogin(options: {
    portalUrl?: string;
    clientId?: string;
    scope?: string;
  } = {}): NousPortalDeviceCodeSession {
    const portalUrl = options.portalUrl || DEFAULT_NOUS_PORTAL_URL;
    const now = Date.now();
    const entropy = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userCode = `NOUS-${entropy.slice(0, 4)}-${entropy.slice(4)}`;
    const deviceCode = `dcode_${now}_${Math.random().toString(36).substring(2, 12)}`;

    const session: NousPortalDeviceCodeSession = {
      deviceCode,
      userCode,
      verificationUri: `${portalUrl}/device`,
      verificationUriComplete: `${portalUrl}/device?user_code=${encodeURIComponent(userCode)}`,
      expiresIn: 900,
      interval: 5,
      createdAtMs: now,
    };

    this.substrate.setDeviceSession(session);
    return session;
  }

  /**
   * Simulates/Resolves exchange of device code for JWT bearer credentials.
   */
  exchangeDeviceToken(
    deviceCode: string,
    options: {
      userId?: string;
      email?: string;
      orgId?: string;
      plan?: string;
      creditsRemaining?: number;
    } = {}
  ): { success: boolean; tokens?: NousPortalTokenResponse; account?: NousPortalAccountInfo; error?: string } {
    const activeSession = this.substrate.getDeviceSession();
    if (!activeSession || activeSession.deviceCode !== deviceCode) {
      return { success: false, error: "invalid_or_expired_device_code" };
    }

    const now = Date.now();
    if (now - activeSession.createdAtMs > activeSession.expiresIn * 1000) {
      this.substrate.setDeviceSession(null);
      return { success: false, error: "device_code_expired" };
    }

    const accessToken = `nous_jwt_${now}_${Math.random().toString(36).substring(2, 16)}`;
    const refreshToken = `nous_refresh_${now}_${Math.random().toString(36).substring(2, 16)}`;

    const tokens: NousPortalTokenResponse = {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 86400,
      scope: "inference:invoke billing:manage",
    };

    const account: NousPortalAccountInfo = {
      loggedIn: true,
      source: "jwt",
      fresh: true,
      userId: options.userId || "user_nous_alpha_01",
      email: options.email || "developer@nousresearch.com",
      orgId: options.orgId || "org_nous_community",
      orgSlug: "nous-research",
      orgName: "Nous Research Community",
      clientId: "lumi-cli",
      portalBaseUrl: DEFAULT_NOUS_PORTAL_URL,
      inferenceBaseUrl: DEFAULT_NOUS_INFERENCE_URL,
      inferenceCredentialPresent: true,
      credentialSource: "device_code",
      expiresAt: new Date(now + 86400 * 1000).toISOString(),
      subscription: {
        plan: options.plan || "Pro Tier 3",
        tier: 3,
        monthlyCharge: 20.0,
        monthlyCredits: 50.0,
        creditsRemaining: options.creditsRemaining !== undefined ? options.creditsRemaining : 48.5,
        rolloverCredits: 12.0,
      },
      paidServiceAccess: true,
      toolAccess: {
        enabled: true,
        coverage: {
          firecrawl: true,
          fal: true,
          "fal-video": false,
          "openai-audio": true,
          "browser-use": true,
          modal: true,
        },
      },
    };

    this.substrate.setAccountInfo(account);
    this.substrate.setDeviceSession(null);

    return { success: true, tokens, account };
  }

  /**
   * Deterministic mock / local provider completion execution with full product attribution.
   */
  async executeChatCompletion(
    payload: NousPortalRequestPayload
  ): Promise<NousPortalCompletionResponse> {
    const t0 = performance.now();
    const model = this.substrate.getModel(payload.model) || {
      id: payload.model,
      name: payload.model,
      contextLength: 131_072,
      maxOutputTokens: 4_096,
      pricing: { promptPerMillion: 0.7, completionPerMillion: 1.4 },
      supportsVision: false,
      supportsReasoning: true,
      description: "Custom Nous Model",
    };

    const promptTokens = Math.max(16, payload.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0));
    const completionTokens = Math.max(12, Math.min(payload.maxTokens || 512, 128));
    const totalTokens = promptTokens + completionTokens;

    const estimatedCostUsd = Number(
      (
        (promptTokens / 1_000_000) * model.pricing.promptPerMillion +
        (completionTokens / 1_000_000) * model.pricing.completionPerMillion
      ).toFixed(6)
    );

    const tags = [
      ...this.generateAttributionTags(payload.sessionId),
      ...(payload.extraBody?.tags || []),
    ];
    const uniqueTags = Array.from(new Set(tags));

    const responseContent = payload.messages[payload.messages.length - 1]?.content.includes("hello")
      ? "Greetings from Hermes on the native Nous Portal! All agent toolchains and reasoning passes are synchronized."
      : `[Nous Research: ${model.name}] Deterministic inference response successfully processed with attribution tags: ${uniqueTags.join(", ")}.`;

    this.substrate.recordInvocation(totalTokens, estimatedCostUsd);

    const account = this.substrate.getAccountInfo();
    if (account.loggedIn && account.subscription && account.subscription.creditsRemaining !== undefined) {
      account.subscription.creditsRemaining = Math.max(0, Number((account.subscription.creditsRemaining - estimatedCostUsd).toFixed(6)));
      this.substrate.setAccountInfo(account);
    }

    const latencyMs = performance.now() - t0;

    return {
      id: `nous_cmpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      model: model.id,
      content: responseContent,
      finishReason: "stop",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
      attributedTags: uniqueTags,
      latencyMs,
    };
  }

  /**
   * Fast-path model catalog query.
   */
  getAvailableModels(): NousPortalModelSpec[] {
    return this.substrate.getModels();
  }

  /**
   * Dynamically fetches live models from the Nous Portal inference API endpoint.
   * Reference: hermes_cli/auth.py fetch_nous_models()
   */
  async fetchDynamicModels(options: {
    inferenceBaseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
    forceFresh?: boolean;
    fetchFn?: (input: string | URL | any, init?: any) => Promise<Response>;
  } = {}): Promise<{
    success: boolean;
    count: number;
    models: NousPortalModelSpec[];
    error?: string;
    cached: boolean;
    fetchedAtMs: number;
  }> {
    if (!options.forceFresh && this.substrate.isModelsCacheFresh()) {
      const cached = this.substrate.getModels();
      return {
        success: true,
        count: cached.length,
        models: cached,
        cached: true,
        fetchedAtMs: this.substrate.getMetrics().lastFetchedAtMs,
      };
    }

    const account = this.substrate.getAccountInfo();
    const inferenceBaseUrl = (options.inferenceBaseUrl || account.inferenceBaseUrl || DEFAULT_NOUS_INFERENCE_URL).replace(/\/+$/, "");
    const apiKey = options.apiKey || (account.source === "jwt" ? "jwt_active_session" : undefined) || process.env.NOUS_API_KEY || process.env.HERMES_PORTAL_TOKEN || "";
    const fetchFunc = options.fetchFn || globalThis.fetch;
    const timeoutMs = options.timeoutMs || 15_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (!fetchFunc) {
        throw new Error("No fetch implementation available for dynamic model fetching.");
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetchFunc(`${inferenceBaseUrl}/models`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Failed to fetch models from ${inferenceBaseUrl}/models: HTTP ${res.status} ${errorText}`);
      }

      const payload = (await res.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          context_length?: number;
          max_output_tokens?: number;
          pricing?: { prompt?: string | number; completion?: string | number };
          architecture?: { modality?: string; instruct_type?: string };
          description?: string;
        }>;
      };

      const rawItems = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? (payload as any) : [];
      if (rawItems.length === 0) {
        const existing = this.substrate.getModels();
        return {
          success: true,
          count: existing.length,
          models: existing,
          cached: true,
          fetchedAtMs: Date.now(),
        };
      }

      const parsedModels: NousPortalModelSpec[] = rawItems
        .filter((item: any) => item && typeof item.id === "string" && item.id.trim().length > 0)
        .map((item: any) => {
          const id = item.id.trim();
          const name = item.name || id;
          const contextLength = Number(item.context_length) || 131_072;
          const maxOutputTokens = Number(item.max_output_tokens) || 8_192;
          const promptPrice = item.pricing?.prompt != null ? Number(item.pricing.prompt) : 0.7;
          const completionPrice = item.pricing?.completion != null ? Number(item.pricing.completion) : 1.4;
          const isVision = item.architecture?.modality?.includes("vision") || id.includes("vision");
          const isReasoning = item.architecture?.instruct_type === "reasoning" || id.includes("deephermes") || id.includes("reason") || id.includes("405b");

          return {
            id,
            name,
            contextLength,
            maxOutputTokens,
            pricing: {
              promptPerMillion: promptPrice,
              completionPerMillion: completionPrice,
            },
            supportsVision: isVision,
            supportsReasoning: isReasoning,
            description: item.description || `Nous Portal Live Dynamic Model: ${name}`,
          };
        });

      this.substrate.setModels(parsedModels);

      return {
        success: true,
        count: parsedModels.length,
        models: parsedModels,
        cached: false,
        fetchedAtMs: Date.now(),
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const fallbackModels = this.substrate.getModels();
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        count: fallbackModels.length,
        models: fallbackModels,
        error: message,
        cached: true,
        fetchedAtMs: this.substrate.getMetrics().lastFetchedAtMs,
      };
    }
  }

  /**
   * Fast-path account entitlement check.
   */
  checkToolPoolEntitlement(category: string): { eligible: boolean; reason: string } {
    const account = this.substrate.getAccountInfo();
    if (!account.loggedIn) {
      return { eligible: false, reason: "Nous Portal account is not logged in." };
    }
    if (!account.toolAccess || !account.toolAccess.enabled) {
      return { eligible: false, reason: "Free tool-pool is not enabled for this tier." };
    }
    const covered = (account.toolAccess.coverage as Record<string, boolean>)[category];
    if (covered === false) {
      return { eligible: false, reason: `Category '${category}' is excluded from the free tool pool (e.g. FAL video gen).` };
    }
    if (covered === true) {
      return { eligible: true, reason: `Category '${category}' is covered under active Nous Portal subscription tool pool.` };
    }
    return { eligible: false, reason: `Category '${category}' is not recognized in the Nous tool pool matrix.` };
  }
}
