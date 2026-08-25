/**
 * tool-dependency-graph-planner.ts
 *
 * Tool Dependency Directed Acyclic Graph (DAG) Execution Planner.
 * Analyzes tool call sequences for data dependencies and resource conflicts.
 * Constructs a topological DAG, executes independent nodes in parallel waves,
 * and chains dependent nodes sequentially while resolving argument pipelines.
 */

import type { IToolRegistry, ToolExecutionRecord } from "../../../core/contracts/tooling.contracts.js";

export interface DAGToolNode {
  readonly id: string;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly dependencies: string[]; // Node IDs that must execute before this node
}

export interface DAGExecutionPlan {
  readonly waves: DAGToolNode[][]; // Sequential waves of parallel nodes
  readonly totalNodes: number;
  readonly hasCycles: boolean;
}

export class DAGExecutionResultMap extends Map<string, ToolExecutionRecord> {
  public metrics: { totalDurationMs: number; totalNodes: number; wavesCount: number; speedup: number } = {
    totalDurationMs: 0,
    totalNodes: 0,
    wavesCount: 0,
    speedup: 1.0,
  };
}

export class ToolDependencyGraphPlanner {
  /**
   * Builds an execution DAG and partitions nodes into topological parallel waves.
   */
  public planDAG(nodes: readonly DAGToolNode[]): DAGExecutionPlan {
    const nodeMap = new Map<string, DAGToolNode>();
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>(); // node -> dependents

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      inDegree.set(node.id, node.dependencies.length);
      graph.set(node.id, []);
    }

    for (const node of nodes) {
      for (const depId of node.dependencies) {
        if (!graph.has(depId)) {
          // Dependency doesn't exist, ignore or fail
          inDegree.set(node.id, Math.max(0, (inDegree.get(node.id) || 1) - 1));
          continue;
        }
        graph.get(depId)!.push(node.id);
      }
    }

    const waves: DAGToolNode[][] = [];
    let currentWaveIds = Array.from(inDegree.entries())
      .filter(([_, deg]) => deg === 0)
      .map(([id]) => id);

    let processedCount = 0;

    while (currentWaveIds.length > 0) {
      const currentWaveNodes = currentWaveIds.map((id) => nodeMap.get(id)!);
      waves.push(currentWaveNodes);
      processedCount += currentWaveIds.length;

      const nextWaveIds: string[] = [];

      for (const id of currentWaveIds) {
        const dependents = graph.get(id) || [];
        for (const depId of dependents) {
          const newDeg = (inDegree.get(depId) || 1) - 1;
          inDegree.set(depId, newDeg);
          if (newDeg === 0) {
            nextWaveIds.push(depId);
          }
        }
      }

      currentWaveIds = nextWaveIds;
    }

    const hasCycles = processedCount < nodes.length;

