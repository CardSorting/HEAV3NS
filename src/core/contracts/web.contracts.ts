/**
 * web.contracts.ts
 *
 * Core data contracts for the Deterministic Web Intelligence, Semantic Extraction & SSRF URL Guardrail Substrate (Phase 82 / ADR-034).
 */

export interface UrlSecurityVerdict {
  readonly safe: boolean;
  readonly sanitizedUrl?: string;
  readonly hostname?: string;
  readonly ipAddress?: string;
  readonly reason?: string;
  readonly isPrivateIp: boolean;
  readonly isMetadataEndpoint: boolean;
}

export type WebExtractionFormat = "markdown" | "text" | "html" | "summary";

export interface WebSearchHit {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly score: number;
  readonly publishedDate?: string;
}

export interface WebSearchResult {
  readonly query: string;
  readonly totalHits: number;
  readonly hits: readonly WebSearchHit[];
  readonly latencyMs: number;
}

export interface WebContentExtraction {
  readonly url: string;
  readonly title: string;
  readonly content: string;
  readonly excerpt: string;
  readonly format: WebExtractionFormat;
  readonly byteLength: number;
  readonly author?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface WebSessionState {
  readonly cachedSearches: Record<string, WebSearchResult>;
  readonly cachedPages: Record<string, WebContentExtraction>;
  readonly blockedDomains: readonly string[];
}

export interface WebWorkspaceSnapshot {
  readonly searchCacheSize: number;
  readonly pageCacheSize: number;
  readonly totalSearches: number;
  readonly totalExtractions: number;
  readonly timestamp: number;
}
