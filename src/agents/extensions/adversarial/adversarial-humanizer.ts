/**
 * adversarial-humanizer.ts
 *
 * Plain-English Diagnostic Translator, Executive ASCII Shield Renderer,
 * and Remediation Storyteller for Adversarial Scrutiny & Provenance Auditing (Pass 194 / ADR-132).
 */

import type {
  AdversarialFinding,
  AdversarialRedTeamVerdict,
  CognitiveDecompositionReport,
  ProvenanceGroundingProof,
} from "../../../core/contracts/adversarial-scrutiny.contracts.js";

export class AdversarialHumanizer {
  /**
   * Renders a high-contrast executive ASCII shield and score card for a red-team verdict.
   */
  public renderVerdictBanner(verdict: AdversarialRedTeamVerdict): string {
    const statusIcon =
      verdict.verdict === "APPROVED" ? "🛡️ [APPROVED]" :
      verdict.verdict === "CAUTION" ? "⚠️ [CAUTION - REVIEW REQUIRED]" :
      "⛔ [REJECTED - FAIL-CLOSED]";

    const lines: string[] = [
      "╔══════════════════════════════════════════════════════════════════════════════╗",
      `║ 🔍 LUMI ADVERSARIAL SCRUTINY SHIELD (Pass 194 / ADR-132)                     ║`,
      "╠══════════════════════════════════════════════════════════════════════════════╣",
      `║ Status:    ${statusIcon.padEnd(65)} ║`,
      `║ Target:    ${verdict.targetType.toUpperCase().padEnd(65)} ║`,
      `║ Score:     ${`${verdict.score}/100`.padEnd(65)} ║`,
      `║ Findings:  ${`Critical: ${verdict.criticalCount} | High: ${verdict.highCount} | Total: ${verdict.totalFindings}`.padEnd(65)} ║`,
      `║ Latency:   ${`${verdict.latencyMs} ms`.padEnd(65)} ║`,
      "╚══════════════════════════════════════════════════════════════════════════════╝",
      "",
      `💬 Executive Summary: ${verdict.executiveSummary}`,
    ];

    if (verdict.findings.length > 0) {
      lines.push("");
      lines.push(this.renderFindingsTable(verdict.findings));
    }

    if (verdict.cognitiveDecomposition) {
      lines.push("");
      lines.push(this.renderCognitiveDecomposition(verdict.cognitiveDecomposition));
    }

    return lines.join("\n");
  }

  /**
   * Renders structured findings with severity indicators, impact scores, and actionable remediations.
   */
  public renderFindingsTable(findings: readonly AdversarialFinding[]): string {
    if (findings.length === 0) {
      return "✅ No architectural or provenance vulnerabilities detected.";
    }

    const lines: string[] = [
      "┌──────────────────────────────────────────────────────────────────────────────┐",
      "│ 📋 ADVERSARIAL RED-TEAM FINDINGS & REMEDIATIONS                              │",
      "├──────┬──────────┬──────┬─────────────────────────────────────────────────────┤",
      "│ #    │ SEVERITY │ SCORE│ TITLE & ACTIONABLE REMEDIATION                      │",
      "├──────┼──────────┼──────┼─────────────────────────────────────────────────────┤",
    ];

    findings.forEach((finding, idx) => {
      const numStr = (idx + 1).toString().padEnd(4);
      const sevStr = finding.severity.padEnd(8);
      const scoreStr = finding.impactScore.toString().padEnd(4);
      const titleStr = finding.title.slice(0, 50);

      lines.push(`│ ${numStr} │ ${sevStr} │ ${scoreStr} │ ${titleStr.padEnd(51)} │`);
      lines.push(`│      │          │      │ 💡 Fix: ${finding.remediation.slice(0, 43).padEnd(44)} │`);
      if (idx < findings.length - 1) {
        lines.push("├──────┼──────────┼──────┼─────────────────────────────────────────────────────┤");
      }
    });

    lines.push("└──────┴──────────┴──────┴─────────────────────────────────────────────────────┘");
    return lines.join("\n");
  }

  /**
   * Renders visual cognitive spend decomposition bar and savings estimations.
   */
  public renderCognitiveDecomposition(report: CognitiveDecompositionReport): string {
    const total = report.totalTokenEstimate;
    const compressible = report.compressibleTokens;
    const irreducible = report.irreducibleTokens;
    const compPct = Math.round(report.compressiblePercentage);
    const irrPct = 100 - compPct;

    const barWidth = 30;
    const compBars = Math.round((compPct / 100) * barWidth);
    const irrBars = barWidth - compBars;

    const visualBar = `[${"#".repeat(irrBars)}${".".repeat(compBars)}]`;

    const lines: string[] = [
      "┌──────────────────────────────────────────────────────────────────────────────┐",
      "│ 🧠 COGNITIVE SPEND & TOKEN COMPRESSIBILITY DECOMPOSITION                    │",
      "├──────────────────────────────────────────────────────────────────────────────┤",
      `│ Token Breakdown: ${visualBar}                                   │`,
      `│   • Irreducible Task Floor: ${irreducible} tokens (${irrPct}%)`.padEnd(79) + "│",
      `│   • Compressible Fluff:     ${compressible} tokens (${compPct}%)`.padEnd(79) + "│",
      `│   • Est. Latency Savings:   ${report.potentialLatencyReductionMs} ms per turn`.padEnd(79) + "│",
    ];

    if (report.fluffCategories.length > 0) {
      lines.push("├──────────────────────────────────────────────────────────────────────────────┤");
      lines.push("│ Identified Fluff Categories:                                                 │");
      for (const cat of report.fluffCategories) {
        lines.push(`│   - ${cat.category}: ~${cat.tokens} tokens (Sample: "${cat.sample.slice(0, 30)}")`.padEnd(79) + "│");
      }
    }

    lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
    return lines.join("\n");
  }

  /**
   * Renders factual provenance grounding proofs.
   */
  public renderProvenanceReport(proofs: readonly ProvenanceGroundingProof[]): string {
    if (proofs.length === 0) {
      return "ℹ️ No provenance assertions recorded in this audit.";
    }

    const lines: string[] = [
      "┌──────────────────────────────────────────────────────────────────────────────┐",
      "│ 🎯 FACTUAL PROVENANCE GROUNDING LEDGER                                       │",
      "├──────────────────────────────────────────────────────────────────────────────┤",
    ];

    proofs.forEach((proof, idx) => {
      const statusIcon = proof.isGrounded ? "✅ [GROUNDED]" : "❌ [UNGROUNDED]";
      lines.push(`│ Assertion #${idx + 1}: ${proof.claim.slice(0, 50).padEnd(58)} │`);
      lines.push(`│   Status:     ${statusIcon} (Confidence: ${Math.round(proof.confidence * 100)}%)`.padEnd(79) + "│");
      if (proof.sourceSnippet) {
        lines.push(`│   Source:     "${proof.sourceSnippet.slice(0, 55)}"`.padEnd(79) + "│");
      }
      if (proof.divergenceDetails) {
        lines.push(`│   Divergence: ${proof.divergenceDetails.slice(0, 55)}`.padEnd(79) + "│");
      }
    });

    lines.push("└──────────────────────────────────────────────────────────────────────────────┘");
    return lines.join("\n");
  }
}
