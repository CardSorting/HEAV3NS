/**
 * stealth-browser-supervisor.ts
 *
 * Master supervisor coordinating tab management, navigation, accessibility snapshots,
 * ref interaction dispatch, cookie storage, and stealth anti-detection (Phase 111 / ADR-087 / Target #44).
 */

import type { BroccoliStealthBrowserSubstrate } from "../../../sessions/extensions/stealth_browser/broccoli-stealth-browser-substrate.js";
import type { DeterministicStealthBrowser } from "./deterministic-stealth-browser.js";
import {
  DEFAULT_VIEWPORT,
  type StealthBrowserTab,
  type AccessibilitySnapshot,
  type RefInteractionAction,
  type RefInteractionResult,
  type CookieRecord,
  type StorageEntry,
  type UrlRewriteResult,
} from "../../../core/contracts/stealth-browser.contracts.js";

export class StealthBrowserSupervisor {
  private readonly substrate: BroccoliStealthBrowserSubstrate;
  private readonly browserEngine: DeterministicStealthBrowser;
  private rewriteLoopback = true;

  constructor(
    substrate: BroccoliStealthBrowserSubstrate,
    browserEngine: DeterministicStealthBrowser,
    options: { rewriteLoopback?: boolean; profileName?: string } = {}
  ) {
    this.substrate = substrate;
    this.browserEngine = browserEngine;
    this.rewriteLoopback = options.rewriteLoopback ?? true;

    // Initialize deterministic profile
    const profile = this.browserEngine.createFingerprintProfile(options.profileName || "default");
    this.substrate.setFingerprintProfile(profile);
  }

  /**
   * Open or navigate active tab.
   */
  public navigate(
    url: string,
    tabId?: string
  ): {
    tab: StealthBrowserTab;
    urlRewrite: UrlRewriteResult;
  } {
    const urlRewrite = this.browserEngine.rewriteLoopbackUrl(url, this.rewriteLoopback);
    const targetUrl = urlRewrite.rewrittenUrl;
    const now = Date.now();

    let tab = tabId ? this.substrate.getTab(tabId) : this.substrate.getActiveTab();

    if (!tab) {
      const newTabId = tabId || `tab-${now}-${Math.random().toString(36).slice(2, 6)}`;
      tab = {
        tabId: newTabId,
        url: targetUrl,
        title: `Page on ${targetUrl}`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        viewport: DEFAULT_VIEWPORT,
      };
      this.substrate.createTab(tab);
    } else {
      this.substrate.updateTab(tab.tabId, {
        url: targetUrl,
        title: `Page on ${targetUrl}`,
        updatedAt: now,
      });
      tab = this.substrate.getTab(tab.tabId)!;
    }

    this.substrate.recordLog({
      tabId: tab.tabId,
      action: "navigate",
      targetUrl,
      durationMs: 5,
      success: true,
    });

    return { tab, urlRewrite };
  }

  /**
   * Capture accessibility snapshot of current tab.
   */
  public captureSnapshot(
    tabId?: string,
    simulatedNodes?: readonly { role: string; name: string; value?: string; disabled?: boolean; checked?: boolean; children?: any[] }[]
  ): AccessibilitySnapshot {
    const tab = tabId ? this.substrate.getTab(tabId) : this.substrate.getActiveTab();
    const effectiveTabId = tab?.tabId || "tab-default";
    const url = tab?.url || "about:blank";
    const title = tab?.title || "Blank Tab";

    const defaultNodes = [
      {
        role: "heading",
        name: "Welcome to Dashboard",
      },
      {
        role: "textbox",
        name: "Search or enter query",
        value: "",
      },
      {
        role: "button",
        name: "Submit Query",
      },
      {
        role: "link",
        name: "Documentation & Guides",
      },
    ];

    const nodes = simulatedNodes || defaultNodes;
    const snapshot = this.browserEngine.buildAccessibilitySnapshot(effectiveTabId, url, title, nodes);
    this.substrate.saveSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Execute interaction on accessibility ref element.
   */
  public interactWithRef(
    refId: string,
    action: RefInteractionAction,
    inputValue?: string,
    tabId?: string
  ): RefInteractionResult {
    const activeTab = tabId ? this.substrate.getTab(tabId) : this.substrate.getActiveTab();
    const effectiveTabId = activeTab?.tabId || "tab-default";

    let snapshot = this.substrate.getSnapshot(effectiveTabId);
    if (!snapshot) {
      snapshot = this.captureSnapshot(effectiveTabId);
    }

    const result = this.browserEngine.interactWithRef(snapshot, refId, action, inputValue);

    this.substrate.recordLog({
      tabId: effectiveTabId,
      action: "interact_ref",
      refId,
      durationMs: result.durationMs,
      success: result.success,
    });

    if (result.navigationOccurred && result.newUrl) {
      this.navigate(result.newUrl, effectiveTabId);
    }

    return result;
  }

  // Multi-tab operations
  public openTab(url = "about:blank"): StealthBrowserTab {
    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { tab } = this.navigate(url, newTabId);
    return tab;
  }

  public switchTab(tabId: string): boolean {
    return this.substrate.setActiveTab(tabId);
  }

  public closeTab(tabId: string): boolean {
    return this.substrate.closeTab(tabId);
  }

  public listTabs(): readonly StealthBrowserTab[] {
    return this.substrate.listTabs();
  }

  // Storage and cookie helpers
  public setCookie(cookie: CookieRecord): void {
    this.substrate.setCookie(cookie);
  }

  public getCookies(domain?: string): readonly CookieRecord[] {
    return this.substrate.getCookies(domain);
  }

  public setStorageItem(entry: StorageEntry): void {
    this.substrate.setStorageItem(entry);
  }

  public getStorage(domain: string, storageType: "localStorage" | "sessionStorage"): readonly StorageEntry[] {
    return this.substrate.getStorage(domain, storageType);
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getRecentLogs(limit = 50) {
    return this.substrate.getRecentLogs(limit);
  }

  public getFingerprintProfile() {
    return this.substrate.getFingerprintProfile();
  }
}
