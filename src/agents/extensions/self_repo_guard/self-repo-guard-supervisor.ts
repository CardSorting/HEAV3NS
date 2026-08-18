/**
 * self-repo-guard-supervisor.ts
 *
 * Master supervisor managing command inspection before shell execution,
 * running source root auto-discovery, health matrix audits, and metrics aggregation (Phase 138 / ADR-114 / Target #78).
 */

import * as fs from "node:fs";
import * as path from "node:path";

import type { BroccoliSelfRepoGuardSubstrate } from "../../../sessions/extensions/self_repo_guard/broccoli-self-repo-guard-substrate.js";
import type { DeterministicSelfRepoGuardEngine } from "./deterministic-self-repo-guard-engine.js";
import type {
  GitOperationSafety,
  SelfRepoGuardConfig,
  SelfRepoGuardDslQueryFilter,
  SelfRepoGuardGroupBy,
  SelfRepoGuardHealthAuditReport,
  SelfRepoGuardIncident,
  SelfRepoGuardIncidentRow,
  SelfRepoGuardMetrics,
  SelfRepoGuardMetricsReport,
  SelfRepoGuardSortBy,
  SelfRepoGuardSortDirection,
  SelfRepoGuardVerdict,
} from "../../../core/contracts/self-repo-guard.contracts.js";

export class SelfRepoGuardSupervisor {
  private readonly substrate: BroccoliSelfRepoGuardSubstrate;
  private readonly engine: DeterministicSelfRepoGuardEngine;
  private cachedRunningRoot: string | null = null;

  constructor(
    substrate: BroccoliSelfRepoGuardSubstrate,
    engine: DeterministicSelfRepoGuardEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public getSubstrate(): BroccoliSelfRepoGuardSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicSelfRepoGuardEngine {
    return this.engine;
  }

  public configure(config: Partial<SelfRepoGuardConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): SelfRepoGuardConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): SelfRepoGuardMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): SelfRepoGuardMetricsReport {
    return this.substrate.getMetricsReport();
  }

  public auditHealth(): SelfRepoGuardHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getIncidents(): readonly SelfRepoGuardIncident[] {
    return this.substrate.getIncidents();
  }

  /**
   * Resolves the running source root directory backing this process.
   */
  public getRunningSourceRoot(): string {
    const config = this.substrate.getConfig();
    if (config.runningSourceRoot) {
      return path.resolve(config.runningSourceRoot);
    }

    if (this.cachedRunningRoot) {
      return this.cachedRunningRoot;
    }

    let candidate = process.cwd();
    while (candidate && candidate !== path.dirname(candidate)) {
      if (fs.existsSync(path.join(candidate, ".git"))) {
        this.cachedRunningRoot = candidate;
        return candidate;
      }
      candidate = path.dirname(candidate);
    }

    this.cachedRunningRoot = process.cwd();
    return this.cachedRunningRoot;
  }

  /**
   * Inspects a shell command before execution to ensure it does not destructively mutate the running source tree.
   */
  public inspectShellCommand(command: string, cwd?: string): SelfRepoGuardVerdict {
    const config = this.substrate.getConfig();
    this.substrate.recordCommandInspected();

    if (!config.enabled) {
      return { allowed: true };
    }

    const effectiveCwd = cwd ? path.resolve(cwd) : process.cwd();
    const runningRoot = this.getRunningSourceRoot();

    const verdict = this.engine.evaluateCommand(command, effectiveCwd, runningRoot, config);

    if (!verdict.allowed) {
      const incident: SelfRepoGuardIncidentRow = {
        incidentId: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        command,
        targetPath: verdict.targetPath || effectiveCwd,
        runningRoot,
        operation: verdict.operation || "git",
        reason: verdict.reason || "Destructive worktree mutation blocked",
      };
      this.substrate.recordIncident(incident);
    } else {
      this.substrate.recordSafeOperation();
    }

    return verdict;
  }

  /**
   * Classifies a git operation safety level.
   */
  public classifyGitOperation(subcommand: string, args: readonly string[]): GitOperationSafety {
    return this.engine.classifyGitOperation(subcommand, args);
  }

  public getGroupedIncidents(groupBy?: SelfRepoGuardGroupBy, sortBy?: SelfRepoGuardSortBy, direction?: SelfRepoGuardSortDirection) {
    return this.substrate.getGroupedIncidents(groupBy, sortBy, direction);
  }

  public queryDsl(query: SelfRepoGuardDslQueryFilter | string) {
    return this.substrate.queryIncidentsDsl(query);
  }

  public bulkPurge(ids: readonly string[]) {
    return this.substrate.bulkPurgeIncidents(ids);
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
