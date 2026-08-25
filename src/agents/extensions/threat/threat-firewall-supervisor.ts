/**
 * threat-firewall-supervisor.ts
 *
 * Master Threat Firewall Supervisor managing pre-execution command checks,
 * prompt injection defense, and security telemetry (Phase 86 / ADR-038).
 */

import type {
  ThreatFinding,
  ThreatPolicyConfig,
  ThreatScanResult,
  ThreatTrustLevel,
  ThreatWorkspaceSnapshot,
} from "../../../core/contracts/threat.contracts.js";
import { DeterministicThreatScanner } from "../../../tooling/extensions/threat/deterministic-threat-scanner.js";
import { BroccoliThreatSubstrate } from "../../../sessions/extensions/threat/broccoli-threat-substrate.js";

export class ThreatFirewallSupervisor {
  private scanner: DeterministicThreatScanner;
  private substrate: BroccoliThreatSubstrate;

  constructor(scanner: DeterministicThreatScanner, substrate: BroccoliThreatSubstrate) {
    this.scanner = scanner;
    this.substrate = substrate;
  }

  /**
   * Configures threat policy thresholds and bypass modes.
   */
  public setPolicy(policy: Partial<ThreatPolicyConfig>): void {
    this.scanner.setPolicy(policy);
  }

  /**
   * Returns current active threat policy.
   */
  public getPolicy(): ThreatPolicyConfig {
    return this.scanner.getPolicy();
  }

  /**
   * Enables autonomous bypass mode (zero blocking deadlocks, full forensic telemetry).
   */
  public enableAutonomousBypass(): void {
    this.scanner.setPolicy({ mode: "autonomous", nonBlockingTelemetry: true });
  }

  /**
   * Enables non-blocking audit-only mode.
   */
  public enableAuditOnlyMode(): void {
    this.scanner.setPolicy({ mode: "audit_only", nonBlockingTelemetry: true });
  }

  /**
   * Enables strict enforcement mode.
   */
  public enableEnforceMode(): void {
    this.scanner.setPolicy({ mode: "enforce", nonBlockingTelemetry: false });
  }

  /**
   * Scans an arbitrary text payload (code, prompt, tool output) and records the audit verdict.
   */
  scan(
    payload: string,
    trustLevel: ThreatTrustLevel = "community",
    location?: string,
    policyOverride?: ThreatPolicyConfig
  ): ThreatScanResult {
    const result = this.scanner.scanPayload(payload, trustLevel, location, policyOverride);
    this.substrate.recordScan(result);
    return result;
  }

  /**
   * Performs a rapid pre-flight safety check on a shell command string.
   */
  isCommandSafe(
    command: string,
    trustLevel: ThreatTrustLevel = "community",
    policyOverride?: ThreatPolicyConfig
  ): boolean {
    const result = this.scan(command, trustLevel, "pre-exec-command", policyOverride);
    return result.verdict !== "block";
  }

  /**
   * Returns workspace stats.
   */
  getStats(): ThreatWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists historical threat findings.
   */
  listFindings(limit: number = 50): readonly ThreatFinding[] {
    return this.substrate.listFindings(limit);
  }

  /**
   * Lists historical scan results.
   */
  listScans(limit: number = 20): readonly ThreatScanResult[] {
    return this.substrate.listScans(limit);
  }
}

