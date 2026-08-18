import type {
  KnowledgeNode,
  MemoryHealthAuditReport,
  MemoryMetricsReport,
} from "../../core/contracts/memory-curator.contracts.js";
import { BroccoliLearningSubstrate } from "../../sessions/extensions/memory/broccoli-learning-substrate.js";

export type MemoryCuratorViewMode = "overview" | "nodes" | "graph" | "decay" | "health" | "metrics";

/**
 * MemoryCuratorModal.
 * Interactive Terminal TUI Modal Component for Persistent Memory Substrate & Knowledge Graph (ADR-028).
 *
 * Features:
 * - Executive KPI Ribbon
 * - Filter Presets (1: All, 2: Preferences, 3: Facts, 4: Skills)
 * - 6 View Modes (Overview, Nodes, Graph, Decay, Health, Metrics)
 * - Actions: Forget Node, Consolidate Nodes, View Topology, Filter Cycling
 */
export class MemoryCuratorModal {
  private readonly substrate: BroccoliLearningSubstrate;
  private readonly onClose: () => void;

  private selectedIndex = 0;
  private filterMode: "all" | "preference" | "fact" | "skill" = "all";
  private viewMode: MemoryCuratorViewMode = "overview";
  private showHelp = false;

  constructor(substrate: BroccoliLearningSubstrate, onClose: () => void) {
    this.substrate = substrate;
    this.onClose = onClose;
  }

  public render(maxWidth = 100): readonly string[] {
    const lines: string[] = [];
    const width = Math.max(60, maxWidth);
    const border = "─".repeat(width - 2);

    const metrics = this.substrate.getMemoryMetrics();
    const nodes = this.getFilteredNodes();

    // 1. Header
    lines.push(`┌${border}┐`);
    lines.push(this.formatLine(` 🧠 LUMI PERSISTENT MEMORY & KNOWLEDGE GRAPH (ADR-028) `, width));
    lines.push(`├${border}┤`);

    // 2. Executive KPI Ribbon
    const kpiText = ` Nodes: ${metrics.activeNodes} │ Edges: ${metrics.totalEdges} │ Recalls: ${metrics.totalRecalls} │ Remembered: ${metrics.totalRemembered} │ Conf: ${(metrics.avgConfidence * 100).toFixed(0)}%`;
    lines.push(this.formatLine(kpiText, width));
    lines.push(`├${border}┤`);

    // 3. View Mode Bar
    const viewTabs = [
      this.viewMode === "overview" ? "[1: 🧠 Overview]" : " 1: Overview ",
      this.viewMode === "nodes" ? "[2: 📚 Nodes]" : " 2: Nodes ",
      this.viewMode === "graph" ? "[3: 🕸️ Graph]" : " 3: Graph ",
      this.viewMode === "decay" ? "[4: ⌛ Decay]" : " 4: Decay ",
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
      case "nodes":
        this.renderNodesView(lines, nodes, width);
        break;
      case "graph":
        this.renderGraphView(lines, width);
        break;
      case "decay":
        this.renderDecayView(lines, nodes, width);
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
      lines.push(this.formatLine(` [j/k] Navigate  [x] Forget Node  [c] Consolidate  [1-4] Filter  [q] Close`, width));
    } else {
      lines.push(this.formatLine(` [v] View (${this.viewMode})  [x] Forget  [c] Consolidate  [1-4] Filters  [?] Help  [q] Close`, width));
    }
    lines.push(`└${border}┘`);

    return lines;
  }

  private renderOverviewView(lines: string[], metrics: MemoryMetricsReport, width: number): void {
    lines.push(this.formatLine(` ── Knowledge Graph Architecture:`, width));
    lines.push(this.formatLine(`  • Active Knowledge Nodes: ${metrics.activeNodes} (Facts: ${metrics.typeCounts.fact}, Prefs: ${metrics.typeCounts.preference}, Skills: ${metrics.typeCounts.skill})`, width));
    lines.push(this.formatLine(`  • Associative Relations: ${metrics.totalEdges} edges in ${metrics.clusterCount} cluster(s)`, width));
    lines.push(this.formatLine(`  • Recall Latencies: P50: ${metrics.p50RecallMs} ms │ P95: ${metrics.p95RecallMs} ms`, width));
    lines.push(this.formatLine(`  • Average Semantic Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%`, width));
  }

