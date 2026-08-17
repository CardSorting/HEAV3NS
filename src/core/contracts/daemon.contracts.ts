/**
 * daemon.contracts.ts
 *
 * Core contracts for the Enterprise Background Process Daemon & Terminal Supervisor (Phase 100 / ADR-130).
 * Defines process lifecycles, bounded log ring buffers, visual process matrix dashboards,
 * health check probes, and auto-restart watchdogs under the AKD-DSO Monolith architecture.
 */

export type DaemonStatus =
  | "SPAWNING"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "CRASHED"
  | "RESTARTING";

export interface DaemonLogEntry {
  readonly timestamp: number;
  readonly stream: "stdout" | "stderr";
  readonly line: string;
}

export interface DaemonHealthProbe {
  readonly probeId: string;
  readonly type: "HTTP" | "TCP";
  readonly target: string; // URL e.g. http://localhost:3000/health or port e.g. 6379
  readonly intervalSeconds: number;
  readonly timeoutMs: number;
  readonly consecutiveFailures: number;
  readonly maxFailuresBeforeRestart: number;
  readonly lastProbeAt?: number;
  readonly lastStatus: "PASS" | "FAIL" | "PENDING";
}

export interface DaemonWatchdogPolicy {
  readonly autoRestartOnCrash: boolean;
  readonly maxRestarts: number;
  readonly restartBackoffMs: number;
  readonly crashWindowSeconds: number;
}

export interface DaemonProcess {
  readonly pid: number;
  readonly processId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly port?: number;
  readonly status: DaemonStatus;
  readonly spawnedAt: number;
  readonly uptimeSeconds: number;
  readonly cpuPercent: number;
  readonly memoryMb: number;
  readonly restartCount: number;
  readonly watchdog: DaemonWatchdogPolicy;
  readonly probe?: DaemonHealthProbe;
}

export interface DaemonProcessDashboardCard {
  readonly asciiTable: string;
  readonly totalProcesses: number;
  readonly runningCount: number;
  readonly crashedCount: number;
  readonly overallStatus: "ALL_HEALTHY" | "DEGRADED" | "CRITICAL";
  readonly timestamp: number;
}

export interface DaemonSupervisorConfig {
  readonly enabled: boolean;
  readonly maxDaemons: number;
  readonly maxLogBufferSize: number; // 500 lines per daemon
  readonly sigtermTimeoutMs: number; // 5000ms before SIGKILL
  readonly defaultAutoRestart: boolean;
}

export interface DaemonHealthMatrix {
  readonly enabled: boolean;
  readonly totalActiveProcesses: number;
  readonly totalCpuUsagePercent: number;
  readonly totalMemoryUsageMb: number;
  readonly healthyProbesCount: number;
  readonly failingProbesCount: number;
  readonly status: "HEALTHY" | "DEGRADED" | "DISABLED";
  readonly timestamp: number;
}

export interface DaemonSubstrateSnapshot {
  readonly processes: readonly DaemonProcess[];
  readonly logs: readonly { readonly processId: string; readonly logs: readonly DaemonLogEntry[] }[];
  readonly config: DaemonSupervisorConfig;
  readonly totalProcessesSpawned: number;
}
