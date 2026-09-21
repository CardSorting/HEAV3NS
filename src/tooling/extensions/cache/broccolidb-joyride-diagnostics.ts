/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 170: Zero-Dependency Broccoli JoyRide Diagnostics
 *
 * Lifted from external source workspace/codemarie-new/src/core/joyride/JoyRideDiagnostics.ts.
 * Provides structured diagnostic telemetry reporting for JoyRide hot-path caches, tracking hit/miss ratios,
 * degraded mode triggers, pressure trim events, and performance indicators. Zero external npm dependencies.
 */

export interface JoyRideDiagnosticMetrics {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRatioPercent: number;
  pressureTrimEvents: number;
  degraded: boolean;
  degradedReason?: string;
}

export class BroccoliJoyRideDiagnostics {
  private totalRequests = 0;
  private hits = 0;
  private misses = 0;
  private pressureTrimEvents = 0;
  private degraded = false;
  private degradedReason?: string;

  public recordHit(): void {
    this.totalRequests++;
    this.hits++;
  }

  public recordMiss(): void {
    this.totalRequests++;
    this.misses++;
  }

  public recordPressureTrim(): void {
    this.pressureTrimEvents++;
  }

  public setDegraded(isDegraded: boolean, reason?: string): void {
    this.degraded = isDegraded;
    this.degradedReason = reason;
  }

  public buildDiagnosticReport(): JoyRideDiagnosticMetrics {
    const hitRatioPercent = this.totalRequests > 0 ? Number(((this.hits / this.totalRequests) * 100).toFixed(2)) : 0;

    return {
      totalRequests: this.totalRequests,
      hits: this.hits,
      misses: this.misses,
      hitRatioPercent,
      pressureTrimEvents: this.pressureTrimEvents,
      degraded: this.degraded,
      degradedReason: this.degradedReason,
    };
  }
}
