/**
 * web-intelligence-supervisor.ts
 *
 * Master Web Intelligence Supervisor coordinating SSRF firewall protection,
 * search query ranking, semantic content extraction, and readability filters (Phase 82 / ADR-034).
 */

import type {
  WebContentExtraction,
  WebExtractionFormat,
  WebSearchResult,
  UrlSecurityVerdict,
} from "../../../core/contracts/web.contracts.js";
import { DeterministicWebEngine } from "../../../tooling/extensions/web/deterministic-web-engine.js";
import { BroccoliWebSubstrate } from "../../../sessions/extensions/web/broccoli-web-substrate.js";

export class WebIntelligenceSupervisor {
  private engine: DeterministicWebEngine;
  private substrate: BroccoliWebSubstrate;

  constructor(engine: DeterministicWebEngine, substrate: BroccoliWebSubstrate) {
    this.engine = engine;
    this.substrate = substrate;
  }

  /**
   * Evaluates whether a URL is secure against SSRF and domain policy blocks.
   */
  verifyUrl(url: string): UrlSecurityVerdict {
    const verdict = this.engine.evaluateUrlSecurity(url);
    if (!verdict.safe) return verdict;

    if (verdict.hostname && this.substrate.isDomainBlocked(verdict.hostname)) {
      return {
        safe: false,
        sanitizedUrl: verdict.sanitizedUrl,
        hostname: verdict.hostname,
        reason: `Domain '${verdict.hostname}' is blocked by repository security policy`,
        isPrivateIp: false,
        isMetadataEndpoint: false,
      };
    }

    return verdict;
  }

  /**
   * Executes a web search query using cached entries or deterministic index.
   */
  search(query: string, limit: number = 5): WebSearchResult {
    const cached = this.substrate.getCachedSearch(query);
    if (cached) return cached;

    const pages = this.substrate.listCachedPages();
    const result = this.engine.performDeterministicSearch(query, pages, limit);
    this.substrate.cacheSearch(query, result);
    return result;
  }

  /**
   * Extracts clean semantic content from HTML markup or URL.
   */
  extractContent(
    url: string,
    htmlContent?: string,
    format: WebExtractionFormat = "markdown"
  ): { success: boolean; extraction?: WebContentExtraction; error?: string } {
    const verdict = this.verifyUrl(url);
    if (!verdict.safe) {
      return {
        success: false,
        error: `URL security check failed: ${verdict.reason}`,
      };
    }

    const cached = this.substrate.getCachedPage(url);
    if (cached && !htmlContent) {
      return { success: true, extraction: cached };
    }

    const htmlToParse = htmlContent ?? `<html><head><title>Web Document</title></head><body><p>Content from ${url}</p></body></html>`;
    const extraction = this.engine.extractSemanticContent(htmlToParse, url, format);

    this.substrate.cachePage(url, extraction);
    return { success: true, extraction };
  }

  /**
   * Blocks a domain from being accessed by the agent.
   */
  blockDomain(domain: string): void {
    this.substrate.blockDomain(domain);
  }

  /**
   * Unblocks a domain.
   */
  unblockDomain(domain: string): void {
    this.substrate.unblockDomain(domain);
  }

  /**
   * Returns statistics about searches, extractions, and blocked domains.
   */
  getStats(): { totalSearches: number; totalExtractions: number; blockedDomainsCount: number } {
    const snapshot = this.substrate.exportSnapshot();
    return {
      totalSearches: snapshot.totalSearches,
      totalExtractions: snapshot.totalExtractions,
      blockedDomainsCount: this.substrate.listBlockedDomains().length,
    };
  }
}
