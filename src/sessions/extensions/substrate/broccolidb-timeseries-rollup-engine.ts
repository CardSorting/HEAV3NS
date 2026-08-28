/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-timeseries-rollup-engine.ts
 *
 * Continuous Time-Series Metric Rollup & Percentile Engine for BroccoliDB (Pass 201 / ADR-139).
 * Computes windowed bucketing (1m, 5m, 1h, 1d) with statistical percentiles (P50, P90, P99), sum, min, max, avg.
 */

import type {
  IBroccoliTimeSeriesRollupEngine,
  TimeSeriesPoint,
  TimeSeriesWindowAggregation,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliTimeSeriesRollupEngine implements IBroccoliTimeSeriesRollupEngine {
  private readonly metricStore = new Map<string, TimeSeriesPoint[]>();
  private readonly maxPointsPerMetric: number;

  constructor(maxPointsPerMetric = 10000) {
    this.maxPointsPerMetric = maxPointsPerMetric;
  }

  public recordPoint(
    metricName: string,
    value: number,
    timestamp = Date.now(),
    tags?: Record<string, string>
  ): void {
    let points = this.metricStore.get(metricName);
    if (!points) {
      points = [];
      this.metricStore.set(metricName, points);
    }

    points.push({ timestamp, value, tags });

    if (points.length > this.maxPointsPerMetric) {
      points.splice(0, points.length - this.maxPointsPerMetric);
    }
  }

  public queryRollup(
    metricName: string,
    windowSizeMs: number,
    startTime: number,
    endTime: number
  ): readonly TimeSeriesWindowAggregation[] {
    const points = this.metricStore.get(metricName);
    if (!points || points.length === 0) return [];

    const filtered = points.filter((p) => p.timestamp >= startTime && p.timestamp <= endTime);
    if (filtered.length === 0) return [];

    const windows = new Map<number, number[]>();

    for (const pt of filtered) {
      const windowStart = Math.floor(pt.timestamp / windowSizeMs) * windowSizeMs;
      let bucket = windows.get(windowStart);
      if (!bucket) {
        bucket = [];
        windows.set(windowStart, bucket);
      }
      bucket.push(pt.value);
    }

    const aggregations: TimeSeriesWindowAggregation[] = [];
    const sortedWindowStarts = Array.from(windows.keys()).sort((a, b) => a - b);

    for (const wStart of sortedWindowStarts) {
      const values = windows.get(wStart)!;
      values.sort((a, b) => a - b);

      let sum = 0;
      let min = Infinity;
      let max = -Infinity;

      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
      }

      const count = values.length;
      const avg = count > 0 ? sum / count : 0;
      const p50 = this.getPercentile(values, 0.50);
      const p90 = this.getPercentile(values, 0.90);
      const p99 = this.getPercentile(values, 0.99);

      aggregations.push({
        windowStart: wStart,
        windowEnd: wStart + windowSizeMs,
        count,
        sum,
        min: count > 0 ? min : 0,
        max: count > 0 ? max : 0,
        avg,
        p50,
        p90,
        p99,
      });
    }

    return aggregations;
  }

  public getMetricNames(): readonly string[] {
    return Array.from(this.metricStore.keys());
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.min(
      sortedValues.length - 1,
      Math.max(0, Math.floor((sortedValues.length - 1) * percentile))
    );
    return sortedValues[index];
  }
}
