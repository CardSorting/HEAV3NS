/**
 * openrouter-provider-engine.ts
 *
 * Deterministic OpenRouter provider engine: dynamic model catalog fetching,
 * attribution header synthesis, model ID normalization, Claude 1M routing,
 * prompt cache injection, temperature / reasoning calibration, stream chunk parsing,
 * mid-stream error detection, reasoning details preservation, and generation endpoint usage fallbacks.
 * (Phase 135 / ADR-110).
 */

import type {
  OpenRouterAttributionHeaders,
  OpenRouterErrorResponse,
  OpenRouterGenerationDetails,
  OpenRouterHandlerOptions,
  OpenRouterModelInfo,
  OpenRouterParsedStreamEvent,
  OpenRouterProviderPreferences,
  OpenRouterRawModelInfo,
  OpenRouterStreamChunk,
  OpenRouterStreamUsage,
} from "../../../core/contracts/openrouter.contracts.js";
import {
  CLAUDE_SONNET_1M_SUFFIX,
  OPENROUTER_PROVIDER_PREFERENCES,
} from "../../../core/contracts/openrouter.contracts.js";
import type { ModelSpecs } from "./model-catalog.js";

/**
 * Stealth models compatible with OpenRouter API but not listed in public catalog.
 */
export const OPENROUTER_STEALTH_MODELS: Record<string, Partial<ModelSpecs>> = {
  "stealth/giga-potato": {
    modelName: "stealth/giga-potato",
    provider: "openrouter",
    contextWindowTokens: 224_000,
    maxOutputTokens: 8_192,
    inputPricePer1M: 0.0,
    outputPricePer1M: 0.0,
    supportsVision: true,
    description: "Stealth model for testing purposes.",
  },
  "x-ai/grok-4.5": {
    modelName: "x-ai/grok-4.5",
    provider: "openrouter",
    contextWindowTokens: 500_000,
    maxOutputTokens: 128_000,
    inputPricePer1M: 2.0,
    outputPricePer1M: 10.0,
    supportsVision: true,
    supportsReasoning: true,
    description: "xAI Grok 4.5 Flagship with 500K context window.",
  },
  "xai/grok-4.5": {
    modelName: "xai/grok-4.5",
    provider: "openrouter",
    contextWindowTokens: 500_000,
    maxOutputTokens: 128_000,
    inputPricePer1M: 2.0,
    outputPricePer1M: 10.0,
    supportsVision: true,
    supportsReasoning: true,
    description: "xAI Grok 4.5 (Alternate mapping).",
  },
};

export class OpenRouterProviderEngine {
  private readonly defaultBaseUrl: string;
  private inMemoryModelCache: Map<string, ModelSpecs> = new Map();
  private cacheExpiry = 0;
  private pendingFetchPromise: Promise<ModelSpecs[]> | null = null;

  constructor(defaultBaseUrl = "https://openrouter.ai/api/v1") {
    this.defaultBaseUrl = defaultBaseUrl;
  }

  /**
   * Builds official OpenRouter attribution headers for rankings and analytics.
   */
  public buildAttributionHeaders(): OpenRouterAttributionHeaders {
    return {
      "HTTP-Referer": "https://github.com/CardSorting/LUMI-JOY",
      "X-Title": "LUMI AGENT OS",
      "X-OpenRouter-Title": "LUMI",
      "X-OpenRouter-Categories": "ide-extension",
    };
  }

  /**
   * Checks if the model requires Claude 1M context routing.
   */
  public isClaude1mModel(modelId: string): boolean {
    if (!modelId) return false;
    return (
      modelId.endsWith(CLAUDE_SONNET_1M_SUFFIX) ||
      modelId === "anthropic/claude-sonnet-4:1m" ||
      modelId === "anthropic/claude-sonnet-4.5:1m" ||
      modelId === "anthropic/claude-sonnet-4.6:1m" ||
      modelId === "anthropic/claude-opus-4.6:1m" ||
      modelId === "anthropic/claude-opus-4.7:1m"
    );
  }

