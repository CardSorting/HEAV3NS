/**
 * runbook.contracts.ts
 *
 * Core data contracts for Declarative Runbook Finite State Machines (FSM),
 * Phase Gating Order, Zero-Subshell File Predicates, Scoped Dynamic Check Manifests,
 * and Context Lifecycle Synthesis (Phase 193 / ADR-123).
 */

export type RunbookHookType =
  | "message"
  | "manual"
  | "checklist"
  | "command"
  | "predicate"
  | "llm_review";

export type RunbookFailurePolicy = "block" | "continue";

export interface FilePredicateConfig {
  readonly path: string;
  readonly cwd?: string;
  readonly exists?: boolean;
  readonly nonEmpty?: boolean;
  readonly contains?: string;
  readonly notContains?: string;
  readonly matchesPattern?: string;
  readonly jsonPath?: string;
  readonly equals?: unknown;
  readonly oneOf?: readonly unknown[];
}

export interface RunbookCheckItem {
  readonly type: RunbookHookType;
  readonly text?: string;
  readonly prompt?: string;
  readonly name?: string;
  readonly command?: string;
  readonly timeoutSeconds?: number;
  readonly cwd?: string;
  readonly items?: readonly string[];
  readonly checks?: readonly string[];
  readonly predicate?: FilePredicateConfig;
  readonly path?: string;
  readonly exists?: boolean;
  readonly nonEmpty?: boolean;
  readonly contains?: string;
  readonly notContains?: string;
  readonly matchesPattern?: string;
  readonly jsonPath?: string;
  readonly equals?: unknown;
  readonly oneOf?: readonly unknown[];
  readonly acceptContains?: string;
  readonly rejectContains?: string;
  readonly acceptRegex?: string;
  readonly rejectRegex?: string;
  readonly stdin?: boolean;
  readonly blocking?: boolean;
  readonly onFailure?: RunbookFailurePolicy;
  readonly reason?: string;
}

export interface DynamicBeforeTransferConfig {
  readonly path: "current_entry";
  readonly required?: boolean;
  readonly minItems?: number;
  readonly requireReason?: boolean;
  readonly requireBasis?: boolean;
  readonly allowTypes?: readonly RunbookHookType[];
  readonly stalePolicy?: "require_confirmation" | "auto_accept";
}

export interface RunbookNodeDefinition {
  readonly id: string;
  readonly prompt: string;
  readonly inHook?: readonly RunbookCheckItem[];
  readonly beforeTransfer?: readonly RunbookCheckItem[];
  readonly dynamicBeforeTransfer?: DynamicBeforeTransferConfig;
  readonly outHook?: readonly RunbookCheckItem[];
}

export interface RunbookEdgeDefinition {
  readonly from: string;
  readonly to: string;
  readonly condition?: string | RunbookCheckItem | readonly RunbookCheckItem[];
  readonly hook?: readonly RunbookCheckItem[];
  readonly maxAttempts?: number;
}

export interface RunbookSpec {
  readonly name: string;
  readonly initial: string;
  readonly nodes: Record<string, RunbookNodeDefinition>;
  readonly edges: readonly RunbookEdgeDefinition[];
  readonly rawText?: string;
  readonly specHash?: string;
}

export interface DynamicCheckProducerMetadata {
  readonly agentId: string;
  readonly role?: string;
  readonly path?: string;
  readonly updatedAt: string;
}

export interface DynamicEntryCheckManifest {
  readonly entryId: string;
  readonly nodeName: string;
  readonly runId: string;
  readonly producer: DynamicCheckProducerMetadata;
  readonly basis?: {
    readonly taskContract?: string;
    readonly implementationSummary?: string;
    readonly [key: string]: unknown;
  };
  readonly checks: readonly RunbookCheckItem[];
  readonly registeredAt: number;
}

export interface DynamicEntryDirectoryManifest {
  readonly entryId: string;
  readonly node: string;
  readonly producers: readonly DynamicCheckProducerMetadata[];
  readonly updatedAt: string;
}

export interface CheckExecutionResult {
  readonly type: RunbookHookType;
  readonly purpose: string;
  readonly passed: boolean;
  readonly output: string;
  readonly exitCode?: number;
  readonly durationMs?: number;
  readonly details?: Record<string, unknown>;
}

export interface DynamicCheckEvaluationPayload {
  readonly configured: boolean;
  readonly entryId?: string;
  readonly producers: readonly DynamicCheckProducerMetadata[];
  readonly checksSnapshot: readonly RunbookCheckItem[];
  readonly results: readonly CheckExecutionResult[];
}

export interface RunbookTransitionResult {
  readonly runId: string;
  readonly from: string;
  readonly to: string;
  readonly current: string;
  readonly currentEntryId: string;
  readonly results: readonly CheckExecutionResult[];
  readonly attempt?: number;
  readonly attemptsUsed?: number;
  readonly maxAttempts?: number;
  readonly attemptsRemaining?: number;
}

export interface RunbookHistoryEvent {
  readonly timestamp: string;
  readonly event: "start" | "goto" | "goto_blocked" | "save" | "save_blocked" | "dynamic_check";
  readonly runId: string;
  readonly current?: string;
  readonly currentEntryId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly node?: string;
  readonly stage?: string;
  readonly beforeTransfer?: readonly CheckExecutionResult[];
  readonly dynamicBeforeTransfer?: DynamicCheckEvaluationPayload;
  readonly condition?: readonly CheckExecutionResult[];
  readonly outHook?: readonly CheckExecutionResult[];
  readonly edgeHook?: readonly CheckExecutionResult[];
  readonly inHook?: readonly CheckExecutionResult[];
  readonly results?: readonly CheckExecutionResult[];
  readonly details?: Record<string, unknown>;
}

export interface RunbookRuntimeState {
  readonly runId: string;
  readonly specName: string;
  readonly specHash: string;
  readonly specPath?: string;
  readonly current: string;
  readonly currentEntryId: string;
  readonly activeAgentId?: string;
  readonly activeAgentRole?: string;
  readonly status: "active" | "blocked" | "completed" | "paused";
  readonly edgeAttempts: Record<string, Record<string, Record<string, number>>>; // entryId -> from -> to -> count
  readonly history: readonly RunbookHistoryEvent[];
}

export interface RunbookStateOverview {
  readonly runId: string;
  readonly current: string;
  readonly currentEntryId: string;
  readonly nodes: readonly {
    readonly name: string;
    readonly prompt: string;
    readonly inHook?: readonly RunbookCheckItem[];
    readonly beforeTransfer?: readonly RunbookCheckItem[];
    readonly dynamicBeforeTransfer?: DynamicBeforeTransferConfig;
    readonly outHook?: readonly RunbookCheckItem[];
  }[];
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly condition?: unknown;
    readonly hook?: unknown;
    readonly maxAttempts?: number;
  }[];
}

export interface RunbookCurrentStateView {
  readonly runId: string;
  readonly specName: string;
  readonly current: string;
  readonly currentEntryId: string;
  readonly prompt: string;
  readonly beforeTransfer?: readonly RunbookCheckItem[];
  readonly dynamicBeforeTransfer?: {
    readonly configured: boolean;
    readonly entryId: string;
    readonly path: string;
  };
  readonly next: readonly {
    readonly to: string;
    readonly condition?: string;
    readonly maxAttempts?: number;
  }[];
}
