import { DynamicModelCache } from "./dynamic-model-cache.js";

export interface ModelSpecs {
  modelName: string;
  provider: "openrouter" | "openai-codex" | "ollama" | "anthropic" | "google" | "openai" | "deepseek" | "nous" | "custom";
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  supportsVision: boolean;
  supportsReasoning?: boolean;
  estimatedLatencyMs?: number;
  description?: string;
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
 * Absorbed from packages/catalog (Pass 16 / ADR-012).
 *
 * Maintains model spec definitions, dynamic OpenRouter API auto-population,
 * context window limits, and turn token cost calculations.
 */
export class ModelCatalog {
  private readonly catalog: Map<string, ModelSpecs> = new Map();
  private readonly dynamicCache: DynamicModelCache = new DynamicModelCache();

  constructor() {
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
      description: "Codex OAuth Flagship Reasoning Engine",
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
      description: "Codex OAuth Balanced Model",
    });

    this.registerModel({
      modelName: "gpt-5.6-codex",
      provider: "openai-codex",
      contextWindowTokens: 900_000,
      maxOutputTokens: 16_384,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: true,
      description: "Codex OAuth Specialized Coding Engine",
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

    // Default Fallback OpenRouter Presets
    const defaultOpenRouterModels: ModelSpecs[] = [
      {
        modelName: "anthropic/claude-3.5-sonnet",
        provider: "openrouter",
        contextWindowTokens: 200_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 3.0,
        outputPricePer1M: 15.0,
        supportsVision: true,
        description: "OpenRouter Anthropic Claude 3.5 Sonnet",
      },
      {
        modelName: "google/gemini-2.0-flash-001",
        provider: "openrouter",
        contextWindowTokens: 1_000_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 0.1,
        outputPricePer1M: 0.4,
        supportsVision: true,
        description: "OpenRouter Google Gemini 2.0 Flash",
      },
      {
        modelName: "deepseek/deepseek-r1",
        provider: "openrouter",
        contextWindowTokens: 64_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 0.55,
        outputPricePer1M: 2.19,
        supportsVision: false,
        description: "OpenRouter DeepSeek R1 Reasoning Model",
      },
    ];

    for (const m of defaultOpenRouterModels) {
      this.registerModel(m);
    }

    // Local / Proxy Models
    this.registerModel({
      modelName: "llama3:latest",
      provider: "ollama",
      contextWindowTokens: 32_000,
      maxOutputTokens: 4_096,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      description: "Local Ollama Llama 3 Instance",
    });

    this.registerModel({
      modelName: "qwen2.5-coder:latest",
      provider: "ollama",
      contextWindowTokens: 32_000,
      maxOutputTokens: 8_192,
      inputPricePer1M: 0.0,
      outputPricePer1M: 0.0,
      supportsVision: false,
      description: "Local Qwen 2.5 Coder Model",
    });
  }

  registerModel(specs: ModelSpecs): void {
    this.catalog.set(specs.modelName, specs);
  }

  getModelInfo(modelName: string): ModelSpecs {
    return (
      this.catalog.get(modelName) ?? {
        modelName,
        provider: "custom",
        contextWindowTokens: 128_000,
        maxOutputTokens: 4_096,
        inputPricePer1M: 1.0,
        outputPricePer1M: 3.0,
        supportsVision: false,
        description: "Custom Proxy Model",
      }
    );
  }

  /**
   * Dynamically fetches live available models from OpenRouter API (https://openrouter.ai/api/v1/models).
   * Caches response in DynamicModelCache with a 1-hour TTL.
   */
  async fetchOpenRouterModels(apiToken?: string): Promise<ModelSpecs[]> {
    const cached = this.dynamicCache.getCachedModels("openrouter");
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      const headers: Record<string, string> = {};
      if (apiToken) {
        headers["Authorization"] = `Bearer ${apiToken}`;
      }

      const res = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        return this.getFallbackOpenRouterModels();
      }

      const body = (await res.json()) as { data?: OpenRouterModelApiResponse[] };
      const rawModels = body?.data ?? [];

      const fetchedSpecs: ModelSpecs[] = [];
      for (const m of rawModels.slice(0, 40)) {
        const inputPrice = m.pricing?.prompt ? Number(m.pricing.prompt) * 1_000_000 : 1.0;
        const outputPrice = m.pricing?.completion ? Number(m.pricing.completion) * 1_000_000 : 3.0;

        const specs: ModelSpecs = {
          modelName: m.id,
          provider: "openrouter",
          contextWindowTokens: m.context_length ?? 128_000,
          maxOutputTokens: m.top_provider?.max_completion_tokens ?? 4_096,
          inputPricePer1M: Number(inputPrice.toFixed(4)),
          outputPricePer1M: Number(outputPrice.toFixed(4)),
          supportsVision: m.architecture?.modality?.includes("image") ?? false,
          description: m.name ?? m.id,
        };

        this.registerModel(specs);
        fetchedSpecs.push(specs);
      }

      if (fetchedSpecs.length > 0) {
        this.dynamicCache.setCachedModels("openrouter", fetchedSpecs);
        return fetchedSpecs;
      }
    } catch {
      // Fallback on network failure
    }

    return this.getFallbackOpenRouterModels();
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