  /**
   * Normalizes model ID by stripping custom suffix (e.g. :1m).
   */
  public normalizeModelId(modelId: string): { normalizedId: string; is1m: boolean } {
    if (!modelId) return { normalizedId: "", is1m: false };
    if (this.isClaude1mModel(modelId)) {
      return {
        normalizedId: modelId.slice(0, -CLAUDE_SONNET_1M_SUFFIX.length),
        is1m: true,
      };
    }
    return { normalizedId: modelId, is1m: false };
  }

  /**
   * Checks if reasoning content should be skipped (e.g. noisy or unsupported models).
   */
  public shouldSkipReasoningForModel(modelId?: string): boolean {
    if (!modelId) return false;
    const lower = modelId.toLowerCase();
    return lower.includes("grok-4") || lower.includes("devstral") || lower.includes("glm");
  }

  /**
   * Checks if model supports prompt caching on OpenRouter (Claude, MiniMax, DeepSeek, etc.).
   */
  public supportsPromptCaching(modelId: string): boolean {
    if (!modelId) return false;
    const lower = modelId.toLowerCase();
    return (
      lower.startsWith("anthropic/claude") ||
      lower.includes("claude-3") ||
      lower.includes("claude-4") ||
      lower.startsWith("minimax/minimax") ||
      lower.startsWith("deepseek/deepseek") ||
      lower.startsWith("openai/gpt-4") ||
      lower.startsWith("openai/gpt-5") ||
      lower.startsWith("google/gemini")
    );
  }

  /**
   * Checks if model supports OpenAI-style reasoning effort.
   */
  public supportsReasoningEffort(modelId: string): boolean {
    if (!modelId) return false;
    const lower = modelId.toLowerCase();
    return (
      lower.includes("o1") ||
      lower.includes("o3") ||
      lower.includes("gpt-5") ||
      lower.includes("deepseek-r1")
    );
  }

  /**
   * Resolves explicit provider preferences for a given model.
   */
  public getProviderPreferences(modelId: string): OpenRouterProviderPreferences | undefined {
    return OPENROUTER_PROVIDER_PREFERENCES[modelId];
  }

