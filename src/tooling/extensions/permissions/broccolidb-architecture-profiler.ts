/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 166: Zero-Dependency Broccoli Workspace Architecture Profiler
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/WorkspaceArchitectureProfile.ts.
 * Detects workspace architectural mode (joy-zoning vs workspace-native vs greenfield), calculates canonical layer tag compliance scores,
 * and enforces Joy-Zoning steering thresholds (maxFunctionLines, maxClassMethods). Zero external npm dependencies.
 */

import { BroccoliJoyZoningEngine, type JoyLayer } from "./broccolidb-joy-zoning.js";
import { BroccoliIntegrityOptimizer } from "./broccolidb-integrity-optimizer.js";

export type WorkspaceArchitectureMode = "greenfield" | "joy-zoning" | "workspace-native";

export interface JoyZoningSteeringThresholds {
  maxFunctionLines: number;
  minBoundaryLines: number;
  maxClassMethods: number;
}

export interface WorkspaceArchitectureProfileResult {
  mode: WorkspaceArchitectureMode;
  tagComplianceScore: number; // 0 to 100
  layerDistribution: Record<JoyLayer, number>;
  steeringThresholds: JoyZoningSteeringThresholds;
  reason: string;
}

export const DEFAULT_JOY_ZONING_STEERING_THRESHOLDS: JoyZoningSteeringThresholds = {
  maxFunctionLines: 80,
  minBoundaryLines: 200,
  maxClassMethods: 15,
};

export class BroccoliWorkspaceArchitectureProfiler {
  private readonly joyEngine: BroccoliJoyZoningEngine;
  readonly optimizer: BroccoliIntegrityOptimizer;

  constructor(joyEngine = new BroccoliJoyZoningEngine()) {
    this.joyEngine = joyEngine;
    this.optimizer = new BroccoliIntegrityOptimizer(joyEngine);
  }

  /**
   * Evaluates a collection of workspace files and calculates Joy-Zoning architecture profile.
   */
  public detectProfile(files: { path: string; content?: string }[]): WorkspaceArchitectureProfileResult {
    const distribution: Record<JoyLayer, number> = {
      domain: 0,
      core: 0,
      infrastructure: 0,
      plumbing: 0,
      ui: 0,
    };

    let taggedFileCount = 0;
    const totalFiles = Math.max(1, files.length);

    for (const f of files) {
      const layer = this.joyEngine.getLayer(f.path, f.content);
      distribution[layer]++;

      if (f.content && this.joyEngine.parseLayerTag(f.content)) {
        taggedFileCount++;
      }
    }

    const tagComplianceScore = Math.round((taggedFileCount / totalFiles) * 100);
    let mode: WorkspaceArchitectureMode = "greenfield";
    let reason = "";

    if (tagComplianceScore >= 30) {
      mode = "joy-zoning";
      reason = `Joy-Zoning active with ${tagComplianceScore}% header tag compliance across ${totalFiles} files.`;
    } else if (distribution.domain > 0 || distribution.core > 0) {
      mode = "workspace-native";
      reason = "Workspace exhibits structured layer boundaries without explicit Joy-Zoning tags.";
    } else {
      mode = "greenfield";
      reason = "Greenfield codebase without explicit architectural layer distribution.";
    }

    return {
      mode,
      tagComplianceScore,
      layerDistribution: distribution,
      steeringThresholds: DEFAULT_JOY_ZONING_STEERING_THRESHOLDS,
      reason,
    };
  }
}
