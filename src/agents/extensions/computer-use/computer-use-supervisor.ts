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
  ComputerUseBulkMutationResult,
  ComputerUseDslQueryFilter,
  ComputerUseGroupBy,
  ComputerUseGroupedLane,
  ComputerUseHealthAuditReport,
  ComputerUseMetricsReport,
  ComputerUseSortBy,
  ComputerUseSortDirection,
  ComputerWorkspaceSnapshot,
  UiElement,
  VirtualDisplayFrame,
  VirtualWindow,
} from "../../../core/contracts/computer-use.contracts.js";
import { DeterministicDisplayDriver } from "../../../tooling/extensions/computer-use/deterministic-display-driver.js";
import { BroccoliDisplaySubstrate } from "../../../sessions/extensions/computer-use/broccoli-display-substrate.js";

export class ComputerUseSupervisor {
  private readonly driver: DeterministicDisplayDriver;
  private readonly substrate: BroccoliDisplaySubstrate;

  constructor(driver?: DeterministicDisplayDriver, substrate?: BroccoliDisplaySubstrate) {
    this.driver = driver ?? new DeterministicDisplayDriver();
    this.substrate = substrate ?? new BroccoliDisplaySubstrate();
  }

  /**
   * Executes a typed computer use action on the virtual display.
   */
  public executeAction(action: ComputerActionType, params: Record<string, unknown> = {}): ComputerActionResult {
    const startedAt = performance.now();
    const actionId = this.driver.generateActionId(action);

    let frame: VirtualDisplayFrame;
    let success = true;
    let errorMsg: string | undefined;

    try {
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
          if (action === "double_click") {
            frame = this.driver.doubleClick({ x, y, elementId });
          } else if (action === "right_click") {
            frame = this.driver.rightClick({ x, y, elementId });
          } else {
            frame = this.driver.click({ x, y, elementId });
          }
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
          const deltaX = typeof params.deltaX === "number" ? params.deltaX : 0;
          const deltaY = typeof params.deltaY === "number" ? params.deltaY : 0;
          frame = this.driver.scroll(deltaX, deltaY);
          break;
        }

        case "set_value": {
          const elementId = typeof params.elementId === "number" ? params.elementId : 1;
          const value = String(params.value || "");
          frame = this.driver.setValue(elementId, value);
          break;
        }

        case "focus_window": {
          const windowId = String(params.windowId || "win-main-1");
          frame = this.driver.focusWindow(windowId);
          break;
        }

        case "list_windows":
        default:
          frame = this.driver.captureFrame();
          break;
      }
    } catch (err: unknown) {
      success = false;
      errorMsg = err instanceof Error ? err.message : String(err);
      frame = this.driver.captureFrame();
    }

    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    const result: ComputerActionResult = {
      actionId,
      success,
      action,
      frame,
      durationMs,
      error: errorMsg,
      timestamp: Date.now(),
    };

    this.substrate.recordAction(result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Queries & Diagnostics
  // ---------------------------------------------------------------------------

  public getAction(actionId: string): ComputerActionResult | undefined {
    return this.substrate.getAction(actionId);
  }

  public listActions(limit: number = 20): readonly ComputerActionResult[] {
    return this.substrate.listActions(limit);
  }

  public listWindows(): readonly VirtualWindow[] {
    return this.driver.listWindows();
  }

  public listElements(): readonly UiElement[] {
    return this.driver.captureFrame().elements;
  }

  public registerWindow(window: VirtualWindow): void {
    this.driver.registerWindow(window);
  }

  public addElement(windowId: string, element: UiElement): boolean {
    return this.driver.addElement(windowId, element);
  }

  public auditHealth(): ComputerUseHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getMetrics(): ComputerUseMetricsReport {
    return this.substrate.getMetrics();
  }

  public getGroupedActions(groupBy?: ComputerUseGroupBy, sortBy?: ComputerUseSortBy, direction?: ComputerUseSortDirection): readonly ComputerUseGroupedLane[] {
    return this.substrate.getGroupedActions(groupBy, sortBy, direction);
  }

  public queryDsl(query: ComputerUseDslQueryFilter | string): readonly ComputerActionResult[] {
    return this.substrate.queryActionsDsl(query);
  }

  public bulkPurge(actionIds: readonly string[]): ComputerUseBulkMutationResult {
    return this.substrate.bulkPurgeActions(actionIds);
  }

  public getStats(): ComputerWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getDriver(): DeterministicDisplayDriver {
    return this.driver;
  }

  public getSubstrate(): BroccoliDisplaySubstrate {
    return this.substrate;
  }
}
