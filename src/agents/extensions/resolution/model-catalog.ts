import { DynamicModelCache } from "./dynamic-model-cache.js";
import { DeterministicLocalEndpointEngine } from "../../../tooling/extensions/endpoints/deterministic-local-endpoint-engine.js";
import type { LocalProviderKind } from "../../../core/contracts/local-endpoints.contracts.js";
import { OpenRouterProviderEngine } from "./openrouter-provider-engine.js";
import { GalxProviderEngine } from "./galx-provider-engine.js";
import {
  filterOpenRouterModelIds,
  filterOpenRouterModelSpecs,
  isOpenRouterFreeModel,
} from "../../../core/contracts/openrouter.contracts.js";

export interface ModelSpecs {
  modelName: string;
  provider: "openrouter" | "openai-codex" | "galx" | "custom";
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  supportsVision: boolean;
  supportsReasoning?: boolean;
  estimatedLatencyMs?: number;
  description?: string;
  isLocal?: boolean;
}

interface OpenRouterModelApiResponse {
  id: string;
  name?: string;
  context_length?: number;
  top_provider?: { max_completion_tokens?: number };
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string };
}

/**
 * ModelCatalog & Context Pricing Registry.
 * Absorbed from packages/catalog (Pass 16 / ADR-012) & upgraded for Local On-Prem (Pass 105 / ADR-052).
 *
 * Maintains model spec definitions, dynamic OpenRouter, GALX AI, Nous Research & local engine auto-discovery (Ollama, llama.cpp, LM Studio, vLLM),
 * context window limits, and turn token cost calculations with sub-cent honesty.
 */
export class ModelCatalog {
  private readonly catalog: Map<string, ModelSpecs> = new Map();
  private readonly dynamicCache: DynamicModelCache = new DynamicModelCache();
  private readonly localEngine: DeterministicLocalEndpointEngine;
  private readonly openRouterEngine: OpenRouterProviderEngine;
  private readonly galxEngine: GalxProviderEngine;

  constructor(
    localEngine?: DeterministicLocalEndpointEngine,
    openRouterEngine?: OpenRouterProviderEngine,
    galxEngine?: GalxProviderEngine
  ) {
    this.localEngine = localEngine ?? new DeterministicLocalEndpointEngine();
    this.openRouterEngine = openRouterEngine ?? new OpenRouterProviderEngine();
    this.galxEngine = galxEngine ?? new GalxProviderEngine();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // 1. OpenAI Codex OAuth Models (ChatGPT Subscription)
    this.registerModel({
      modelName: "gpt-5.6-sol",
      provider: "openai-codex",
      contextWindowTokens: 372_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.6 Sol: Flagship coding model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.6-sol-pro",
      provider: "openai-codex",
      contextWindowTokens: 372_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.6 Sol Pro: High-effort reasoning flagship via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.6-terra",
      provider: "openai-codex",
      contextWindowTokens: 372_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.6 Terra: Balanced flagship coding model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.6-terra-pro",
      provider: "openai-codex",
      contextWindowTokens: 372_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.6 Terra Pro: High-effort balanced model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.6-luna",
      provider: "openai-codex",
      contextWindowTokens: 372_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.6 Luna: High-velocity flagship coding model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.6-luna-pro",
      provider: "openai-codex",
      contextWindowTokens: 372_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.6 Luna Pro: High-effort high-velocity model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.5",
      provider: "openai-codex",
      contextWindowTokens: 272_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.5 Codex: OpenAI flagship coding model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.4",
      provider: "openai-codex",
      contextWindowTokens: 272_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.4 Codex: High performance model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.3-codex",
      provider: "openai-codex",
      contextWindowTokens: 272_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.3 Codex: Frontier agentic coding model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "gpt-5.2-codex",
      provider: "openai-codex",
      contextWindowTokens: 400_000,
      maxOutputTokens: 128_000,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "GPT-5.2 Codex: OpenAI flagship coding model via ChatGPT subscription",
    });

    this.registerModel({
      modelName: "o3-mini",
      provider: "openai-codex",
      contextWindowTokens: 200_000,
      maxOutputTokens: 100_000,
      inputPricePer1M: 1.1,
      outputPricePer1M: 4.4,
      supportsVision: false,
      supportsReasoning: true,
      description: "OpenAI specialized reasoning model with deep math and coding strength",
    });

    this.registerModel({
      modelName: "o1",
      provider: "openai-codex",
      contextWindowTokens: 200_000,
      maxOutputTokens: 100_000,
      inputPricePer1M: 15.0,
      outputPricePer1M: 60.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "OpenAI full deliberation reasoning engine",
    });

    this.registerModel({
      modelName: "gpt-4o",
      provider: "openai-codex",
      contextWindowTokens: 128_000,
      maxOutputTokens: 16_384,
      inputPricePer1M: 2.5,
      outputPricePer1M: 10.0,
      supportsVision: true,
      supportsReasoning: false,
      description: "Standard OpenAI GPT-4o Model",
    });

    // 2. GALX Wholesale Compute Clearinghouse Models
    for (const galxSpec of this.galxEngine.getFallbackModelSpecs()) {
      this.registerModel(galxSpec);
    }

    // 3. OpenRouter Default Models
    const defaultOpenRouterModels = this.openRouterEngine.getFallbackModelSpecs();
    for (const m of defaultOpenRouterModels) {
      this.registerModel(m);
    }
  }

