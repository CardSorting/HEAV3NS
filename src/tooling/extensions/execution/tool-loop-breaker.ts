/**
 * tool-loop-breaker.ts
 *
 * Automated Tool Call Deduplication & Recursive Loop Breaker.
 * Tracks recent tool invocations using deterministic argument hashes.
 * Detects unproductive repeat cycles and injects self-correcting prompt advisories.
 */

import * as crypto from "node:crypto";

export interface LoopBreakerConfig {
  readonly maxRepeatThreshold?: number; // max identical calls allowed before breaking (default: 3)
  readonly windowSize?: number; // rolling signature window size (default: 10)
}

export interface LoopDetectionResult {
  readonly loopDetected: boolean;
  readonly repeatCount: number;
  readonly advisoryMessage?: string;
}

export class ToolLoopBreaker {
  private readonly maxRepeatThreshold: number;
  private readonly windowSize: number;
  private callHistory: Array<{ signature: string; toolName: string; timestamp: number }> = [];

  constructor(config: LoopBreakerConfig = {}) {
    this.maxRepeatThreshold = config.maxRepeatThreshold ?? 3;
    this.windowSize = config.windowSize ?? 10;
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
  public recordAndCheck(toolName: string, args: Record<string, unknown>): LoopDetectionResult {
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

    if (consecutiveOccurrences >= this.maxRepeatThreshold) {
      return {
        loopDetected: true,
        repeatCount: consecutiveOccurrences,
        advisoryMessage: `[TOOL LOOP DETECTED]: You have called '${toolName}' with identical arguments ${consecutiveOccurrences} times consecutively without making progress. Execution has been paused. Please pause, re-evaluate the failure reason, and attempt a different strategy or inspect file contents.`,
      };
    }

    return {
      loopDetected: false,
      repeatCount: consecutiveOccurrences,
    };
  }

  /**
   * Resets the loop history (e.g. at the start of a new user turn).
   */
  public reset(): void {
    this.callHistory = [];
  }
}
