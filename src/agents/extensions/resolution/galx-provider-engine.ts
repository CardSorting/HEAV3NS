/**
 * galx-provider-engine.ts
 *
 * Deterministic GALX AI Wholesale Compute Clearinghouse Provider Engine:
 * Dynamic model catalog fetching, attribution header synthesis, model ID normalization,
 * wholesale pricing calculations, prompt cache discount pass-through, request payload formatting,
 * stream delta decoding, and transport substrate delegation (Phase 136 / ADR-112).
 */

import {
  DEFAULT_GALX_BASE_URL,
  DEFAULT_GALX_CLEARINGHOUSE_URL,
  DEFAULT_GALX_MODEL_ID,
  DEFAULT_GALX_CLIENT_TAG,
  DEFAULT_GALX_CLIENT_ID,
  GALX_DEFAULT_MODELS,
  type GalxAttributionHeaders,
  type GalxModelSpec,
} from "../../../core/contracts/galx.contracts.js";
import { GalxTransportClient, galxTransportClient } from "../../../integrations/galx/GalxTransportClient.js";
import type { ModelSpecs } from "./model-catalog.js";

export class GalxProviderEngine {
  private readonly defaultBaseUrl: string;
  private readonly transportClient: GalxTransportClient;
  private inMemoryModelCache: Map<string, ModelSpecs> = new Map();
  private cacheExpiry = 0;

  constructor(defaultBaseUrl = DEFAULT_GALX_BASE_URL, transportClient?: GalxTransportClient) {
    this.defaultBaseUrl = defaultBaseUrl;
    this.transportClient = transportClient ?? galxTransportClient;
  }

  public getTransportClient(): GalxTransportClient {
    return this.transportClient;
  }

  public getDefaultBaseUrl(): string {
    return this.defaultBaseUrl;
  }

  /**
   * Builds official GALX AI attribution headers for enterprise clearinghouse tracking.
   */
  public buildAttributionHeaders(): GalxAttributionHeaders {
    return {
      "X-GALX-Client": DEFAULT_GALX_CLIENT_TAG,
      "X-GALX-Client-ID": DEFAULT_GALX_CLIENT_ID,
      "X-OpenRouter-Title": "LUMI",
      "HTTP-Referer": "https://github.com/CardSorting/LUMI-JOY",
    };
  }

