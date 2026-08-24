/**
 * tool-telemetry-ledger.ts
 *
 * Tool Execution Telemetry & Performance Metrics Aggregator.
 * Collects duration samples, calculates latency percentiles (p50, p95),
 * tracks error rates, and generates structured execution summaries for inspection.
 */

export interface ToolMetricSummary {
  readonly toolName: string;
  readonly totalInvocations: number;
  readonly successfulInvocations: number;
  readonly failedInvocations: number;
  readonly successRatePercent: number;
  readonly avgDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly totalBytesProcessed: number;
}

export class ToolTelemetryLedger {
  private toolMetrics = new Map<
    string,
    {
      invocations: number;
      successes: number;
      failures: number;
      durations: number[];
      bytesProcessed: number;
    }
  >();

  /**
   * Records a completed tool execution sample.
   */
  public recordSample(
    toolName: string,
    durationMs: number,
    success: boolean,
    bytesProcessed = 0
  ): void {
    let entry = this.toolMetrics.get(toolName);
    if (!entry) {
      entry = {
        invocations: 0,
        successes: 0,
        failures: 0,
        durations: [],
        bytesProcessed: 0,
      };
      this.toolMetrics.set(toolName, entry);
    }

    entry.invocations++;
    if (success) {
      entry.successes++;
    } else {
      entry.failures++;
    }
    entry.durations.push(durationMs);
    entry.bytesProcessed += bytesProcessed;

    // Cap duration samples to 1000 per tool to prevent memory growth
    if (entry.durations.length > 1000) {
      entry.durations.shift();
    }
  }

  /**
   * Calculates percentile for sorted samples.
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Returns a snapshot of metrics for a specific tool.
   */
  public getToolMetric(toolName: string): ToolMetricSummary | undefined {
    const entry = this.toolMetrics.get(toolName);
    if (!entry) return undefined;

    const sortedDurations = [...entry.durations].sort((a, b) => a - b);
    const sum = sortedDurations.reduce((acc, v) => acc + v, 0);
    const avg = entry.invocations > 0 ? sum / entry.invocations : 0;
    const successRate = entry.invocations > 0 ? (entry.successes / entry.invocations) * 100 : 100;

    return {
      toolName,
      totalInvocations: entry.invocations,
      successfulInvocations: entry.successes,
      failedInvocations: entry.failures,
      successRatePercent: Number(successRate.toFixed(1)),
      avgDurationMs: Number(avg.toFixed(2)),
      p50DurationMs: this.calculatePercentile(sortedDurations, 50),
      p95DurationMs: this.calculatePercentile(sortedDurations, 95),
      totalBytesProcessed: entry.bytesProcessed,
    };
  }

  /**
   * Returns metric summaries across all recorded tools.
   */
  public getAllMetrics(): ToolMetricSummary[] {
    const summaries: ToolMetricSummary[] = [];
    for (const toolName of this.toolMetrics.keys()) {
      const summary = this.getToolMetric(toolName);
      if (summary) summaries.push(summary);
    }
    return summaries.sort((a, b) => b.totalInvocations - a.totalInvocations);
  }

  /**
   * Resets all metric samples.
   */
  public reset(): void {
    this.toolMetrics.clear();
  }
}
