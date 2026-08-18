/**
 * deterministic-url-safety.ts
 *
 * SSRF Defense Firewall, Cloud Metadata & Private IP Blocker, and URL Normalizer
 * (Phase 118 / ADR-094 / Target #87).
 */

import {
  CLOUD_METADATA_IPS,
  CLOUD_METADATA_HOSTS,
  DEFAULT_URL_SAFETY_CONFIG,
  type IpAddressCategory,
  type UrlSafetyCheckResult,
  type UrlSafetyConfig,
  type UrlSafetyMetrics,
  type UrlSafetyVerdict,
} from "../../../core/contracts/url-safety.contracts.js";

export class DeterministicUrlSafety {
  /**
   * Normalizes URLs into clean, safe ASCII URIs without double percent-encoding.
   */
  public normalizeUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== "string") {
      return "";
    }

    let url = rawUrl.trim();
    if (!url) return "";

    // Repair intra-scheme whitespace (e.g. "https:// docs.example" -> "https://docs.example")
    url = url.replace(/^([A-Za-z][A-Za-z0-9+.-]*:\/\/)\s+/i, "$1");

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return url;
      }

      // Convert hostname to lowercase ASCII (IDNA / punycode handled by URL constructor)
      const hostname = parsed.hostname.toLowerCase();

      // Percent-encode non-ASCII path characters safely
      const pathname = parsed.pathname;
      const search = parsed.search;
      const hash = parsed.hash;

      const portPart = parsed.port ? `:${parsed.port}` : "";
      return `${parsed.protocol}//${hostname}${portPart}${pathname}${search}${hash}`;
    } catch {
      return url;
    }
  }

  /**
   * Parse alternative IP representations (Integer, Hex, Octal, IPv4-mapped IPv6).
   */
  public parseAlternativeIp(host: string): string | null {
    if (!host) return null;
    const clean = host.toLowerCase().trim().replace(/^\[|\]$/g, "");

    // 1. IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1 or ::ffff:a9fe:a9fe)
    if (clean.startsWith("::ffff:")) {
      const remainder = clean.slice(7);
      const dotMatch = remainder.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (dotMatch) {
        return remainder;
      }
      const hexParts = remainder.split(":");
      if (hexParts.length === 2) {
        const h1 = parseInt(hexParts[0], 16);
        const h2 = parseInt(hexParts[1], 16);
        if (!isNaN(h1) && !isNaN(h2) && h1 >= 0 && h1 <= 65535 && h2 >= 0 && h2 <= 65535) {
          const b0 = (h1 >>> 8) & 255;
          const b1 = h1 & 255;
          const b2 = (h2 >>> 8) & 255;
          const b3 = h2 & 255;
          return `${b0}.${b1}.${b2}.${b3}`;
        }
      }
    }

    // 2. Pure Integer IP (e.g. 2130706433 -> 127.0.0.1)
    if (/^\d{8,10}$/.test(clean)) {
      const intVal = Number(clean);
      if (intVal >= 0 && intVal <= 4294967295) {
        const byte1 = (intVal >>> 24) & 255;
        const byte2 = (intVal >>> 16) & 255;
        const byte3 = (intVal >>> 8) & 255;
        const byte4 = intVal & 255;
        return `${byte1}.${byte2}.${byte3}.${byte4}`;
      }
    }

    // 3. Hex Integer (e.g. 0x7f000001)
    if (/^0x[0-9a-f]{1,8}$/i.test(clean)) {
      const intVal = parseInt(clean, 16);
      if (!isNaN(intVal) && intVal >= 0 && intVal <= 4294967295) {
        const byte1 = (intVal >>> 24) & 255;
        const byte2 = (intVal >>> 16) & 255;
        const byte3 = (intVal >>> 8) & 255;
        const byte4 = intVal & 255;
        return `${byte1}.${byte2}.${byte3}.${byte4}`;
      }
    }

    // 4. Dot-separated hex or octal parts (e.g. 0177.0.0.1 or 0x7f.0.0.1)
    const parts = clean.split(".");
    if (parts.length === 4) {
      const decParts: number[] = [];
      for (const part of parts) {
        if (/^0x[0-9a-f]+$/i.test(part)) {
          decParts.push(parseInt(part, 16));
        } else if (/^0[0-7]+$/.test(part)) {
          decParts.push(parseInt(part, 8));
        } else if (/^\d+$/.test(part)) {
          decParts.push(parseInt(part, 10));
        } else {
          return null;
        }
      }

      if (decParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
        return decParts.join(".");
      }
    }

    return null;
  }

  /**
   * Classifies an IPv4 or IPv6 address into security categories.
   */
  public classifyIp(ip: string): IpAddressCategory {
    if (!ip) return "invalid";
    const clean = ip.toLowerCase().trim().replace(/^\[|\]$/g, "");

    // Cloud Metadata
    if (CLOUD_METADATA_IPS.includes(clean)) {
      return "cloud_metadata";
    }

    // IPv6 checks
    if (clean.includes(":")) {
      if (clean === "::1" || clean === "0:0:0:0:0:0:0:1") {
        return "loopback";
      }
      if (clean.startsWith("fe80:") || clean.startsWith("fe8") || clean.startsWith("fe9") || clean.startsWith("fea") || clean.startsWith("feb")) {
        return "link_local";
      }
      if (clean.startsWith("ff")) {
        return "multicast";
      }
      if (clean.startsWith("fc") || clean.startsWith("fd")) {
        return "private";
      }
      return "public";
    }

    // Standard IPv4 breakdown
    const parts = clean.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return "invalid";
    }

    const [b0, b1] = parts;

    // Loopback (127.0.0.0/8)
    if (b0 === 127) {
      return "loopback";
    }

    // Zero / Current Network (0.0.0.0/8)
    if (b0 === 0) {
      return "reserved";
    }

    // Link-Local (169.254.0.0/16)
    if (b0 === 169 && b1 === 254) {
      return "link_local";
    }

    // Private Subnets (RFC 1918)
    // 10.0.0.0/8
    if (b0 === 10) {
      return "private";
    }
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) {
      return "private";
    }
    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) {
      return "private";
    }

    // Carrier-Grade NAT (100.64.0.0/10 -> 100.64.0.0 - 100.127.255.255)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) {
      return "carrier_grade_nat";
    }

    // Benchmarking (198.18.0.0/15 -> 198.18.0.0 - 198.19.255.255)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) {
      return "reserved";
    }

    // Multicast (224.0.0.0/4) & Broadcast (255.255.255.255)
    if (b0 >= 224 && b0 <= 239) {
      return "multicast";
    }
    if (b0 >= 240) {
      return "reserved";
    }

    return "public";
  }

  /**
   * Main URL safety check against SSRF vulnerabilities.
   */
  public checkUrlSafety(
    rawUrl: string,
    options: Partial<UrlSafetyConfig> = {}
  ): UrlSafetyCheckResult {
    const startTime = performance.now();
    const config: UrlSafetyConfig = {
      ...DEFAULT_URL_SAFETY_CONFIG,
      ...options,
    };

    const normalizedUrl = this.normalizeUrl(rawUrl);
    if (!normalizedUrl) {
      return {
        isSafe: false,
        verdict: "invalid_url",
        normalizedUrl: rawUrl,
        hostname: "",
        resolvedIps: [],
        reason: "Invalid or empty URL.",
        category: "invalid",
        latencyMs: performance.now() - startTime,
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(normalizedUrl);
    } catch {
      return {
        isSafe: false,
        verdict: "invalid_url",
        normalizedUrl,
        hostname: "",
        resolvedIps: [],
        reason: "Failed to parse URL syntax.",
        category: "invalid",
        latencyMs: performance.now() - startTime,
      };
    }

    // Scheme validation
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isSafe: false,
        verdict: "invalid_url",
        normalizedUrl,
        hostname: parsed.hostname || "",
        resolvedIps: [],
        reason: `Unsupported URL protocol '${parsed.protocol}'. Only http/https are allowed.`,
        category: "invalid",
        latencyMs: performance.now() - startTime,
      };
    }

    const rawHostname = parsed.hostname.toLowerCase().trim();
    const hostname = rawHostname.replace(/^\[|\]$/g, "");

    // 1. Check Custom Allowed List (Highest Priority)
    if (config.customAllowedHosts.some((h) => h.toLowerCase() === hostname)) {
      return {
        isSafe: true,
        verdict: "allowed",
        normalizedUrl,
        hostname,
        resolvedIps: [],
        category: "public",
        latencyMs: performance.now() - startTime,
      };
    }

    // 2. Cloud Metadata Hostnames (Unconditional Block)
    if (
      CLOUD_METADATA_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
    ) {
      return {
        isSafe: false,
        verdict: "blocked_cloud_metadata",
        normalizedUrl,
        hostname,
        resolvedIps: [],
        reason: `Target hostname '${hostname}' is a cloud metadata endpoint.`,
        category: "cloud_metadata",
        latencyMs: performance.now() - startTime,
      };
    }

    // 3. Localhost hostname
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      if (config.allowLocalhost) {
        return {
          isSafe: true,
          verdict: "allowed",
          normalizedUrl,
          hostname,
          resolvedIps: ["127.0.0.1"],
          category: "loopback",
          latencyMs: performance.now() - startTime,
        };
      }
      return {
        isSafe: false,
        verdict: "blocked_loopback",
        normalizedUrl,
        hostname,
        resolvedIps: ["127.0.0.1"],
        reason: "Localhost access is blocked to prevent SSRF.",
        category: "loopback",
        latencyMs: performance.now() - startTime,
      };
    }

    // 4. Custom Blocked Hosts
    if (config.customBlockedHosts.some((h) => h.toLowerCase() === hostname)) {
      return {
        isSafe: false,
        verdict: "blocked_custom_rule",
        normalizedUrl,
        hostname,
        resolvedIps: [],
        reason: `Hostname '${hostname}' is in the custom blocklist.`,
        category: "invalid",
        latencyMs: performance.now() - startTime,
      };
    }

    // 5. Alternative IP / Direct IP Classification
    const altIp = this.parseAlternativeIp(hostname);
    const candidateIp = altIp || hostname;

    const category = this.classifyIp(candidateIp);

    switch (category) {
      case "cloud_metadata":
        return {
          isSafe: false,
          verdict: "blocked_cloud_metadata",
          normalizedUrl,
          hostname,
          resolvedIps: [candidateIp],
          reason: `IP '${candidateIp}' is a cloud instance metadata endpoint.`,
          category,
          latencyMs: performance.now() - startTime,
        };
      case "loopback":
        if (config.allowLocalhost) {
          return {
            isSafe: true,
            verdict: "allowed",
            normalizedUrl,
            hostname,
            resolvedIps: [candidateIp],
            category,
            latencyMs: performance.now() - startTime,
          };
        }
        return {
          isSafe: false,
          verdict: "blocked_loopback",
          normalizedUrl,
          hostname,
          resolvedIps: [candidateIp],
          reason: `Loopback IP '${candidateIp}' is blocked.`,
          category,
          latencyMs: performance.now() - startTime,
        };
      case "private":
      case "link_local":
      case "carrier_grade_nat":
      case "reserved":
      case "multicast":
        if (config.allowPrivateUrls) {
          return {
            isSafe: true,
            verdict: "allowed",
            normalizedUrl,
            hostname,
            resolvedIps: [candidateIp],
            category,
            latencyMs: performance.now() - startTime,
          };
        }
        return {
          isSafe: false,
          verdict: "blocked_private_ip",
          normalizedUrl,
          hostname,
          resolvedIps: [candidateIp],
          reason: `Private/internal IP '${candidateIp}' (${category}) is blocked.`,
          category,
          latencyMs: performance.now() - startTime,
        };
      case "public":
        return {
          isSafe: true,
          verdict: "allowed",
          normalizedUrl,
          hostname,
          resolvedIps: [candidateIp],
          category,
          latencyMs: performance.now() - startTime,
        };
      case "invalid":
      default:
        // Regular domain name (e.g. api.github.com, docs.python.org)
        return {
          isSafe: true,
          verdict: "allowed",
          normalizedUrl,
          hostname,
          resolvedIps: [],
          category: "public",
          latencyMs: performance.now() - startTime,
        };
    }
  }

  /**
   * Formats a URL safety check result into a human-readable string.
   */
  public formatCheckResult(result: UrlSafetyCheckResult): string {
    const icon = result.isSafe ? "[SAFE]" : "[BLOCKED]";
    const ipInfo = result.resolvedIps.length > 0 ? ` (IP: ${result.resolvedIps.join(", ")})` : "";
    const reasonInfo = result.reason ? ` - ${result.reason}` : "";
    return `[URL-SAFETY:${result.verdict.toUpperCase()}] ${icon} ${result.normalizedUrl}${ipInfo}${reasonInfo}`;
  }

  /**
   * Formats URL safety metrics into a summary line.
   */
  public formatUrlSafetyMetrics(metrics: UrlSafetyMetrics): string {
    return `[URL-METRICS] Total: ${metrics.totalChecks} | Safe: ${metrics.allowedCount} | Metadata Blocks: ${metrics.blockedMetadataCount} | Private Blocks: ${metrics.blockedPrivateCount} | Loopback Blocks: ${metrics.blockedLoopbackCount}`;
  }
}
