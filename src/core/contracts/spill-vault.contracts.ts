/**
 * spill-vault.contracts.ts
 *
 * Core contracts, data types, and invariants for
 * Spill-Safe File Vault, Context-Overflow Result Persistence & Multi-Tier Turn Budget Governor
 * (Phase 117 / ADR-093 / Target #50).
 */

export type SpillPrivacyTier = "private" | "public";

export interface PersistedResultDescriptor {
  resultId: string;
  sessionId: string;
  toolName: string;
  filePath: string;
  originalSize: number;
  previewSize: number;
  createdAt: number;
}

export interface TurnBudgetConfig {
  maxResultChars: number;
  maxTurnBudgetChars: number;
  previewHeadChars: number;
  previewTailChars: number;
  enabled: boolean;
}

export interface TurnBudgetEnforcementResult {
  spilledCount: number;
  originalTotalChars: number;
  finalTotalChars: number;
  persistedResults: readonly PersistedResultDescriptor[];
}

export interface SpillVaultMetrics {
  totalPersistedResults: number;
  totalBytesSpilled: number;
  totalTurnBudgetEnforcements: number;
  activeSessionCount: number;
}

export interface SpillVaultWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  persistedResults: readonly PersistedResultDescriptor[];
  metrics: SpillVaultMetrics;
}

export const DEFAULT_MAX_RESULT_CHARS = 10_000;
export const DEFAULT_MAX_TURN_BUDGET_CHARS = 100_000;
export const DEFAULT_PREVIEW_HEAD = 500;
export const DEFAULT_PREVIEW_TAIL = 500;

export const PERSISTED_OUTPUT_TAG = "<persisted-output>";
export const PERSISTED_OUTPUT_CLOSING_TAG = "</persisted-output>";
