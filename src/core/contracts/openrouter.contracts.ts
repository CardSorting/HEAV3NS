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
