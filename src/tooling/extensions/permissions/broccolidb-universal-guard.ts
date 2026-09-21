/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 175: Zero-Dependency Broccoli Universal Guard
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/UniversalGuard.ts.
 * Serves as a unified, singleton authority for all Joy-Zoning architectural policy enforcement,
 * system pressure management, and execution mode tracking (plan vs act). Zero external npm dependencies.
 */

import { BroccoliJoyZoningEngine } from "./broccolidb-joy-zoning.js";
import { BroccoliJoyZoningGuard } from "./broccolidb-joy-zoning-guard.js";
import { BroccoliAutomatedModeController } from "../../../agents/extensions/execution/broccolidb-mode-controller.js";

export type ExecutionMode = "plan" | "act" | "auto";

export class BroccoliUniversalGuard {
  private mode: ExecutionMode = "act";
  private systemPressure = 0;
  readonly joyEngine: BroccoliJoyZoningEngine;
  readonly joyGuard: BroccoliJoyZoningGuard;
  readonly modeController = new BroccoliAutomatedModeController();

  constructor(joyEngine = new BroccoliJoyZoningEngine()) {
    this.joyEngine = joyEngine;
    this.joyGuard = new BroccoliJoyZoningGuard(joyEngine);
  }

  /**
   * Updates current execution mode.
   */
  public setMode(mode: ExecutionMode): void {
    this.mode = mode;
  }

  /**
   * Returns active execution mode.
   */
  public getMode(): ExecutionMode {
    return this.mode;
  }

  /**
   * Increments and checks system pressure strikes.
   */
  public incrementPressure(): number {
    this.systemPressure++;
    return this.systemPressure;
  }

  /**
   * Resets accumulated system pressure strikes.
   */
  public resetSystemPressure(): void {
    this.systemPressure = 0;
  }

  /**
   * Returns current diagnostic summary.
   */
  public getSystemDiagnostics(): string {
    return `[UniversalGuard] Mode: ${this.mode.toUpperCase()}, Pressure Strikes: ${this.systemPressure}`;
  }
}
