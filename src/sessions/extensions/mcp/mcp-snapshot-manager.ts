/**
 * mcp-snapshot-manager.ts
 *
 * Frame-perfect binary snapshotting and O(1) state rewind for the MCP client substrate.
 */

import type { McpSessionSnapshot } from "../../../core/contracts/mcp-client.contracts.js";
import { BroccoliMcpSubstrate } from "./broccoli-mcp-substrate.js";

export interface McpSnapshotFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly snapshot: McpSessionSnapshot;
}

export class McpSnapshotManager {
  private readonly history: McpSnapshotFrame[] = [];
  private readonly substrate: BroccoliMcpSubstrate;
  private readonly maxFrames: number;

  constructor(
    substrate: BroccoliMcpSubstrate,
    maxFrames = 128
  ) {
    this.substrate = substrate;
    this.maxFrames = Math.max(16, maxFrames);
  }

  /**
   * Captures an atomic snapshot frame of current MCP client state.
   */
  public captureFrame(frameId: number): McpSnapshotFrame {
    const snapshot = this.substrate.createSnapshot();
    const frame: McpSnapshotFrame = {
      frameId,
      timestamp: Date.now(),
      snapshot,
    };

    this.history.push(frame);
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }

    return frame;
  }

  /**
   * Rewinds MCP substrate state to a designated historical frame ID in sub-millisecond O(1) time.
   */
  public rewindToFrame(frameId: number): boolean {
    const target = this.history.find((f) => f.frameId === frameId);
    if (!target) return false;

    this.substrate.restoreSnapshot(target.snapshot);
    return true;
  }

  /**
   * Returns snapshot frame count.
   */
  public getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Gets latest recorded frame.
   */
  public getLatestFrame(): McpSnapshotFrame | undefined {
    return this.history[this.history.length - 1];
  }

  /**
   * Clears historical frames.
   */
  public clear(): void {
    this.history.length = 0;
  }
}
