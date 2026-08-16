/**
 * broccoli-threat-substrate.ts
 *
 * In-memory Broccolidb substrate for threat findings, security scan results, and quarantine ledgers (Phase 86 / ADR-038).
 */

import type {
  ThreatFinding,
  ThreatScanResult,
  ThreatWorkspaceSnapshot,
} from "../../../core/contracts/threat.contracts.js";

export class BroccoliThreatSubstrate {
  private scans: ThreatScanResult[];
  private allFindings: ThreatFinding[];
  private totalScannedBytes: number;
  private totalScans: number;
  private threatCount: number;
  private blockedCount: number;

  constructor() {
    this.scans = [];
    this.allFindings = [];
    this.totalScannedBytes = 0;
    this.totalScans = 0;
    this.threatCount = 0;
    this.blockedCount = 0;
  }

  /**
   * Records a completed scan result in the ledger.
   */
  recordScan(result: ThreatScanResult): void {
    this.scans.push(result);
    this.totalScans++;
    this.totalScannedBytes += result.bytesScanned;

    if (!result.clean) {
      this.threatCount += result.findings.length;
      for (let i = 0; i < result.findings.length; i++) {
        this.allFindings.push(result.findings[i]);
      }
    }

    if (result.verdict === "block") {
      this.blockedCount++;
    }

    // Keep ring buffer of latest 500 scans
    if (this.scans.length > 500) {
      this.scans.shift();
    }
  }

  /**
   * Lists recent threat findings.
   */
  listFindings(limit: number = 50): readonly ThreatFinding[] {
    return this.allFindings.slice(-limit);
  }

  /**
   * Returns recent scan results.
   */
  listScans(limit: number = 20): readonly ThreatScanResult[] {
    return this.scans.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): ThreatWorkspaceSnapshot {
    return {
      totalScannedBytes: this.totalScannedBytes,
      totalScans: this.totalScans,
      threatCount: this.threatCount,
      blockedCount: this.blockedCount,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: ThreatWorkspaceSnapshot): void {
    this.totalScannedBytes = snapshot.totalScannedBytes;
    this.totalScans = snapshot.totalScans;
    this.threatCount = snapshot.threatCount;
    this.blockedCount = snapshot.blockedCount;
  }

  /**
   * Clears all stored scan ledgers.
   */
  clear(): void {
    this.scans = [];
    this.allFindings = [];
    this.totalScannedBytes = 0;
    this.totalScans = 0;
    this.threatCount = 0;
    this.blockedCount = 0;
  }
}
