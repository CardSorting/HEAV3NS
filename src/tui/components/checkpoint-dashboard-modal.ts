import type {
  CheckpointMetricsReport,
  CheckpointNode,
} from "../../core/contracts/checkpoint.contracts.js";
import { BroccoliCheckpointSubstrate } from "../../sessions/extensions/checkpoint/broccoli-checkpoint-substrate.js";

export type CheckpointDashboardViewMode = "overview" | "commits" | "tree" | "blobs" | "health" | "metrics";

/**
 * CheckpointDashboardModal.
 * Interactive Terminal TUI Modal Component for Content-Addressable Blob Store,
 * Checkpoint Kernel & Merkle Tree Subsystem (ADR-039).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Large >100KB, 3: Multi-file >5, 4: Frame >10)
 * - 6 View Modes (Overview, Commits, Tree, Blobs, Health, Metrics)
 * - Actions: Delete Commit, Filter Cycling, View Switching
 */
export class CheckpointDashboardModal {
  private readonly substrate: BroccoliCheckpointSubstrate;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private filterMode: "all" | "large" | "multifile" | "recent" = "all";
  private viewMode: CheckpointDashboardViewMode = "overview";
  private showHelp = false;

  constructor(
    substrate: BroccoliCheckpointSubstrate,
    onClose?: () => void
  ) {
    this.substrate = substrate;
    this.onClose = onClose ?? (() => {});
  }

