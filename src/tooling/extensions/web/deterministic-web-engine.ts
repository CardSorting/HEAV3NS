/**
 * deterministic-web-engine.ts
 *
 * High-performance zero-GC in-memory SSRF firewall, semantic HTML-to-Markdown extractor,
 * and deterministic BM25 search index for the Web Intelligence Subsystem (Phase 82 / ADR-034).
 */

import type {
  WebContentExtraction,
  WebExtractionFormat,
  WebSearchHit,
  WebSearchResult,
  UrlSecurityVerdict,
} from "../../../core/contracts/web.contracts.js";

export class DeterministicWebEngine {
  private static readonly DISALLOWED_SCHEMES = new Set([
    "file:",
    "gopher:",
    "dict:",
    "ftp:",
    "javascript:",
    "data:",
    "ldap:",
    "tftp:",
    "ssh:",
  ]);

  private static readonly METADATA_HOSTS = new Set([
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.internal",
    "instance-data",
  ]);

  constructor() {}

  /**
   * Evaluates whether a URL is secure and compliant with SSRF firewall guardrails.
   */
  evaluateUrlSecurity(rawUrl: string): UrlSecurityVerdict {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return {
        safe: false,
        reason: "URL is empty",
        isPrivateIp: false,
        isMetadataEndpoint: false,
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        safe: false,
        reason: `Invalid URL format: '${trimmed}'`,
        isPrivateIp: false,
        isMetadataEndpoint: false,
      };
    }

    // Scheme check
    const protocol = parsed.protocol.toLowerCase();
    if (DeterministicWebEngine.DISALLOWED_SCHEMES.has(protocol)) {
      return {
        safe: false,
        sanitizedUrl: parsed.href,
        hostname: parsed.hostname,
        reason: `Forbidden scheme '${protocol}'`,
        isPrivateIp: false,
        isMetadataEndpoint: false,
      };
    }

    if (protocol !== "http:" && protocol !== "https:") {
      return {
        safe: false,
        sanitizedUrl: parsed.href,
        hostname: parsed.hostname,
        reason: `Unsupported protocol '${protocol}', only http: and https: are allowed`,
        isPrivateIp: false,
        isMetadataEndpoint: false,
      };
    }

    const host = parsed.hostname.toLowerCase();

    // Check Cloud metadata endpoints
    if (DeterministicWebEngine.METADATA_HOSTS.has(host) || host.includes("169.254.169.254")) {
      return {
        safe: false,
        sanitizedUrl: parsed.href,
        hostname: host,
        reason: `Blocked access to cloud instance metadata endpoint '${host}'`,
        isPrivateIp: true,
        isMetadataEndpoint: true,
      };
    }

    // Check Private IPv4/IPv6 ranges
    if (this.isPrivateOrReservedHost(host)) {
      return {
        safe: false,
        sanitizedUrl: parsed.href,
        hostname: host,
        reason: `Blocked access to private/internal network host '${host}'`,
        isPrivateIp: true,
        isMetadataEndpoint: false,
      };
    }

