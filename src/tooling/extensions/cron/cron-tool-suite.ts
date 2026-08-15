import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ICronScheduler } from "../../../core/contracts/cron.contracts.js";
import { DeterministicBlueprintCatalog } from "./deterministic-blueprint-catalog.js";

/**
 * CronToolSuite.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Model tool suite enabling AI agents to schedule, inspect, trigger, and manage
 * background jobs and automation blueprints deterministically.
 */
export class CronToolSuite {
  private readonly scheduler: ICronScheduler;
  private readonly blueprintCatalog: DeterministicBlueprintCatalog;

  constructor(
    scheduler: ICronScheduler,
    blueprintCatalog = new DeterministicBlueprintCatalog()
  ) {
    this.scheduler = scheduler;
    this.blueprintCatalog = blueprintCatalog;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "cron_list_jobs",
        description: "List all scheduled background cron jobs, status, recurrence schedules, and execution history.",
        parameters: {
          status: {
            type: "string",
            required: false,
            description: "Optional filter by status: 'active', 'paused', 'running', 'completed', 'failed'.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_list_jobs", args);
        },
      },
      {
        name: "cron_create_job",
        description: "Create a new recurring cron job, interval timer, or instantiate an automation blueprint.",
        parameters: {
          name: {
            type: "string",
            required: true,
            description: "Descriptive name for the scheduled job.",
          },
          prompt: {
            type: "string",
            required: false,
            description: "Instruction prompt executed when the job triggers (optional if blueprintKey is supplied).",
          },
          scheduleType: {
            type: "string",
            required: false,
            description: "Schedule type: 'cron' (default), 'interval', or 'once'.",
          },
          scheduleExpression: {
            type: "string",
            required: false,
            description: "Standard 5-field cron expression (e.g. '0 9 * * 1-5' for weekdays at 9am).",
          },
          intervalMs: {
            type: "number",
            required: false,
            description: "Interval duration in milliseconds (for 'interval' schedule type).",
          },
          blueprintKey: {
            type: "string",
            required: false,
            description: "Optional blueprint key to instantiate (e.g. 'daily_summary', 'health_check_monitor').",
          },
          blueprintSlots: {
            type: "string",
            required: false,
            description: "JSON-encoded dictionary of slot values when instantiating a blueprint.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_create_job", args);
        },
      },
      {
        name: "cron_trigger_job",
        description: "Manually trigger an existing scheduled job immediately out-of-schedule.",
        parameters: {
          jobId: {
            type: "string",
            required: true,
            description: "Identifier of the cron job to trigger.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_trigger_job", args);
        },
      },
      {
        name: "cron_pause_job",
        description: "Pause an active cron job to temporarily halt scheduled execution.",
        parameters: {
          jobId: {
            type: "string",
            required: true,
            description: "Identifier of the cron job to pause.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_pause_job", args);
        },
      },
      {
        name: "cron_resume_job",
        description: "Resume a paused cron job to restore scheduled execution.",
        parameters: {
          jobId: {
            type: "string",
            required: true,
            description: "Identifier of the cron job to resume.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_resume_job", args);
        },
      },
      {
        name: "cron_delete_job",
        description: "Permanently delete a scheduled cron job.",
        parameters: {
          jobId: {
            type: "string",
            required: true,
            description: "Identifier of the cron job to delete.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_delete_job", args);
        },
      },
      {
        name: "cron_list_blueprints",
        description: "List all parameterized automation blueprint templates available in the catalog.",
        parameters: {
          category: {
            type: "string",
            required: false,
            description: "Optional category filter: 'productivity', 'operations', 'maintenance', 'security', 'performance'.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("cron_list_blueprints", args);
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      switch (name) {
        case "cron_list_jobs": {
          const status = typeof args.status === "string" ? (args.status as any) : undefined;
          const jobs = this.scheduler.listJobs(status);
          return { success: true, data: jobs };
        }

        case "cron_create_job": {
          const nameStr = String(args.name ?? "Untitled Job");
          const blueprintKey = typeof args.blueprintKey === "string" ? args.blueprintKey : undefined;

          if (blueprintKey) {
            let slotValues: Record<string, unknown> = {};
            if (typeof args.blueprintSlots === "string" && args.blueprintSlots.trim().length > 0) {
              try {
                slotValues = JSON.parse(args.blueprintSlots);
              } catch {
                return { success: false, error: "Failed to parse blueprintSlots JSON dictionary" };
              }
            }
            const jobId = `job-${Date.now()}`;
            const materialized = this.blueprintCatalog.materializeBlueprint(blueprintKey, jobId, slotValues);
            const job = this.scheduler.registerJob(materialized);
            return { success: true, data: job };
          }

          const prompt = String(args.prompt ?? "");
          if (!prompt) {
            return { success: false, error: "Prompt is required when blueprintKey is not provided" };
          }

          const scheduleType = (args.scheduleType as any) || "cron";
          const scheduleExpression = typeof args.scheduleExpression === "string" ? args.scheduleExpression : "0 9 * * 1-5";
          const intervalMs = typeof args.intervalMs === "number" ? args.intervalMs : undefined;

          const job = this.scheduler.registerJob({
            id: `job-${Date.now()}`,
            name: nameStr,
            scheduleType,
            scheduleExpression,
            intervalMs,
            prompt,
          });

          return { success: true, data: job };
        }

        case "cron_trigger_job": {
          const jobId = String(args.jobId ?? "");
          const outcome = await this.scheduler.triggerJob(jobId);
          return { success: outcome.success, data: outcome };
        }

        case "cron_pause_job": {
          const jobId = String(args.jobId ?? "");
          const success = this.scheduler.pauseJob(jobId);
          return { success, data: { jobId, status: "paused" } };
        }

        case "cron_resume_job": {
          const jobId = String(args.jobId ?? "");
          const success = this.scheduler.resumeJob(jobId);
          return { success, data: { jobId, status: "active" } };
        }

        case "cron_delete_job": {
          const jobId = String(args.jobId ?? "");
          const success = this.scheduler.deleteJob(jobId);
          return { success, data: { jobId, deleted: success } };
        }

        case "cron_list_blueprints": {
          const category = typeof args.category === "string" ? args.category : undefined;
          const blueprints = this.blueprintCatalog.listBlueprints(category);
          return { success: true, data: blueprints };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
