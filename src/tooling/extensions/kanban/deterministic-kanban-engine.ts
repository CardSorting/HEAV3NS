/**
 * deterministic-kanban-engine.ts
 *
 * High-performance zero-GC in-memory Task DAG dependency resolver, cycle detector,
 * and state-machine transition validator for the Kanban Subsystem (Phase 81 / ADR-033).
 */

import type {
  KanbanColumn,
  KanbanPriority,
  KanbanTask,
} from "../../../core/contracts/kanban.contracts.js";

export class DeterministicKanbanEngine {
  private static readonly PRIORITY_WEIGHTS: Record<KanbanPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  private static readonly ALLOWED_TRANSITIONS: Record<KanbanColumn, readonly KanbanColumn[]> = {
    backlog: ["todo", "archived"],
    todo: ["in_progress", "backlog", "archived"],
    in_progress: ["review", "todo", "archived"],
    review: ["done", "in_progress", "archived"],
    done: ["archived", "review"],
    archived: ["backlog", "todo"],
  };

  constructor() {}

  /**
   * Validates whether a state machine transition between two columns is legal.
   */
  isValidTransition(fromColumn: KanbanColumn, toColumn: KanbanColumn): boolean {
    if (fromColumn === toColumn) return true;
    const allowed = DeterministicKanbanEngine.ALLOWED_TRANSITIONS[fromColumn];
    return allowed ? allowed.includes(toColumn) : false;
  }

  /**
   * Returns priority numerical weight for deterministic sorting.
   */
  getPriorityWeight(priority: KanbanPriority): number {
    return DeterministicKanbanEngine.PRIORITY_WEIGHTS[priority] ?? 1;
  }

  /**
   * Checks if a task is currently unblocked given the current set of all tasks.
   * A task is unblocked if all tasks in its blockedBy list are in 'done' or 'archived' status.
   */
  isTaskUnblocked(task: KanbanTask, allTasks: readonly KanbanTask[]): boolean {
    if (!task.blockedBy || task.blockedBy.length === 0) {
      return true;
    }

    const taskMap = new Map<string, KanbanTask>();
    for (let i = 0; i < allTasks.length; i++) {
      taskMap.set(allTasks[i].id, allTasks[i]);
    }

    for (let i = 0; i < task.blockedBy.length; i++) {
      const blockerId = task.blockedBy[i];
      const blocker = taskMap.get(blockerId);
      if (!blocker) {
        // Missing blocker is considered non-blocking or resolved
        continue;
      }
      if (blocker.column !== "done" && blocker.column !== "archived") {
        return false;
      }
    }

    return true;
  }

  /**
   * Detects whether adding/updating a dependency would create a cycle in the task DAG.
   */
  hasDependencyCycle(taskId: string, proposedBlockers: readonly string[], allTasks: readonly KanbanTask[]): boolean {
    const adjList = new Map<string, string[]>();

    for (let i = 0; i < allTasks.length; i++) {
      const t = allTasks[i];
      if (t.id === taskId) {
        adjList.set(t.id, [...proposedBlockers]);
      } else {
        adjList.set(t.id, [...t.blockedBy]);
      }
    }

    if (!adjList.has(taskId)) {
      adjList.set(taskId, [...proposedBlockers]);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = adjList.get(node) ?? [];
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i];
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(node);
      return false;
    };

    const keys = Array.from(adjList.keys());
    for (let i = 0; i < keys.length; i++) {
      const node = keys[i];
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  /**
   * Performs topological sort on a list of tasks respecting dependencies.
   */
  topologicalSort(tasks: readonly KanbanTask[]): KanbanTask[] {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();
    const taskMap = new Map<string, KanbanTask>();

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      taskMap.set(t.id, t);
      inDegree.set(t.id, 0);
      graph.set(t.id, []);
    }

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      for (let j = 0; j < t.blockedBy.length; j++) {
        const blockerId = t.blockedBy[j];
        if (taskMap.has(blockerId)) {
          const edges = graph.get(blockerId) ?? [];
          edges.push(t.id);
          graph.set(blockerId, edges);
          inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    // Sort queue by priority initially
    queue.sort((a, b) => {
      const taskA = taskMap.get(a)!;
      const taskB = taskMap.get(b)!;
      return this.getPriorityWeight(taskB.priority) - this.getPriorityWeight(taskA.priority);
    });

    const result: KanbanTask[] = [];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      result.push(taskMap.get(currId)!);

      const neighbors = graph.get(currId) ?? [];
      for (let i = 0; i < neighbors.length; i++) {
        const neighbor = neighbors[i];
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }
}