  /**
   * Dynamically fetches all live models directly from the OpenRouter API (https://openrouter.ai/api/v1/models)
   * without static truncation or artificial hardcoding.
   */
  public async fetchOpenRouterModels(
    apiToken?: string,
    baseUrl?: string,
    forceRefresh = false
  ): Promise<ModelSpecs[]> {
    const now = Date.now();
    if (!forceRefresh && this.inMemoryModelCache.size > 0 && now < this.cacheExpiry) {
      return Array.from(this.inMemoryModelCache.values());
    }

    if (this.pendingFetchPromise) {
      return this.pendingFetchPromise;
    }

    this.pendingFetchPromise = (async () => {
      try {
        const endpointUrl = `${baseUrl || this.defaultBaseUrl}/models`;
        const headers: Record<string, string> = {
          ...this.buildAttributionHeaders(),
        };
        if (apiToken) {
          headers["Authorization"] = `Bearer ${apiToken}`;
        }

        const res = await fetch(endpointUrl, {
          method: "GET",
          headers,
        });

        if (!res.ok) {
          return this.getFallbackModelSpecs();
        }

        const json = (await res.json()) as { data?: OpenRouterRawModelInfo[] };
        const rawModels = json.data ?? [];
        if (rawModels.length === 0) {
          return this.getFallbackModelSpecs();
        }

        const parsePricePer1M = (priceVal: unknown): number => {
          if (priceVal === undefined || priceVal === null || priceVal === "") return 0;
          const num = typeof priceVal === "number" ? priceVal : Number.parseFloat(String(priceVal));
          return Number.isNaN(num) ? 0 : Number((num * 1_000_000).toFixed(4));
        };

        const fetchedMap = new Map<string, ModelSpecs>();

        for (const raw of rawModels) {
          const promptPrice = parsePricePer1M(raw.pricing?.prompt);
          const completionPrice = parsePricePer1M(raw.pricing?.completion);
          const supportThinking =
            raw.supported_parameters?.some(
              (p) => p === "include_reasoning" || p === "reasoning"
            ) ||
            raw.id.includes("r1") ||
            raw.id.includes("reasoning") ||
            raw.id.includes("thinking") ||
            raw.id.includes("o1") ||
            raw.id.includes("o3");

          const spec: ModelSpecs = {
            modelName: raw.id,
            provider: "openrouter",
            contextWindowTokens: raw.context_length ?? 128_000,
            maxOutputTokens: raw.top_provider?.max_completion_tokens ?? 4_096,
            inputPricePer1M: promptPrice,
            outputPricePer1M: completionPrice,
            supportsVision: raw.architecture?.modality?.includes("image") ?? false,
            supportsReasoning: Boolean(supportThinking),
            description: raw.description || raw.name || raw.id,
            isLocal: false,
          };

          fetchedMap.set(raw.id, spec);

          // Dynamically synthesize :1m Claude variants if applicable
          if (
            raw.id === "anthropic/claude-sonnet-4" ||
            raw.id === "anthropic/claude-sonnet-4.5" ||
            raw.id === "anthropic/claude-4.5-sonnet" ||
            raw.id === "anthropic/claude-sonnet-4.6" ||
            raw.id === "anthropic/claude-4.6-sonnet" ||
            raw.id === "anthropic/claude-opus-4.6"
          ) {
            const variantId = `${raw.id}${CLAUDE_SONNET_1M_SUFFIX}`;
            fetchedMap.set(variantId, {
              ...spec,
              modelName: variantId,
              contextWindowTokens: 1_000_000,
              description: `${spec.description} (1M Extended Context)`,
            });
          }
        }

        // Inject stealth models
        for (const [stealthId, stealthSpec] of Object.entries(OPENROUTER_STEALTH_MODELS)) {
          if (!fetchedMap.has(stealthId)) {
            fetchedMap.set(stealthId, {
              modelName: stealthId,
              provider: "openrouter",
              contextWindowTokens: stealthSpec.contextWindowTokens ?? 128_000,
              maxOutputTokens: stealthSpec.maxOutputTokens ?? 8_192,
              inputPricePer1M: stealthSpec.inputPricePer1M ?? 0.0,
              outputPricePer1M: stealthSpec.outputPricePer1M ?? 0.0,
              supportsVision: stealthSpec.supportsVision ?? true,
              supportsReasoning: stealthSpec.supportsReasoning ?? false,
              description: stealthSpec.description ?? "Stealth OpenRouter Model",
              isLocal: false,
            });
          }
        }

        this.inMemoryModelCache = fetchedMap;
        this.cacheExpiry = Date.now() + 3600_000; // 1-hour TTL
        return Array.from(fetchedMap.values());
      } catch {
        return this.getFallbackModelSpecs();
      } finally {
        this.pendingFetchPromise = null;
      }
    })();

    return this.pendingFetchPromise;
  }

