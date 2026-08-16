/**
 * computer-use-supervisor.ts
 *
 * Master Computer Use Supervisor coordinating virtual display actions, Set-of-Marks
 * element indexing, and deterministic action recording (Phase 88 / ADR-040).
 */

import { performance } from "node:perf_hooks";
import type {
  ComputerActionResult,
  ComputerActionType,
  ComputerWorkspaceSnapshot,
} from "../../../core/contracts/computer-use.contracts.js";
import { DeterministicDisplayDriver } from "../../../tooling/extensions/computer-use/deterministic-display-driver.js";
import { BroccoliDisplaySubstrate } from "../../../sessions/extensions/computer-use/broccoli-display-substrate.js";

export class ComputerUseSupervisor {
  private driver: DeterministicDisplayDriver;
  private substrate: BroccoliDisplaySubstrate;

  constructor(driver: DeterministicDisplayDriver, substrate: BroccoliDisplaySubstrate) {
    this.driver = driver;
    this.substrate = substrate;
  }

  /**
   * Executes a typed computer use action on the virtual display.
   */
  executeAction(action: ComputerActionType, params: Record<string, unknown> = {}): ComputerActionResult {
    const startedAt = performance.now();

    let frame;
    switch (action) {
      case "capture":
        frame = this.driver.captureFrame();
        break;
      case "click":
      case "double_click":
      case "right_click":
      case "middle_click": {
        const x = typeof params.x === "number" ? params.x : undefined;
        const y = typeof params.y === "number" ? params.y : undefined;
        const elementId = typeof params.elementId === "number" ? params.elementId : undefined;
        frame = this.driver.click({ x, y, elementId });
        break;
      }
      case "type": {
        const text = String(params.text || "");
        frame = this.driver.type(text);
        break;
      }
      case "drag": {
        const startX = typeof params.startX === "number" ? params.startX : 0;
        const startY = typeof params.startY === "number" ? params.startY : 0;
        const endX = typeof params.endX === "number" ? params.endX : 0;
        const endY = typeof params.endY === "number" ? params.endY : 0;
        frame = this.driver.drag(startX, startY, endX, endY);
        break;
      }
      case "scroll": {
        const dx = typeof params.dx === "number" ? params.dx : 0;
        const dy = typeof params.dy === "number" ? params.dy : 0;
        frame = this.driver.scroll(dx, dy);
        break;
      }
      case "focus_window": {
        const windowId = String(params.windowId || "");
        this.driver.focusWindow(windowId);
        frame = this.driver.captureFrame();
        break;
      }
      default:
        frame = this.driver.captureFrame();
        break;
    }

    const duration = Number((performance.now() - startedAt).toFixed(3));
    const result: ComputerActionResult = {
      success: true,
      action,
      frame,
      durationMs: duration,
    };

    this.substrate.recordAction(result);
    return result;
  }

  /**
   * Captures screen state.
   */
  capture(): ComputerActionResult {
    return this.executeAction("capture");
  }

  /**
   * Returns workspace stats.
   */
  getStats(): ComputerWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists historical actions.
   */
  listActions(limit: number = 20): readonly ComputerActionResult[] {
    return this.substrate.listActions(limit);
  }
}
