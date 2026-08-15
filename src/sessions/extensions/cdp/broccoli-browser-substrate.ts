import type {
  CdpTarget,
  CdpDialogEvent,
  CdpDialogStatus,
  CdpConsoleMessage,
  CdpNetworkRequest,
  CdpDomSnapshot,
  IBroccoliBrowserSubstrate,
} from "../../../core/contracts/cdp.contracts.js";

const MAX_CONSOLE_MESSAGES = 100;
const MAX_NETWORK_REQUESTS = 100;
const MAX_DIALOG_HISTORY = 50;

/**
 * Zero-GC in-memory cache of browser targets, dialog events, console logs,
 * and network requests stored directly in Broccolidb session memory.
 */
export class BroccoliBrowserSubstrate implements IBroccoliBrowserSubstrate {
  private readonly targets = new Map<string, CdpTarget>();
  private activeTargetId?: string;
  private readonly pendingDialogs = new Map<string, CdpDialogEvent>();
  private readonly dialogHistory: CdpDialogEvent[] = [];
  private readonly consoleMessages: CdpConsoleMessage[] = [];
  private readonly networkRequests: CdpNetworkRequest[] = [];
  private readonly domSnapshotCache = new Map<string, CdpDomSnapshot>();

  addTarget(target: CdpTarget): void {
    this.targets.set(target.targetId, target);
    if (!this.activeTargetId || target.type === "page") {
      this.activeTargetId = target.targetId;
    }
  }

  removeTarget(targetId: string): void {
    this.targets.delete(targetId);
    this.domSnapshotCache.delete(targetId);
    if (this.activeTargetId === targetId) {
      const first = Array.from(this.targets.values()).find((t) => t.type === "page");
      this.activeTargetId = first?.targetId;
    }
  }

  getTarget(targetId: string): CdpTarget | undefined {
    return this.targets.get(targetId);
  }

  listTargets(): readonly CdpTarget[] {
    return Array.from(this.targets.values());
  }

  getActiveTarget(): CdpTarget | undefined {
    return this.activeTargetId ? this.targets.get(this.activeTargetId) : undefined;
  }

  setActiveTarget(targetId: string): void {
    if (this.targets.has(targetId)) {
      this.activeTargetId = targetId;
    }
  }

  addDialog(dialog: CdpDialogEvent): void {
    this.pendingDialogs.set(dialog.id, dialog);
  }

  updateDialog(dialogId: string, status: CdpDialogStatus, responseText?: string): void {
    const dialog = this.pendingDialogs.get(dialogId);
    if (dialog) {
      this.pendingDialogs.delete(dialogId);
      const updated: CdpDialogEvent = {
        ...dialog,
        status,
        responseText,
      };
      this.dialogHistory.push(updated);
      if (this.dialogHistory.length > MAX_DIALOG_HISTORY) {
        this.dialogHistory.shift();
      }
    }
  }

  getPendingDialogs(): readonly CdpDialogEvent[] {
    return Array.from(this.pendingDialogs.values());
  }

  getDialogHistory(): readonly CdpDialogEvent[] {
    return this.dialogHistory;
  }

  recordConsoleMessage(message: CdpConsoleMessage): void {
    this.consoleMessages.push(message);
    if (this.consoleMessages.length > MAX_CONSOLE_MESSAGES) {
      this.consoleMessages.shift();
    }
  }

  listConsoleMessages(targetId?: string, limit = 50): readonly CdpConsoleMessage[] {
    let list = this.consoleMessages;
    if (targetId) {
      list = list.filter((m) => m.targetId === targetId);
    }
    return list.slice(-limit);
  }

  recordNetworkRequest(request: CdpNetworkRequest): void {
    this.networkRequests.push(request);
    if (this.networkRequests.length > MAX_NETWORK_REQUESTS) {
      this.networkRequests.shift();
    }
  }

  listNetworkRequests(targetId?: string, limit = 50): readonly CdpNetworkRequest[] {
    let list = this.networkRequests;
    if (targetId) {
      list = list.filter((r) => r.targetId === targetId);
    }
    return list.slice(-limit);
  }

  cacheDomSnapshot(targetId: string, snapshot: CdpDomSnapshot): void {
    this.domSnapshotCache.set(targetId, snapshot);
  }

  getCachedDomSnapshot(targetId: string): CdpDomSnapshot | undefined {
    return this.domSnapshotCache.get(targetId);
  }

  clear(): void {
    this.targets.clear();
    this.activeTargetId = undefined;
    this.pendingDialogs.clear();
    this.dialogHistory.length = 0;
    this.consoleMessages.length = 0;
    this.networkRequests.length = 0;
    this.domSnapshotCache.clear();
  }
}