  /**
   * Fallback model presets for offline resilience when remote endpoint is unreachable.
   */
  public getFallbackModelSpecs(): ModelSpecs[] {
    return [
      {
        modelName: "anthropic/claude-3.7-sonnet",
        provider: "openrouter",
        contextWindowTokens: 200_000,
        maxOutputTokens: 16_384,
        inputPricePer1M: 3.0,
        outputPricePer1M: 15.0,
        supportsVision: true,
        supportsReasoning: true,
        description: "Anthropic Claude 3.7 Sonnet Hybrid Reasoning Flagship",
      },
      {
        modelName: "anthropic/claude-3.5-sonnet",
        provider: "openrouter",
        contextWindowTokens: 200_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 3.0,
        outputPricePer1M: 15.0,
        supportsVision: true,
        description: "Anthropic Claude 3.5 Sonnet Industry Coding Benchmark",
      },
      {
        modelName: "google/gemini-2.0-flash-001",
        provider: "openrouter",
        contextWindowTokens: 1_000_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 0.1,
        outputPricePer1M: 0.4,
        supportsVision: true,
        description: "Google Gemini 2.0 Flash High-Velocity Multimodal Engine",
      },
      {
        modelName: "deepseek/deepseek-r1",
        provider: "openrouter",
        contextWindowTokens: 64_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 0.55,
        outputPricePer1M: 2.19,
        supportsVision: false,
        supportsReasoning: true,
        description: "DeepSeek R1 Frontier Open-Weights Reasoning Engine",
      },
      {
        modelName: "qwen/qwen-2.5-coder-32b-instruct",
        provider: "openrouter",
        contextWindowTokens: 128_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 0.18,
        outputPricePer1M: 0.36,
        supportsVision: false,
        supportsReasoning: true,
        description: "Qwen 2.5 Coder 32B Specialized Agentic Coding Model",
      },
      {
        modelName: "moonshotai/kimi-k2",
        provider: "openrouter",
        contextWindowTokens: 131_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 1.0,
        outputPricePer1M: 3.0,
        supportsVision: false,
        description: "Moonshot AI Kimi K2 High-Throughput Engine",
      },
      {
        modelName: "z-ai/glm-4.6",
        provider: "openrouter",
        contextWindowTokens: 128_000,
        maxOutputTokens: 8_192,
        inputPricePer1M: 0.8,
        outputPricePer1M: 2.4,
        supportsVision: false,
        description: "Z-AI GLM 4.6 Frontier Coding Engine",
      },
    ];
  }

