/**
 * openrouter.contracts.ts
 *
 * OpenRouter Provider Contracts, Preference Routing Types, Stream Chunk Formats,
 * Raw API Response Definitions, and Attribution Header Specifications (Phase 135 / ADR-110).
 */

export interface OpenRouterModelInfo {
  name?: string;
  contextWindow: number;
  maxTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
  cacheReadsPrice?: number;
  cacheWritesPrice?: number;
  supportsImages?: boolean;
  supportsPromptCache?: boolean;
  supportsReasoning?: boolean;
  thinkingConfig?: {
    maxThinkingTokens?: number;
  };
  description?: string;
}

export type OpenRouterSupportedParams =
  | "frequency_penalty"
  | "include_reasoning"
  | "logit_bias"
  | "logprobs"
  | "max_tokens"
  | "min_p"
  | "presence_penalty"
  | "reasoning"
  | "repetition_penalty"
  | "response_format"
  | "seed"
  | "stop"
  | "temperature"
  | "tool_choice"
  | "tools"
  | "top_k"
  | "top_logprobs"
  | "top_p";

export interface OpenRouterRawModelInfo {
  id: string;
  name?: string;
  description?: string | null;
  context_length?: number | null;
  top_provider?: {
    max_completion_tokens?: number | null;
    context_length?: number | null;
    is_moderated?: boolean | null;
  } | null;
  architecture?: {
    modality?: string | string[];
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string;
  } | null;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    request?: string | number;
    image?: string | number;
    audio?: string | number;
    web_search?: string | number;
    internal_reasoning?: string | number;
    input_cache_read?: string | number;
    input_cache_write?: string | number;
  } | null;
  supports_global_endpoint?: boolean | null;
  tiers?: unknown[] | null;
  supported_parameters?: OpenRouterSupportedParams[] | string[] | null;
}

export interface OpenRouterProviderPreferences {
  order?: string[];
  allow_fallbacks?: boolean;
  sort?: "price" | "latency" | "throughput" | string;
  ignore?: string[];
  quantizations?: string[];
}

export interface OpenRouterReasoningBlock {
  type?: string;
  text?: string;
  data?: unknown;
  signature?: string;
  index?: number;
}

export interface OpenRouterStreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  cost?: number;
  cost_details?: {
    upstream_inference_cost?: number;
    cache_read_cost?: number;
    cache_write_cost?: number;
  };
}

