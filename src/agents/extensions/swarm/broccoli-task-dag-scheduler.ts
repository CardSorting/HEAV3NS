/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 119: Broccoli Task DAG Scheduler
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration).
 * Dependency-based task scheduling (dependsOnTaskIds), topological sort execution queues,
 * and failure cascade resolution. Zero external dependencies.
 */

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface DagTaskNode {
  id: string;
  taskPrompt: string;
  dependsOnTaskIds: string[];
  status: TaskStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
}

export class BroccoliTaskDagScheduler {
  private readonly tasks = new Map<string, DagTaskNode>();

  /**
   * Adds a task node to the DAG with dependency requirements.
   */
  public addTask(id: string, taskPrompt: string, dependsOnTaskIds: string[] = []): DagTaskNode {
    const node: DagTaskNode = {
      id,
      taskPrompt,
      dependsOnTaskIds,
      status: "pending",
      createdAt: Date.now(),
    };
    this.tasks.set(id, node);
    return node;
  }

  /**
   * Evaluates topological execution order, returning ready tasks with satisfied dependencies.
   */
  public getReadyTasks(): DagTaskNode[] {
    const ready: DagTaskNode[] = [];

    for (const task of this.tasks.values()) {
      if (task.status !== "pending") continue;

      let dependenciesSatisfied = true;
      for (const depId of task.dependsOnTaskIds) {
        const depNode = this.tasks.get(depId);
        if (!depNode || depNode.status !== "completed") {
          dependenciesSatisfied = false;
          break;
        }
      }

      if (dependenciesSatisfied) {
        ready.push(task);
      }
    }

    return ready;
  }

  /**
   * Marks a task as completed and returns next ready tasks.
   */
  public markCompleted(id: string, result?: unknown): DagTaskNode[] {
    const node = this.tasks.get(id);
    if (node) {
      node.status = "completed";
      node.result = result;
    }
    return this.getReadyTasks();
  }

  /**
   * Marks a task as failed and cascade-skips downstream dependent tasks.
   */
  public markFailed(id: string, error: string): void {
    const node = this.tasks.get(id);
    if (!node) return;

    node.status = "failed";
    node.error = error;

    // Cascade skip downstream dependencies
    for (const task of this.tasks.values()) {
      if (task.status === "pending" && task.dependsOnTaskIds.includes(id)) {
        task.status = "skipped";
        task.error = `Skipped due to upstream dependency failure in '${id}'`;
      }
    }
  }

  /**
   * Checks if all DAG tasks have finished execution (completed, failed, or skipped).
   */
  public isFinished(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status === "pending" || task.status === "running") {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns current DAG metrics.
   */
  public getMetrics(): { total: number; completed: number; failed: number; skipped: number } {
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const t of this.tasks.values()) {
      if (t.status === "completed") completed++;
      else if (t.status === "failed") failed++;
      else if (t.status === "skipped") skipped++;
    }

    return {
      total: this.tasks.size,
      completed,
      failed,
      skipped,
    };
  }
}
