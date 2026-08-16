/**
 * deterministic-website-policy.ts
 *
 * Pure TypeScript Domain Wildcard Matcher, URL Normalizer & Policy Evaluator
 * (Phase 120 / ADR-096 / Target #53).
 */

import type {
  WebsiteAccessCheckResult,
  WebsitePolicyRule,
} from "../../../core/contracts/website-policy.contracts.js";

export class DeterministicWebsitePolicy {
  /**
   * Normalizes a hostname or URL to a clean lowercase domain string.
   */
  public normalizeHost(hostOrUrl: string): string {
    if (!hostOrUrl || typeof hostOrUrl !== "string") {
      return "";
    }

    let input = hostOrUrl.trim().toLowerCase();

    // Remove comments or trailing whitespace
    if (input.startsWith("#")) return "";

    // Parse URL if scheme or '//' is present
    if (input.includes("://") || input.startsWith("//")) {
      try {
        const parsed = new URL(input.startsWith("//") ? `http:${input}` : input);
        input = parsed.hostname || parsed.host;
      } catch {
        // Fallback simple parsing
        input = input.replace(/^(https?:)?\/\//i, "").split("/")[0];
      }
    } else {
      // Simple path / port strip
      input = input.split("/")[0].split(":")[0];
    }

    // Strip trailing dot
    input = input.replace(/\.+$/, "");

    // Strip www. prefix for consistent matching
    if (input.startsWith("www.")) {
      input = input.slice(4);
    }

    return input;
  }

  /**
   * Normalizes a blocklist rule pattern.
   */
  public normalizeRule(rule: string): string | null {
    if (!rule || typeof rule !== "string") return null;
    const trimmed = rule.trim().toLowerCase();
    if (!trimmed || trimmed.startsWith("#")) return null;

    let value = trimmed;
    if (value.includes("://") || value.startsWith("//")) {
      try {
        const parsed = new URL(value.startsWith("//") ? `http:${value}` : value);
        value = parsed.hostname || parsed.host;
      } catch {
        value = value.replace(/^(https?:)?\/\//i, "").split("/")[0];
      }
    } else {
      value = value.split("/")[0];
    }

    value = value.replace(/\.+$/, "");
    if (value.startsWith("www.")) {
      value = value.slice(4);
    }

    return value || null;
  }

  /**
   * Evaluates if a target domain matches a rule pattern.
   * Supports:
   * 1. Exact match ('example.com' === 'example.com')
   * 2. Subdomain inheritance ('example.com' matches 'sub.example.com')
   * 3. Wildcard glob matching ('*.tracker.*' matches 'cdn.tracker.net')
   */
  public matchesDomain(host: string, pattern: string): boolean {
    if (!host || !pattern) return false;

    const h = host.toLowerCase();
    const p = pattern.toLowerCase();

    // 1. Exact Match
    if (h === p) {
      return true;
    }

    // 2. Subdomain of rule domain (e.g. pattern "example.com" matches "api.example.com")
    if (!p.includes("*") && h.endsWith(`.${p}`)) {
      return true;
    }

    // 3. Wildcard Glob Matching (convert glob pattern *.domain.* to regex)
    if (p.includes("*")) {
      const regexPattern = "^" + p.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$";
      try {
        const re = new RegExp(regexPattern);
        return re.test(h);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Parses text lines from an external shared blocklist file.
   */
  public parseBlocklistFile(content: string, sourcePath: string): WebsitePolicyRule[] {
    if (!content || typeof content !== "string") return [];

    const lines = content.split("\n");
    const rules: WebsitePolicyRule[] = [];
    const seen = new Set<string>();

    for (const rawLine of lines) {
      const normalized = this.normalizeRule(rawLine);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        rules.push({
          pattern: normalized,
          source: "shared_file",
          sourcePath,
          enabled: true,
        });
      }
    }

    return rules;
  }

  /**
   * Checks whether a given host or URL is permitted by active website policy rules.
   */
  public checkAccess(
    urlOrHost: string,
    rules: readonly WebsitePolicyRule[],
    enabled = true
  ): WebsiteAccessCheckResult {
    const host = this.normalizeHost(urlOrHost);
    if (!host) {
      return { allowed: true, host: "" };
    }

    if (!enabled) {
      return { allowed: true, host };
    }

    for (const rule of rules) {
      if (!rule.enabled) continue;

      if (this.matchesDomain(host, rule.pattern)) {
        return {
          allowed: false,
          host,
          matchedRule: rule,
          message: `Access to '${host}' is blocked by website policy rule '${rule.pattern}' (source: ${rule.source}).`,
        };
      }
    }

    return {
      allowed: true,
      host,
    };
  }
}
