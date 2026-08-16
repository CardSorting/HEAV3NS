/**
 * broccoli-display-substrate.ts
 *
 * In-memory Broccolidb substrate for virtual display frames, UI element trees, and action logs (Phase 88 / ADR-040).
 */

import type {
  ComputerActionResult,
  ComputerWorkspaceSnapshot,
} from "../../../core/contracts/computer-use.contracts.js";

export class BroccoliDisplaySubstrate {
  private actions: ComputerActionResult[];
  private displayWidth: number;
  private displayHeight: number;
  private windowCount: number;
  private elementCount: number;
  private currentCursor: { x: number; y: number };

  constructor() {
    this.actions = [];
    this.displayWidth = 1920;
    this.displayHeight = 1080;
    this.windowCount = 1;
    this.elementCount = 3;
    this.currentCursor = { x: 960, y: 540 };
  }

  /**
   * Records a computer action outcome into the Broccolidb ledger.
   */
  recordAction(result: ComputerActionResult): void {
    this.actions.push(result);
    this.displayWidth = result.frame.width;
    this.displayHeight = result.frame.height;
    this.windowCount = result.frame.windows.length;
    this.elementCount = result.frame.elements.length;
    this.currentCursor = { x: result.frame.cursor.x, y: result.frame.cursor.y };

    if (this.actions.length > 200) {
      this.actions.shift();
    }
  }

  /**
   * Lists historical computer actions.
   */
  listActions(limit: number = 20): readonly ComputerActionResult[] {
    return this.actions.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): ComputerWorkspaceSnapshot {
    return {
      displayWidth: this.displayWidth,
      displayHeight: this.displayHeight,
      windowCount: this.windowCount,
      elementCount: this.elementCount,
      currentCursor: { ...this.currentCursor },
      totalActions: this.actions.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: ComputerWorkspaceSnapshot): void {
    this.displayWidth = snapshot.displayWidth;
    this.displayHeight = snapshot.displayHeight;
    this.windowCount = snapshot.windowCount;
    this.elementCount = snapshot.elementCount;
    this.currentCursor = { ...snapshot.currentCursor };
    this.actions = this.actions.slice(0, snapshot.totalActions);
  }

  /**
   * Clears all stored action logs.
   */
  clear(): void {
    this.actions = [];
    this.windowCount = 1;
    this.elementCount = 3;
    this.currentCursor = { x: 960, y: 540 };
  }
}
