/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 158: Zero-Dependency Broccoli Structural Discovery Service
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/StructuralDiscoveryService.ts).
 * Analyzes workspace file dependency graphs, calculates node blast radius, centrality scores, and critical dependent sets
 * with incremental inverse graph indexing. Zero external npm dependencies.
 */

import * as path from "node:path";

export interface StructuralBlastRadius {
  targetPath: string;
  affectedNodes: string[];
  centralityScore: number;
  criticalDependents: string[];
}

export class BroccoliStructuralDiscoveryService {
  private readonly workspaceRoot: string;
  private readonly forwardGraph = new Map<string, Set<string>>();
  private readonly inverseGraph = new Map<string, Set<string>>();

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Registers a dependency edge from source module to imported target.
   */
  public addDependency(sourcePath: string, importedPath: string): void {
    const srcNorm = path.normalize(sourcePath);
    const impNorm = path.normalize(importedPath);

    if (!this.forwardGraph.has(srcNorm)) {
      this.forwardGraph.set(srcNorm, new Set());
    }
    this.forwardGraph.get(srcNorm)!.add(impNorm);

    if (!this.inverseGraph.has(impNorm)) {
      this.inverseGraph.set(impNorm, new Set());
    }
    this.inverseGraph.get(impNorm)!.add(srcNorm);
  }

  /**
   * Calculates the structural blast radius for a given target file.
   */
  public getBlastRadius(filePath: string): StructuralBlastRadius {
    const normPath = path.normalize(filePath);
    const affectedNodes = new Set<string>();
    const queue: string[] = [normPath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.inverseGraph.get(current);

      if (dependents) {
        for (const dep of dependents) {
          if (!affectedNodes.has(dep)) {
            affectedNodes.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    const totalNodes = Math.max(1, this.forwardGraph.size + this.inverseGraph.size);
    const centralityScore = Number((affectedNodes.size / totalNodes).toFixed(4));
    const criticalDependents = Array.from(affectedNodes).slice(0, 10);

    return {
      targetPath: normPath,
      affectedNodes: Array.from(affectedNodes),
      centralityScore,
      criticalDependents,
    };
  }

  /**
   * Clears in-memory dependency graphs.
   */
  public clear(): void {
    this.forwardGraph.clear();
    this.inverseGraph.clear();
  }
}
