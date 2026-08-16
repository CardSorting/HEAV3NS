/**
 * prompt-cache.contracts.ts
 *
 * Core data contracts for Deterministic Byte-Stable Prompt Cache Boundary,
 * Progressive System Envelope & Reasoning Sanitizer Subsystem (Phase 93 / ADR-045).
 */

export type CacheBreakpointType = "static_prefix" | "system_tail" | "history_mid" | "turn_tail";

export interface PromptCacheMarker {
  readonly type: "ephemeral";
  readonly ttl?: string;
  readonly priority?: number;
}

export interface PromptCacheBreakpoint {
  readonly breakpointIndex: number;
  readonly target: "system" | "message" | "tool";
  readonly breakpointType: CacheBreakpointType;
  readonly byteOffset: number;
  readonly tokenEstimate: number;
}

export interface ByteStablePromptEnvelope {
  readonly staticPrefixBytes: number;
  readonly systemPromptHash: string;
  readonly dynamicSuffixBytes: number;
  readonly totalPromptBytes: number;
  readonly breakpoints: readonly PromptCacheBreakpoint[];
}

export interface ReasoningSanitizationResult {
  readonly sanitizedContent: string;
  readonly reasoningContent?: string;
  readonly hasThinkTags: boolean;
  readonly strippedTokensCount: number;
}

export interface PromptCacheWorkspaceSnapshot {
  readonly envelopeHash: string;
  readonly totalBreakpoints: number;
  readonly activeBreakpoints: readonly PromptCacheBreakpoint[];
  readonly timestamp: number;
}
