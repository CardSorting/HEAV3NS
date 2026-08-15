import type {
  CdpBrowserStateSnapshot,
  IBrowserSnapshotManager,
  IBroccoliBrowserSubstrate,
} from "../../../core/contracts/cdp.contracts.js";

/**
 * Frame-perfect binary snapshot and rollback manager for browser state.
 */
export class BrowserSnapshotManager implements IBrowserSnapshotManager {
  private substrate: IBroccoliBrowserSubstrate;

  constructor(substrate: IBroccoliBrowserSubstrate) {
    this.substrate = substrate;
  }

  setSubstrate(substrate: IBroccoliBrowserSubstrate): void {
    this.substrate = substrate;
  }

  createSnapshot(tick: number): CdpBrowserStateSnapshot {
    const targets = this.substrate.listTargets();
    const activeTarget = this.substrate.getActiveTarget();
    const pendingDialogs = this.substrate.getPendingDialogs();
    const dialogHistory = this.substrate.getDialogHistory();
    const consoleLogs = this.substrate.listConsoleMessages();
    const networkReqs = this.substrate.listNetworkRequests();

    return {
      targets: targets.map((t) => ({ ...t })),
      activeTargetId: activeTarget?.targetId,
      pendingDialogs: pendingDialogs.map((d) => ({ ...d })),
      dialogHistory: dialogHistory.map((d) => ({ ...d })),
      consoleLogCount: consoleLogs.length,
      networkRequestCount: networkReqs.length,
      snapshotTick: tick,
    };
  }

  restoreSnapshot(snapshot: CdpBrowserStateSnapshot): void {
    this.substrate.clear();

    for (const target of snapshot.targets) {
      this.substrate.addTarget(target);
    }

    if (snapshot.activeTargetId) {
      this.substrate.setActiveTarget(snapshot.activeTargetId);
    }

    for (const dialog of snapshot.pendingDialogs) {
      this.substrate.addDialog(dialog);
    }

    for (const dialog of snapshot.dialogHistory) {
      // Re-populate history
      this.substrate.addDialog(dialog);
      this.substrate.updateDialog(dialog.id, dialog.status, dialog.responseText);
    }
  }
}