  private renderNodesView(lines: string[], nodes: readonly KnowledgeNode[], width: number): void {
    if (nodes.length === 0) {
      lines.push(this.formatLine(" (No knowledge nodes in this view)", width));
      return;
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isSelected = i === this.selectedIndex;
      const marker = isSelected ? "▶" : " ";
      const typeBadge = `[${n.type.slice(0, 4).toUpperCase()}]`;
      const confStr = `${(n.confidence * 100).toFixed(0)}%`;

      const row = `${marker} ${typeBadge} ${n.label.slice(0, 24).padEnd(24)} (${confStr}) │ ${n.content.slice(0, width - 42)}`;
      lines.push(this.formatLine(row, width));
    }
  }

  private renderGraphView(lines: string[], width: number): void {
    const edges = this.substrate.getGraph().getAllEdges();
    if (edges.length === 0) {
      lines.push(this.formatLine(" (No associative relational edges in graph)", width));
      return;
    }

    lines.push(this.formatLine(` ── Associative Relational Edges (${edges.length} edges):`, width));
    for (const e of edges.slice(0, 8)) {
      lines.push(this.formatLine(` • \`${e.source}\` ──[${e.relation} (w: ${e.weight.toFixed(2)})]──> \`${e.target}\``, width));
    }
  }

  private renderDecayView(lines: string[], nodes: readonly KnowledgeNode[], width: number): void {
    const decaying = nodes.filter((n) => n.decayFactor < 0.8);
    if (decaying.length === 0) {
      lines.push(this.formatLine(" (All knowledge nodes are fresh with decayFactor >= 0.8)", width));
      return;
    }

    lines.push(this.formatLine(` ── Decaying & Stale Facts (${decaying.length} nodes):`, width));
    for (const n of decaying) {
      lines.push(this.formatLine(` • [${n.type.toUpperCase()}] ${n.label}: decay=${n.decayFactor.toFixed(2)}, accessed ${n.accessCount}x`, width));
    }
  }

  private renderHealthView(lines: string[], width: number): void {
    const audit = this.substrate.auditMemoryHealth();
    lines.push(this.formatLine(` Knowledge Health: ${audit.healthStatus.toUpperCase()} │ Stale: ${audit.staleFactCount} │ Fragmented: ${audit.fragmentedClusterCount}`, width));
    lines.push(this.formatLine(` Average Confidence: ${(audit.avgConfidence * 100).toFixed(1)}% │ Decay Ratio: ${audit.decayRatio.toFixed(2)}`, width));
    lines.push(this.formatLine(` ── Diagnostic Recommendations:`, width));
    for (const r of audit.recommendations) {
      lines.push(this.formatLine(`  • ${r}`, width));
    }
  }

  private renderMetricsView(lines: string[], metrics: MemoryMetricsReport, width: number): void {
    lines.push(this.formatLine(` Total: ${metrics.totalNodes} │ Recalls: ${metrics.totalRecalls} │ Remembered: ${metrics.totalRemembered}`, width));
    lines.push(this.formatLine(` Types: Facts: ${metrics.typeCounts.fact} │ Prefs: ${metrics.typeCounts.preference} │ Entities: ${metrics.typeCounts.entity} │ Concepts: ${metrics.typeCounts.concept} │ Skills: ${metrics.typeCounts.skill}`, width));
    lines.push(this.formatLine(` Recall Latency: P50: ${metrics.p50RecallMs}ms │ P95: ${metrics.p95RecallMs}ms`, width));
  }

  public handleInput(key: string): void {
    const nodes = this.getFilteredNodes();

    switch (key) {
      case "j":
      case "down":
        if (this.selectedIndex < nodes.length - 1) {
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
        this.filterMode = "preference";
        this.selectedIndex = 0;
        break;
      case "3":
        this.filterMode = "fact";
        this.selectedIndex = 0;
        break;
      case "4":
        this.filterMode = "skill";
        this.selectedIndex = 0;
        break;

      case "v": {
        const modes: MemoryCuratorViewMode[] = ["overview", "nodes", "graph", "decay", "health", "metrics"];
        const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
        this.viewMode = modes[nextIdx];
        break;
      }

      case "x": {
        const currentNode = nodes[this.selectedIndex];
        if (currentNode) {
          this.substrate.forgetNode(currentNode.id);
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

  private getFilteredNodes(): readonly KnowledgeNode[] {
    let list = this.substrate.getGraph().getAllNodes();
    if (this.filterMode === "preference") {
      list = list.filter((n) => n.type === "preference");
    } else if (this.filterMode === "fact") {
      list = list.filter((n) => n.type === "fact");
    } else if (this.filterMode === "skill") {
      list = list.filter((n) => n.type === "skill");
    }
    return list;
  }

  private formatLine(content: string, width: number): string {
    const cleanContent = content.length > width - 4 ? content.slice(0, width - 4) : content;
    const padding = Math.max(0, width - 2 - cleanContent.length);
    return `│${cleanContent}${" ".repeat(padding)}│`;
  }
}
