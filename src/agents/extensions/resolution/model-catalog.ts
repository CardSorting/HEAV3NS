import { DynamicModelCache } from "./dynamic-model-cache.js";
import { DeterministicLocalEndpointEngine } from "../../../tooling/extensions/endpoints/deterministic-local-endpoint-engine.js";
import type { LocalProviderKind } from "../../../core/contracts/local-endpoints.contracts.js";
import { OpenRouterProviderEngine } from "./openrouter-provider-engine.js";

export interface ModelSpecs {
  modelName: string;
  provider:
    | "openrouter"
    | "openai-codex"
    | "ollama"
    | "llamacpp"
    | "lmstudio"
    | "vllm"
    | "localai"
    | "local"
    | "onprem"
    | "anthropic"
    | "google"
    | "openai"
    | "deepseek"
    | "nous"
    | "custom";
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
 * Maintains model spec definitions, dynamic OpenRouter & local engine auto-discovery (Ollama, llama.cpp, LM Studio, vLLM),
 * context window limits, and turn token cost calculations with sub-cent honesty.
 */
export class ModelCatalog {
  private readonly catalog: Map<string, ModelSpecs> = new Map();
  private readonly dynamicCache: DynamicModelCache = new DynamicModelCache();
  private readonly localEngine: DeterministicLocalEndpointEngine;
  private readonly openRouterEngine: OpenRouterProviderEngine;