  public render(maxWidth = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.substrate.getCheckpointMetrics();
    const commits = this.getFilteredCommits();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 📦 LUMI CHECKPOINT KERNEL & CAS STORE (ADR-039) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Commits: ${metrics.totalCheckpoints} │ Blobs: ${metrics.totalBlobs} │ Bytes: ${(metrics.totalBytes / 1024).toFixed(1)} KB │ Dedup: ${metrics.deduplicationRatio}x │ HEAD: ${metrics.currentHeadId ? metrics.currentHeadId.slice(0, 8) : "none"}`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "overview" ? "[1: 📦 Overview]" : " 1: Overview ",
      this.viewMode === "commits" ? "[2: 📜 Commits]" : " 2: Commits ",
      this.viewMode === "tree" ? "[3: 🌲 Tree]" : " 3: Tree ",
      this.viewMode === "blobs" ? "[4: 🗄️ Blobs]" : " 4: Blobs ",
      this.viewMode === "health" ? "[5: 🩺 Health]" : " 5: Health ",
      this.viewMode === "metrics" ? "[6: 📊 Metrics]" : " 6: Metrics ",
    ].join(" │ ");
    lines.push(this.formatLine(` ${viewTabs}`, width));
    lines.push(`├${border}┤`);

    // 4. Content Area
    switch (this.viewMode) {
      case "overview":
        this.renderOverviewView(lines, metrics, width);
        break;
      case "commits":
        this.renderCommitsView(lines, commits, width);
        break;
      case "tree":
        this.renderTreeView(lines, commits, width);
        break;
      case "blobs":
        this.renderBlobsView(lines, metrics, width);
        break;
      case "health":
        this.renderHealthView(lines, width);
        break;
      case "metrics":
        this.renderMetricsView(lines, metrics, width);
        break;
    }

    lines.push(`├${border}┤`);

    // 5. Footer & Keybindings
    if (this.showHelp) {
      lines.push(this.formatLine(` [j/k] Navigate  [x] Delete Commit  [1-4] Filter  [v] View Mode  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [x] Delete Commit  [1-4] Filters  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderOverviewView(lines: string[], metrics: CheckpointMetricsReport, width: number): void {
    lines.push(this.formatLine(` ── CAS Filesystem & Merkle Checkpoint Architecture:`, width));
    lines.push(this.formatLine(`  • Active Checkpoint Commits: ${metrics.totalCheckpoints} recorded across session`, width));
    lines.push(this.formatLine(`  • Content-Addressable Blob Pool: ${metrics.totalBlobs} unique blobs (${metrics.totalBytes.toLocaleString()} bytes)`, width));
    lines.push(this.formatLine(`  • Deduplication Savings: ${metrics.deduplicationRatio}x storage efficiency factor`, width));
    lines.push(this.formatLine(`  • Sub-Millisecond Rollback Latency: P50: ${metrics.p50RollbackMs} ms, P95: ${metrics.p95RollbackMs} ms (< 0.1 ms SLA)`, width));
    lines.push(this.formatLine(`  • Merkle Tree Invariant: SHA-256 deterministic path hashing & zero float drift`, width));
  }

  private renderCommitsView(lines: string[], commits: readonly CheckpointNode[], width: number): void {
    if (commits.length === 0) {
      lines.push(this.formatLine(" (No checkpoint commit records in this view)", width));
      return;
    }

    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const commitStr = `[#${c.frameIndex}] \`${c.id.slice(0, 8)}\``.padEnd(16);
      const metaStr = `(${c.stats.fileCount} files, ${(c.stats.byteCount / 1024).toFixed(1)} KB)`.padEnd(18);
      const row = `${marker} ${commitStr} ${metaStr} │ ${c.message}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderTreeView(lines: string[], commits: readonly CheckpointNode[], width: number): void {
    lines.push(this.formatLine(` ── Checkpoint Commit DAG & Branch Structure:`, width));
    for (const c of commits.slice(-8)) {
      const commitTag = `[#${c.frameIndex}] \`${c.id.slice(0, 8)}\``;
      const parentTag = c.parentId ? `(parent: \`${c.parentId.slice(0, 6)}\`)` : "(root)";
      lines.push(this.formatLine(`  • ──● ${commitTag} ${parentTag} "${c.message.slice(0, 20)}"`, width));
    }
  }

  private renderBlobsView(lines: string[], metrics: CheckpointMetricsReport, width: number): void {
    lines.push(this.formatLine(` ── CAS Blob Store Telemetry:`, width));
    lines.push(this.formatLine(`  • Total Unique Blobs: ${metrics.totalBlobs}`, width));
    lines.push(this.formatLine(`  • Total Physical Bytes: ${metrics.totalBytes.toLocaleString()} B`, width));
    lines.push(this.formatLine(`  • Deduplication Multiplier: ${metrics.deduplicationRatio}x nominal size`, width));
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.substrate.auditCheckpointHealth();
    lines.push(this.formatLine(` Health Status: ${audit.healthStatus.toUpperCase()} │ Dedup Ratio: ${audit.deduplicationRatio}x`, width));
    lines.push(this.formatLine(` Avg Files / Commit: ${audit.avgFilesPerCommit}`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: CheckpointMetricsReport, width: number): void {
    lines.push(this.formatLine(` Total Commits: ${metrics.totalCheckpoints} │ Total Merkle Trees: ${metrics.totalTrees}`, width));
    lines.push(this.formatLine(` Rollback SLA Latency: P50: ${metrics.p50RollbackMs} ms │ P95: ${metrics.p95RollbackMs} ms`, width));
    lines.push(this.formatLine(` Commit Frequency: ${metrics.commitFrequencyPerTurn} commit/turn`, width));
  }

  public handleInput(key: string): void {
    const commits = this.getFilteredCommits();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < commits.length - 1) {
          this.selectedIndex++;
        }
        break;

      case "k":
      case "up":
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
        }
        break;

      case "1":
        this.filterMode = "all";
        this.selectedIndex = 0;
        break;
      case "2":
        this.filterMode = "large";
        this.selectedIndex = 0;
        break;
      case "3":
        this.filterMode = "multifile";
        this.selectedIndex = 0;
        break;
      case "4":
        this.filterMode = "recent";
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: CheckpointDashboardViewMode[] = ["overview", "commits", "tree", "blobs", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "x": {
        const currentCommit = commits[this.selectedIndex];
        if (currentCommit) {
          this.substrate.bulkDeleteCheckpoints([currentCommit.id]);
        }
        break;
      }

      case "?":
        this.showHelp = !this.showHelp;
        break;

      case "q":
      case "escape":
        this.onClose();
        break;
    }
  }

  private getFilteredCommits(): readonly CheckpointNode[] {
    let list = this.substrate.listCheckpoints(100);
    if (this.filterMode === "large") {
      list = list.filter((c) => c.stats.byteCount >= 100_000);
    } else if (this.filterMode === "multifile") {
      list = list.filter((c) => c.stats.fileCount >= 5);
    } else if (this.filterMode === "recent") {
      list = list.filter((c) => c.frameIndex >= 10);
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
