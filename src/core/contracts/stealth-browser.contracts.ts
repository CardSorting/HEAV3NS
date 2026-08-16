/**
 * stealth-browser.contracts.ts
 *
 * Core contracts, enums, interfaces, and constants for Camoufox Anti-Fingerprinting
 * Stealth Browser Engine, Accessibility Ref Navigation, Loopback Rewriter, and
 * Session Persistence Subsystem (Phase 111 / ADR-087 / Target #44).
 */

export type RefInteractionAction =
  | "click"
  | "type"
  | "press"
  | "scroll"
  | "hover"
  | "select"
  | "focus"
  | "clear";

export type StorageType = "localStorage" | "sessionStorage";

export const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"] as const;

export const DOCKER_INTERNAL_HOST = "host.docker.internal";

export const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
} as const;

export interface StealthBrowserViewport {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor?: number;
}

export interface StealthBrowserTab {
  readonly tabId: string;
  readonly title: string;
  readonly url: string;
  readonly isActive: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly viewport: StealthBrowserViewport;
}

export interface AccessibilityRefNode {
  readonly refId: string; // e.g. "e1", "e2"
  readonly role: string; // e.g. "button", "link", "textbox", "heading", "checkbox", "combobox"
  readonly name: string;
  readonly value?: string;
  readonly disabled?: boolean;
  readonly checked?: boolean;
  readonly focused?: boolean;
  readonly children?: readonly AccessibilityRefNode[];
  readonly selector?: string;
}

export interface AccessibilitySnapshot {
  readonly tabId: string;
  readonly url: string;
  readonly title: string;
  readonly totalInteractiveElements: number;
  readonly textTree: string;
  readonly elementMap: Readonly<Record<string, AccessibilityRefNode>>;
  readonly capturedAt: number;
}

export interface StealthFingerprintProfile {
  readonly profileId: string;
  readonly userId: string;
  readonly sessionKey: string;
  readonly canvasNoiseSeed: number;
  readonly webGlVendor: string;
  readonly webGlRenderer: string;
  readonly audioContextJitter: number;
  readonly hardwareConcurrency: number;
  readonly deviceMemory: number;
  readonly userAgent: string;
  readonly platform: string;
  readonly locale: string;
  readonly timezone: string;
}

export interface CookieRecord {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires?: number;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: "Strict" | "Lax" | "None";
}

export interface StorageEntry {
  readonly key: string;
  readonly value: string;
  readonly domain: string;
  readonly storageType: StorageType;
}

export interface RefInteractionResult {
  readonly refId: string;
  readonly action: RefInteractionAction;
  readonly success: boolean;
  readonly elementRole: string;
  readonly elementName: string;
  readonly newUrl?: string;
  readonly navigationOccurred: boolean;
  readonly durationMs: number;
  readonly error?: string;
}

export interface UrlRewriteResult {
  readonly originalUrl: string;
  readonly rewrittenUrl: string;
  readonly didRewrite: boolean;
  readonly reason: string;
}

export interface StealthBrowserLogRecord {
  readonly recordId: string;
  readonly timestamp: number;
  readonly tabId: string;
  readonly action: string;
  readonly targetUrl?: string;
  readonly refId?: string;
  readonly durationMs: number;
  readonly success: boolean;
}

export interface StealthBrowserWorkspaceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly activeTabId?: string;
  readonly tabs: readonly StealthBrowserTab[];
  readonly cookies: readonly CookieRecord[];
  readonly storage: readonly StorageEntry[];
  readonly recentLogs: readonly StealthBrowserLogRecord[];
  readonly fingerprintProfile?: StealthFingerprintProfile;
}