  constructor(
    localEngine?: DeterministicLocalEndpointEngine,
    openRouterEngine?: OpenRouterProviderEngine
  ) {
    this.localEngine = localEngine ?? new DeterministicLocalEndpointEngine();
    this.openRouterEngine = openRouterEngine ?? new OpenRouterProviderEngine();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Native Nous Portal Models
    this.registerModel({
      modelName: "nous/hermes-3-llama-3.1-405b",
      provider: "nous",
      contextWindowTokens: 131_072,
      maxOutputTokens: 8_192,
      inputPricePer1M: 3.5,
      outputPricePer1M: 7.0,
      supportsVision: false,
      supportsReasoning: true,
      description: "Nous Research Flagship 405B Frontier Open-Weights Model",
    });

    this.registerModel({
      modelName: "nous/hermes-3-llama-3.1-70b",
      provider: "nous",
      contextWindowTokens: 131_072,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.7,
      outputPricePer1M: 1.4,
      supportsVision: false,
      supportsReasoning: true,
      description: "Nous Research High-Efficiency 70B Model",
    });

    this.registerModel({
      modelName: "nous/deephermes-3-llama-3-8b-preview",
      provider: "nous",
      contextWindowTokens: 65_536,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      supportsVision: false,
      supportsReasoning: true,
      description: "Nous Research Deep Reasoning Model",
    });

    // OpenAI Codex OAuth Models (ChatGPT Subscription)
    this.registerModel({
      modelName: "gpt-5.6-terra",
      provider: "openai-codex",
      contextWindowTokens: 900_000,
      maxOutputTokens: 16_384,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "Codex OAuth Flagship Reasoning Engine (Default)",
    });

    this.registerModel({
      modelName: "gpt-5.6-luna",
      provider: "openai-codex",
      contextWindowTokens: 900_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      description: "Codex OAuth High-Velocity Model",
    });

    this.registerModel({
      modelName: "gpt-5.6-sol",
      provider: "openai-codex",
      contextWindowTokens: 900_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      supportsReasoning: true,
      description: "Codex OAuth Balanced Model",
    });

    this.registerModel({
      modelName: "gpt-4o",
      provider: "openai-codex",
      contextWindowTokens: 900_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 2.5,
      outputPricePer1M: 10.0,
      supportsVision: true,
      description: "Standard OpenAI GPT-4o Model",
    });

    // Default Fallback OpenRouter Presets from OpenRouterProviderEngine
    const defaultOpenRouterModels = this.openRouterEngine.getFallbackModelSpecs();
    for (const m of defaultOpenRouterModels) {
      this.registerModel(m);
    }

    // 1. Ollama Local Models
    this.registerModel({
      modelName: "llama3:latest",
      provider: "ollama",
      contextWindowTokens: 32_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 5,
      isLocal: true,
      description: "Local Ollama Llama 3 Instance",
    });

    this.registerModel({
      modelName: "llama3.2:latest",
      provider: "ollama",
      contextWindowTokens: 32_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 4,
      isLocal: true,
      description: "Local Ollama Llama 3.2 (Lightweight, High-Velocity)",
    });

    this.registerModel({
      modelName: "llama3.3:latest",
      provider: "ollama",
      contextWindowTokens: 128_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      supportsReasoning: true,
      estimatedLatencyMs: 12,
      isLocal: true,
      description: "Local Ollama Llama 3.3 70B Flagship Model",
    });

    this.registerModel({
      modelName: "qwen2.5-coder:latest",
      provider: "ollama",
      contextWindowTokens: 32_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 6,
      isLocal: true,
      description: "Local Qwen 2.5 Coder Model",
    });

    this.registerModel({
      modelName: "deepseek-r1:latest",
      provider: "ollama",
      contextWindowTokens: 64_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      supportsReasoning: true,
      estimatedLatencyMs: 8,
      isLocal: true,
      description: "Local Ollama DeepSeek R1 Distill Reasoning Model",
    });

    this.registerModel({
      modelName: "mistral:latest",
      provider: "ollama",
      contextWindowTokens: 32_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 5,
      isLocal: true,
      description: "Local Ollama Mistral 7B Instruct Model",
    });

    // 2. llama.cpp (llama-server) Models
    this.registerModel({
      modelName: "llamacpp/default",
      provider: "llamacpp",
      contextWindowTokens: 16_384,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 4,
      isLocal: true,
      description: "llama.cpp Server Active Loaded GGUF Model",
    });

    this.registerModel({
      modelName: "llamacpp/qwen2.5-coder-7b",
      provider: "llamacpp",
      contextWindowTokens: 32_768,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 5,
      isLocal: true,
      description: "llama.cpp Qwen 2.5 Coder 7B Instruct GGUF",
    });

    this.registerModel({
      modelName: "llamacpp/mistral-7b",
      provider: "llamacpp",
      contextWindowTokens: 32_768,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 4,
      isLocal: true,
      description: "llama.cpp Mistral 7B Instruct v0.3 GGUF",
    });

    // 3. LM Studio Models
    this.registerModel({
      modelName: "lmstudio/loaded-model",
      provider: "lmstudio",
      contextWindowTokens: 32_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 6,
      isLocal: true,
      description: "LM Studio Active Running Model (Port 1234)",
    });

    this.registerModel({
      modelName: "lmstudio/qwen2.5-coder",
      provider: "lmstudio",
      contextWindowTokens: 32_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 6,
      isLocal: true,
      description: "LM Studio Qwen 2.5 Coder Model",
    });

    this.registerModel({
      modelName: "lmstudio/deepseek-r1",
      provider: "lmstudio",
      contextWindowTokens: 64_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      supportsReasoning: true,
      estimatedLatencyMs: 8,
      isLocal: true,
      description: "LM Studio DeepSeek R1 Distill GGUF",
    });

    // 4. vLLM & Custom On-Premises Models
    this.registerModel({
      modelName: "vllm/default",
      provider: "vllm",
      contextWindowTokens: 64_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 3,
      isLocal: true,
      description: "vLLM High-Throughput Inference Engine",
    });

    this.registerModel({
      modelName: "onprem/llama-3.3-70b",
      provider: "onprem",
      contextWindowTokens: 128_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      supportsReasoning: true,
      estimatedLatencyMs: 15,
      isLocal: true,
      description: "Private Corporate On-Premises Llama 3.3 Cluster",
    });

    this.registerModel({
      modelName: "local/onprem-model",
      provider: "local",
      contextWindowTokens: 32_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      estimatedLatencyMs: 5,
      isLocal: true,
      description: "Custom Local On-Premises OpenAI-Compatible Model",
    });
  }

  registerModel(specs: ModelSpecs): void {
    this.catalog.set(specs.modelName, specs);
  }

  getModelInfo(modelName: string): ModelSpecs {
    const existing = this.catalog.get(modelName);
    if (existing) return existing;

    const isOpenRouter =
      modelName.startsWith("openrouter/") ||
      modelName.includes("/") ||
      this.openRouterEngine.isClaude1mModel(modelName);

    const isLocal =
      modelName.startsWith("ollama/") ||
      modelName.startsWith("llamacpp/") ||
      modelName.startsWith("lmstudio/") ||
      modelName.startsWith("vllm/") ||
      modelName.startsWith("local/") ||
      modelName.startsWith("onprem/") ||
      modelName.includes(":latest");

    if (isOpenRouter && !isLocal) {
      const { normalizedId, is1m } = this.openRouterEngine.normalizeModelId(modelName);
      const baseSpec = this.catalog.get(normalizedId);
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
      provider: isLocal ? "local" : isOpenRouter ? "openrouter" : "custom",
      contextWindowTokens: 128_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: isLocal ? 0.0 : 1.0,
      outputPricePer1M: isLocal ? 0.0 : 3.0,
      supportsVision: false,
      estimatedLatencyMs: isLocal ? 5 : 45,
      isLocal,
      description: isLocal ? "Local On-Premises Model" : isOpenRouter ? "Dynamic OpenRouter Model" : "Custom Proxy Model",
    };
  }

