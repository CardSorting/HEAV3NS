/**
 * dependency-matrix-generator.ts
 *
 * Codebase Dependency Matrix & Topological Order Generator.
 * Parses relative imports across files, builds directed dependency graphs,
 * detects circular dependency cycles, and computes optimal compilation/test order.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface DependencyMatrixReport {
  readonly totalFiles: number;
  readonly dependencies: Record<string, string[]>;
  readonly circularCycles: string[][];
  readonly topologicalOrder: string[];
}

export class DependencyMatrixGenerator {
  private readonly ignoredDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".gemini", "scratch"]);

  /**
   * Generates a complete dependency matrix for workspace files.
   */
  public async generateMatrix(rootDir: string, subpath = ""): Promise<DependencyMatrixReport> {
    const targetDir = subpath ? (path.isAbsolute(subpath) ? subpath : path.resolve(rootDir, subpath)) : rootDir;
    const files = await this.collectFiles(targetDir);

    const graph: Record<string, string[]> = {};
    const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;

    for (const fullPath of files) {
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      graph[relPath] = [];

      try {
        const content = await fs.readFile(fullPath, "utf-8");
        let match: RegExpExecArray | null;

        while ((match = importRegex.exec(content)) !== null) {
          const specifier = match[1];
          if (specifier.startsWith("./") || specifier.startsWith("../")) {
            const dir = path.dirname(fullPath);
            const resolved = path.resolve(dir, specifier).replace(/\\/g, "/");
            const relResolved = path.relative(rootDir, resolved).replace(/\\/g, "/");

            // Normalize with extension if found in files
            const matchedFile = files
              .map((f) => path.relative(rootDir, f).replace(/\\/g, "/"))
              .find((f) => f === relResolved || f.replace(/\.(ts|js|tsx|jsx)$/, "") === relResolved.replace(/\.(ts|js|tsx|jsx)$/, ""));

            if (matchedFile && !graph[relPath].includes(matchedFile) && matchedFile !== relPath) {
              graph[relPath].push(matchedFile);
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Detect cycles using Tarjan/DFS
    const circularCycles = this.findCycles(graph);

    // Compute topological order (Kahn's algorithm)
    const topologicalOrder = this.computeTopologicalOrder(graph);

    return {
      totalFiles: Object.keys(graph).length,
      dependencies: graph,
      circularCycles,
      topologicalOrder,
    };
  }

  private findCycles(graph: Record<string, string[]>): string[][] {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, pathNodes: string[]) => {
      visited.add(node);
      recStack.add(node);
      pathNodes.push(node);

      for (const neighbor of graph[node] || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...pathNodes]);
        } else if (recStack.has(neighbor)) {
          const cycleStart = pathNodes.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...pathNodes.slice(cycleStart), neighbor]);
          }
        }
      }

      recStack.delete(node);
    };

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  private computeTopologicalOrder(graph: Record<string, string[]>): string[] {
    const inDegree: Record<string, number> = {};
    for (const node of Object.keys(graph)) {
      inDegree[node] = 0;
    }

    for (const node of Object.keys(graph)) {
      for (const neighbor of graph[node] || []) {
        inDegree[neighbor] = (inDegree[neighbor] || 0) + 1;
      }
    }

    const queue: string[] = [];
    for (const [node, deg] of Object.entries(inDegree)) {
      if (deg === 0) queue.push(node);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);

      for (const neighbor of graph[node] || []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Add any remaining nodes
    for (const node of Object.keys(graph)) {
      if (!order.includes(node)) {
        order.push(node);
      }
    }

    return order;
  }

  private async collectFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    const supported = new Set([".ts", ".tsx", ".js", ".jsx"]);

    const walk = async (current: string) => {
      let entries: any[] = [];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (this.ignoredDirs.has(entry.name) || entry.name.startsWith(".")) continue;

        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (supported.has(ext)) {
            results.push(full);
          }
        }
      }
    };

    await walk(dir);
    return results;
  }
}
