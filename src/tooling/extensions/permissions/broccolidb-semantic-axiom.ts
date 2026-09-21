/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 184: Zero-Dependency Broccoli Semantic Axiom Engine
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/SemanticAxiomEngine.ts.
 * High-level logical truth validator enforcing SIMPLICITY axioms, cognitive bloat limits (2500 lines pre-emptive warning,
 * 3000 lines hard limit), and automatic remediation plan generation for domain/core modules. Zero external npm dependencies.
 */

import { BroccoliJoyZoningModuleDecomposer } from "./broccolidb-module-decomposer.js";
import { BroccoliJoyZoningEngine } from "./broccolidb-joy-zoning.js";

export interface AxiomViolation {
  axiom: string;
  severity: "ERROR" | "WARN";
  message: string;
  remediation?: string;
}

export class BroccoliSemanticAxiomEngine {
  private readonly PREEMPTIVE_THRESHOLD = 2500;
  private readonly SIMPLICITY_THRESHOLD = 3000;
  private readonly decomposer: BroccoliJoyZoningModuleDecomposer;
  private readonly joyEngine: BroccoliJoyZoningEngine;

  constructor(joyEngine = new BroccoliJoyZoningEngine()) {
    this.joyEngine = joyEngine;
    this.decomposer = new BroccoliJoyZoningModuleDecomposer(joyEngine);
  }

  /**
   * Validates file content against high-level SIMPLICITY and cognitive bloat axioms.
   */
  public validateAxioms(filePath: string, content: string): AxiomViolation[] {
    const violations: AxiomViolation[] = [];

    // Bypass markers
    if (content.includes("#BYPASS") || content.includes("@sovereign-exception") || content.includes("@dietcode-bypass")) {
      return violations;
    }

    const layer = this.joyEngine.getLayer(filePath);
    if (layer === "domain" || layer === "core") {
      const lineCount = content.split("\n").length;

      if (lineCount > this.PREEMPTIVE_THRESHOLD) {
        const isHardBlock = lineCount > this.SIMPLICITY_THRESHOLD;
        const plan = this.decomposer.analyzeDecomposition(filePath, content);
        const stepsFormatted = plan.steps
          .map((s) => `- [${s.action}] ${s.target} -> ${s.destination}: ${s.reason}`)
          .join("\n");

        violations.push({
          axiom: "SIMPLICITY",
          severity: isHardBlock ? "ERROR" : "WARN",
          message: isHardBlock
            ? `🛑 COGNITIVE BLOAT (LIMIT EXCEEDED): ${layer.toUpperCase()} file exceeds industrial limit (${lineCount}/${this.SIMPLICITY_THRESHOLD} lines).`
            : `⚠️ COGNITIVE BLOAT (PRE-EMPTIVE): ${layer.toUpperCase()} file is approaching limit (${lineCount}/${this.PREEMPTIVE_THRESHOLD} lines).`,
          remediation: `Sunder the module into specialized sub-components. Follow the recommended plan:\n\n${stepsFormatted || "Manual decomposition required."}`,
        });
      }
    }

    return violations;
  }
}