  /**
   * Dynamically fetches live available models from OpenRouter API (https://openrouter.ai/api/v1/models).
   * Automatically parses rich metadata, calculates per-1M token pricing, synthesizes 1M context variants,
   * and caches in dynamic cache.
   */
  async fetchOpenRouterModels(apiToken?: string, forceRefresh = false): Promise<ModelSpecs[]> {
    const cached = !forceRefresh ? this.dynamicCache.getCachedModels("openrouter") : null;
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      const models = await this.openRouterEngine.fetchOpenRouterModels(apiToken, undefined, forceRefresh);
      for (const m of models) {
        this.registerModel(m);
      }
      if (models.length > 0) {
        this.dynamicCache.setCachedModels("openrouter", models);
      }
      return models;
    } catch {
      return this.getFallbackOpenRouterModels();
    }
  }

  /**
   * Dynamically discovers live models loaded/running on local endpoints (Ollama, llama.cpp, LM Studio, vLLM).
   * Caches in DynamicModelCache with a 5-minute TTL.
   */
  async fetchLocalEndpointModels(provider: LocalProviderKind, baseUrl?: string): Promise<ModelSpecs[]> {
    const cacheKey = `local:${provider}`;
    const cached = this.dynamicCache.getCachedModels(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      const probeResult = await this.localEngine.probeServer(provider, baseUrl, undefined, 2000);
      if (probeResult.reachable && probeResult.detectedModels.length > 0) {
        const specsList: ModelSpecs[] = probeResult.detectedModels.map((m) => {
          const spec: ModelSpecs = {
            modelName: m.modelId,
            provider: m.provider,
            contextWindowTokens: m.contextWindow,
            maxOutputTokens: m.maxOutputTokens,
            inputPricePer1M: 0.0,
            outputPricePer1M: 0.0,
            supportsVision: m.supportsVision,
            supportsReasoning: m.supportsReasoning,
            estimatedLatencyMs: probeResult.latencyMs,
            isLocal: true,
            description: `${probeResult.displayName} • ${m.parameterSize || "Local Model"}${m.quantization ? ` (${m.quantization})` : ""}`,
          };
          this.registerModel(spec);
          return spec;
        });

        this.dynamicCache.setCachedModels(cacheKey, specsList, 300_000);
        return specsList;
      }
    } catch {
      // Ignore local probe errors
    }

    return Array.from(this.catalog.values()).filter(
      (m) => m.provider.toLowerCase() === provider.toLowerCase()
    );
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
              mergedMap.set(m.modelName, m);
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

  private getFallbackCodexModels(): ModelSpecs[] {
    return Array.from(this.catalog.values()).filter((m) => m.provider === "openai-codex");
  }

  private getFallbackOpenRouterModels(): ModelSpecs[] {
    return Array.from(this.catalog.values()).filter((m) => m.provider === "openrouter");
  }

  getAllModels(): ModelSpecs[] {
    return Array.from(this.catalog.values());
  }

  async getModelsForProvider(provider: string): Promise<ModelSpecs[]> {
    const normalized = provider.toLowerCase();
    if (normalized === "openrouter") {
      return this.fetchOpenRouterModels();
    }
    if (normalized === "openai-codex" || normalized === "codex" || normalized === "openai") {
      return this.fetchCodexModels();
    }
    if (
      normalized === "ollama" ||
      normalized === "llamacpp" ||
      normalized === "lmstudio" ||
      normalized === "vllm" ||
      normalized === "localai"
    ) {
      return this.fetchLocalEndpointModels(normalized as LocalProviderKind);
    }
    return Array.from(this.catalog.values()).filter(
      (m) => m.provider.toLowerCase() === normalized
    );
  }

  calculateTurnCost(modelName: string, inputTokens: number, outputTokens: number): number {
    const info = this.getModelInfo(modelName);
    const inputCost = (inputTokens / 1_000_000) * info.inputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * info.outputPricePer1M;
    return Number((inputCost + outputCost).toFixed(6));
  }
}
