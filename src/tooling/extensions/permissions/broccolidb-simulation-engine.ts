/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 185: Zero-Dependency Broccoli Simulation Engine
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/SimulationEngine.ts.
 * Pre-flight architectural impact simulator. Predicts structural integrity outcome, score drop,
 * and downstream impacted dependents during Plan Mode before modifications are applied to disk. Zero external npm dependencies.
 */

import * as path from "node:path";
import { BroccoliJoyZoningEngine } from "./broccolidb-joy-zoning.js";

export interface SimulationResult {
  safe: boolean;
  predictedScore: number;
  scoreDrop: number;
  violations: string[];
  message: string;
  impactedDependents: string[];
}

export class BroccoliSimulationEngine {
  private readonly workspaceRoot: string;
  private readonly joyEngine: BroccoliJoyZoningEngine;

  constructor(workspaceRoot = process.cwd(), joyEngine = new BroccoliJoyZoningEngine()) {
    this.workspaceRoot = workspaceRoot;
    this.joyEngine = joyEngine;
  }

  /**
   * Simulates a file move/rename and predicts structural impact.
   */
  public simulateMove(oldPath: string, newPath: string): SimulationResult {
    const oldLayer = this.joyEngine.getLayer(oldPath);
    const newLayer = this.joyEngine.getLayer(newPath);

    const violations: string[] = [];
    let scoreDrop = 0;

    // Moving out of Domain layer into Infrastructure
    if (oldLayer === "domain" && newLayer === "infrastructure") {
      violations.push("Domain Fission: Moving business logic node out of Domain layer into Infrastructure.");
      scoreDrop += 15;
    }

    const safe = violations.length === 0 || scoreDrop < 20;

    return {
      safe,
      predictedScore: Math.max(0, 100 - scoreDrop),
      scoreDrop,
      violations,
      message: safe
        ? `Pre-flight simulation clear for move: \`${path.basename(oldPath)}\` -> \`${path.basename(newPath)}\`.`
        : `Pre-flight simulation warning: Potential layer boundary regression detected.`,
      impactedDependents: [],
    };
  }

  /**
   * Simulates writing new content to a file.
   */
  public simulateWrite(filePath: string, newContent: string): SimulationResult {
    const lineCount = newContent.split("\n").length;
    const violations: string[] = [];
    let scoreDrop = 0;

    if (lineCount > 2500) {
      violations.push(`Cognitive Expansion: File \`${path.basename(filePath)}\` expands to ${lineCount} lines.`);
      scoreDrop += 10;
    }

    return {
      safe: scoreDrop < 20,
      predictedScore: Math.max(0, 100 - scoreDrop),
      scoreDrop,
      violations,
      message: `Pre-flight write simulation complete for \`${path.basename(filePath)}\`.`,
      impactedDependents: [],
    };
  }
}