  registerModel(specs: ModelSpecs): void {
    const key = `${specs.provider.toLowerCase()}::${specs.modelName}`;
    this.catalog.set(key, specs);
  }

  getModelInfo(modelName: string, provider?: string): ModelSpecs {
    if (provider) {
      const key = `${provider.toLowerCase()}::${modelName}`;
      const exact = this.catalog.get(key);
      if (exact) return exact;
    }

    // Try exact compound key
    const direct = this.catalog.get(modelName.toLowerCase());
    if (direct) return direct;

    // Try finding by modelName across registered specs
    for (const [key, spec] of this.catalog.entries()) {
      if (spec.modelName === modelName || key.endsWith(`::${modelName}`)) {
        return spec;
      }
    }

    const isOpenRouter =
      modelName.startsWith("openrouter/") ||
      modelName.includes("/") ||
      this.openRouterEngine.isClaude1mModel(modelName);

    const isGalx =
      modelName.startsWith("galx/") ||
      provider?.toLowerCase() === "galx" ||
      modelName === "gpt-5.6-sol" ||
      modelName === "gpt-5.6-terra" ||
      modelName === "gpt-5.6-luna";

    if (isGalx) {
      const canonical = this.galxEngine.normalizeModelId(modelName);
      const spec = this.catalog.get(`galx::${canonical}`) || Array.from(this.catalog.values()).find(m => m.provider === "galx" && m.modelName === canonical);
      if (spec) return spec;
    }

    if (isOpenRouter) {
      const { normalizedId, is1m } = this.openRouterEngine.normalizeModelId(modelName);
      const baseSpec = this.catalog.get(`openrouter::${normalizedId}`) || Array.from(this.catalog.values()).find(m => m.modelName === normalizedId);
      if (baseSpec && is1m) {
        const variantSpec: ModelSpecs = {
          ...baseSpec,
          modelName,
          contextWindowTokens: 1_000_000,
          description: `${baseSpec.description} (1M Extended Context)`,
        };
        this.registerModel(variantSpec);
        return variantSpec;
      }
    }

    return {
      modelName,
      provider: isOpenRouter ? "openrouter" : "custom",
      contextWindowTokens: 128_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 1.0,
      outputPricePer1M: 3.0,
      supportsVision: false,
      estimatedLatencyMs: 45,
      description: isOpenRouter ? "Dynamic OpenRouter Model" : "Custom Proxy Model",
    };
  }