    return {
      waves,
      totalNodes: nodes.length,
      hasCycles,
    };
  }

  /**
   * Resolves argument pipeline placeholders like `$nodeId.result.fieldName`.
   */
  public resolvePipedArgs(
    rawArgs: Record<string, unknown>,
    results: Map<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(rawArgs)) {
      if (typeof value === "string" && value.startsWith("$") && value.includes(".")) {
        // e.g. "$step1.output" or "$step1.path"
        const parts = value.slice(1).split(".");
        const depId = parts[0];
        const propPath = parts.slice(1);

        const depResult = results.get(depId);
        if (depResult !== undefined) {
          let current: unknown = depResult;
          let activeProps = propPath;
          if (
            activeProps.length > 0 &&
            (activeProps[0] === "result" || activeProps[0] === "output") &&
            typeof current === "object" &&
            current !== null &&
            !(activeProps[0] in current)
          ) {
            activeProps = activeProps.slice(1);
          }

          for (const prop of activeProps) {
            if (current && typeof current === "object" && prop in current) {
              current = (current as Record<string, unknown>)[prop];
            } else {
              current = undefined;
              break;
            }
          }
          resolved[key] = current !== undefined ? current : value;
        } else {
          resolved[key] = value;
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Automatically infers DAGToolNode graph with dependencies from a flat array of tool calls.
   */
  public inferDependenciesFromBatch(
    calls: readonly { id?: string; name: string; args: Record<string, unknown> }[],
    cwd: string = process.cwd()
  ): DAGToolNode[] {
    const nodes: DAGToolNode[] = [];
    const resourceWriters = new Map<string, string>(); // resourcePath -> nodeId

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const id = call.id || `node_${i + 1}`;
      const dependencies: string[] = [];

      // 1. Detect explicit pipe dependencies ($nodeId...)
      const serialized = JSON.stringify(call.args);
      const pipeMatches = serialized.match(/\$([a-zA-Z0-9_-]+)\./g);
      if (pipeMatches) {
        for (const m of pipeMatches) {
          const depId = m.slice(1, -1);
          if (!dependencies.includes(depId)) {
            dependencies.push(depId);
          }
        }
      }

      // 2. Detect implicit resource dependencies (read after write)
      const targetPath = typeof call.args.path === "string" ? call.args.path : (typeof call.args.filePath === "string" ? call.args.filePath : undefined);
      if (targetPath) {
        const fullPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const prevWriterId = resourceWriters.get(fullPath);
        if (prevWriterId && prevWriterId !== id && !dependencies.includes(prevWriterId)) {
          dependencies.push(prevWriterId);
        }

        // If this is a writer tool, record as active writer
        if (
          call.name.includes("write") ||
          call.name.includes("replace") ||
          call.name.includes("append") ||
          call.name.includes("patch")
        ) {
          resourceWriters.set(fullPath, id);
        }
      }

      nodes.push({
        id,
        toolName: call.name,
        args: call.args,
        dependencies,
      });
    }

    return nodes;
  }

  /**
   * Executes a DAG of tool calls wave by wave with rich metrics.
   */
  public async executeDAG(
    nodes: readonly DAGToolNode[],
    cwd: string,
    registry: IToolRegistry
  ): Promise<DAGExecutionResultMap> {
    const plan = this.planDAG(nodes);
    if (plan.hasCycles) {
      throw new Error("Cannot execute Tool DAG: cyclic dependency detected.");
    }

    const results = new Map<string, unknown>();
    const records = new DAGExecutionResultMap();
    const dagStartTime = Date.now();
    let sequentialEstimatedMs = 0;

    for (const wave of plan.waves) {
      const wavePromises = wave.map(async (node) => {
        const start = Date.now();
        const resolvedArgs = this.resolvePipedArgs(node.args, results);
        try {
          const res = await registry.executeTool(node.toolName, resolvedArgs, cwd);
          const durationMs = Date.now() - start;
          sequentialEstimatedMs += durationMs;
          results.set(node.id, res);
          records.set(node.id, {
            name: node.toolName,
            toolName: node.toolName,
            callId: node.id,
            args: resolvedArgs,
            output: res,
            result: res,
            success: true,
            durationMs,
          });
        } catch (err) {
          const durationMs = Date.now() - start;
          sequentialEstimatedMs += durationMs;
          const errMsg = err instanceof Error ? err.message : String(err);
          records.set(node.id, {
            name: node.toolName,
            toolName: node.toolName,
            callId: node.id,
            args: resolvedArgs,
            output: null,
            error: errMsg,
            success: false,
            durationMs,
          });
          throw err;
        }
      });

      await Promise.all(wavePromises);
    }

    const totalDurationMs = Date.now() - dagStartTime;
    const speedup = totalDurationMs > 0 ? Number((sequentialEstimatedMs / totalDurationMs).toFixed(2)) : 1.0;

    records.metrics = {
      totalDurationMs,
      totalNodes: nodes.length,
      wavesCount: plan.waves.length,
      speedup: Math.max(1.0, speedup),
    };

    return records;
  }
}


