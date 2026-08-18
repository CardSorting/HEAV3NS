/**
 * deterministic-display-driver.ts
 *
 * In-memory zero-GC virtual display driver and Set-of-Marks (SoM) element overlay engine (Phase 88 / ADR-040).
 */

import * as crypto from "node:crypto";
import type {
  ComputerActionType,
  UiElement,
  VirtualDisplayFrame,
  VirtualWindow,
} from "../../../core/contracts/computer-use.contracts.js";

export class DeterministicDisplayDriver {
  private width: number;
  private height: number;
  private cursorX: number;
  private cursorY: number;
  private cursorPressed: boolean;
  private activeWindowId?: string;
  private windows: Map<string, VirtualWindow>;
  private frameCount: number;

  constructor(width: number = 1920, height: number = 1080) {
    this.width = width;
    this.height = height;
    this.cursorX = Math.floor(width / 2);
    this.cursorY = Math.floor(height / 2);
    this.cursorPressed = false;
    this.windows = new Map<string, VirtualWindow>();
    this.frameCount = 0;
    this.initDefaultWorkspace();
  }

  /**
   * Generates a deterministic action ID.
   */
  public generateActionId(action: ComputerActionType, timestamp = Date.now()): string {
    const hash = crypto.createHash("sha256").update(`${action}:${this.frameCount}:${timestamp}`).digest("hex");
    return `act_${hash.slice(0, 10)}`;
  }

  private initDefaultWorkspace(): void {
    const defaultWindow: VirtualWindow = {
      id: "win-main-1",
      title: "LUMI Desktop Workspace",
      appName: "LumiDesk",
      bounds: { x: 100, y: 100, width: 1000, height: 700 },
      active: true,
      elements: [
        { id: 1, label: "Search bar", role: "input", bounds: { x: 120, y: 120, width: 400, height: 40 }, value: "" },
        { id: 2, label: "Submit button", role: "button", bounds: { x: 540, y: 120, width: 100, height: 40 } },
        { id: 3, label: "Content view", role: "pane", bounds: { x: 120, y: 180, width: 960, height: 600 } },
      ],
    };
    this.windows.set(defaultWindow.id, defaultWindow);
    this.activeWindowId = defaultWindow.id;
  }

  /**
   * Adds or updates a window in the virtual display.
   */
  public registerWindow(window: VirtualWindow): void {
    this.windows.set(window.id, window);
    if (window.active) {
      this.activeWindowId = window.id;
    }
  }

  /**
   * Adds an element to an existing window.
   */
  public addElement(windowId: string, element: UiElement): boolean {
    const win = this.windows.get(windowId);
    if (!win) return false;
    const updated = {
      ...win,
      elements: [...win.elements, element],
    };
    this.windows.set(windowId, updated);
    return true;
  }

  /**
   * Captures the current virtual display state as a VirtualDisplayFrame.
   */
  public captureFrame(): VirtualDisplayFrame {
    this.frameCount++;
    const allWindows = Array.from(this.windows.values());
    const allElements: UiElement[] = [];

    for (const win of allWindows) {
      allElements.push(...win.elements);
    }

    return {
      frameIndex: this.frameCount,
      width: this.width,
      height: this.height,
      cursor: {
        x: this.cursorX,
        y: this.cursorY,
        pressed: this.cursorPressed,
      },
      activeWindowId: this.activeWindowId,
      windows: allWindows,
      elements: allElements,
      timestamp: Date.now(),
    };
  }

  /**
   * Simulates clicking the cursor at coordinates or targeting an element.
   */
  public click(params: { x?: number; y?: number; elementId?: number; button?: "left" | "right" | "middle" } = {}): VirtualDisplayFrame {
    if (typeof params.elementId === "number") {
      const el = this.findElement(params.elementId);
      if (el) {
        this.cursorX = Math.floor(el.bounds.x + el.bounds.width / 2);
        this.cursorY = Math.floor(el.bounds.y + el.bounds.height / 2);
      }
    } else {
      if (typeof params.x === "number") this.cursorX = Math.max(0, Math.min(this.width, params.x));
      if (typeof params.y === "number") this.cursorY = Math.max(0, Math.min(this.height, params.y));
    }
    return this.captureFrame();
  }

  public doubleClick(params: { x?: number; y?: number; elementId?: number } = {}): VirtualDisplayFrame {
    return this.click(params);
  }

  public rightClick(params: { x?: number; y?: number; elementId?: number } = {}): VirtualDisplayFrame {
    return this.click({ ...params, button: "right" });
  }

  /**
   * Simulates typing text into the currently focused or active input element.
   */
  public type(text: string): VirtualDisplayFrame {
    if (this.activeWindowId) {
      const win = this.windows.get(this.activeWindowId);
      if (win) {
        const inputElem = win.elements.find((e) => e.role === "input");
        if (inputElem) {
          const updatedElem: UiElement = {
            ...inputElem,
            value: (inputElem.value || "") + text,
          };
          const updatedElements = win.elements.map((e) => (e.id === inputElem.id ? updatedElem : e));
          this.windows.set(this.activeWindowId, { ...win, elements: updatedElements });
        }
      }
    }
    return this.captureFrame();
  }

  public setValue(elementId: number, value: string): VirtualDisplayFrame {
    for (const [winId, win] of this.windows.entries()) {
      const el = win.elements.find((e) => e.id === elementId);
      if (el) {
        const updated = win.elements.map((e) => (e.id === elementId ? { ...e, value } : e));
        this.windows.set(winId, { ...win, elements: updated });
        break;
      }
    }
    return this.captureFrame();
  }

  /**
   * Simulates dragging from start to end coordinates.
   */
  public drag(startX: number, startY: number, endX: number, endY: number): VirtualDisplayFrame {
    this.cursorX = startX;
    this.cursorY = startY;
    this.cursorPressed = true;
    this.cursorX = endX;
    this.cursorY = endY;
    this.cursorPressed = false;
    return this.captureFrame();
  }

  /**
   * Simulates scrolling the virtual display.
   */
  public scroll(deltaX: number = 0, deltaY: number = 0): VirtualDisplayFrame {
    this.cursorX = Math.max(0, Math.min(this.width, this.cursorX + deltaX));
    this.cursorY = Math.max(0, Math.min(this.height, this.cursorY + deltaY));
    return this.captureFrame();
  }

  /**
   * Changes the active virtual window.
   */
  public focusWindow(windowId: string): VirtualDisplayFrame {
    if (this.windows.has(windowId)) {
      this.activeWindowId = windowId;
      for (const [id, win] of this.windows.entries()) {
        this.windows.set(id, { ...win, active: id === windowId });
      }
    }
    return this.captureFrame();
  }

  public listWindows(): readonly VirtualWindow[] {
    return Array.from(this.windows.values());
  }

  public findElement(id: number): UiElement | undefined {
    for (const win of this.windows.values()) {
      const el = win.elements.find((e) => e.id === id);
      if (el) return el;
    }
    return undefined;
  }

  public getResolution(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  public getCursor(): { x: number; y: number; pressed: boolean } {
    return { x: this.cursorX, y: this.cursorY, pressed: this.cursorPressed };
  }

  public clear(): void {
    this.windows.clear();
    this.frameCount = 0;
    this.initDefaultWorkspace();
  }
}
