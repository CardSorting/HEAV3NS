/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 131: Zero-Dependency Broccoli Blast Radius Calculator
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/StructuralDiscoveryService.ts).
 * Calculates file edit blast radius, inverse dependency graph traversal, centrality scores,
 * and critical dependent lists without external parsing libraries. Zero external npm dependencies.
 */

import * as path from "node:path";
import { BroccoliStructuralDiscoveryService } from "../../../tooling/extensions/perception/broccolidb-structural-discovery.js";

export interface BlastRadiusResult {
  targetFile: string;
  affectedNodes: string[];
  centralityScore: number;
  criticalDependents: string[];
  dependencyDepth: number;
}

export interface FileDependencyNode {
  filePath: string;
  imports: string[];
}

export class BroccoliBlastRadiusCalculator {
  private readonly workspaceRoot: string;
  readonly structuralDiscovery: BroccoliStructuralDiscoveryService;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.structuralDiscovery = new BroccoliStructuralDiscoveryService(workspaceRoot);
  }

  /**
   * Normalizes relative file paths against workspace root.
   */
  private normalize(fp: string): string {
    return path.isAbsolute(fp) ? path.relative(this.workspaceRoot, fp) : fp;
  }

  /**
   * Calculates inverse dependency blast radius for a target file across a file dependency graph.
   */
  public calculateBlastRadius(targetFilePath: string, graphNodes: FileDependencyNode[]): BlastRadiusResult {
    const normTarget = this.normalize(targetFilePath);

    // Build inverse adjacency map (importedFile -> dependentFiles[])
    const inverseGraph = new Map<string, Set<string>>();
    const allFiles = new Set<string>();

    for (const node of graphNodes) {
      const normSrc = this.normalize(node.filePath);
      allFiles.add(normSrc);

      for (const imp of node.imports) {
        const normImp = this.normalize(imp);
        const existing = inverseGraph.get(normImp) ?? new Set();
        existing.add(normSrc);
        inverseGraph.set(normImp, existing);
      }
    }

    const affectedSet = new Set<string>();
    const queue: Array<{ file: string; depth: number }> = [{ file: normTarget, depth: 0 }];
    let maxDepth = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.file !== normTarget) {
        affectedSet.add(current.file);
      }

      maxDepth = Math.max(maxDepth, current.depth);
      const dependents = inverseGraph.get(current.file);

      if (dependents) {
        for (const dep of dependents) {
          if (!affectedSet.has(dep) && dep !== normTarget) {
            queue.push({ file: dep, depth: current.depth + 1 });
          }
        }
      }
    }

    const affectedNodes = Array.from(affectedSet);
    const totalCount = allFiles.size || 1;
    const centralityScore = Math.round((affectedNodes.length / totalCount) * 100) / 100;

    const criticalDependents = affectedNodes.filter((f) => {
      const depCount = inverseGraph.get(f)?.size ?? 0;
      return depCount >= 3 || f.includes("index.") || f.includes("factory");
    });

    return {
      targetFile: normTarget,
      affectedNodes,
      centralityScore,
      criticalDependents,
      dependencyDepth: maxDepth,
    };
  }
}
