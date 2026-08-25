/**
 * tool-loop-breaker.ts
 *
 * Automated Tool Call Deduplication & Recursive Loop Breaker.
 * Tracks recent tool invocations using deterministic argument hashes.
 * Detects unproductive repeat cycles and injects self-correcting prompt advisories.
 */

import * as crypto from "node:crypto";

export interface LoopBreakerConfig {
  readonly maxRepeatThreshold?: number; // max identical calls allowed before breaking (default: 4)
  readonly windowSize?: number; // rolling signature window size (default: 12)
  readonly softAdvisoryMode?: boolean; // If true, return advisory without hard throwing
}

export interface LoopDetectionResult {
  readonly loopDetected: boolean;
  readonly repeatCount: number;
  readonly advisoryMessage?: string;
  readonly softAdvisory?: boolean;
}

export class ToolLoopBreaker {
  private maxRepeatThreshold: number;
  private windowSize: number;
  private softAdvisoryMode: boolean;
  private callHistory: Array<{ signature: string; toolName: string; timestamp: number }> = [];

  constructor(config: LoopBreakerConfig = {}) {
    this.maxRepeatThreshold = config.maxRepeatThreshold ?? 4;
    this.windowSize = config.windowSize ?? 12;
    this.softAdvisoryMode = config.softAdvisoryMode ?? false;
  }

  /**
   * Updates configuration dynamically.
   */
  public updateConfig(config: Partial<LoopBreakerConfig>): void {
    if (typeof config.maxRepeatThreshold === "number") this.maxRepeatThreshold = config.maxRepeatThreshold;
    if (typeof config.windowSize === "number") this.windowSize = config.windowSize;
    if (typeof config.softAdvisoryMode === "boolean") this.softAdvisoryMode = config.softAdvisoryMode;
  }

  /**
   * Generates a deterministic signature for a tool name and arguments.
   */
  public generateSignature(toolName: string, args: Record<string, unknown>): string {
    const serializedArgs = JSON.stringify(args, Object.keys(args).sort());
    const hash = crypto.createHash("sha256").update(serializedArgs).digest("hex").slice(0, 16);
    return `${toolName}:${hash}`;
  }

  /**
   * Records a tool call and checks whether a loop has been formed.
   */
  public recordAndCheck(
    toolName: string,
    args: Record<string, unknown>,
    options?: { softMode?: boolean }
  ): LoopDetectionResult {
    const signature = this.generateSignature(toolName, args);
    const now = Date.now();

    this.callHistory.push({ signature, toolName, timestamp: now });

    if (this.callHistory.length > this.windowSize) {
      this.callHistory.shift();
    }

    // Count consecutive identical signatures from the end of history
    let consecutiveOccurrences = 0;
    for (let i = this.callHistory.length - 1; i >= 0; i--) {
      if (this.callHistory[i].signature === signature) {
        consecutiveOccurrences++;
      } else {
        break;
      }
    }

    const isSoft = options?.softMode ?? this.softAdvisoryMode;

    if (consecutiveOccurrences >= this.maxRepeatThreshold) {
      return {
        loopDetected: true,
        repeatCount: consecutiveOccurrences,
        softAdvisory: isSoft,
        advisoryMessage: `[TOOL LOOP DETECTED]: You have called '${toolName}' with identical arguments ${consecutiveOccurrences} times consecutively without making progress. Execution has been paused. Please pause, re-evaluate the failure reason, and attempt a different strategy or inspect file contents.`,
      };
    }

    return {
      loopDetected: false,
      repeatCount: consecutiveOccurrences,
      softAdvisory: isSoft,
    };
  }

  /**
   * Resets the loop history (e.g. at the start of a new user turn).
   */
  public reset(): void {
    this.callHistory = [];
  }
}

