/**
 * broccoli-stealth-browser-substrate.ts
 *
 * In-memory Broccolidb substrate repository maintaining tabs, element ref indexes,
 * cookie jars, local storage vaults, anti-fingerprint profiles, and navigation histories
 * (Phase 111 / ADR-087 / Target #44).
 */

import type {
  StealthBrowserTab,
  CookieRecord,
  StorageEntry,
  StealthFingerprintProfile,
  StealthBrowserLogRecord,
  StealthBrowserWorkspaceSnapshot,
  AccessibilitySnapshot,
} from "../../../core/contracts/stealth-browser.contracts.js";

export class BroccoliStealthBrowserSubstrate {
  private readonly tabs = new Map<string, StealthBrowserTab>();
  private activeTabId: string | null = null;
  private readonly cookies: CookieRecord[] = [];
  private readonly storage: StorageEntry[] = [];
  private readonly logs: StealthBrowserLogRecord[] = [];
  private readonly snapshots = new Map<string, AccessibilitySnapshot>();
  private fingerprintProfile: StealthFingerprintProfile | null = null;

  private totalNavigations = 0;
  private totalRefInteractions = 0;
  private totalSnapshotsCaptured = 0;
  private maxLogCapacity = 5000;

  constructor(maxLogCapacity = 5000) {
    this.maxLogCapacity = maxLogCapacity;
  }

  public setFingerprintProfile(profile: StealthFingerprintProfile): void {
    this.fingerprintProfile = profile;
  }

  public getFingerprintProfile(): StealthFingerprintProfile | null {
    return this.fingerprintProfile;
  }

  public createTab(tab: StealthBrowserTab): void {
    this.tabs.set(tab.tabId, tab);
    if (!this.activeTabId || tab.isActive) {
      this.setActiveTab(tab.tabId);
    }
  }

  public getTab(tabId: string): StealthBrowserTab | undefined {
    return this.tabs.get(tabId);
  }

  public getActiveTab(): StealthBrowserTab | undefined {
    if (!this.activeTabId) return undefined;
    return this.tabs.get(this.activeTabId);
  }

  public setActiveTab(tabId: string): boolean {
    if (!this.tabs.has(tabId)) return false;
    for (const [id, tab] of this.tabs.entries()) {
      if (id === tabId) {
        this.tabs.set(id, { ...tab, isActive: true, updatedAt: Date.now() });
      } else if (tab.isActive) {
        this.tabs.set(id, { ...tab, isActive: false, updatedAt: Date.now() });
      }
    }
    this.activeTabId = tabId;
    return true;
  }

  public updateTab(tabId: string, updates: Partial<StealthBrowserTab>): boolean {
    const existing = this.tabs.get(tabId);
    if (!existing) return false;
    this.tabs.set(tabId, { ...existing, ...updates, updatedAt: Date.now() });
    return true;
  }

  public closeTab(tabId: string): boolean {
    const deleted = this.tabs.delete(tabId);
    this.snapshots.delete(tabId);
    if (this.activeTabId === tabId) {
      const nextTab = this.tabs.keys().next().value;
      this.activeTabId = nextTab || null;
      if (nextTab) {
        this.setActiveTab(nextTab);
      }
    }
    return deleted;
  }

  public listTabs(): readonly StealthBrowserTab[] {
    return Array.from(this.tabs.values());
  }

  public saveSnapshot(snapshot: AccessibilitySnapshot): void {
    this.totalSnapshotsCaptured++;
    this.snapshots.set(snapshot.tabId, snapshot);
  }

  public getSnapshot(tabId: string): AccessibilitySnapshot | undefined {
    return this.snapshots.get(tabId);
  }

  // Cookie Jar operations
  public setCookie(cookie: CookieRecord): void {
    const idx = this.cookies.findIndex(
      (c) => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
    );
    if (idx >= 0) {
      this.cookies[idx] = cookie;
    } else {
      this.cookies.push(cookie);
    }
  }

  public getCookies(domain?: string): readonly CookieRecord[] {
    if (!domain) return [...this.cookies];
    return this.cookies.filter((c) => c.domain.includes(domain) || domain.includes(c.domain));
  }

  public clearCookies(): void {
    this.cookies.length = 0;
  }

  // Local/Session Storage operations
  public setStorageItem(entry: StorageEntry): void {
    const idx = this.storage.findIndex(
      (s) => s.key === entry.key && s.domain === entry.domain && s.storageType === entry.storageType
    );
    if (idx >= 0) {
      this.storage[idx] = entry;
    } else {
      this.storage.push(entry);
    }
  }

  public getStorage(domain: string, storageType: "localStorage" | "sessionStorage"): readonly StorageEntry[] {
    return this.storage.filter((s) => s.domain === domain && s.storageType === storageType);
  }

  public clearStorage(): void {
    this.storage.length = 0;
  }

  // Logging & Metrics
  public recordLog(log: Omit<StealthBrowserLogRecord, "recordId" | "timestamp">): void {
    if (log.action === "navigate") this.totalNavigations++;
    if (log.action === "interact_ref") this.totalRefInteractions++;

    const entry: StealthBrowserLogRecord = {
      recordId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...log,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogCapacity) {
      this.logs.splice(0, this.logs.length - this.maxLogCapacity);
    }
  }

  public getMetrics() {
    return {
      activeTabsCount: this.tabs.size,
      totalNavigations: this.totalNavigations,
      totalRefInteractions: this.totalRefInteractions,
      totalSnapshotsCaptured: this.totalSnapshotsCaptured,
      totalCookies: this.cookies.length,
      totalStorageEntries: this.storage.length,
      loggedEventsCount: this.logs.length,
    };
  }

  public getRecentLogs(limit = 50): readonly StealthBrowserLogRecord[] {
    return this.logs.slice(-limit);
  }

  public createSnapshot(snapshotId: string): StealthBrowserWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      activeTabId: this.activeTabId || undefined,
      tabs: Array.from(this.tabs.values()),
      cookies: [...this.cookies],
      storage: [...this.storage],
      recentLogs: [...this.logs],
      fingerprintProfile: this.fingerprintProfile ? { ...this.fingerprintProfile } : undefined,
    };
  }

  public restoreSnapshot(snapshot: StealthBrowserWorkspaceSnapshot): void {
    this.tabs.clear();
    for (const tab of snapshot.tabs) {
      this.tabs.set(tab.tabId, tab);
    }
    this.activeTabId = snapshot.activeTabId || null;

    this.cookies.length = 0;
    this.cookies.push(...snapshot.cookies);

    this.storage.length = 0;
    this.storage.push(...snapshot.storage);

    this.logs.length = 0;
    this.logs.push(...snapshot.recentLogs);

    this.fingerprintProfile = snapshot.fingerprintProfile ? { ...snapshot.fingerprintProfile } : null;
  }

  public clear(): void {
    this.tabs.clear();
    this.snapshots.clear();
    this.activeTabId = null;
    this.cookies.length = 0;
    this.storage.length = 0;
    this.logs.length = 0;
    this.fingerprintProfile = null;
    this.totalNavigations = 0;
    this.totalRefInteractions = 0;
    this.totalSnapshotsCaptured = 0;
  }
}
