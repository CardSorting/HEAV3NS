/**
 * background-review-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing background turn reviews,
 * extracted candidate knowledge (facts/skills), session insights, and SLA health (Phase 96 / ADR-048 / Target #67).
 */

import type {
  BackgroundReviewHealthAuditReport,
  BackgroundReviewMetricsReport,
  CandidateFactItem,
  CandidateSkillItem,
  TurnReviewResult,
} from "../../core/contracts/background-review.contracts.js";
import { BroccoliReviewSubstrate } from "../../sessions/extensions/review/broccoli-review-substrate.js";
import { DeterministicReviewEvaluator } from "../../tooling/extensions/review/deterministic-review-evaluator.js";

export type BackgroundReviewDashboardViewMode = "overview" | "reviews" | "facts_skills" | "health" | "raw";

export class BackgroundReviewDashboardModal {
  private readonly substrate: BroccoliReviewSubstrate;
  private readonly evaluator: DeterministicReviewEvaluator;
  private viewMode: BackgroundReviewDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(substrate: BroccoliReviewSubstrate, evaluator?: DeterministicReviewEvaluator) {
    this.substrate = substrate;
    this.evaluator = evaluator || new DeterministicReviewEvaluator();
    this.viewMode = "overview";
    this.selectedIndex = 0;
    this.isVisible = false;
  }

  public open(): void {
    this.isVisible = true;
    this.selectedIndex = 0;
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public setViewMode(mode: BackgroundReviewDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): BackgroundReviewDashboardViewMode {
    const modes: BackgroundReviewDashboardViewMode[] = ["overview", "reviews", "facts_skills", "health", "raw"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: BackgroundReviewDashboardViewMode } {
    if (!this.isVisible) return { action: "none", viewMode: this.viewMode };

    switch (key.toLowerCase()) {
      case "q":
      case "escape":
        this.close();
        return { action: "close", viewMode: this.viewMode };

      case "\t":
      case "tab":
        this.cycleViewMode();
        return { action: "render", viewMode: this.viewMode };

      case "1":
        this.setViewMode("overview");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("reviews");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("facts_skills");
        return { action: "render", viewMode: this.viewMode };

      case "4":
        this.setViewMode("health");
        return { action: "render", viewMode: this.viewMode };

      case "5":
        this.setViewMode("raw");
        return { action: "render", viewMode: this.viewMode };

      case "j":
      case "down":
        this.selectedIndex = Math.min(this.selectedIndex + 1, 100);
        return { action: "render", viewMode: this.viewMode };

      case "k":
      case "up":
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        return { action: "render", viewMode: this.viewMode };

      default:
        return { action: "none", viewMode: this.viewMode };
    }
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    lines.push("╔════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║        🔍 BACKGROUND REVIEW & POST-TURN SELF-IMPROVEMENT MODAL             ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs = [
      { id: "overview", label: "[1] Overview" },
      { id: "reviews", label: "[2] Turn Reviews" },
      { id: "facts_skills", label: "[3] Facts & Skills" },
      { id: "health", label: "[4] SLA Health" },
      { id: "raw", label: "[5] Raw JSON" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const reviews = this.substrate.listReviews();
    const metrics = this.substrate.getMetrics();
    const health = this.substrate.auditHealth();

    switch (this.viewMode) {
      case "overview": {
        lines.push(`║  Total Turns Reviewed:   \x1b[1m${reviews.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Candidate Facts:        \x1b[33m${metrics.totalCandidateFactsExtracted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Candidate Skills:       \x1b[35m${metrics.totalCandidateSkillsExtracted}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Current Topic Title:    \x1b[36m${this.substrate.getTitle() || "None"}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Trigger Policy:         ${this.substrate.getTriggerPolicy().toUpperCase()}`.padEnd(76) + " ║");
        break;
      }

      case "reviews": {
        if (reviews.length === 0) {
          lines.push("║  No turn reviews recorded yet.                                            ║");
        } else {
          for (let i = 0; i < Math.min(reviews.length, 6); i++) {
            const r = reviews[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? "▶ " : "  ";
            const line = `${prefix}\x1b[1mTurn #${r.turnIndex}\x1b[0m │ ${r.reviewDigest.userGoal.slice(0, 32)} │ \x1b[33m${r.candidateFacts.length}F\x1b[0m/\x1b[35m${r.candidateSkills.length}S\x1b[0m`;
            lines.push(`║ ${line.slice(0, 72).padEnd(72)} ║`);
          }
        }
        break;
      }

      case "facts_skills": {
        const facts = this.substrate.getAllFacts();
        const skills = this.substrate.getAllSkills();
        lines.push(`║  --- Candidate Facts (${facts.length}) ---`.padEnd(76) + " ║");
        for (const f of facts.slice(0, 3)) {
          lines.push(`║  • [${f.category}] ${f.subject} -> ${f.predicate}: ${f.object.slice(0, 36)}`.padEnd(76) + " ║");
        }
        lines.push(`║  --- Candidate Skills (${skills.length}) ---`.padEnd(76) + " ║");
        for (const s of skills.slice(0, 3)) {
          lines.push(`║  • ${s.title.slice(0, 68)}`.padEnd(76) + " ║");
        }
        break;
      }

      case "health": {
        const statusColor = health.healthStatus === "stalled" ? "\x1b[31m" : health.healthStatus === "degraded" ? "\x1b[33m" : "\x1b[32m";
        lines.push(`║  Health Status:          ${statusColor}${health.healthStatus.toUpperCase()}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  Trigger Policy:         ${health.triggerPolicy.toUpperCase()}`.padEnd(76) + " ║");
        lines.push(`║  Latest Turn Index:      #${health.latestTurnIndex}`.padEnd(76) + " ║");
        for (const rec of health.recommendations) {
          lines.push(`║  💡 ${rec.slice(0, 68)}`.padEnd(76) + " ║");
        }
        break;
      }

      case "raw": {
        const snapshot = this.substrate.exportSnapshot();
        const rawJson = JSON.stringify(snapshot, null, 2).split("\n");
        for (const r of rawJson.slice(0, 10)) {
          lines.push(`║  ${r.slice(0, 72)}`.padEnd(76) + " ║");
        }
        break;
      }
    }

    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");
    lines.push("║ [Tab] Cycle View  [1-5] Direct View  [j/k] Navigate  [q/Esc] Close Modal   ║");
    lines.push("╚════════════════════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }
}
