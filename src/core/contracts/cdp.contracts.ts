/**
 * Chrome DevTools Protocol (CDP) & Browser Automation Contracts
 *
 * Defines contracts, schemas, and interfaces for the Deterministic
 * CDP Browser Supervisor & Dialog Automation subsystem (K_cdp).
 */

export type CdpTargetType = "page" | "iframe" | "worker" | "service_worker" | "other";

export interface CdpTarget {
  readonly targetId: string;
  readonly type: CdpTargetType;
  readonly title: string;
  readonly url: string;
  readonly attached: boolean;
  readonly openerId?: string;
}

export type CdpDialogType = "alert" | "confirm" | "prompt" | "beforeunload";
export type CdpDialogStatus = "pending" | "accepted" | "dismissed" | "timed_out";

export interface CdpDialogEvent {
  readonly id: string;
  readonly targetId: string;
  readonly type: CdpDialogType;
  readonly message: string;
  readonly defaultPrompt?: string;
  readonly timestampMs: number;
  readonly status: CdpDialogStatus;
  readonly responseText?: string;
}

export type CdpDialogPolicy = "auto_dismiss" | "auto_accept" | "interactive";

export interface CdpDomNode {
  readonly id: number;
  readonly tag: string;
  readonly role?: string;
  readonly name?: string;
  readonly text?: string;
  readonly value?: string;
  readonly href?: string;
  readonly isInteractive: boolean;
  readonly attributes: Record<string, string>;
  readonly children: readonly CdpDomNode[];
}

export interface CdpDomSnapshot {
  readonly targetId: string;
  readonly url: string;
  readonly title: string;
  readonly totalNodes: number;
  readonly interactiveNodesCount: number;
  readonly root: CdpDomNode;
  readonly pendingDialogs: readonly CdpDialogEvent[];
  readonly timestampMs: number;
  readonly textSummary: string;
}

export interface CdpConsoleMessage {
  readonly id: string;
  readonly targetId: string;
  readonly level: "log" | "info" | "warning" | "error" | "debug";
  readonly text: string;
  readonly source?: string;
  readonly timestampMs: number;
}

export interface CdpNetworkRequest {
  readonly requestId: string;
  readonly targetId: string;
  readonly url: string;
  readonly method: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly failed: boolean;
  readonly failureReason?: string;
  readonly timestampMs: number;
}

export interface CdpNavigationPolicy {
  readonly allowedSchemes: readonly string[];
  readonly blockPrivateIps: boolean;
  readonly blockCloudMetadata: boolean;
  readonly maxRedirects: number;
  readonly defaultTimeoutMs: number;
}

export interface CdpBrowserStateSnapshot {
  readonly targets: readonly CdpTarget[];
  readonly activeTargetId?: string;
  readonly pendingDialogs: readonly CdpDialogEvent[];
  readonly dialogHistory: readonly CdpDialogEvent[];
  readonly consoleLogCount: number;
  readonly networkRequestCount: number;
  readonly snapshotTick: number;
}

export interface ICdpProtocolClient {
  isConnected(): boolean;
  connect(endpointUrl: string): Promise<boolean>;
  disconnect(): Promise<void>;
  sendCommand<T = unknown>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T>;
  onEvent(handler: (event: { method: string; params: Record<string, unknown>; sessionId?: string }) => void): void;
}

export interface IBroccoliBrowserSubstrate {
  addTarget(target: CdpTarget): void;
  removeTarget(targetId: string): void;
  getTarget(targetId: string): CdpTarget | undefined;
  listTargets(): readonly CdpTarget[];
  getActiveTarget(): CdpTarget | undefined;
  setActiveTarget(targetId: string): void;
  addDialog(dialog: CdpDialogEvent): void;
  updateDialog(dialogId: string, status: CdpDialogStatus, responseText?: string): void;
  getPendingDialogs(): readonly CdpDialogEvent[];
  getDialogHistory(): readonly CdpDialogEvent[];
  recordConsoleMessage(message: CdpConsoleMessage): void;
  listConsoleMessages(targetId?: string, limit?: number): readonly CdpConsoleMessage[];
  recordNetworkRequest(request: CdpNetworkRequest): void;
  listNetworkRequests(targetId?: string, limit?: number): readonly CdpNetworkRequest[];
  cacheDomSnapshot(targetId: string, snapshot: CdpDomSnapshot): void;
  getCachedDomSnapshot(targetId: string): CdpDomSnapshot | undefined;
  clear(): void;
}

export interface IBrowserSnapshotManager {
  createSnapshot(tick: number): CdpBrowserStateSnapshot;
  restoreSnapshot(snapshot: CdpBrowserStateSnapshot): void;
}

export interface ICdpSupervisor {
  getActiveTarget(): CdpTarget | undefined;
  navigate(url: string, targetId?: string): Promise<{ success: boolean; targetId: string; title: string; url: string; error?: string }>;
  takeSnapshot(targetId?: string, maxDepth?: number): Promise<CdpDomSnapshot>;
  clickElement(selectorOrId: string | number, targetId?: string): Promise<{ success: boolean; error?: string }>;
  typeText(selectorOrId: string | number, text: string, targetId?: string): Promise<{ success: boolean; error?: string }>;
  handleDialog(action: "accept" | "dismiss", promptText?: string, dialogId?: string): Promise<{ success: boolean; dialogId?: string; error?: string }>;
  evaluateScript<T = unknown>(expression: string, targetId?: string): Promise<{ success: boolean; result?: T; error?: string }>;
  sendRawCdpCommand<T = unknown>(method: string, params?: Record<string, unknown>): Promise<{ success: boolean; result?: T; error?: string }>;
}
