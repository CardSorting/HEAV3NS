/**
 * deterministic-stealth-browser.ts
 *
 * Anti-fingerprint profile generator, Docker loopback URL rewriter,
 * accessibility tree snapshotter, and ref-based interaction engine (Phase 111 / ADR-087 / Target #44).
 */

import {
  LOOPBACK_HOSTS,
  DOCKER_INTERNAL_HOST,
  type StealthFingerprintProfile,
  type AccessibilityRefNode,
  type AccessibilitySnapshot,
  type RefInteractionAction,
  type RefInteractionResult,
  type UrlRewriteResult,
} from "../../../core/contracts/stealth-browser.contracts.js";

export class DeterministicStealthBrowser {
  /**
   * Deterministic profile-scoped identity and fingerprint generator.
   */
  public createFingerprintProfile(profileName = "default", taskId?: string): StealthFingerprintProfile {
    let hash = 0;
    const seedStr = `${profileName}:${taskId || "default"}`;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);

    const userHex = (positiveHash ^ 0xabcdef).toString(16).padStart(8, "0").slice(0, 8);
    const sessionHex = ((positiveHash * 31) ^ 0x123456).toString(16).padStart(12, "0").slice(0, 12);

    return {
      profileId: profileName,
      userId: `lumi_${userHex}`,
      sessionKey: `task_${sessionHex}`,
      canvasNoiseSeed: positiveHash % 1000000,
      webGlVendor: "Mozilla",
      webGlRenderer: "Camoufox ANGLE (Apple, Apple M3 Pro, Metal 13.6.1)",
      audioContextJitter: (positiveHash % 100) / 10000,
      hardwareConcurrency: 8,
      deviceMemory: 16,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0",
      platform: "MacIntel",
      locale: "en-US",
      timezone: "America/New_York",
    };
  }

  /**
   * Deterministic Docker Loopback URL Rewriter.
   * Rewrites http://127.0.0.1:3000 or http://localhost:8080 to http://host.docker.internal:3000
   * when running inside containerized browser environments.
   */
  public rewriteLoopbackUrl(urlStr: string, rewriteEnabled = true): UrlRewriteResult {
    if (!rewriteEnabled) {
      return { originalUrl: urlStr, rewrittenUrl: urlStr, didRewrite: false, reason: "Rewrite disabled" };
    }

    try {
      const parsed = new URL(urlStr);
      const hostname = parsed.hostname.toLowerCase();

      if ((LOOPBACK_HOSTS as readonly string[]).includes(hostname)) {
        parsed.hostname = DOCKER_INTERNAL_HOST;
        const rewritten = parsed.toString();
        return {
          originalUrl: urlStr,
          rewrittenUrl: rewritten,
          didRewrite: true,
          reason: `Loopback host '${hostname}' rewritten to '${DOCKER_INTERNAL_HOST}'`,
        };
      }

      return { originalUrl: urlStr, rewrittenUrl: urlStr, didRewrite: false, reason: "Non-loopback URL" };
    } catch {
      return { originalUrl: urlStr, rewrittenUrl: urlStr, didRewrite: false, reason: "Invalid URL syntax" };
    }
  }

  /**
   * Build accessibility tree snapshot with deterministic [ref=eX] identifiers.
   */
  public buildAccessibilitySnapshot(
    tabId: string,
    url: string,
    title: string,
    rawNodes: readonly {
      role: string;
      name: string;
      value?: string;
      disabled?: boolean;
      checked?: boolean;
      children?: readonly any[];
      selector?: string;
    }[]
  ): AccessibilitySnapshot {
    let refCounter = 1;
    const elementMap: Record<string, AccessibilityRefNode> = {};
    const textLines: string[] = [];

    function processNode(node: any, depth = 0): AccessibilityRefNode {
      const refId = `e${refCounter++}`;
      const indent = "  ".repeat(depth);

      let valuePart = "";
      if (node.value !== undefined && node.value !== "") {
        valuePart = ` value=${JSON.stringify(node.value)}`;
      }
      if (node.disabled) valuePart += " [disabled]";
      if (node.checked) valuePart += " [checked]";

      const line = `${indent}[ref=${refId}] [${node.role}] ${JSON.stringify(node.name)}${valuePart}`;
      textLines.push(line);

      const processedChildren: AccessibilityRefNode[] = [];
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          processedChildren.push(processNode(child, depth + 1));
        }
      }

      const refNode: AccessibilityRefNode = {
        refId,
        role: node.role,
        name: node.name,
        value: node.value,
        disabled: node.disabled,
        checked: node.checked,
        children: processedChildren.length > 0 ? processedChildren : undefined,
        selector: node.selector || `[data-ref="${refId}"]`,
      };

      elementMap[refId] = refNode;
      return refNode;
    }

    const processedRoots = rawNodes.map((n) => processNode(n, 0));

    return {
      tabId,
      url,
      title,
      totalInteractiveElements: Object.keys(elementMap).length,
      textTree: textLines.join("\n"),
      elementMap,
      capturedAt: Date.now(),
    };
  }

  /**
   * Execute atomic interaction on accessibility element reference.
   */
  public interactWithRef(
    snapshot: AccessibilitySnapshot,
    refId: string,
    action: RefInteractionAction,
    inputValue?: string
  ): RefInteractionResult {
    const startTime = performance.now();
    const node = snapshot.elementMap[refId];

    if (!node) {
      return {
        refId,
        action,
        success: false,
        elementRole: "unknown",
        elementName: "unknown",
        navigationOccurred: false,
        durationMs: performance.now() - startTime,
        error: `Element reference '[ref=${refId}]' not found in active page accessibility snapshot.`,
      };
    }

    if (node.disabled) {
      return {
        refId,
        action,
        success: false,
        elementRole: node.role,
        elementName: node.name,
        navigationOccurred: false,
        durationMs: performance.now() - startTime,
        error: `Element '[ref=${refId}]' [${node.role}] "${node.name}" is disabled.`,
      };
    }

    let navigationOccurred = false;
    let newUrl: string | undefined = undefined;

    if (action === "click" && (node.role === "link" || node.role === "button")) {
      if (node.name.toLowerCase().includes("next") || node.name.toLowerCase().includes("submit")) {
        navigationOccurred = true;
        newUrl = `${snapshot.url}#submitted`;
      }
    }

    return {
      refId,
      action,
      success: true,
      elementRole: node.role,
      elementName: node.name,
      newUrl,
      navigationOccurred,
      durationMs: performance.now() - startTime,
    };
  }
}
