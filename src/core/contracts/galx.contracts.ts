/**
 * galx.contracts.ts
 *
 * GALX AI Wholesale Compute Clearinghouse Contracts, Transport Definitions,
 * Merkle Ledger Structures, and Model Specifications (Phase 136 / ADR-112).
 */

export const DEFAULT_GALX_BASE_URL = "https://galx.ai/v1";
export const DEFAULT_GALX_CLEARINGHOUSE_URL = "https://galx.ai";
export const DEFAULT_GALX_MODEL_ID = "gpt-5.6-sol";
export const DEFAULT_GALX_CLIENT_TAG = "LUMI/12.5.0";
export const DEFAULT_GALX_CLIENT_ID = "lumi-ide";

export interface GalxModelInfo {
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

export interface GalxModelSpec {
  modelName: string;
  provider: "galx";
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  cacheReadsPricePer1M?: number;
  supportsVision: boolean;
  supportsReasoning?: boolean;
  estimatedLatencyMs?: number;
  description?: string;
  wholesaleDiscountPercent?: number;
}

export interface GalxHandlerOptions {
  galxApiKey?: string;
  galxBaseUrl?: string;
  galxModelId?: string;
  galxModelInfo?: GalxModelInfo;
  reasoningEffort?: string;
  thinkingBudgetTokens?: number;
}

export interface GalxTransportOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerCooldownMs?: number;
  clientVersion?: string;
  keyId?: string;
  sharedSecret?: string;
  maxConcurrentRequests?: number;
  rateLimitPerMinute?: number;
  enableBackgroundOutboxWorker?: boolean;
  customStorageDir?: string;
}

export interface GalxIngestPayload {
  provider: "openai" | "openrouter" | "anthropic" | "grok" | "galx" | (string & {});
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  idToken?: string;
  expiresAtMs?: number;
  email?: string;
  displayName?: string;
  mode?: "pooled" | "private" | (string & {});
  authType?: "oauth" | "api_key" | (string & {});
  [key: string]: unknown;
}

export interface GalxTransportResponse<T = unknown> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
  correlationId?: string;
  idempotentReplay?: boolean;
  durationMs: number;
  attempts: number;
  serverTiming?: string;
  shardId?: string;
  edgeRegion?: string;
  dpopProof?: string;
  traceId?: string;
}

export interface CircuitBreakerState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  consecutiveFailures: number;
  lastStateChangeMs: number;
  lastError?: string;
}

export interface TransportAuditReport {
  circuitBreaker: CircuitBreakerState;
  concurrencyLimit: number;
  inFlightRequests: number;
  activeShardAffinity?: string;
  activeEdgeRegion?: string;
  latestReceiptHash: string;
  merkleRoot: string;
  tokenBucketAvailable: number;
  slaMetrics: BroccoliSlaMetrics;
}

export interface BroccoliTransportEntry {
  id: string;
  correlationId: string;
  idempotencyKey: string;
  path: string;
  payloadHash: string;
  payload: Record<string, unknown>;
  status: "QUEUED" | "IN_FLIGHT" | "COMMITTED" | "FAILED" | "REPLAYED";
  attempts: number;
  lastError?: string;
  createdAtMs: number;
  updatedAtMs: number;
  serverTiming?: string;
  receiptHash?: string;
  shardId?: string;
  edgeRegion?: string;
  traceId?: string;
  spanId?: string;
}

export interface BroccoliDeliveryReceipt {
  receiptId: string;
  correlationId: string;
  idempotencyKey: string;
  status: number;
  receiptHash: string;
  prevReceiptHash: string;
  timestampMs: number;
  durationMs: number;
  shardId?: string;
  edgeRegion?: string;
  traceId?: string;
}

export interface BroccoliSlaMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  replayedRequests: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p99LatencyMs: number;
  averageLatencyMs: number;
  outboxQueueDepth: number;
  merkleRoot: string;
}

export interface BroccoliEnvelopePayload {
  iv: string;
  tag: string;
  encryptedData: string;
  keyId: string;
  algorithm: "AES-256-GCM";
  salt: string;
}

export interface TraceContext {
  traceparent: string;
  tracestate: string;
  traceId: string;
  spanId: string;
}

export interface GalxAttributionHeaders {
  "X-GALX-Client": string;
  "X-GALX-Client-ID": string;
  "X-OpenRouter-Title": string;
  "HTTP-Referer"?: string;
}

export const GALX_DEFAULT_MODELS: Record<string, GalxModelSpec> = {
  "gpt-5.6-sol": {
    modelName: "gpt-5.6-sol",
    provider: "galx",
    contextWindowTokens: 900_000,
    maxOutputTokens: 128_000,
    inputPricePer1M: 3.75,
    outputPricePer1M: 15.0,
    cacheReadsPricePer1M: 1.25,
    supportsVision: true,
    supportsReasoning: true,
    estimatedLatencyMs: 35,
    wholesaleDiscountPercent: 25,
    description:
      "Flagship coding, deep mathematics, algorithmic reasoning, and multi-file architecture with 25% wholesale discount and 75% prompt cache pass-through.",
  },
  "gpt-5.6-terra": {
    modelName: "gpt-5.6-terra",
    provider: "galx",
    contextWindowTokens: 900_000,
    maxOutputTokens: 128_000,
    inputPricePer1M: 2.25,
    outputPricePer1M: 9.0,
    cacheReadsPricePer1M: 0.75,
    supportsVision: true,
    supportsReasoning: true,
    estimatedLatencyMs: 25,
    wholesaleDiscountPercent: 25,
    description:
      "Balanced frontier agentic coding model for large-scale refactoring and daily development with 25% wholesale discount.",
  },
  "gpt-5.6-luna": {
    modelName: "gpt-5.6-luna",
    provider: "galx",
    contextWindowTokens: 900_000,
    maxOutputTokens: 128_000,
    inputPricePer1M: 0.95,
    outputPricePer1M: 3.8,
    cacheReadsPricePer1M: 0.3,
    supportsVision: true,
    supportsReasoning: false,
    estimatedLatencyMs: 12,
    wholesaleDiscountPercent: 36,
    description:
      "High-velocity rapid iteration coding engine optimized for instant sub-second completions with 36% wholesale discount.",
  },
};
