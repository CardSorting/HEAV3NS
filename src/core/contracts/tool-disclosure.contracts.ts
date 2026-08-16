/**
 * tool-disclosure.contracts.ts
 *
 * Core data contracts for Progressive Tool Disclosure, Dynamic Schema Gateway
 * & Deferred Tooling Subsystem (Phase 91 / ADR-043).
 */

export interface DeferredToolDefinition {
  readonly name: string;
  readonly namespace: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly isCore: boolean;
  readonly tags: readonly string[];
}

export type DisclosureTier = "eager" | "budgeted_listing" | "names_only" | "search_only";

export interface DisclosureManifest {
  readonly totalRegistered: number;
  readonly eagerCount: number;
  readonly deferredCount: number;
  readonly activeTier: DisclosureTier;
  readonly tokenBudget: number;
  readonly summary: string;
}

export interface ToolSearchResult {
  readonly query: string;
  readonly totalMatches: number;
  readonly tools: readonly DeferredToolDefinition[];
}

export interface ToolDisclosureWorkspaceSnapshot {
  readonly totalTools: number;
  readonly deferredToolsCount: number;
  readonly activatedTools: readonly string[];
  readonly activeTier: DisclosureTier;
  readonly timestamp: number;
}
