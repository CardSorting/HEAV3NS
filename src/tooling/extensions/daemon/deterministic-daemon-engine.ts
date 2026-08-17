/**
 * deterministic-daemon-engine.ts
 *
 * Deterministic process calculation engine for Daemon Supervisor (Phase 100 / ADR-130).
 * Compiles ASCII process matrix dashboards, formats colorized terminal log tails,
 * and performs liveness probe evaluation.
 */

import type {
  DaemonHealthProbe,
  DaemonLogEntry,
  DaemonProcess,
  DaemonProcessDashboardCard,
} from "../../../core/contracts/daemon.contracts.js";

export class DeterministicDaemonEngine {
  /**
   * Strips ANSI terminal escape color codes for clean visual display.
   */
  public stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  }

  /**
   * Compiles an approachable visual ASCII process matrix dashboard mirroring Docker Desktop / PM2.
   */
  public renderProcessDashboard(processes: readonly DaemonProcess[]): DaemonProcessDashboardCard {
    if (!processes || processes.length === 0) {
      const asciiTable = "```text\n+--------------------------------------------------------------------------------+\n| PID   | Name           | Port  | Status  | Uptime  | CPU% | RAM (MB) | Probes  |\n+-------+----------------+-------+---------+---------+------+----------+---------+\n| (No active background daemon processes registered)                             |\n+--------------------------------------------------------------------------------+\n```";
      return {
        asciiTable,
        totalProcesses: 0,
        runningCount: 0,
        crashedCount: 0,
        overallStatus: "ALL_HEALTHY",
        timestamp: Date.now(),
      };
    }

    const running = processes.filter((p) => p.status === "RUNNING");
    const crashed = processes.filter((p) => p.status === "CRASHED");

    let table = "```text\n" +
      "+-------+----------------+-------+---------+---------+------+----------+---------+\n" +
      "| PID   | Name           | Port  | Status  | Uptime  | CPU% | RAM (MB) | Probes  |\n" +
      "+-------+----------------+-------+---------+---------+------+----------+---------+\n";

    for (const p of processes) {
      const pidStr = String(p.pid).padEnd(5, " ");
      const nameStr = (p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name).padEnd(14, " ");
      const portStr = (p.port ? `:${p.port}` : "-").padEnd(5, " ");
      const statusIcon = p.status === "RUNNING" ? "RUNNING" : p.status === "CRASHED" ? "CRASHED" : p.status;
      const statusStr = statusIcon.padEnd(7, " ");

      const mins = Math.floor(p.uptimeSeconds / 60);
      const secs = p.uptimeSeconds % 60;
      const uptimeStr = `${mins}m ${secs}s`.padEnd(7, " ");

      const cpuStr = `${p.cpuPercent.toFixed(1)}%`.padEnd(4, " ");
      const ramStr = `${p.memoryMb.toFixed(1)}MB`.padEnd(8, " ");
      const probeStr = p.probe ? (p.probe.lastStatus === "PASS" ? "🟢 OK" : "🔴 FAIL") : "⚪ N/A";

      table += `| ${pidStr} | ${nameStr} | ${portStr} | ${statusStr} | ${uptimeStr} | ${cpuStr} | ${ramStr} | ${probeStr.padEnd(7, " ")} |\n`;
    }

    table += "+-------+----------------+-------+---------+---------+------+----------+---------+\n```";

    const overallStatus = crashed.length > 0 ? "DEGRADED" : "ALL_HEALTHY";

    return {
      asciiTable: table,
      totalProcesses: processes.length,
      runningCount: running.length,
      crashedCount: crashed.length,
      overallStatus,
      timestamp: Date.now(),
    };
  }

  /**
   * Formats log buffer entries into a clean monospace terminal card.
   */
  public formatTailLogs(logs: readonly DaemonLogEntry[], processName = "process"): string {
    if (!logs || logs.length === 0) {
      return `*(No logs recorded for \`${processName}\`)*`;
    }

    let output = `📜 *Terminal Output: \`${processName}\`* (Latest ${logs.length} lines)\n\n` +
      "```terminal\n";

    for (const log of logs) {
      const date = new Date(log.timestamp).toISOString().slice(11, 19);
      const streamTag = log.stream === "stderr" ? "[ERR]" : "[OUT]";
      const cleanLine = this.stripAnsiCodes(log.line);
      output += `${date} ${streamTag} ${cleanLine}\n`;
    }

    output += "```";
    return output;
  }

  /**
   * Deterministic simulation/evaluation of HTTP/TCP health probe.
   */
  public evaluateLiveness(probe: DaemonHealthProbe): { isAlive: boolean; latencyMs: number; status: "PASS" | "FAIL" } {
    const isAlive = probe.consecutiveFailures < probe.maxFailuresBeforeRestart;
    const latencyMs = isAlive ? 1.4 : 5000;
    return {
      isAlive,
      latencyMs,
      status: isAlive ? "PASS" : "FAIL",
    };
  }
}