  /**
   * Dynamically fetches live available models from OpenRouter API (https://openrouter.ai/api/v1/models).
   * Automatically parses rich metadata, calculates per-1M token pricing, synthesizes 1M context variants,
   * and caches in dynamic cache. Optionally filters to :free models only.
   */
  async fetchOpenRouterModels(apiToken?: string, forceRefresh = false, freeOnly = false): Promise<ModelSpecs[]> {
    const cached = !forceRefresh ? this.dynamicCache.getCachedModels("openrouter") : null;
    if (cached && cached.length > 0) {
      return freeOnly ? filterOpenRouterModelSpecs(cached, "openrouter") : cached;
    }

    try {
      const models = await this.openRouterEngine.fetchOpenRouterModels(apiToken, undefined, forceRefresh, false);
      for (const m of models) {
        this.registerModel(m);
      }
      if (models.length > 0) {
        this.dynamicCache.setCachedModels("openrouter", models);
      }
      return freeOnly ? filterOpenRouterModelSpecs(models, "openrouter") : models;
    } catch {
      const fallback = this.getFallbackOpenRouterModels();
      return freeOnly ? filterOpenRouterModelSpecs(fallback, "openrouter") : fallback;
    }
  }

  /**
   * Dynamically fetches live models from OpenRouter and returns only the free models available in real-time.
   */
  async fetchOpenRouterFreeModels(apiToken?: string, forceRefresh = false): Promise<ModelSpecs[]> {
    return this.fetchOpenRouterModels(apiToken, forceRefresh, true);
  }

