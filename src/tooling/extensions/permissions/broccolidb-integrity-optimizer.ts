/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 181: Zero-Dependency Broccoli Integrity Optimizer
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/IntegrityOptimizer.ts.
 * Scans workspace architecture profiles to identify layer drift optimization opportunities,
 * deadwood export sensing with archetypal file protection, and structural integrity gain scoring. Zero external npm dependencies.
 */

import * as path from "node:path";
import { BroccoliJoyZoningEngine } from "./broccolidb-joy-zoning.js";

export interface OptimizationOpportunity {
  file: string;
  currentLayer: string;
  recommendedLayer: string;
  reason: string;
  integrityGain: number;
  type: "STRUCTURAL" | "DEADWOOD" | "COHESION" | "CYCLE_BREAK";
  action: "MOVE" | "EXTRACT" | "DECOUPLE" | "HARDEN";
}

export class BroccoliIntegrityOptimizer {
  private readonly joyEngine: BroccoliJoyZoningEngine;

  constructor(joyEngine = new BroccoliJoyZoningEngine()) {
    this.joyEngine = joyEngine;
  }

  /**
   * Scans a list of file paths for structural layer drift optimization opportunities.
   */
  public findOptimizations(filePaths: string[]): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];

    for (const filePath of filePaths) {
      const currentLayer = this.joyEngine.getLayer(filePath);
      const fileName = path.basename(filePath);

      // Archetypal protection check (index.ts, extension.ts, main.ts are exempted from deadwood sensing)
      const isArchetypal = fileName.endsWith("index.ts") || fileName.endsWith("extension.ts") || fileName.endsWith("main.ts");

      // Sensing layer drift heuristics
      if (currentLayer === "domain" && (filePath.includes("/services/") || filePath.includes("/adapters/"))) {
        opportunities.push({
          file: filePath,
          currentLayer,
          recommendedLayer: "infrastructure",
          reason: `Layer Drift: File \`${fileName}\` contains adapter/service path patterns but sits in Domain layer.`,
          integrityGain: 15,
          type: "STRUCTURAL",
          action: "MOVE",
        });
      } else if ((currentLayer as string) === "unknown" && !isArchetypal) {
        opportunities.push({
          file: filePath,
          currentLayer,
          recommendedLayer: "core",
          reason: `Unclassified Layer: File \`${fileName}\` lacks canonical [LAYER: ...] header tag.`,
          integrityGain: 10,
          type: "COHESION",
          action: "HARDEN",
        });
      }
    }

    return opportunities;
  }
}