  /**
   * Normalizes a model name or alias to canonical GALX model ID.
   */
  public normalizeModelId(modelId: string): string {
    if (!modelId || typeof modelId !== "string") return DEFAULT_GALX_MODEL_ID;
    const trimmed = modelId.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith("galx/")) {
      return lower.slice(5);
    }
    if (lower === "galx" || lower === "galx-sol" || lower === "sol") {
      return "gpt-5.6-sol";
    }
    if (lower === "galx-terra" || lower === "terra") {
      return "gpt-5.6-terra";
    }
    if (lower === "galx-luna" || lower === "luna") {
      return "gpt-5.6-luna";
    }
    return trimmed;
  }

  /**
   * Returns fallback / default curated GALX ModelSpecs.
   */
  public getFallbackModelSpecs(): ModelSpecs[] {
    return Object.values(GALX_DEFAULT_MODELS).map((m) => ({
      modelName: m.modelName,
      provider: "galx",
      contextWindowTokens: m.contextWindowTokens,
      maxOutputTokens: m.maxOutputTokens,
      inputPricePer1M: m.inputPricePer1M,
      outputPricePer1M: m.outputPricePer1M,
      supportsVision: m.supportsVision,
      supportsReasoning: m.supportsReasoning,
      estimatedLatencyMs: m.estimatedLatencyMs,
      description: m.description,
    }));
  }

  /**
   * Dynamically fetches live models from GALX AI endpoint.
   */
  public async fetchGalxModels(
    apiToken?: string,
    baseUrl?: string,
    forceRefresh = false
  ): Promise<ModelSpecs[]> {
    const now = Date.now();
    if (!forceRefresh && this.inMemoryModelCache.size > 0 && now < this.cacheExpiry) {
      return Array.from(this.inMemoryModelCache.values());
    }

    const effectiveBaseUrl = (baseUrl || this.defaultBaseUrl).replace(/\/$/, "");
    const token = apiToken || process.env.GALX_API_KEY || process.env.GALX_KEY;

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...this.buildAttributionHeaders(),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${effectiveBaseUrl}/models`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id: string; name?: string; context_length?: number; pricing?: { prompt?: string | number; completion?: string | number } }> };
        const dataList = Array.isArray(json.data) ? json.data : [];
        if (dataList.length > 0) {
          const fetchedSpecs: ModelSpecs[] = [];
          for (const item of dataList) {
            const id = item.id;
            if (!id || typeof id !== "string") continue;
            const curated = GALX_DEFAULT_MODELS[id];
            const spec: ModelSpecs = {
              modelName: id,
              provider: "galx",
              contextWindowTokens: curated?.contextWindowTokens ?? (Number(item.context_length) || 900_000),
              maxOutputTokens: curated?.maxOutputTokens ?? 128_000,
              inputPricePer1M: curated?.inputPricePer1M ?? (typeof item.pricing?.prompt === "number" ? item.pricing.prompt * 1_000_000 : 3.75),
              outputPricePer1M: curated?.outputPricePer1M ?? (typeof item.pricing?.completion === "number" ? item.pricing.completion * 1_000_000 : 15.0),
              supportsVision: curated?.supportsVision ?? true,
              supportsReasoning: curated?.supportsReasoning ?? (id.includes("sol") || id.includes("terra")),
              estimatedLatencyMs: curated?.estimatedLatencyMs ?? 30,
              description: curated?.description ?? `GALX Wholesale Model: ${item.name || id}`,
            };
            this.inMemoryModelCache.set(id, spec);
            fetchedSpecs.push(spec);
          }

          // Ensure curated defaults are registered
          for (const fallback of this.getFallbackModelSpecs()) {
            if (!this.inMemoryModelCache.has(fallback.modelName)) {
              this.inMemoryModelCache.set(fallback.modelName, fallback);
              fetchedSpecs.push(fallback);
            }
          }

          this.cacheExpiry = now + 300_000; // 5 minutes TTL
          return fetchedSpecs;
        }
      }
    } catch {
      // Fall through to fallback models
    }

    const fallbacks = this.getFallbackModelSpecs();
    for (const fb of fallbacks) {
      this.inMemoryModelCache.set(fb.modelName, fb);
    }
    this.cacheExpiry = now + 300_000;
    return fallbacks;
  }

  /**
   * Prepares OpenAI-compatible chat completion payload for GALX.
   */
  public prepareRequestPayload(params: {
    modelId: string;
    messages: Array<{ role: string; content: string | null; [key: string]: unknown }>;
    maxTokens?: number;
    tools?: Array<{ type: "function"; function: { name: string; description?: string; parameters?: unknown } }>;
    reasoningEffort?: string;
  }): Record<string, unknown> {
    const canonicalModelId = this.normalizeModelId(params.modelId);
    const payload: Record<string, unknown> = {
      model: canonicalModelId,
      messages: params.messages,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (params.maxTokens !== undefined) {
      payload.max_tokens = params.maxTokens;
    }

    if (params.tools && params.tools.length > 0) {
      payload.tools = params.tools;
    }

    if (params.reasoningEffort) {
      payload.reasoning_effort = params.reasoningEffort;
    }

    return payload;
  }

  /**
   * Calculates sub-cent wholesale turn cost accounting for prompt caching discount pass-through.
   */
  public calculateTurnCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens = 0
  ): number {
    const canonical = this.normalizeModelId(modelName);
    const spec = GALX_DEFAULT_MODELS[canonical] || {
      inputPricePer1M: 3.75,
      outputPricePer1M: 15.0,
      cacheReadsPricePer1M: 1.25,
    };

    const uncachedInput = Math.max(0, inputTokens - cachedTokens);
    const inputCost = (uncachedInput / 1_000_000) * spec.inputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * spec.outputPricePer1M;
    const cacheCost = spec.cacheReadsPricePer1M !== undefined ? (cachedTokens / 1_000_000) * spec.cacheReadsPricePer1M : 0;

    return Number((inputCost + outputCost + cacheCost).toFixed(6));
  }
}
