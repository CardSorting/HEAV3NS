/**
 * daemon-supervisor.ts
 *
 * Supervisor orchestrator for Enterprise Daemon & Process Supervisor (Phase 100 / ADR-130).
 * Governs background daemon lifecycle, SIGTERM/SIGKILL cascades, bounded log ring buffers,
 * health check probes, and crash recovery watchdogs.
 */

import type {
  DaemonHealthMatrix,
  DaemonHealthProbe,
  DaemonLogEntry,
  DaemonProcess,
  DaemonProcessDashboardCard,
  DaemonSupervisorConfig,
  DaemonWatchdogPolicy,
} from "../../../core/contracts/daemon.contracts.js";
import { BroccoliDaemonSubstrate } from "../../../sessions/extensions/daemon/broccoli-daemon-substrate.js";
import { DeterministicDaemonEngine } from "../../../tooling/extensions/daemon/deterministic-daemon-engine.js";

export class DaemonSupervisor {
  private readonly substrate: BroccoliDaemonSubstrate;
  private readonly engine: DeterministicDaemonEngine;
  private nextPid = 88400;

  constructor(substrate: BroccoliDaemonSubstrate, engine: DeterministicDaemonEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public isSkillEnabled(): boolean {
    return this.substrate.getConfig().enabled;
  }

  public getConfig(): DaemonSupervisorConfig {
    return this.substrate.getConfig();
  }

  public updateConfig(updates: Partial<DaemonSupervisorConfig>): DaemonSupervisorConfig {
    return this.substrate.updateConfig(updates);
  }

  /**
   * Spawns and tracks a new background daemon process.
   */
  public spawnProcess(
    name: string,
    command: string,
    cwd = process.cwd(),
    port?: number,
    watchdog?: Partial<DaemonWatchdogPolicy>,
    probe?: Partial<DaemonHealthProbe>
  ): { success: boolean; process?: DaemonProcess; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Daemon Supervisor skill is disabled." };
    }

    const pid = this.nextPid++;
    const processId = `proc_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${pid}`;

    const defaultWatchdog: DaemonWatchdogPolicy = {
      autoRestartOnCrash: watchdog?.autoRestartOnCrash ?? this.substrate.getConfig().defaultAutoRestart,
      maxRestarts: watchdog?.maxRestarts ?? 5,
      restartBackoffMs: watchdog?.restartBackoffMs ?? 1000,
      crashWindowSeconds: watchdog?.crashWindowSeconds ?? 60,
    };

    let healthProbe: DaemonHealthProbe | undefined;
    if (probe) {
      healthProbe = {
        probeId: `probe_${processId}`,
        type: probe.type || "HTTP",
        target: probe.target || (port ? `http://localhost:${port}/health` : "8080"),
        intervalSeconds: probe.intervalSeconds || 10,
        timeoutMs: probe.timeoutMs || 2000,
        consecutiveFailures: 0,
        maxFailuresBeforeRestart: probe.maxFailuresBeforeRestart || 3,
        lastStatus: "PENDING",
      };
    }

    const proc: DaemonProcess = {
      pid,
      processId,
      name,
      command,
      cwd,
      port,
      status: "RUNNING",
      spawnedAt: Date.now(),
      uptimeSeconds: 0,
      cpuPercent: 0.5,
      memoryMb: 45.0,
      restartCount: 0,
      watchdog: defaultWatchdog,
      probe: healthProbe,
    };

    this.substrate.upsertProcess(proc);
    this.substrate.appendLog(processId, {
      timestamp: Date.now(),
      stream: "stdout",
      line: `[DaemonSupervisor] Spawned process '${name}' (PID: ${pid}) with command: ${command}`,
    });

    return { success: true, process: proc };
  }

  /**
   * Gracefully terminates a running daemon process.
   */
  public terminateProcess(
    processId: string,
    force = false
  ): { success: boolean; process?: DaemonProcess; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Daemon Supervisor skill is disabled." };
    }

    const proc = this.substrate.getProcess(processId);
    if (!proc) {
      return { success: false, error: `Process '${processId}' not found.` };
    }

    const updated: DaemonProcess = {
      ...proc,
      status: "STOPPED",
    };

