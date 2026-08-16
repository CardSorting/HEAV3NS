/**
 * context-breakdown.contracts.ts
 *
 * Core contracts, interfaces, and invariants for
 * Context Window Token Composition Breakdown & Category Metering
 * (Phase 127 / ADR-103 / Target #60).
 */

export type ContextCategoryId =
  | "system_prompt"
  | "tool_definitions"
  | "rules"
  | "skills"
  | "mcp"
  | "subagent_definitions"
  | "memory"
  | "conversation";

export interface ContextCategorySlice {
  id: ContextCategoryId;
  label: string;
  tokens: number;
  percentage: number;
  color: string;
}

export interface ContextBreakdownReport {
  categories: ContextCategorySlice[];
  totalTokens: number;
  maxContextTokens: number;
  utilizationPercent: number;
  headroomTokens: number;
  compressionImminent: boolean;
  model: string;
  timestamp: number;
}

export interface ContextBreakdownConfig {
  defaultContextLimit: number;
  compressionThresholdPercent: number;
  tokenEstimationMultiplier: number;
}

export interface ContextBreakdownMetrics {
  totalBreakdowns: number;
  avgTokensComputed: number;
  maxTokensObserved: number;
  lastUtilizationPercent: number;
}

export interface ContextBreakdownWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  latestReport?: ContextBreakdownReport;
  config: ContextBreakdownConfig;
  metrics: ContextBreakdownMetrics;
}

export const DEFAULT_CONTEXT_BREAKDOWN_CONFIG: ContextBreakdownConfig = {
  defaultContextLimit: 128000,
  compressionThresholdPercent: 80,
  tokenEstimationMultiplier: 0.25, // roughly 4 chars per token
};
