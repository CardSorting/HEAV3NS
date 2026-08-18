/**
 * subdir-hints-supervisor.ts
 *
 * Master supervisor coordinating progressive subdirectory context discovery,
 * dynamic instruction hints, SHA-256 deduplication, and prefix-cache preservation
 * (Phase 129 / ADR-105 / Target #84).
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import type { BroccoliSubdirHintsSubstrate } from "../../../sessions/extensions/subdir_hints/broccoli-subdir-hints-substrate.js";
import type { DeterministicSubdirHintEngine } from "./deterministic-subdir-hint-engine.js";
import type {
  DiscoveredSubdirHint,
  SubdirectoryHintRow,
  SubdirectoryHintsBulkMutationResult,
  SubdirectoryHintsConfig,
  SubdirectoryHintsDslQueryFilter,
  SubdirectoryHintsGroupBy,
  SubdirectoryHintsGroupedLane,
  SubdirectoryHintsHealthAuditReport,
  SubdirectoryHintsMetrics,
  SubdirectoryHintsMetricsReport,
  SubdirectoryHintsSortBy,
  SubdirectoryHintsSortDirection,
  SubdirHintDiscoveryResult,
} from "../../../core/contracts/subdirectory-hints.contracts.js";

export class SubdirHintsSupervisor {
  private readonly substrate: BroccoliSubdirHintsSubstrate;
  private readonly engine: DeterministicSubdirHintEngine;

  constructor(substrate: BroccoliSubdirHintsSubstrate, engine: DeterministicSubdirHintEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public getSubstrate(): BroccoliSubdirHintsSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicSubdirHintEngine {
    return this.engine;
  }

  public configure(config: Partial<SubdirectoryHintsConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): SubdirectoryHintsConfig {
    return this.substrate.getConfig();
  }

  public registerVirtualHint(directoryPath: string, filename: string, content: string): void {
    this.substrate.registerVirtualHint(path.resolve(directoryPath), filename, content);
  }

  public getDiscoveredHints(): readonly DiscoveredSubdirHint[] {
    return this.substrate.getDiscoveredHints();
  }

  public getMetrics(): SubdirectoryHintsMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): SubdirectoryHintsMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public auditHealth(): SubdirectoryHintsHealthAuditReport {
    return this.substrate.auditHealth();
  }

  /**
   * Inspects tool arguments and loads any progressive subdirectory hints on first access.
   */
  public async checkToolCall(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<SubdirHintDiscoveryResult> {
    const tStart = performance.now();
    const config = this.substrate.getConfig();
    const workingDir = path.resolve(config.workingDir);

    const candidates = this.engine.extractCandidateDirectories(toolName, args, config);
    this.substrate.recordCheck(candidates.length);

    const hintsFound: DiscoveredSubdirHint[] = [];

    for (const dirPath of candidates) {
      if (this.substrate.isDirectoryLoaded(dirPath)) {
        continue;
      }
      this.substrate.markDirectoryLoaded(dirPath);

      // Check virtual hints first
      const virtualList = this.substrate.getVirtualHintsForDirectory(dirPath);
      if (virtualList.length > 0) {
        for (const v of virtualList) {
          const content = v.content.slice(0, config.maxHintChars).trim();
          const digest = this.engine.computeDigest(content);

          if (this.substrate.isDigestLoaded(digest)) {
            this.substrate.recordDuplicateSkipped();
            continue;
          }

          const relativeDirectory = path.relative(workingDir, dirPath);
          const hint: DiscoveredSubdirHint = {
            directoryPath: dirPath,
            relativeDirectory,
            filename: v.filename,
            content,
            contentDigest: digest,
            charCount: content.length,
            discoveredAt: Date.now(),
          };

          this.substrate.addDiscoveredHint(hint);
          hintsFound.push(hint);
        }
        continue;
      }

      // Check filesystem hints
      for (const filename of config.hintFilenames) {
        const filePath = path.join(dirPath, filename);
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const rawContent = fs.readFileSync(filePath, "utf8");
            const content = rawContent.slice(0, config.maxHintChars).trim();
            if (!content) continue;

            const digest = this.engine.computeDigest(content);
            if (this.substrate.isDigestLoaded(digest)) {
              this.substrate.recordDuplicateSkipped();
              continue;
            }

            const relativeDirectory = path.relative(workingDir, dirPath);
            const hint: DiscoveredSubdirHint = {
              directoryPath: dirPath,
              relativeDirectory,
              filename,
              content,
              contentDigest: digest,
              charCount: content.length,
              discoveredAt: Date.now(),
            };

            this.substrate.addDiscoveredHint(hint);
            hintsFound.push(hint);
            break; // First match per directory
          }
        } catch {
          // Ignore filesystem errors
        }
      }
    }

    const formattedAttachment =
      hintsFound.length > 0 ? this.engine.formatHintAttachment(hintsFound) : undefined;

    return {
      hintsFound,
      formattedAttachment,
      inspectedPaths: candidates,
      durationMs: Number((performance.now() - tStart).toFixed(4)),
    };
  }

  public getGroupedHints(
    groupBy?: SubdirectoryHintsGroupBy,
    sortBy?: SubdirectoryHintsSortBy,
    direction?: SubdirectoryHintsSortDirection
  ): readonly SubdirectoryHintsGroupedLane[] {
    return this.substrate.getGroupedHints(groupBy, sortBy, direction);
  }

  public queryDsl(query: SubdirectoryHintsDslQueryFilter | string): readonly SubdirectoryHintRow[] {
    return this.substrate.queryHintsDsl(query);
  }

  public bulkPurge(hintKeys: readonly string[]): SubdirectoryHintsBulkMutationResult {
    return this.substrate.bulkPurgeHints(hintKeys);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }
}
