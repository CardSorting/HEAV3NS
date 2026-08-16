/**
 * deterministic-display-driver.ts
 *
 * In-memory zero-GC virtual display driver and Set-of-Marks (SoM) element overlay engine (Phase 88 / ADR-040).
 */

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
  registerWindow(window: VirtualWindow): void {
    this.windows.set(window.id, window);
    if (window.active) {
      this.activeWindowId = window.id;
    }
  }

  /**
   * Sets the active focused window.
   */
  focusWindow(windowId: string): boolean {
    const target = this.windows.get(windowId);
    if (!target) return false;

    for (const [id, win] of this.windows.entries()) {
      this.windows.set(id, { ...win, active: id === windowId });
    }
    this.activeWindowId = windowId;
    return true;
  }

  /**
   * Finds an element by Set-of-Marks integer ID.
   */
  findElementById(elementId: number): { windowId: string; element: UiElement } | undefined {
    for (const [windowId, win] of this.windows.entries()) {
      for (let i = 0; i < win.elements.length; i++) {
        const el = win.elements[i];
        if (el.id === elementId) {
          return { windowId, element: el };
        }
      }
    }
    return undefined;
  }

  /**
   * Finds an element under specific (x, y) coordinates.
   */
  hitTest(x: number, y: number): { windowId: string; element?: UiElement } | undefined {
    // Iterate active window first
    if (this.activeWindowId) {
      const activeWin = this.windows.get(this.activeWindowId);
      if (activeWin && this.isInsideBounds(x, y, activeWin.bounds)) {
        for (let i = 0; i < activeWin.elements.length; i++) {
          const el = activeWin.elements[i];
          if (this.isInsideBounds(x, y, el.bounds)) {
            return { windowId: activeWin.id, element: el };
          }
        }
        return { windowId: activeWin.id };
      }
    }

    for (const win of this.windows.values()) {
      if (this.isInsideBounds(x, y, win.bounds)) {
        for (let i = 0; i < win.elements.length; i++) {
          const el = win.elements[i];
          if (this.isInsideBounds(x, y, el.bounds)) {
            return { windowId: win.id, element: el };
          }
        }
        return { windowId: win.id };
      }
    }
    return undefined;
  }

  private isInsideBounds(x: number, y: number, b: { x: number; y: number; width: number; height: number }): boolean {
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  /**
   * Captures the current virtual display state.
   */
  captureFrame(): VirtualDisplayFrame {
    this.frameCount++;
    const allWindows = Array.from(this.windows.values());
    const allElements: UiElement[] = [];
    for (let i = 0; i < allWindows.length; i++) {
      allElements.push(...allWindows[i].elements);
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
   * Dispatches a click action by coordinate or SoM element ID.
   */
  click(target?: { x?: number; y?: number; elementId?: number }): VirtualDisplayFrame {
    if (typeof target?.elementId === "number") {
      const match = this.findElementById(target.elementId);
      if (match) {
        this.cursorX = match.element.bounds.x + Math.floor(match.element.bounds.width / 2);
        this.cursorY = match.element.bounds.y + Math.floor(match.element.bounds.height / 2);
        this.focusWindow(match.windowId);
      }
    } else if (typeof target?.x === "number" && typeof target?.y === "number") {
      this.cursorX = target.x;
      this.cursorY = target.y;
      const hit = this.hitTest(target.x, target.y);
      if (hit) {
        this.focusWindow(hit.windowId);
      }
    }
    return this.captureFrame();
  }

  /**
   * Dispatches a type action to the focused element.
   */
  type(text: string): VirtualDisplayFrame {
    if (this.activeWindowId) {
      const win = this.windows.get(this.activeWindowId);
      if (win) {
        // Find focused element or default to first input
        const targetElIndex = win.elements.findIndex((e) => e.focused || e.role === "input");
        if (targetElIndex >= 0) {
          const updatedElements = [...win.elements];
          const el = updatedElements[targetElIndex];
          updatedElements[targetElIndex] = {
            ...el,
            value: (el.value || "") + text,
            focused: true,
          };
          this.windows.set(win.id, { ...win, elements: updatedElements });
        }
      }
    }
    return this.captureFrame();
  }

  /**
   * Dispatches a mouse drag action.
   */
  drag(startX: number, startY: number, endX: number, endY: number): VirtualDisplayFrame {
    this.cursorX = startX;
    this.cursorY = startY;
    this.cursorPressed = true;
    this.cursorX = endX;
    this.cursorY = endY;
    this.cursorPressed = false;
    return this.captureFrame();
  }

  /**
   * Dispatches a scroll action.
   */
  scroll(dx: number, dy: number): VirtualDisplayFrame {
    this.cursorX = Math.max(0, Math.min(this.width, this.cursorX + dx));
    this.cursorY = Math.max(0, Math.min(this.height, this.cursorY + dy));
    return this.captureFrame();
  }

  /**
   * Resets display driver.
   */
  reset(): void {
    this.windows.clear();
    this.initDefaultWorkspace();
    this.cursorX = Math.floor(this.width / 2);
    this.cursorY = Math.floor(this.height / 2);
    this.cursorPressed = false;
    this.frameCount = 0;
  }
}
