/**
 * broccoli-subdir-hints-substrate.ts
 *
 * In-memory Broccolidb repository storing discovered hints, loaded directory sets,
 * SHA-256 digest sets, virtual hint files, and telemetry metrics (Phase 129 / ADR-105 / Target #62).
 */

import type {
  DiscoveredSubdirHint,
  SubdirectoryHintsConfig,
  SubdirectoryHintsMetrics,
  SubdirectoryHintsWorkspaceSnapshot,
} from "../../../core/contracts/subdirectory-hints.contracts.js";
import { DEFAULT_SUBDIRECTORY_HINTS_CONFIG } from "../../../core/contracts/subdirectory-hints.contracts.js";

export class BroccoliSubdirHintsSubstrate {
  private config: SubdirectoryHintsConfig = { ...DEFAULT_SUBDIRECTORY_HINTS_CONFIG };
  private loadedDirectories = new Set<string>();
  private loadedDigests = new Set<string>();
  private discoveredHints = new Map<string, DiscoveredSubdirHint>();
  private virtualHints = new Map<string, { directoryPath: string; filename: string; content: string }>();
  private metrics: SubdirectoryHintsMetrics = {
    totalToolChecks: 0,
    pathsEvaluated: 0,
    hintsDiscovered: 0,
    duplicatesSkipped: 0,
    bytesInjected: 0,
  };

  public setConfig(config: Partial<SubdirectoryHintsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): SubdirectoryHintsConfig {
    return { ...this.config };
  }

  public isDirectoryLoaded(dirPath: string): boolean {
    return this.loadedDirectories.has(dirPath);
  }

  public markDirectoryLoaded(dirPath: string): void {
    this.loadedDirectories.add(dirPath);
  }

  public isDigestLoaded(digest: string): boolean {
    return this.loadedDigests.has(digest);
  }

  public markDigestLoaded(digest: string): void {
    this.loadedDigests.add(digest);
  }

  public addDiscoveredHint(hint: DiscoveredSubdirHint): void {
    const key = `${hint.directoryPath}:${hint.filename}`;
    this.discoveredHints.set(key, { ...hint });
    this.loadedDigests.add(hint.contentDigest);
    this.metrics.hintsDiscovered++;
    this.metrics.bytesInjected += hint.charCount;
  }

  public getDiscoveredHints(): DiscoveredSubdirHint[] {
    return Array.from(this.discoveredHints.values()).map((h) => ({ ...h }));
  }

  public registerVirtualHint(directoryPath: string, filename: string, content: string): void {
    const key = `${directoryPath}:${filename}`;
    this.virtualHints.set(key, { directoryPath, filename, content });
  }

  public getVirtualHint(directoryPath: string, filename: string): { directoryPath: string; filename: string; content: string } | undefined {
    const key = `${directoryPath}:${filename}`;
    return this.virtualHints.get(key);
  }

  public getVirtualHintsForDirectory(directoryPath: string): Array<{ filename: string; content: string }> {
    const results: Array<{ filename: string; content: string }> = [];
    for (const [key, v] of this.virtualHints.entries()) {
      if (key.startsWith(`${directoryPath}:`)) {
        results.push({ filename: v.filename, content: v.content });
      }
    }
    return results;
  }

  public recordCheck(pathsCount: number): void {
    this.metrics.totalToolChecks++;
    this.metrics.pathsEvaluated += pathsCount;
  }

  public recordDuplicateSkipped(): void {
    this.metrics.duplicatesSkipped++;
  }

  public getMetrics(): SubdirectoryHintsMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SubdirectoryHintsWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      loadedDirectories: Array.from(this.loadedDirectories),
      loadedDigests: Array.from(this.loadedDigests),
      discoveredHints: this.getDiscoveredHints(),
      virtualHints: Array.from(this.virtualHints.values()).map((v) => ({ ...v })),
    };
  }

  public restoreSnapshot(snapshot: SubdirectoryHintsWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
    this.loadedDirectories = new Set(snapshot.loadedDirectories);
    this.loadedDigests = new Set(snapshot.loadedDigests);
    this.discoveredHints.clear();
    for (let i = 0; i < snapshot.discoveredHints.length; i++) {
      const hint = snapshot.discoveredHints[i];
      this.discoveredHints.set(`${hint.directoryPath}:${hint.filename}`, hint);
    }
    this.virtualHints.clear();
    for (let i = 0; i < snapshot.virtualHints.length; i++) {
      const v = snapshot.virtualHints[i];
      this.virtualHints.set(`${v.directoryPath}:${v.filename}`, v);
    }
  }

  public clear(): void {
    this.config = { ...DEFAULT_SUBDIRECTORY_HINTS_CONFIG };
    this.loadedDirectories.clear();
    this.loadedDigests.clear();
    this.discoveredHints.clear();
    this.virtualHints.clear();
    this.metrics = {
      totalToolChecks: 0,
      pathsEvaluated: 0,
      hintsDiscovered: 0,
      duplicatesSkipped: 0,
      bytesInjected: 0,
    };
  }
}