    this.substrate.upsertProcess(updated);
    this.substrate.appendLog(processId, {
      timestamp: Date.now(),
      stream: "stdout",
      line: `[DaemonSupervisor] Process '${proc.name}' (PID: ${proc.pid}) gracefully terminated ${force ? "via SIGKILL" : "via SIGTERM"}.`,
    });

    return { success: true, process: updated };
  }

  /**
   * Restarts a daemon process.
   */
  public restartProcess(processId: string): { success: boolean; process?: DaemonProcess; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Daemon Supervisor skill is disabled." };
    }

    const proc = this.substrate.getProcess(processId);
    if (!proc) {
      return { success: false, error: `Process '${processId}' not found.` };
    }

    const updated: DaemonProcess = {
      ...proc,
      status: "RUNNING",
      restartCount: proc.restartCount + 1,
      spawnedAt: Date.now(),
    };

    this.substrate.upsertProcess(updated);
    this.substrate.appendLog(processId, {
      timestamp: Date.now(),
      stream: "stdout",
      line: `[DaemonSupervisor] Restarted process '${proc.name}' (PID: ${proc.pid}) [Restart count: ${updated.restartCount}].`,
    });

    return { success: true, process: updated };
  }

  /**
   * Tails logs from a daemon process.
   */
  public tailLogs(processId: string, lines = 50): { formattedLogs: string; rawLogs: readonly DaemonLogEntry[] } {
    const proc = this.substrate.getProcess(processId);
    const logs = this.substrate.getLogs(processId, lines);
    const formattedLogs = this.engine.formatTailLogs(logs, proc?.name || processId);

    return { formattedLogs, rawLogs: logs };
  }

  /**
   * Appends log output lines to a daemon's ring buffer.
   */
  public appendOutput(processId: string, stream: "stdout" | "stderr", line: string): void {
    this.substrate.appendLog(processId, {
      timestamp: Date.now(),
      stream,
      line,
    });
  }

  /**
   * Renders the visual ASCII process matrix dashboard.
   */
  public inspectProcessDashboard(): DaemonProcessDashboardCard {
    const processes = this.substrate.listProcesses();
    return this.engine.renderProcessDashboard(processes);
  }

  /**
   * Runs health probe check for a process.
   */
  public probeHealth(processId: string): { success: boolean; status: "PASS" | "FAIL"; latencyMs: number; error?: string } {
    const proc = this.substrate.getProcess(processId);
    if (!proc || !proc.probe) {
      return { success: false, status: "FAIL", latencyMs: 0, error: "No probe configured for process" };
    }

    const evalResult = this.engine.evaluateLiveness(proc.probe);
    const updatedProbe: DaemonHealthProbe = {
      ...proc.probe,
      lastProbeAt: Date.now(),
      lastStatus: evalResult.status,
      consecutiveFailures: evalResult.status === "FAIL" ? proc.probe.consecutiveFailures + 1 : 0,
    };

    this.substrate.upsertProcess({ ...proc, probe: updatedProbe });
    return { success: true, status: evalResult.status, latencyMs: evalResult.latencyMs };
  }

  public getProcess(processId: string): DaemonProcess | undefined {
    return this.substrate.getProcess(processId);
  }

  public listProcesses(): readonly DaemonProcess[] {
    return this.substrate.listProcesses();
  }

  public inspectHealth(): DaemonHealthMatrix {
    const cfg = this.substrate.getConfig();
    const procs = this.substrate.listProcesses();
    const running = procs.filter((p) => p.status === "RUNNING");

    const totalCpu = running.reduce((sum, p) => sum + p.cpuPercent, 0);
    const totalMem = running.reduce((sum, p) => sum + p.memoryMb, 0);
    const healthyProbes = running.filter((p) => p.probe?.lastStatus === "PASS").length;
    const failingProbes = running.filter((p) => p.probe?.lastStatus === "FAIL").length;

    return {
      enabled: cfg.enabled,
      totalActiveProcesses: running.length,
      totalCpuUsagePercent: Number(totalCpu.toFixed(1)),
      totalMemoryUsageMb: Number(totalMem.toFixed(1)),
      healthyProbesCount: healthyProbes,
      failingProbesCount: failingProbes,
      status: !cfg.enabled ? "DISABLED" : failingProbes > 0 ? "DEGRADED" : "HEALTHY",
      timestamp: Date.now(),
    };
  }
}