export interface OpenRouterErrorResponse {
  error?: {
    code?: number | string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface OpenRouterStreamDelta {
  role?: string;
  content?: string | null;
  reasoning?: string | Record<string, unknown> | null;
  reasoning_details?: unknown[] | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface OpenRouterStreamChoice {
  index?: number;
  delta?: OpenRouterStreamDelta;
  finish_reason?: string | null;
  error?: {
    code?: number | string;
    message?: string;
    metadata?: unknown;
  };
}

export interface OpenRouterStreamChunk {
  id?: string;
  model?: string;
  choices?: OpenRouterStreamChoice[];
  usage?: OpenRouterStreamUsage;
  error?: {
    code?: number | string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface OpenRouterParsedStreamEvent {
  type: "text" | "reasoning" | "usage" | "tool_call";
  text?: string;
  reasoning?: string;
  details?: unknown[];
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
  toolCall?: {
    id?: string;
    name?: string;
    arguments?: string;
  };
}

export interface OpenRouterGenerationDetails {
  id: string;
  model: string;
  native_tokens_prompt?: number;
  native_tokens_completion?: number;
  native_tokens_cached?: number;
  total_cost?: number;
  cache_discount?: number;
  origin?: string;
  created_at?: string;
}

export interface OpenRouterAttributionHeaders {
  "HTTP-Referer": string;
  "X-Title": string;
  "X-OpenRouter-Title": string;
  "X-OpenRouter-Categories": string;
  [key: string]: string;
}

export interface OpenRouterHandlerOptions {
  openRouterApiKey?: string;
  openRouterModelId?: string;
  openRouterModelInfo?: OpenRouterModelInfo;
  openRouterProviderSorting?: string;
  reasoningEffort?: string;
  thinkingBudgetTokens?: number;
  baseUrl?: string;
}

export interface OpenRouterAuthCallbackResult {
  code: string;
  success: boolean;
  error?: string;
}

export const CLAUDE_SONNET_1M_SUFFIX = ":1m";

/**
 * Standard default provider preferences for exacto and specialized models on OpenRouter.
 */
export const OPENROUTER_PROVIDER_PREFERENCES: Record<
  string,
  { order: string[]; allow_fallbacks: boolean }
> = {
  // Exacto Providers
  "moonshotai/kimi-k2:exacto": {
    order: ["groq", "moonshotai"],
    allow_fallbacks: false,
  },
  "z-ai/glm-4.6:exacto": {
    order: ["z-ai", "novita"],
    allow_fallbacks: false,
  },
  "deepseek/deepseek-v3.1-terminus:exacto": {
    order: ["novita", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-coder:exacto": {
    order: ["baseten"],
    allow_fallbacks: false,
  },
  "openai/gpt-oss-120b:exacto": {
    order: ["groq", "novita"],
    allow_fallbacks: false,
  },

  // Normal Providers
  "moonshotai/kimi-k2": {
    order: ["groq", "fireworks", "baseten", "parasail", "novita", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-coder": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-235b-a22b-thinking-2507": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-235b-a22b-07-25": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-30b-a3b-thinking-2507": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-30b-a3b-instruct-2507": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-30b-a3b:free": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-next-80b-a3b-thinking": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-next-80b-a3b-instruct": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "qwen/qwen3-max": {
    order: ["nebius", "baseten", "fireworks", "together", "deepinfra"],
    allow_fallbacks: false,
  },
  "deepseek/deepseek-v3.2-exp": {
    order: ["deepseek", "novita", "fireworks", "nebius"],
    allow_fallbacks: false,
  },
  "z-ai/glm-4.6": {
    order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
    allow_fallbacks: false,
  },
  "z-ai/glm-4.5v": {
    order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
    allow_fallbacks: false,
  },
  "z-ai/glm-4.5": {
    order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
    allow_fallbacks: false,
  },
  "z-ai/glm-4.5-air": {
    order: ["z-ai", "novita", "baseten", "fireworks", "chutes"],
    allow_fallbacks: false,
  },
};

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

export const CLINE_FREE_MODEL_EXCEPTIONS: readonly string[] = [
  "minimax-m2",
  "devstral-2512",
  "arcee-ai/trinity-large",
];

export const OPENROUTER_FREE_MODEL_EXCEPTIONS = CLINE_FREE_MODEL_EXCEPTIONS;

export function isDietCodeFreeModelException(modelId: string): boolean {
  const normalizedModelId = normalizeModelId(modelId);
  return CLINE_FREE_MODEL_EXCEPTIONS.some((token) => normalizedModelId.includes(token));
}

export const isOpenRouterFreeModelException = isDietCodeFreeModelException;

export function isOpenRouterFreeModel(
  modelId: string,
  inputPricePer1M?: number,
  outputPricePer1M?: number,
): boolean {
  const normalized = normalizeModelId(modelId);
  if (normalized.endsWith(":free") || normalized.includes(":free")) return true;
  if (isOpenRouterFreeModelException(normalized)) return true;
  if (inputPricePer1M !== undefined && outputPricePer1M !== undefined) {
    return inputPricePer1M === 0 && outputPricePer1M === 0;
  }
  return false;
}

/**
 * Filters OpenRouter model IDs based on provider-specific rules.
 * For OpenRouter provider (default): displays only :free models
 * For DietCode provider: excludes :free models (except known exception models)
 * For other providers: excludes dietcode/ prefixed models
 */
export function filterOpenRouterModelIds(
  modelIds: string[],
  provider: string = "openrouter",
  allowedFreeModelIds: string[] = [],
): string[] {
  if (provider === "dietcode") {
    const allowedFreeIdSet = new Set(allowedFreeModelIds.map((id) => normalizeModelId(id)));
    return modelIds.filter((id) => {
      const normalizedModelId = normalizeModelId(id);
      if (allowedFreeIdSet.has(normalizedModelId)) {
        return true;
      }
      if (isDietCodeFreeModelException(normalizedModelId)) {
        return true;
      }
      return !normalizedModelId.includes(":free");
    });
  }

  if (provider === "openrouter") {
    return modelIds.filter((id) => {
      const normalizedModelId = normalizeModelId(id);
      return !id.startsWith("dietcode/") && (normalizedModelId.endsWith(":free") || normalizedModelId.includes(":free"));
    });
  }

  return modelIds.filter((id) => !id.startsWith("dietcode/"));
}

/**
 * Filters model spec objects based on OpenRouter model filtering rules.
 */
export function filterOpenRouterModelSpecs<T extends { modelName: string; inputPricePer1M?: number; outputPricePer1M?: number; provider?: string }>(
  models: T[],
  provider: string = "openrouter",
  allowedFreeModelIds: string[] = [],
): T[] {
  if (provider === "openrouter") {
    const allowedFreeIdSet = new Set(allowedFreeModelIds.map((id) => normalizeModelId(id)));
    return models.filter((m) => {
      const normalizedModelId = normalizeModelId(m.modelName);
      if (m.modelName.startsWith("dietcode/")) return false;
      if (allowedFreeIdSet.has(normalizedModelId)) return true;
      if (isDietCodeFreeModelException(normalizedModelId)) return true;
      if (normalizedModelId.endsWith(":free") || normalizedModelId.includes(":free")) return true;
      if (m.inputPricePer1M === 0 && m.outputPricePer1M === 0 && (!m.provider || m.provider === "openrouter")) return true;
      return false;
    });
  }

  const modelNames = models.map((m) => m.modelName);
  const filteredNames = new Set(filterOpenRouterModelIds(modelNames, provider, allowedFreeModelIds));
  return models.filter((m) => filteredNames.has(m.modelName));
}


