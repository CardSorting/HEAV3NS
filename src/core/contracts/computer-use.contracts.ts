/**
 * computer-use.contracts.ts
 *
 * Core data contracts for Deterministic Computer Use, Virtual Display Buffer
 * & OS Automation Subsystem (Phase 88 / ADR-040).
 */

export type ComputerActionType =
  | "capture"
  | "click"
  | "double_click"
  | "right_click"
  | "middle_click"
  | "drag"
  | "scroll"
  | "type"
  | "key"
  | "set_value"
  | "wait"
  | "list_windows"
  | "focus_window";

export interface UiElementBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UiElement {
  readonly id: number;
  readonly label: string;
  readonly role: string;
  readonly bounds: UiElementBounds;
  readonly value?: string;
  readonly focused?: boolean;
}

export interface VirtualWindow {
  readonly id: string;
  readonly title: string;
  readonly appName: string;
  readonly bounds: UiElementBounds;
  readonly active: boolean;
  readonly elements: readonly UiElement[];
}

export interface VirtualDisplayFrame {
  readonly frameIndex: number;
  readonly width: number;
  readonly height: number;
  readonly cursor: {
    readonly x: number;
    readonly y: number;
    readonly pressed: boolean;
  };
  readonly activeWindowId?: string;
  readonly windows: readonly VirtualWindow[];
  readonly elements: readonly UiElement[];
  readonly timestamp: number;
}

export interface ComputerActionResult {
  readonly success: boolean;
  readonly action: ComputerActionType;
  readonly frame: VirtualDisplayFrame;
  readonly durationMs: number;
  readonly error?: string;
}

export interface ComputerWorkspaceSnapshot {
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly windowCount: number;
  readonly elementCount: number;
  readonly currentCursor: { readonly x: number; readonly y: number };
  readonly totalActions: number;
  readonly timestamp: number;
}