  /**
   * Prepares the full outbound JSON request payload for OpenRouter chat completions.
   */
  public prepareRequestPayload(params: {
    modelId: string;
    messages: Array<{ role: string; content: string | any;[key: string]: unknown }>;
    maxTokens?: number;
    reasoningEffort?: string;
    thinkingBudgetTokens?: number;
    openRouterProviderSorting?: string;
    tools?: unknown[];
    temperatureOverride?: number;
  }): { payload: Record<string, unknown>; effectiveModelId: string } {
    const { normalizedId, is1m } = this.normalizeModelId(params.modelId);
    let openAiMessages = [...params.messages];

    // Ephemeral Multi-Breakpoint Prompt Caching injection (Anthropic / OpenRouter 4-breakpoint protocol)
    let processedTools = params.tools ? [...params.tools] : undefined;
    if (this.supportsPromptCaching(normalizedId) && openAiMessages.length > 0) {
      let injectedBreakpoints = 0;
      const MAX_BREAKPOINTS = 4;

      // Breakpoint 1: System Prompt Tail
      const firstMsg = openAiMessages[0];
      if (firstMsg && firstMsg.role === "system") {
        const textContent = typeof firstMsg.content === "string" ? firstMsg.content : "";
        if (textContent && injectedBreakpoints < MAX_BREAKPOINTS) {
          openAiMessages[0] = {
            ...firstMsg,
            content: [
              {
                type: "text",
                text: textContent,
                cache_control: { type: "ephemeral" },
              },
            ],
          };
          injectedBreakpoints++;
        }
      }

      // Breakpoint 2: Tool Definitions Manifest Tail
      if (processedTools && processedTools.length > 0 && injectedBreakpoints < MAX_BREAKPOINTS) {
        const lastToolIndex = processedTools.length - 1;
        const lastTool = processedTools[lastToolIndex] as Record<string, unknown>;
        if (lastTool && typeof lastTool === "object") {
          processedTools[lastToolIndex] = {
            ...lastTool,
            cache_control: { type: "ephemeral" },
          };
          injectedBreakpoints++;
        }
      }

      // Breakpoint 3: History Midpoint Checkpoint (if >= 4 messages)
      if (openAiMessages.length >= 4 && injectedBreakpoints < MAX_BREAKPOINTS) {
        const midIndex = Math.floor(openAiMessages.length / 2);
        const midMsg = openAiMessages[midIndex];
        if (midMsg && typeof midMsg.content === "string" && midMsg.content.length > 0) {
          openAiMessages[midIndex] = {
            ...midMsg,
            content: [
              {
                type: "text",
                text: midMsg.content,
                cache_control: { type: "ephemeral" },
              },
            ],
          };
          injectedBreakpoints++;
        }
      }

      // Breakpoint 4: Penultimate Turn Checkpoint (if >= 2 messages)
      if (openAiMessages.length >= 2 && injectedBreakpoints < MAX_BREAKPOINTS) {
        const penultIndex = openAiMessages.length - 2;
        const penultMsg = openAiMessages[penultIndex];
        if (penultMsg && typeof penultMsg.content === "string" && penultMsg.content.length > 0) {
          openAiMessages[penultIndex] = {
            ...penultMsg,
            content: [
              {
                type: "text",
                text: penultMsg.content,
                cache_control: { type: "ephemeral" },
              },
            ],
          };
          injectedBreakpoints++;
        }
      }
    }

    // Default Temperature & Top-P Calibration
    let temperature: number | undefined = params.temperatureOverride ?? 0;
    let topP: number | undefined;

    if (
      normalizedId.startsWith("deepseek/deepseek-r1") ||
      normalizedId === "perplexity/sonar-reasoning" ||
      normalizedId === "qwen/qwq-32b:free" ||
      normalizedId === "qwen/qwq-32b"
    ) {
      temperature = 0.7;
      topP = 0.95;
    } else if (normalizedId.startsWith("google/gemini-3")) {
      temperature = 1.0;
    }

    // Extended thinking / Reasoning Configuration
    const supportsEffort = this.supportsReasoningEffort(normalizedId);
    let reasoningPayload: Record<string, unknown> | undefined;

    if (params.thinkingBudgetTokens && params.thinkingBudgetTokens > 0) {
      temperature = undefined; // Extended thinking requires omitting non-1 temperature
      reasoningPayload = { max_tokens: params.thinkingBudgetTokens };
    } else if (supportsEffort && params.reasoningEffort && params.reasoningEffort !== "none") {
      reasoningPayload = { effort: params.reasoningEffort };
    }

    const includeReasoning = !this.shouldSkipReasoningForModel(normalizedId);

    // Provider routing & sorting logic
    const matchedPreferences = this.getProviderPreferences(normalizedId);
    let providerConfig: Record<string, unknown> | undefined;

    if (is1m) {
      providerConfig = {
        order: ["anthropic", "google-vertex/global"],
        allow_fallbacks: false,
      };
    } else if (matchedPreferences) {
      providerConfig = { ...matchedPreferences };
    } else if (params.openRouterProviderSorting) {
      providerConfig = { sort: params.openRouterProviderSorting };
    }

    const payload: Record<string, unknown> = {
      model: normalizedId,
      messages: openAiMessages,
      stream: true,
      stream_options: { include_usage: true },
      include_reasoning: includeReasoning,
      ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(topP !== undefined ? { top_p: topP } : {}),
      ...(reasoningPayload ? { reasoning: reasoningPayload } : {}),
      ...(providerConfig ? { provider: providerConfig } : {}),
      ...(processedTools && processedTools.length > 0 ? { tools: processedTools } : {}),
    };

    return {
      payload,
      effectiveModelId: normalizedId,
    };
  }

