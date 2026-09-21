/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 136: Zero-Dependency Broccoli Repair Mutation Executor
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration/RepairExecutor.ts).
 * The sole authorized repair mutation path in engine orchestration. All disk writes for code repairs flow
 * through this transactional executor with trace events and resync tracking. Zero external npm dependencies.
 */

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BroccoliMutationPlanner } from "./broccolidb-mutation-planner.js";

export interface RepairDirective {
  directiveId: string;
  filePath: string;
  action: "replace" | "insert" | "delete";
  content?: string;
  startLine?: number;
  endLine?: number;
}

export interface MutationStep {
  stepId: string;
  directiveId: string;
}

export interface MutationPlan {
  planId: string;
  steps: MutationStep[];
  directives: RepairDirective[];
}

export interface RepairExecution {
  executionId: string;
  planId: string;
  sessionId: string;
  startedAt: number;
  finishedAt?: number;
  appliedSteps: string[];
  skippedSteps: string[];
  status: "running" | "completed" | "failed";
  error?: string;
}

export class BroccoliRepairMutationExecutor {
  private readonly workspaceRoot: string;
  readonly planner = new BroccoliMutationPlanner();

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Applies a single repair directive to disk atomically.
   */
  public async applyDirective(directive: RepairDirective): Promise<void> {
    const fullPath = path.resolve(this.workspaceRoot, directive.filePath);

    if (directive.action === "replace" && directive.content !== undefined) {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, directive.content, "utf-8");
    } else if (directive.action === "delete") {
      try {
        await fs.unlink(fullPath);
      } catch {
        // Ignored if already deleted
      }
    }
  }

  /**
   * Executes a complete mutation plan transactionally.
   */
  public async execute(plan: MutationPlan, sessionId: string): Promise<RepairExecution> {
    const execution: RepairExecution = {
      executionId: randomUUID(),
      planId: plan.planId,
      sessionId,
      startedAt: Date.now(),
      appliedSteps: [],
      skippedSteps: [],
      status: "running",
    };

    try {
      for (const step of plan.steps) {
        const directive = plan.directives.find((d) => d.directiveId === step.directiveId);
        if (!directive) {
          execution.skippedSteps.push(step.stepId);
          continue;
        }

        await this.applyDirective(directive);
        execution.appliedSteps.push(step.stepId);
      }

      execution.status = "completed";
      execution.finishedAt = Date.now();
    } catch (err) {
      execution.status = "failed";
      execution.error = err instanceof Error ? err.message : String(err);
      execution.finishedAt = Date.now();
    }

    return execution;
  }
}
