/**
 * broccoli-disclosure-substrate.ts
 *
 * In-memory Broccolidb repository for registered tool catalogs, deferred schemas,
 * and dynamic activation ledgers (Phase 91 / ADR-043).
 */

import type {
  DisclosureTier,
  ToolDisclosureWorkspaceSnapshot,
} from "../../../core/contracts/tool-disclosure.contracts.js";

export class BroccoliDisclosureSubstrate {
  private activatedTools: Set<string>;
  private activationHistory: string[];
  private activeTier: DisclosureTier;

  constructor() {
    this.activatedTools = new Set<string>();
    this.activationHistory = [];
    this.activeTier = "budgeted_listing";
  }

  recordActivation(toolName: string): void {
    this.activatedTools.add(toolName);
    this.activationHistory.push(toolName);

    if (this.activationHistory.length > 500) {
      this.activationHistory.shift();
    }
  }

  setActiveTier(tier: DisclosureTier): void {
    this.activeTier = tier;
  }

  getActivatedTools(): readonly string[] {
    return Array.from(this.activatedTools);
  }

  exportSnapshot(totalTools: number, deferredToolsCount: number): ToolDisclosureWorkspaceSnapshot {
    return {
      totalTools,
      deferredToolsCount,
      activatedTools: Array.from(this.activatedTools),
      activeTier: this.activeTier,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: ToolDisclosureWorkspaceSnapshot): void {
    this.activatedTools.clear();
    for (let i = 0; i < snapshot.activatedTools.length; i++) {
      this.activatedTools.add(snapshot.activatedTools[i]);
    }
    this.activeTier = snapshot.activeTier;
  }

  clear(): void {
    this.activatedTools.clear();
    this.activationHistory = [];
    this.activeTier = "budgeted_listing";
  }
}
