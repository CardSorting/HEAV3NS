/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 167: Zero-Dependency Broccoli Joy-Zoning Module Decomposer
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/ModuleDecomposer.ts.
 * Analyzes complex monolithic modules and provides step-by-step Joy-Zoning refactoring recommendations
 * (EXTRACT, MOVE, DECOUPLE, HARDEN), calculating structural integrity scores (0-100) and logic island boundaries. Zero external npm dependencies.
 */

import * as path from "node:path";
import { BroccoliJoyZoningEngine, type JoyLayer } from "./broccolidb-joy-zoning.js";

export type DecompositionAction = "EXTRACT" | "MOVE" | "DECOUPLE" | "HARDEN";

export interface DecompositionStep {
  action: DecompositionAction;
  target: string;
  destination: string;
  reason: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
}

export interface DecompositionPlan {
  filePath: string;
  currentLayer: JoyLayer;
  integrityScore: number; // 0-100
  projectedIntegrityScore: number;
  steps: DecompositionStep[];
}

export class BroccoliJoyZoningModuleDecomposer {
  private readonly joyEngine: BroccoliJoyZoningEngine;

  constructor(joyEngine = new BroccoliJoyZoningEngine()) {
    this.joyEngine = joyEngine;
  }

  /**
   * Analyzes a file's content and returns a structured Joy-Zoning decomposition plan.
   */
  public analyzeDecomposition(filePath: string, content: string): DecompositionPlan {
    const currentLayer = this.joyEngine.getLayer(filePath, content);
    const lines = content.split("\n");
    const totalLines = lines.length;
    const steps: DecompositionStep[] = [];

    let integrityScore = 100;

    // Check line threshold
    if (totalLines > 300) {
      integrityScore -= 20;
      steps.push({
        action: "EXTRACT",
        target: "Monolithic Function Blocks",
        destination: path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}-extracted.ts`),
        reason: `File length (${totalLines} lines) exceeds Joy-Zoning 300-line recommended boundary.`,
        risk: "MEDIUM",
      });
    }

    // Check layer tag missing
    const hasTag = this.joyEngine.parseLayerTag(content);
    if (!hasTag) {
      integrityScore -= 15;
      steps.push({
        action: "HARDEN",
        target: "Header Layer Tag",
        destination: filePath,
        reason: `Missing explicit [LAYER: ${currentLayer.toUpperCase()}] header tag.`,
        risk: "LOW",
      });
    }

    // Check I/O leaks in domain files
    if (currentLayer === "domain") {
      const hasFS = /import\s+.*from\s+["'](node:)?fs/i.test(content);
      const hasHTTP = /import\s+.*from\s+["'](node:)?http/i.test(content);

      if (hasFS || hasHTTP) {
        integrityScore -= 30;
        steps.push({
          action: "DECOUPLE",
          target: "I/O Imports",
          destination: "src/tooling/extensions/adapters/",
          reason: "Domain layer file contains direct I/O adapter imports violating clean architecture.",
          risk: "HIGH",
        });
      }
    }

    const finalScore = Math.max(0, integrityScore);
    const projectedIntegrityScore = Math.min(100, finalScore + (steps.length > 0 ? 30 : 0));

    return {
      filePath,
      currentLayer,
      integrityScore: finalScore,
      projectedIntegrityScore,
      steps,
    };
  }
}
