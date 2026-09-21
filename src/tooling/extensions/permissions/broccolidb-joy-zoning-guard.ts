/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 164: Zero-Dependency Broccoli Joy-Zoning Guard
 *
 * Lifted from external source workspace/codemarie-new/src/utils/joy-zoning.ts.
 * Enforces single-direction architectural layer boundary rules, preventing illegal imports (e.g. Domain importing Infrastructure or Core importing UI)
 * to guarantee strict clean-architecture layer isolation. Zero external npm dependencies.
 */

import { BroccoliJoyZoningEngine, type JoyLayer } from "./broccolidb-joy-zoning.js";

export interface BoundaryViolation {
  sourceFile: string;
  sourceLayer: JoyLayer;
  importedFile: string;
  targetLayer: JoyLayer;
  reason: string;
}

export interface BoundaryValidationResult {
  valid: boolean;
  violations: BoundaryViolation[];
}

export class BroccoliJoyZoningGuard {
  private readonly engine: BroccoliJoyZoningEngine;
  private readonly LAYER_TIER: Record<JoyLayer, number> = {
    domain: 0,
    core: 1,
    infrastructure: 2,
    plumbing: 2,
    ui: 3,
  };

  constructor(engine = new BroccoliJoyZoningEngine()) {
    this.engine = engine;
  }

  /**
   * Validates dependency imports between source file and target imported file.
   */
  public validateLayerBoundary(sourceFile: string, importedFile: string, sourceContent?: string): BoundaryValidationResult {
    const sourceLayer = this.engine.getLayer(sourceFile, sourceContent);
    const targetLayer = this.engine.getLayer(importedFile);
    const violations: BoundaryViolation[] = [];

    const sourceTier = this.LAYER_TIER[sourceLayer];
    const targetTier = this.LAYER_TIER[targetLayer];

    // Rule 1: Pure Domain Layer cannot import Core, Infrastructure, or UI
    if (sourceLayer === "domain" && targetLayer !== "domain" && targetLayer !== "plumbing") {
      violations.push({
        sourceFile,
        sourceLayer,
        importedFile,
        targetLayer,
        reason: `Illegal Domain Boundary Leak: Pure domain file cannot import ${targetLayer.toUpperCase()} layer.`,
      });
    }

    // Rule 2: Single-direction tier flow (Lower tier cannot depend on higher tier unless plumbing)
    if (sourceTier < targetTier && targetLayer !== "plumbing") {
      violations.push({
        sourceFile,
        sourceLayer,
        importedFile,
        targetLayer,
        reason: `Architectural Misalignment: ${sourceLayer.toUpperCase()} tier (${sourceTier}) depends on higher ${targetLayer.toUpperCase()} tier (${targetTier}).`,
      });
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}
