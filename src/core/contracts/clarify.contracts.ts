/**
 * clarify.contracts.ts
 *
 * Core data contracts for the Deterministic Clarification, Interactive Inquiry &
 * Intent Disambiguation Subsystem (Phase 85 / ADR-037).
 */

export type ClarifyInputMode = "single_select" | "multi_select" | "free_text";

export interface ClarifyChoice {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly isRecommended?: boolean;
}

export interface ClarifyInquiry {
  readonly id: string;
  readonly question: string;
  readonly mode: ClarifyInputMode;
  readonly choices: readonly ClarifyChoice[];
  readonly timeoutMs?: number;
  readonly defaultChoiceId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdFrame: number;
  readonly timestamp: number;
}

export interface ClarifyResolution {
  readonly inquiryId: string;
  readonly selectedChoiceIds: readonly string[];
  readonly writeInResponse?: string;
  readonly resolvedBy: "user" | "timeout" | "default" | "auto_policy";
  readonly resolutionDurationMs: number;
  readonly timestamp: number;
}

export interface ClarifyWorkspaceSnapshot {
  readonly activeInquiryId?: string;
  readonly totalInquiries: number;
  readonly resolvedCount: number;
  readonly timestamp: number;
}
