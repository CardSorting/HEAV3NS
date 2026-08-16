/**
 * auxiliary-router.contracts.ts
 *
 * Core contracts for Deterministic Auxiliary Client Router, Sub-Task Fallback Chain & Dynamic User Model Selection (Phase 101 / ADR-055).
 */

export type AuxiliaryTaskType =
  | "compression"
  | "search"
  | "web_extract"
  | "vision_analysis"
  | "browser_vision"
  | "title_generation"
  | "insights"
  | "patch_review"
  | "commit_message";

export interface AuxiliaryProviderConfig {
  readonly provider: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly isFreeOnly?: boolean;
  readonly supportsVision?: boolean;
  readonly priority: number;
  readonly simulatedQuotaRemaining?: number;
}

export interface AuxiliaryRoutingRequest {
  readonly taskType: AuxiliaryTaskType;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly requiresVision?: boolean;
  readonly maxTokens?: number;
  readonly customModelOverride?: string;
}

export interface AuxiliaryDispatchAttempt {
  readonly provider: string;
  readonly model: string;
  readonly status: "success" | "failed" | "skipped";
  readonly error?: string;
  readonly latencyMs: number;
}

export interface AuxiliaryRoutingResult {
  readonly success: boolean;
  readonly taskType: AuxiliaryTaskType;
  readonly selectedProvider: string;
  readonly selectedModel: string;
  readonly attempts: readonly AuxiliaryDispatchAttempt[];
  readonly outputText: string;
  readonly tokensUsed: number;
}

export interface AuxiliaryWorkspaceSnapshot {
  readonly providers: readonly AuxiliaryProviderConfig[];
  readonly taskOverrides: Record<string, AuxiliaryProviderConfig>;
  readonly freeOnly: boolean;
  readonly timestamp: number;
}