  /**
   * Dynamically fetches live available models from OpenAI Codex API / models endpoint.
   * Auto-discovers new model variants (e.g. gpt-5.6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.7-*, etc.),
   * calculates context windows and reasoning capabilities, and caches them in DynamicModelCache.
   */
  async fetchCodexModels(
    authHeaders?: Record<string, string>,
    forceRefresh = false,
    baseUrl = "https://api.openai.com/v1"
  ): Promise<ModelSpecs[]> {
    const cacheKey = "codex:models";
    const cached = !forceRefresh ? this.dynamicCache.getCachedModels(cacheKey) : null;
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      const headers: Record<string, string> = { ...authHeaders };
      if (!headers.Authorization && process.env.OPENAI_API_KEY) {
        headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
      }

      const res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id: string; created?: number; owned_by?: string }> };
        if (json.data && Array.isArray(json.data)) {
          const discovered: ModelSpecs[] = [];
          for (const item of json.data) {
            const id = item.id;
            const lower = id.toLowerCase();
            // Filter relevant OpenAI / Codex models
            if (
              lower.includes("gpt-5") ||
              lower.includes("gpt-6") ||
              lower.includes("terra") ||
              lower.includes("luna") ||
              lower.includes("sol") ||
              lower === "gpt-4o" ||
              lower.startsWith("gpt-4o-") ||
              lower.startsWith("o1") ||
              lower.startsWith("o3")
            ) {
              const isLarge = lower.includes("gpt-5") || lower.includes("gpt-6") || lower.includes("terra") || lower.includes("luna") || lower.includes("sol") || lower === "gpt-4o";
              const isReasoning = lower.includes("terra") || lower.includes("sol") || lower.startsWith("o1") || lower.startsWith("o3");
              const maxOut = lower.includes("terra") || lower.startsWith("o1") ? 16_384 : 8_192;
              
              let desc = "OpenAI Codex AI Model";
              if (lower.includes("terra")) desc = "Codex OAuth Flagship Reasoning Engine (Default)";
              else if (lower.includes("luna")) desc = "Codex OAuth High-Velocity Model";
              else if (lower.includes("sol")) desc = "Codex OAuth Balanced Model";
              else if (lower.includes("4o")) desc = "Standard OpenAI GPT-4o Model";
              else if (lower.startsWith("o1")) desc = "OpenAI o1 Reasoning Model";
              else if (lower.startsWith("o3")) desc = "OpenAI o3 High-Throughput Reasoning Model";

              const spec: ModelSpecs = {
                modelName: id,
                provider: "openai-codex",
                contextWindowTokens: isLarge ? 900_000 : 128_000,
                maxOutputTokens: maxOut,
                inputPricePer1M: 0.0,
                outputPricePer1M: 0.0,
                supportsVision: true,
                supportsReasoning: isReasoning,
                description: desc,
              };
              this.registerModel(spec);
              discovered.push(spec);
            }
          }

          if (discovered.length > 0) {
            // Ensure core curated models are present
            const coreModels = this.getFallbackCodexModels();
            const mergedMap = new Map<string, ModelSpecs>();
            for (const m of [...coreModels, ...discovered]) {
              const key = `${m.provider.toLowerCase()}::${m.modelName}`;
              mergedMap.set(key, m);
            }
            const merged = Array.from(mergedMap.values());
            this.dynamicCache.setCachedModels(cacheKey, merged, 300_000);
            return merged;
          }
        }
      }
    } catch {
      // Ignore network errors and return curated defaults
    }

    const fallback = this.getFallbackCodexModels();
    this.dynamicCache.setCachedModels(cacheKey, fallback, 300_000);
    return fallback;
  }

  /**
   * Dynamically fetches live available models from GALX Wholesale Compute Clearinghouse.
   */
  async fetchGalxModels(apiToken?: string, forceRefresh = false, baseUrl?: string): Promise<ModelSpecs[]> {
    const cacheKey = "galx:models";
    const cached = !forceRefresh ? this.dynamicCache.getCachedModels(cacheKey) : null;
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      const models = await this.galxEngine.fetchGalxModels(apiToken, baseUrl, forceRefresh);
      for (const m of models) {
        this.registerModel(m);
      }
      if (models.length > 0) {
        this.dynamicCache.setCachedModels(cacheKey, models, 300_000);
        return models;
      }
    } catch {
      // Ignore errors and return fallback
    }

    const fallback = this.getFallbackGalxModels();
    this.dynamicCache.setCachedModels(cacheKey, fallback, 300_000);
    return fallback;
  }

  private getFallbackGalxModels(): ModelSpecs[] {
    return Array.from(this.catalog.values()).filter((m) => m.provider === "galx");
  }

  private getFallbackCodexModels(): ModelSpecs[] {
    return Array.from(this.catalog.values()).filter((m) => m.provider === "openai-codex");
  }

  private getFallbackOpenRouterModels(): ModelSpecs[] {
    return Array.from(this.catalog.values()).filter((m) => m.provider === "openrouter");
  }

  getAllModels(): ModelSpecs[] {
    return Array.from(this.catalog.values());
  }

  async getModelsForProvider(provider: string, freeOnly = false): Promise<ModelSpecs[]> {
    const normalized = provider.toLowerCase();
    if (normalized === "galx" || normalized === "galxai") {
      return this.fetchGalxModels();
    }
    if (normalized === "openrouter") {
      return this.fetchOpenRouterModels(undefined, false, freeOnly);
    }
    if (normalized === "openai-codex" || normalized === "codex" || normalized === "openai") {
      return this.fetchCodexModels();
    }
    return Array.from(this.catalog.values()).filter(
      (m) => m.provider.toLowerCase() === normalized
    );
  }

  filterOpenRouterModelIds(
    modelIds: string[],
    provider = "openrouter",
    allowedFreeModelIds: string[] = []
  ): string[] {
    return filterOpenRouterModelIds(modelIds, provider, allowedFreeModelIds);
  }

  filterOpenRouterModelSpecs<T extends { modelName: string }>(
    models: T[],
    provider = "openrouter",
    allowedFreeModelIds: string[] = []
  ): T[] {
    return filterOpenRouterModelSpecs(models, provider, allowedFreeModelIds);
  }

  calculateTurnCost(modelName: string, inputTokens: number, outputTokens: number): number {
    const info = this.getModelInfo(modelName);
    const inputCost = (inputTokens / 1_000_000) * info.inputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * info.outputPricePer1M;
    return Number((inputCost + outputCost).toFixed(6));
  }
}

