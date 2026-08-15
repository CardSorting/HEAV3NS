/**
 * broccoli-process-substrate.ts
 *
 * In-memory zero-GC Broccolidb storage layer for background process handles,
 * PID tables, output ring buffers, and lifecycle metrics.
 */

import type {
  ProcessHandleDescriptor,
  ProcessSessionSnapshot,
  ProcessWatchMatch,
} from "../../../core/contracts/process.contracts.js";
import { ProcessOutputRingBuffer } from "../../../tooling/extensions/process/process-output-ring-buffer.js";

export class BroccoliProcessSubstrate {
  private readonly activeProcesses = new Map<string, ProcessHandleDescriptor>();
  private readonly historyProcesses = new Map<string, ProcessHandleDescriptor>();
  private readonly buffers = new Map<string, ProcessOutputRingBuffer>();
  private readonly taskIndex = new Map<string, string>(); // taskId -> processId

  private totalSpawned = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private totalKilled = 0;

  /**
   * Registers a newly spawned process descriptor and its output buffer.
   */
  public registerProcess(
    descriptor: ProcessHandleDescriptor,
    bufferCapacity = 262144
  ): void {
    this.activeProcesses.set(descriptor.id, descriptor);
    if (descriptor.taskId) {
      this.taskIndex.set(descriptor.taskId, descriptor.id);
    }
    if (!this.buffers.has(descriptor.id)) {
      this.buffers.set(descriptor.id, new ProcessOutputRingBuffer(bufferCapacity));
    }
    this.totalSpawned++;
  }

  /**
   * Updates an existing process descriptor.
   */
  public updateProcess(
    id: string,
    updates: Partial<ProcessHandleDescriptor>
  ): ProcessHandleDescriptor | undefined {
    const existing = this.activeProcesses.get(id) || this.historyProcesses.get(id);
    if (!existing) return undefined;

    const updated: ProcessHandleDescriptor = {
      ...existing,
      ...updates,
    };

    if (
      updated.status === "completed" ||
      updated.status === "failed" ||
      updated.status === "killed" ||
      updated.status === "timed_out" ||
      updated.status === "orphaned"
    ) {
      this.activeProcesses.delete(id);
      this.historyProcesses.set(id, updated);

      if (updated.status === "completed") this.totalCompleted++;
      else if (updated.status === "killed") this.totalKilled++;
      else this.totalFailed++;
    } else {
      this.activeProcesses.set(id, updated);
    }

    return updated;
  }

  public getProcess(idOrTaskId: string): ProcessHandleDescriptor | undefined {
    const processId = this.taskIndex.get(idOrTaskId) || idOrTaskId;
    return this.activeProcesses.get(processId) || this.historyProcesses.get(processId);
  }

  public getBuffer(id: string): ProcessOutputRingBuffer | undefined {
    return this.buffers.get(id);
  }

  public recordWatchMatch(id: string, match: ProcessWatchMatch): void {
    const proc = this.getProcess(id);
    if (!proc) return;
    const matches = [...proc.watchMatches, match];
    this.updateProcess(id, {
      watchMatches: matches,
      lastWatchMatchTime: match.timestamp,
    });
  }

  public incrementStrike(id: string): number {
    const proc = this.getProcess(id);
    if (!proc) return 0;
    const strikeCount = proc.strikeCount + 1;
    this.updateProcess(id, { strikeCount });
    return strikeCount;
  }

  public listActive(): ProcessHandleDescriptor[] {
    return Array.from(this.activeProcesses.values());
  }

  public listHistory(): ProcessHandleDescriptor[] {
    return Array.from(this.historyProcesses.values());
  }

  public listAll(): ProcessHandleDescriptor[] {
    return [...this.listActive(), ...this.listHistory()];
  }

  /**
   * Captures an immutable binary snapshot of current substrate state.
   */
  public captureSnapshot(): ProcessSessionSnapshot {
    return {
      activeProcesses: this.listActive(),
      historyProcesses: this.listHistory(),
      totalSpawned: this.totalSpawned,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      totalKilled: this.totalKilled,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores substrate state from a snapshot.
   */
  public restoreSnapshot(snapshot: ProcessSessionSnapshot): void {
    this.activeProcesses.clear();
    this.historyProcesses.clear();
    this.taskIndex.clear();

    for (const proc of snapshot.activeProcesses) {
      this.activeProcesses.set(proc.id, { ...proc });
      if (proc.taskId) {
        this.taskIndex.set(proc.taskId, proc.id);
      }
    }

    for (const proc of snapshot.historyProcesses) {
      this.historyProcesses.set(proc.id, { ...proc });
      if (proc.taskId) {
        this.taskIndex.set(proc.taskId, proc.id);
      }
    }

    this.totalSpawned = snapshot.totalSpawned;
    this.totalCompleted = snapshot.totalCompleted;
    this.totalFailed = snapshot.totalFailed;
    this.totalKilled = snapshot.totalKilled;
  }

  public clear(): void {
    this.activeProcesses.clear();
    this.historyProcesses.clear();
    this.buffers.clear();
    this.taskIndex.clear();
    this.totalSpawned = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.totalKilled = 0;
  }
}
