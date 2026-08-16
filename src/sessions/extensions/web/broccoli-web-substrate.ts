/**
 * broccoli-web-substrate.ts
 *
 * In-memory Broccolidb substrate for cached web searches, extracted documents,
 * and domain security policies (Phase 82 / ADR-034).
 */

import type {
  WebContentExtraction,
  WebSearchResult,
  WebWorkspaceSnapshot,
} from "../../../core/contracts/web.contracts.js";

export class BroccoliWebSubstrate {
  private searchCache: Map<string, WebSearchResult>;
  private pageCache: Map<string, WebContentExtraction>;
  private blockedDomains: Set<string>;
  private totalSearches: number;
  private totalExtractions: number;

  constructor() {
    this.searchCache = new Map<string, WebSearchResult>();
    this.pageCache = new Map<string, WebContentExtraction>();
    this.blockedDomains = new Set<string>();
    this.totalSearches = 0;
    this.totalExtractions = 0;
  }

  /**
   * Caches a search result by query.
   */
  cacheSearch(query: string, result: WebSearchResult): void {
    this.searchCache.set(query.toLowerCase().trim(), result);
    this.totalSearches++;
  }

  /**
   * Retrieves a cached search result.
   */
  getCachedSearch(query: string): WebSearchResult | undefined {
    return this.searchCache.get(query.toLowerCase().trim());
  }

  /**
   * Caches extracted web content by URL.
   */
  cachePage(url: string, extraction: WebContentExtraction): void {
    this.pageCache.set(url.trim(), extraction);
    this.totalExtractions++;
  }

  /**
   * Retrieves cached extracted page content.
   */
  getCachedPage(url: string): WebContentExtraction | undefined {
    return this.pageCache.get(url.trim());
  }

  /**
   * Lists all cached web extractions.
   */
  listCachedPages(): readonly WebContentExtraction[] {
    return Array.from(this.pageCache.values());
  }

  /**
   * Adds a domain to the blocked domain list.
   */
  blockDomain(domain: string): void {
    this.blockedDomains.add(domain.toLowerCase().trim());
  }

  /**
   * Removes a domain from the blocked domain list.
   */
  unblockDomain(domain: string): void {
    this.blockedDomains.delete(domain.toLowerCase().trim());
  }

  /**
   * Checks whether a domain is blocked.
   */
  isDomainBlocked(domain: string): boolean {
    const clean = domain.toLowerCase().trim();
    if (this.blockedDomains.has(clean)) return true;
    for (const b of this.blockedDomains) {
      if (clean.endsWith(`.${b}`)) return true;
    }
    return false;
  }

  /**
   * Lists all blocked domains.
   */
  listBlockedDomains(): readonly string[] {
    return Array.from(this.blockedDomains);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): WebWorkspaceSnapshot {
    return {
      searchCacheSize: this.searchCache.size,
      pageCacheSize: this.pageCache.size,
      totalSearches: this.totalSearches,
      totalExtractions: this.totalExtractions,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: WebWorkspaceSnapshot): void {
    this.totalSearches = snapshot.totalSearches;
    this.totalExtractions = snapshot.totalExtractions;
  }

  /**
   * Resets substrate caches.
   */
  clear(): void {
    this.searchCache.clear();
    this.pageCache.clear();
    this.blockedDomains.clear();
    this.totalSearches = 0;
    this.totalExtractions = 0;
  }
}
