/**
 * [LAYER: AGENT EXTENSION]
 * Pass 179: Zero-Dependency Broccoli Automated Mode Controller
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/ModeController logic.
 * Manages automated state machine transitions between Plan Mode and Act Mode, enforcing read-only
 * research during Plan Mode and active transaction tracking during Act Mode. Zero external npm dependencies.
 */

export type ModeState = "plan" | "act";

export interface ModeGateResult {
  allowed: boolean;
  reason?: string;
}

export class BroccoliAutomatedModeController {
  private state: ModeState = "act";
  private planTurnCount = 0;
  private actTurnCount = 0;

  constructor(initialState: ModeState = "act") {
    this.state = initialState;
  }

  /**
   * Transitions active mode state.
   */
  public transitionMode(newState: ModeState): ModeState {
    this.state = newState;
    return this.state;
  }

  /**
   * Returns current mode state.
   */
  public getMode(): ModeState {
    return this.state;
  }

  /**
   * Increments turn count for current mode.
   */
  public advanceTurn(): void {
    if (this.state === "plan") {
      this.planTurnCount++;
    } else {
      this.actTurnCount++;
    }
  }

  /**
   * Validates if a tool invocation is allowed in the current mode state.
   */
  public canExecuteToolInMode(toolName: string): ModeGateResult {
    if (this.state === "plan") {
      const isMutatingTool = toolName === "write_to_file" || toolName === "replace_file_content" || toolName === "multi_replace_file_content";
      if (isMutatingTool) {
        return {
          allowed: false,
          reason: `[PLAN MODE ACTIVE] Tool \`${toolName}\` mutates workspace files. Switch to ACT mode or approve plan before writing.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Returns strategic mode advisory.
   */
  public getModeAdvisory(): string {
    if (this.state === "plan") {
      return `[MODE: PLAN] Research & strategic drafting active (${this.planTurnCount} turns). File modifications blocked.`;
    }
    return `[MODE: ACT] Active execution & mutation tracking enabled (${this.actTurnCount} turns).`;
  }
}
