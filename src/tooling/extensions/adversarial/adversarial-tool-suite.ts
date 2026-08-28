/**
 * adversarial-tool-suite.ts
 *
 * Model Tool Suite for Adversarial Plan Scrutiny, Factual Provenance Auditing,
 * Cognitive Spend Decomposition, and Completion Verification (Pass 194 / ADR-132).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { AdversarialScrutinySupervisor } from "../../../agents/extensions/adversarial/adversarial-scrutiny-supervisor.js";
import { AdversarialHumanizer } from "../../../agents/extensions/adversarial/adversarial-humanizer.js";

export class AdversarialToolSuite {
  private readonly supervisor: AdversarialScrutinySupervisor;
  private readonly humanizer: AdversarialHumanizer;

  constructor(supervisor: AdversarialScrutinySupervisor, humanizer?: AdversarialHumanizer) {
    this.supervisor = supervisor;
    this.humanizer = humanizer ?? new AdversarialHumanizer();
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "adversarial_scrutinize_plan",
        description: "Adversarially red-teams a technical implementation plan, hunting for missing verification gates, ungrounded claims, amnesia risks, and token bloat.",
        parameters: {
          plan: {
            type: "string",
            description: "Implementation plan markdown content or path to plan file.",
            required: true,
          },
          strictProvenance: {
            type: "boolean",
            description: "Enforce strict fail-closed factual grounding.",
            required: false,
          },
          inspectCognitiveSpend: {
            type: "boolean",
            description: "Include cognitive spend decomposition and fluff analysis.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const rawPlan = String(args.plan || "").trim();
          let planText = rawPlan;

          // Check if plan is a file path
          const potentialPath = path.isAbsolute(rawPlan) ? rawPlan : path.resolve(cwd, rawPlan);
          if (fs.existsSync(potentialPath)) {
            try {
              planText = fs.readFileSync(potentialPath, "utf-8");
            } catch {
              // fallback to raw text
            }
          }

          const verdict = this.supervisor.scrutinizePlan(planText, {
            strictProvenance: args.strictProvenance === true,
            inspectCognitiveSpend: args.inspectCognitiveSpend !== false,
          });

          const humanized = this.humanizer.renderVerdictBanner(verdict);
          return {
            verdict: verdict.verdict,
            score: verdict.score,
            criticalCount: verdict.criticalCount,
            highCount: verdict.highCount,
            totalFindings: verdict.totalFindings,
            renderedBanner: humanized,
            findings: verdict.findings,
            cognitiveDecomposition: verdict.cognitiveDecomposition,
          };
        },
      },
      {
        name: "adversarial_audit_provenance",
        description: "Audits a factual claim against empirical source text to verify 100% fail-closed grounding without synthetic placeholders.",
        parameters: {
          claim: {
            type: "string",
            description: "The specific claim, statistic, or assertion to audit.",
            required: true,
          },
          evidence: {
            type: "string",
            description: "The raw source evidence string or path to an evidence file.",
            required: true,
          },
          strictProvenance: {
            type: "boolean",
            description: "Enforce strict zero-tolerance threshold.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const claim = String(args.claim || "").trim();
          const rawEvidence = String(args.evidence || "").trim();
          let evidenceText = rawEvidence;

          const potentialPath = path.isAbsolute(rawEvidence) ? rawEvidence : path.resolve(cwd, rawEvidence);
          if (fs.existsSync(potentialPath)) {
            try {
              evidenceText = fs.readFileSync(potentialPath, "utf-8");
            } catch {
              // fallback to raw string
            }
          }

          const proof = this.supervisor.auditProvenance(claim, evidenceText, {
            strictProvenance: args.strictProvenance === true,
          });

          const rendered = this.humanizer.renderProvenanceReport([proof]);
          return {
            isGrounded: proof.isGrounded,
            confidence: proof.confidence,
            sourceSnippet: proof.sourceSnippet,
            divergenceDetails: proof.divergenceDetails,
            renderedLedger: rendered,
          };
        },
      },
      {
        name: "adversarial_decompose_spend",
        description: "Decomposes a prompt or response into compressible fluff vs. irreducible task floor tokens, estimating potential latency reductions.",
        parameters: {
          text: {
            type: "string",
            description: "The prompt, plan, or response text to analyze.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = String(args.text || "").trim();
          const report = this.supervisor.decomposeCognitiveSpend(text);
          const rendered = this.humanizer.renderCognitiveDecomposition(report);

          return {
            totalTokens: report.totalTokenEstimate,
            compressibleTokens: report.compressibleTokens,
            irreducibleTokens: report.irreducibleTokens,
            compressiblePercentage: report.compressiblePercentage,
            potentialLatencyReductionMs: report.potentialLatencyReductionMs,
            fluffCategories: report.fluffCategories,
            renderedReport: rendered,
          };
        },
      },
      {
        name: "adversarial_verify_completion",
        description: "Validates task completion against empirical test receipts, preventing premature declarations and simulated execution illusions.",
        parameters: {
          declaredSummary: {
            type: "string",
            description: "Summary of completed work.",
            required: true,
          },
          evidenceReceipts: {
            type: "string",
            description: "JSON array of stdout test receipts, compiler outputs, or file assertions.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const summary = String(args.declaredSummary || "");
          let receipts: string[] = [];

          if (typeof args.evidenceReceipts === "string") {
            try {
              const parsed = JSON.parse(args.evidenceReceipts);
              receipts = Array.isArray(parsed) ? parsed.map(String) : [args.evidenceReceipts];
            } catch {
              receipts = [args.evidenceReceipts];
            }
          } else if (Array.isArray(args.evidenceReceipts)) {
            receipts = args.evidenceReceipts.map(String);
          }

          const verdict = this.supervisor.verifyTaskCompletion(summary, receipts);
          const rendered = this.humanizer.renderVerdictBanner(verdict);

          return {
            verdict: verdict.verdict,
            score: verdict.score,
            findings: verdict.findings,
            renderedBanner: rendered,
          };
        },
      },
    ];
  }
}