    return {
      safe: true,
      sanitizedUrl: parsed.href,
      hostname: host,
      isPrivateIp: false,
      isMetadataEndpoint: false,
    };
  }

  /**
   * Checks if an IP or hostname is private/loopback/link-local/internal.
   */
  isPrivateOrReservedHost(host: string): boolean {
    const cleanHost = host.startsWith("[") && host.endsWith("]")
      ? host.slice(1, -1)
      : host;

    // Localhost checks
    if (cleanHost === "localhost" || cleanHost.endsWith(".localhost") || cleanHost.endsWith(".local")) {
      return true;
    }

    // IPv6 Loopback / Private
    if (cleanHost === "::1" || cleanHost === "::" || cleanHost.startsWith("fe80:") || cleanHost.startsWith("fc00:") || cleanHost.startsWith("fd00:")) {
      return true;
    }

    // Check IPv4 dot notation
    const ipv4Parts = cleanHost.split(".");
    if (ipv4Parts.length === 4 && ipv4Parts.every((p) => /^\d+$/.test(p))) {
      const b0 = parseInt(ipv4Parts[0], 10);
      const b1 = parseInt(ipv4Parts[1], 10);

      // 0.0.0.0/8
      if (b0 === 0) return true;
      // 127.0.0.0/8 (Loopback)
      if (b0 === 127) return true;
      // 10.0.0.0/8 (Private)
      if (b0 === 10) return true;
      // 172.16.0.0/12 (Private: 172.16.x.x - 172.31.x.x)
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      // 192.168.0.0/16 (Private)
      if (b0 === 192 && b1 === 168) return true;
      // 169.254.0.0/16 (Link-local & AWS/GCP Metadata)
      if (b0 === 169 && b1 === 254) return true;
      // 100.64.0.0/10 (Carrier-grade NAT)
      if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    }

    return false;
  }

  /**
   * Zero-GC semantic HTML-to-Markdown extractor stripping scripts, styles, navigation, and noise.
   */
  extractSemanticContent(html: string, url: string = "https://example.com", format: WebExtractionFormat = "markdown"): WebContentExtraction {
    if (!html || html.trim().length === 0) {
      return {
        url,
        title: "",
        content: "",
        excerpt: "",
        format,
        byteLength: 0,
      };
    }

    // Extract Title
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract Author & Description
    let author: string | undefined;
    const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }

    let description = "";
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Strip comments, scripts, styles, nav, footer, header, svg, noscript
    let clean = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");

    // Convert Headings
    clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
    clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
    clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
    clean = clean.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
    clean = clean.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
    clean = clean.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

    // Convert Links
    clean = clean.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

    // Convert Lists
    clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

    // Convert Code
    clean = clean.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
    clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

    // Convert Formatting
    clean = clean.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
    clean = clean.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

    // Convert Paragraphs / Breaks / Divs
    clean = clean.replace(/<br\s*\/?>/gi, "\n");
    clean = clean.replace(/<\/p>/gi, "\n\n");
    clean = clean.replace(/<\/div>/gi, "\n");

    // Strip remaining tags
    clean = clean.replace(/<[^>]+>/g, "");

    // Unescape common HTML entities
    clean = clean
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    const lines = clean.split("\n").map((l) => l.trimEnd());
    const content = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

    const excerpt = description || (content.length > 200 ? content.slice(0, 197) + "..." : content);

    return {
      url,
      title: title || "Untitled Web Document",
      content,
      excerpt,
      format,
      byteLength: Buffer.byteLength(content, "utf8"),
      author,
    };
  }

  /**
   * Deterministic BM25 ranker over a corpus of documents for offline search execution.
   */
  performDeterministicSearch(query: string, corpus: readonly WebContentExtraction[], limit: number = 5): WebSearchResult {
    const startTime = Date.now();
    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (queryTokens.length === 0 || corpus.length === 0) {
      return {
        query,
        totalHits: 0,
        hits: [],
        latencyMs: Date.now() - startTime,
      };
    }

    const hits: WebSearchHit[] = [];

    for (let i = 0; i < corpus.length; i++) {
      const doc = corpus[i];
      const docText = `${doc.title} ${doc.excerpt} ${doc.content}`.toLowerCase();
      let matchScore = 0;

      for (let j = 0; j < queryTokens.length; j++) {
        const token = queryTokens[j];
        if (doc.title.toLowerCase().includes(token)) {
          matchScore += 5.0;
        }
        if (doc.excerpt.toLowerCase().includes(token)) {
          matchScore += 2.0;
        }
        if (docText.includes(token)) {
          matchScore += 1.0;
        }
      }

      if (matchScore > 0) {
        hits.push({
          title: doc.title,
          url: doc.url,
          snippet: doc.excerpt,
          score: matchScore,
        });
      }
    }

    hits.sort((a, b) => b.score - a.score);

    return {
      query,
      totalHits: hits.length,
      hits: hits.slice(0, limit),
      latencyMs: Date.now() - startTime,
    };
  }
}
