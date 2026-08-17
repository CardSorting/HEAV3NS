/**
 * broccoli-daemon-substrate.ts
 *
 * In-memory Zero-GC Broccolidb substrate for Enterprise Daemon & Process Supervisor (Phase 100 / ADR-130).
 * Manages background process states, bounded 500-line log ring buffers per daemon,
 * and O(1) state snapshotting under the AKD-DSO Monolith architecture.
 */

import type {
  DaemonLogEntry,
  DaemonProcess,
  DaemonSubstrateSnapshot,
  DaemonSupervisorConfig,
} from "../../../core/contracts/daemon.contracts.js";

const DEFAULT_DAEMON_CONFIG: DaemonSupervisorConfig = {
  enabled: false, // Fail-closed default
  maxDaemons: 20,
  maxLogBufferSize: 500,
  sigtermTimeoutMs: 5000,
  defaultAutoRestart: true,
};

export class BroccoliDaemonSubstrate {
  private config: DaemonSupervisorConfig = { ...DEFAULT_DAEMON_CONFIG };
  private readonly processes = new Map<string, DaemonProcess>();
  private readonly logBuffers = new Map<string, DaemonLogEntry[]>();
  private totalProcessesSpawned = 0;

  public getConfig(): DaemonSupervisorConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<DaemonSupervisorConfig>): DaemonSupervisorConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  public upsertProcess(proc: DaemonProcess): DaemonProcess {
    if (!this.processes.has(proc.processId)) {
      this.totalProcessesSpawned++;
    }
    this.processes.set(proc.processId, proc);
    return proc;
  }

  public getProcess(processId: string): DaemonProcess | undefined {
    return this.processes.get(processId);
  }

  public removeProcess(processId: string): boolean {
    this.logBuffers.delete(processId);
    return this.processes.delete(processId);
  }

  public listProcesses(): readonly DaemonProcess[] {
    return Array.from(this.processes.values());
  }

  public appendLog(processId: string, entry: DaemonLogEntry): void {
    let buf = this.logBuffers.get(processId);
    if (!buf) {
      buf = [];
      this.logBuffers.set(processId, buf);
    }

    if (buf.length >= this.config.maxLogBufferSize) {
      buf.shift();
    }
    buf.push(entry);
  }

  public getLogs(processId: string, limit = 100): readonly DaemonLogEntry[] {
    const buf = this.logBuffers.get(processId) || [];
    if (limit >= buf.length) return [...buf];
    return buf.slice(buf.length - limit);
  }

  public clearLogs(processId: string): void {
    const buf = this.logBuffers.get(processId);
    if (buf) buf.length = 0;
  }

  public exportSnapshot(): DaemonSubstrateSnapshot {
    const logsExport = Array.from(this.logBuffers.entries()).map(([processId, logs]) => ({
      processId,
      logs: [...logs],
    }));

    return {
      processes: Array.from(this.processes.values()),
      logs: logsExport,
      config: this.getConfig(),
      totalProcessesSpawned: this.totalProcessesSpawned,
    };
  }

  public importSnapshot(snapshot: DaemonSubstrateSnapshot): void {
    this.processes.clear();
    for (const p of snapshot.processes) {
      this.processes.set(p.processId, p);
    }
    this.logBuffers.clear();
    for (const item of snapshot.logs) {
      this.logBuffers.set(item.processId, [...item.logs]);
    }
    this.config = { ...snapshot.config };
    this.totalProcessesSpawned = snapshot.totalProcessesSpawned;
  }
}
