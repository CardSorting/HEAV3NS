import type { CdpNavigationPolicy } from "../../../core/contracts/cdp.contracts.js";

const DEFAULT_NAVIGATION_POLICY: CdpNavigationPolicy = {
  allowedSchemes: ["http:", "https:", "about:", "data:"],
  blockPrivateIps: false,
  blockCloudMetadata: true,
  maxRedirects: 5,
  defaultTimeoutMs: 30000,
};

const FORBIDDEN_METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "100.100.100.200", // Alibaba Cloud metadata
  "fd00:ec2::254",    // AWS IPv6 metadata
]);

/**
 * Security boundary & navigation guardrail.
 *
 * Validates URLs before browser navigation, blocks SSRF and metadata endpoints,
 * and sanitizes sensitive credentials from DevTools protocol strings.
 */
export class CdpNavigationGuard {
  private readonly policy: CdpNavigationPolicy;

  constructor(policy: Partial<CdpNavigationPolicy> = {}) {
    this.policy = { ...DEFAULT_NAVIGATION_POLICY, ...policy };
  }

  getPolicy(): CdpNavigationPolicy {
    return this.policy;
  }

  validateNavigationUrl(urlString: string): { allowed: boolean; sanitizedUrl?: string; reason?: string } {
    if (!urlString || typeof urlString !== "string") {
      return { allowed: false, reason: "Empty or invalid URL string" };
    }

    const trimmed = urlString.trim();

    // Block sensitive file system access
    if (trimmed.startsWith("file:///etc/") || trimmed.startsWith("file:///var/") || trimmed.startsWith("file:///root/")) {
      return { allowed: false, reason: "Access to sensitive system file path is forbidden" };
    }

    try {
      const parsed = new URL(trimmed);

      if (!this.policy.allowedSchemes.includes(parsed.protocol)) {
        return {
          allowed: false,
          reason: `Protocol '${parsed.protocol}' is not allowed. Permitted protocols: ${this.policy.allowedSchemes.join(", ")}`,
        };
      }

      if (this.policy.blockCloudMetadata && FORBIDDEN_METADATA_HOSTS.has(parsed.hostname.toLowerCase())) {
        return {
          allowed: false,
          reason: `Access to cloud metadata endpoint '${parsed.hostname}' is blocked for security.`,
        };
      }

      return { allowed: true, sanitizedUrl: parsed.toString() };
    } catch {
      // Allow relative or special about:blank URLs
      if (trimmed === "about:blank" || trimmed.startsWith("about:")) {
        return { allowed: true, sanitizedUrl: trimmed };
      }
      return { allowed: false, reason: `Malformed URL: '${urlString}'` };
    }
  }

  redactCdpUrl(cdpUrl: string): string {
    if (!cdpUrl || typeof cdpUrl !== "string") {
      return "";
    }
    try {
      let result = cdpUrl;
      // Mask userinfo password
      result = result.replace(/:\/\/(.*?):(.*?)@/, "://$1:[REDACTED]@");
      // Mask token query param
      result = result.replace(/token=([^&]+)/g, "token=[REDACTED]");
      return result;
    } catch {
      return cdpUrl.replace(/token=([^&]+)/g, "token=[REDACTED]");
    }
  }
}
