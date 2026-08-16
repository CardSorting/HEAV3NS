/**
 * deterministic-kanban-engine.ts
 *
 * Deterministic rules engine for Kanban column state transitions, DAG cycle detection,
 * Natural Query DSL parsing, Unblock Loop Breaking, and Auto-Progression (ADR-118).
 */

import type {
  KanbanColumn,
  KanbanPriority,
  KanbanQueryFilter,
  KanbanStageCategory,
  KanbanTask,
} from "../../../core/contracts/kanban.contracts.js";

export class DeterministicKanbanEngine {
  /**
   * Defines allowable state transitions across the 9-state lifecycle.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<KanbanColumn, readonly KanbanColumn[]> = {
    triage: ["backlog", "todo", "ready", "blocked", "canceled", "archived"],
    backlog: ["triage", "todo", "ready", "in_progress", "blocked", "canceled", "archived"],
    todo: ["backlog", "ready", "in_progress", "blocked", "canceled", "archived"],
    ready: ["todo", "in_progress", "blocked", "canceled", "archived"],
    in_progress: ["todo", "ready", "blocked", "review", "done", "canceled"],
    blocked: ["triage", "todo", "ready", "in_progress", "canceled", "archived"],
    review: ["in_progress", "ready", "done", "blocked", "canceled"],
    done: ["ready", "in_progress", "review", "archived"],
    canceled: ["triage", "backlog", "todo", "archived"],
    archived: ["backlog", "todo"],
  };

  /**
   * Validates if a column transition is allowed by the state machine.
   */
  public isValidTransition(from: KanbanColumn, to: KanbanColumn): boolean {
    if (from === to) return true;
    const allowed = DeterministicKanbanEngine.ALLOWED_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * Topologically sorts tasks by their dependency DAG order.
   */
  public topologicalSort(tasks: readonly KanbanTask[]): readonly KanbanTask[] {
    const taskMap = new Map<string, KanbanTask>();
    for (const t of tasks) {
      taskMap.set(t.id, t);
    }

    const visited = new Set<string>();
    const result: KanbanTask[] = [];

    const visit = (task: KanbanTask) => {
      if (visited.has(task.id)) return;
      for (const blockerId of task.blockedBy) {
        const blocker = taskMap.get(blockerId);
        if (blocker) {
          visit(blocker);
        }
      }
      visited.add(task.id);
      result.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return result;
  }

  /**
   * Detects if adding or mutating dependencies creates a circular dependency DAG.
   */
  public hasDependencyCycle(
    taskId: string,
    proposedBlockedBy: readonly string[],
    allTasks: readonly KanbanTask[]
  ): boolean {
    const taskMap = new Map<string, readonly string[]>();
    for (const t of allTasks) {
      taskMap.set(t.id, t.blockedBy);
    }
    taskMap.set(taskId, proposedBlockedBy);

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (curr: string): boolean => {
      visited.add(curr);
      recStack.add(curr);

      const neighbors = taskMap.get(curr) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (checkCycle(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(curr);
      return false;
    };

    return checkCycle(taskId);
  }

  /**
   * Checks if all dependencies for a given task have transitioned to 'done'.
   */
  public isTaskUnblocked(task: KanbanTask, allTasks: readonly KanbanTask[]): boolean {
    if (!task.blockedBy || task.blockedBy.length === 0) return true;

    for (const blockerId of task.blockedBy) {
      const blocker = allTasks.find((t) => t.id === blockerId);
      if (!blocker || blocker.column !== "done") {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns the unresolved blockers for a task.
   */
  public getEffectiveBlockers(task: KanbanTask, allTasks: readonly KanbanTask[]): readonly KanbanTask[] {
    if (!task.blockedBy || task.blockedBy.length === 0) return [];
    return allTasks.filter((t) => task.blockedBy.includes(t.id) && t.column !== "done");
  }

  /**
   * Automatically promotes unblocked 'todo' or dependency-blocked tasks to 'ready'.
   */
  public recomputeReady(tasks: readonly KanbanTask[]): {
    promotedTaskIds: string[];
    updatedTasks: KanbanTask[];
  } {
    const promotedTaskIds: string[] = [];
    const updatedTasks: KanbanTask[] = [];

    for (const task of tasks) {
      if (
        (task.column === "todo" || (task.column === "blocked" && task.blockKind === "dependency")) &&
        this.isTaskUnblocked(task, tasks)
      ) {
        promotedTaskIds.push(task.id);
        updatedTasks.push({
          ...task,
          column: "ready",
          blockKind: undefined,
          blockReason: undefined,
          updatedAtMs: Date.now(),
        });
      } else {
        updatedTasks.push(task);
      }
    }

    return { promotedTaskIds, updatedTasks };
  }

  /**
   * Natural Query DSL Parser (Linear/GitHub Projects-style syntax).
   * E.g. `is:open is:blocked priority:urgent assignee:agent-1 tag:bug auth migration`
   */
  public parseQuery(dsl: string): KanbanQueryFilter {
    if (!dsl || dsl.trim().length === 0) {
      return {};
    }

    const tokens = dsl.trim().split(/\s+/);
    let column: KanbanColumn | undefined;
    let priority: KanbanPriority | undefined;
    let assignee: string | undefined;
    let tag: string | undefined;
    let isBlocked: boolean | undefined;
    let isReady: boolean | undefined;
    let goalMode: boolean | undefined;
    let category: KanbanStageCategory | undefined;
    const searchTerms: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();

      if (lower.startsWith("is:")) {
        const val = lower.slice(3);
        if (val === "open") {
          // Open matches triage, backlog, todo, ready, in_progress, blocked, review
          category = undefined;
        } else if (val === "closed" || val === "done") {
          column = "done";
        } else if (val === "blocked") {
          isBlocked = true;
        } else if (val === "ready") {
          isReady = true;
        } else if (val === "unassigned") {
          assignee = "";
        }
      } else if (lower.startsWith("status:") || lower.startsWith("col:") || lower.startsWith("column:")) {
        const val = lower.split(":")[1] as KanbanColumn;
        column = val;
      } else if (lower.startsWith("priority:") || lower.startsWith("p:")) {
        const val = lower.split(":")[1] as KanbanPriority;
        priority = val;
      } else if (lower.startsWith("assignee:") || lower.startsWith("assigned:")) {
        assignee = token.split(":")[1];
      } else if (lower.startsWith("tag:") || lower.startsWith("label:")) {
        tag = token.split(":")[1];
      } else if (lower.startsWith("goal:")) {
        goalMode = lower.slice(5) === "true";
      } else if (lower.startsWith("category:") || lower.startsWith("cat:")) {
        category = lower.split(":")[1] as KanbanStageCategory;
      } else {
        searchTerms.push(token);
      }
    }

    return {
      query: dsl,
      column,
      category,
      priority,
      assignee,
      tag,
      isBlocked,
      isReady,
      goalMode,
      searchTerm: searchTerms.join(" ").trim() || undefined,
    };
  }

  /**
   * Evaluates if a task satisfies the structured and/or natural query filter.
   */
  public matchesFilter(
    task: KanbanTask,
    filter: KanbanQueryFilter,
    allTasks: readonly KanbanTask[] = []
  ): boolean {
    // If a raw natural query string is present, merge its parsed filter
    let effectiveFilter = filter;
    if (filter.query) {
      const parsed = this.parseQuery(filter.query);
      effectiveFilter = { ...parsed, ...filter };
    }

    // Category filter
    if (effectiveFilter.category) {
      const cat = this.mapColumnToCategory(task.column);
      if (cat !== effectiveFilter.category) return false;
    }

    // Column / Status filter
    if (effectiveFilter.column && task.column !== effectiveFilter.column) {
      return false;
    }

    // Priority filter
    if (effectiveFilter.priority && task.priority !== effectiveFilter.priority) {
      return false;
    }

    // Assignee filter
    if (effectiveFilter.assignee !== undefined) {
      if (effectiveFilter.assignee === "" && task.assignee) {
        return false;
      }
      if (effectiveFilter.assignee && task.assignee !== effectiveFilter.assignee) {
        return false;
      }
    }

    // Tag filter
    if (effectiveFilter.tag) {
      const tagLower = effectiveFilter.tag.toLowerCase();
      if (!task.tags.some((t) => t.toLowerCase() === tagLower)) {
        return false;
      }
    }

    // Blocked filter
    if (effectiveFilter.isBlocked !== undefined) {
      const isActuallyBlocked = task.column === "blocked" || !this.isTaskUnblocked(task, allTasks);
      if (effectiveFilter.isBlocked !== isActuallyBlocked) {
        return false;
      }
    }

    // Ready filter
    if (effectiveFilter.isReady !== undefined) {
      const isActuallyReady = task.column === "ready" || (task.column === "todo" && this.isTaskUnblocked(task, allTasks));
      if (effectiveFilter.isReady !== isActuallyReady) {
        return false;
      }
    }

    // GoalMode filter
    if (effectiveFilter.goalMode !== undefined) {
      if (Boolean(task.goalMode) !== effectiveFilter.goalMode) {
        return false;
      }
    }

    // Search term filter (substring across title, description, tags)
    if (effectiveFilter.searchTerm) {
      const term = effectiveFilter.searchTerm.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(term);
      const matchDesc = task.description.toLowerCase().includes(term);
      const matchTags = task.tags.some((t) => t.toLowerCase().includes(term));
      const matchId = task.id.toLowerCase().includes(term);

      if (!matchTitle && !matchDesc && !matchTags && !matchId) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper to map a column status to a macro stage category.
   */
  public mapColumnToCategory(column: KanbanColumn): KanbanStageCategory {
    switch (column) {
      case "backlog":
      case "triage":
        return "backlog";
      case "todo":
      case "ready":
        return "unstarted";
      case "in_progress":
      case "blocked":
      case "review":
        return "started";
      case "done":
      case "archived":
        return "completed";
      case "canceled":
        return "canceled";
      default:
        return "unstarted";
    }
  }
}