  /**
   * Parses a single SSE data chunk from OpenRouter stream, yielding structured stream events.
   */
  public parseStreamChunk(
    chunk: OpenRouterStreamChunk,
    options?: { skipReasoning?: boolean }
  ): OpenRouterParsedStreamEvent[] {
    const events: OpenRouterParsedStreamEvent[] = [];

    // 1. Root-level error check
    if (chunk.error) {
      const err = chunk.error;
      const meta = err.metadata ? `\nMetadata: ${JSON.stringify(err.metadata)}` : "";
      throw new Error(`OpenRouter API Error ${err.code ?? "UNKNOWN"}: ${err.message ?? "Unknown error"}${meta}`);
    }

    // 2. Mid-stream finish_reason === "error" check
    const firstChoice = chunk.choices?.[0];
    if (firstChoice) {
      if (firstChoice.finish_reason === "error") {
        if (firstChoice.error) {
          const detail = typeof firstChoice.error === "object" ? JSON.stringify(firstChoice.error) : String(firstChoice.error);
          throw new Error(`OpenRouter Mid-Stream Error: ${detail}`);
        }
        throw new Error("OpenRouter Mid-Stream Error: Stream terminated with error status");
      }

      const delta = firstChoice.delta;
      if (delta) {
        // Text content
        if (delta.content) {
          events.push({
            type: "text",
            text: delta.content,
          });
        }

        // Tool calls
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          for (const tc of delta.tool_calls) {
            events.push({
              type: "tool_call",
              toolCall: {
                id: tc.id,
                name: tc.function?.name,
                arguments: tc.function?.arguments,
              },
            });
          }
        }

        // Reasoning tokens
        if (!options?.skipReasoning) {
          if (delta.reasoning) {
            const reasoningStr = typeof delta.reasoning === "string" ? delta.reasoning : JSON.stringify(delta.reasoning);
            events.push({
              type: "reasoning",
              reasoning: reasoningStr,
            });
          }

          // Reasoning details (preserving reasoning blocks / traces)
          if (delta.reasoning_details && delta.reasoning_details.length > 0) {
            events.push({
              type: "reasoning",
              reasoning: "",
              details: delta.reasoning_details,
            });
          }
        }
      }
    }

    // 3. Usage token & cost parsing
    if (chunk.usage) {
      const cached = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
      const prompt = chunk.usage.prompt_tokens ?? 0;
      const completion = chunk.usage.completion_tokens ?? 0;
      const rawCost = chunk.usage.cost ?? 0;
      const upstreamCost = chunk.usage.cost_details?.upstream_inference_cost ?? 0;

      events.push({
        type: "usage",
        cacheReadTokens: cached,
        cacheWriteTokens: 0,
        inputTokens: Math.max(0, prompt - cached),
        outputTokens: completion,
        totalCost: Number((rawCost + upstreamCost).toFixed(6)),
      });
    }

    return events;
  }

  /**
   * Fetches generation details from OpenRouter `/generation?id=${genId}` as fallback for usage/cost.
   */
  public async fetchGenerationDetails(
    genId: string,
    apiKey: string,
    baseUrl?: string
  ): Promise<OpenRouterGenerationDetails | null> {
    const url = `${baseUrl || this.defaultBaseUrl}/generation?id=${encodeURIComponent(genId)}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...this.buildAttributionHeaders(),
        },
      });

      if (!res.ok) {
        return null;
      }

      const json = (await res.json()) as { data?: OpenRouterGenerationDetails };
      return json.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Handles OpenRouter OAuth callback code parameter exchange.
   */
  public handleOpenRouterCallback(codeOrUri: string): { code: string; success: boolean; error?: string } {
    if (!codeOrUri || typeof codeOrUri !== "string") {
      return { code: "", success: false, error: "Missing authorization code" };
    }

    // Handle URI scheme (vscode://.../openrouter?code=... or https://.../openrouter?code=...)
    if (codeOrUri.includes("code=")) {
      try {
        const parsed = new URL(codeOrUri.replace(/^vscode:\/\/[^/]+/, "https://dummy.host"));
        const code = parsed.searchParams.get("code");
        if (code) {
          return { code, success: true };
        }
      } catch {
        const match = codeOrUri.match(/[?&]code=([^&]+)/);
        if (match && match[1]) {
          return { code: decodeURIComponent(match[1]), success: true };
        }
      }
    }

    const trimmed = codeOrUri.trim();
    if (trimmed.length > 0) {
      return { code: trimmed, success: true };
    }

    return { code: "", success: false, error: "Invalid OpenRouter callback payload" };
  }
}
