/**
 * computer-use.contracts.ts
 *
 * Core data contracts for Deterministic Computer Use, Virtual Display Buffer,
 * Set-of-Marks (SoM) Element Overlay & OS Automation Subsystem (Phase 88 / ADR-040).
 */

export type ComputerActionType =
  | "capture"
  | "click"
  | "double_click"
  | "right_click"
  | "middle_click"
  | "drag"
  | "scroll"
  | "type"
  | "key"
  | "set_value"
  | "wait"
  | "list_windows"
  | "focus_window";

export type UiElementRole =
  | "button"
  | "input"
  | "pane"
  | "text"
  | "link"
  | "window"
  | "menu"
  | "checkbox"
  | "select"
  | "image";

export interface UiElementBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UiElement {
  readonly id: number;
  readonly label: string;
  readonly role: UiElementRole | string;
  readonly bounds: UiElementBounds;
  readonly value?: string;
  readonly focused?: boolean;
}

export interface VirtualWindow {
  readonly id: string;
  readonly title: string;
  readonly appName: string;
  readonly bounds: UiElementBounds;
  readonly active: boolean;
  readonly elements: readonly UiElement[];
}

export interface VirtualDisplayFrame {
  readonly frameIndex: number;
  readonly width: number;
  readonly height: number;
  readonly cursor: {
    readonly x: number;
    readonly y: number;
    readonly pressed: boolean;
  };
  readonly activeWindowId?: string;
  readonly windows: readonly VirtualWindow[];
  readonly elements: readonly UiElement[];
  readonly timestamp: number;
}

export interface ComputerActionResult {
  readonly actionId?: string;
  readonly success: boolean;
  readonly action: ComputerActionType;
  readonly frame: VirtualDisplayFrame;
  readonly durationMs: number;
  readonly error?: string;
  readonly timestamp?: number;
}

export interface ComputerWorkspaceSnapshot {
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly windowCount: number;
  readonly elementCount: number;
  readonly currentCursor: { readonly x: number; readonly y: number };
  readonly totalActions: number;
  readonly actions?: readonly ComputerActionResult[];
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface ComputerActionRow {
  readonly id: string;
  readonly action: string;
  readonly success: boolean;
  readonly frameIndex: number;
  readonly activeWindowId?: string;
  readonly durationMs: number;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface UiElementRow {
  readonly id: string;
  readonly elementId: number;
  readonly label: string;
  readonly role: string;
  readonly windowId?: string;
  readonly boundsJson: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

export interface DisplayAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type ComputerUseHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "error_spike";

export interface ComputerUseHealthAuditReport {
  readonly totalActions: number;
  readonly successfulActions: number;
  readonly failedActions: number;
  readonly overallSuccessRate: number;
  readonly avgActionLatencyMs: number;
  readonly windowCount: number;
  readonly elementDensity: number;
  readonly healthStatus: ComputerUseHealthStatus;
  readonly recommendations: readonly string[];
}

export interface ComputerUseMetricsReport {
  readonly totalActions: number;
  readonly successfulActions: number;
  readonly failedActions: number;
  readonly overallSuccessRate: number;
  readonly avgActionLatencyMs: number;
  readonly p50ActionLatencyMs: number;
  readonly p95ActionLatencyMs: number;
  readonly displayResolution: string;
  readonly topActions: readonly { action: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type ComputerUseGroupBy = "action" | "activeWindowId" | "success";

export type ComputerUseSortBy = "timestamp" | "durationMs" | "frameIndex";

export type ComputerUseSortDirection = "asc" | "desc";

export interface ComputerUseGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly successRate: number;
  readonly actions: readonly ComputerActionResult[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface ComputerUseDslQueryFilter {
  readonly rawQuery: string;
  readonly action?: ComputerActionType;
  readonly success?: boolean;
  readonly windowId?: string;
  readonly minDurationMs?: number;
  readonly maxDurationMs?: number;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface ComputerUseMutationUndoRecord {
  readonly mutationType: "record_action" | "purge_actions" | "register_window" | "bulk";
  readonly previousSnapshot: ComputerWorkspaceSnapshot;
  readonly nextSnapshot: ComputerWorkspaceSnapshot;
  readonly timestampMs: number;
}

export interface ComputerUseBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedActionIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliDisplaySubstrate {
  recordAction(result: ComputerActionResult): void;
  getAction(actionId: string): ComputerActionResult | undefined;
  listActions(limit?: number): readonly ComputerActionResult[];
  getMetrics(): ComputerUseMetricsReport;
  auditHealth(): ComputerUseHealthAuditReport;
  getGroupedActions(groupBy?: ComputerUseGroupBy, sortBy?: ComputerUseSortBy, direction?: ComputerUseSortDirection): readonly ComputerUseGroupedLane[];
  queryActionsDsl(query: ComputerUseDslQueryFilter | string): readonly ComputerActionResult[];
  bulkPurgeActions(actionIds: readonly string[]): ComputerUseBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): ComputerWorkspaceSnapshot;
  importSnapshot(snapshot: ComputerWorkspaceSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}
