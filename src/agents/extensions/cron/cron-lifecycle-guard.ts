import type { CronJobManifest } from "../../../core/contracts/cron.contracts.js";

/**
 * CronLifecycleGuard.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Enforces schedule validity, blocks destructive process kill injections,
 * and defends against recursive self-scheduling loops in cron jobs.
 */
export class CronLifecycleGuard {
  private readonly destructiveCommands = [
    /\bshutdown_monolith\b/i,
    /\bpkill\b.*(?:hermes|lumi|agent|node)/i,
    /\blaunchctl\s+(?:kickstart|unload|stop|kill)\b.*(?:hermes|lumi)/i,
    /\bsystemctl\s+(?:restart|stop|kill)\b.*(?:hermes|lumi)/i,
    /\brm\s+-rf\s+\/(?:\s|$)/i,
  ];

  private readonly recursiveCronTools = [
    /\bcron_create_job\b/i,
    /\bcron_trigger_job\b/i,
    /\bdelegate_batch\b/i,
  ];

  /**
   * Validates whether a cron job manifest can be safely registered.
   */
  validateJobManifest(manifest: Omit<CronJobManifest, "status" | "totalRuns" | "createdTick">): {
    allowed: boolean;
    reason?: string;
  } {
    if (!manifest.id || manifest.id.trim().length === 0) {
      return { allowed: false, reason: "Cron job ID cannot be empty" };
    }

    if (!manifest.name || manifest.name.trim().length === 0) {
      return { allowed: false, reason: "Cron job name cannot be empty" };
    }

    if (!manifest.prompt || manifest.prompt.trim().length === 0) {
      return { allowed: false, reason: "Cron job prompt cannot be empty" };
    }

    // 1. Validate schedule
    if (manifest.scheduleType === "cron") {
      if (!manifest.scheduleExpression) {
        return { allowed: false, reason: "Cron schedule expression is required for 'cron' type" };
      }
      const cronFields = manifest.scheduleExpression.trim().split(/\s+/);
      if (cronFields.length !== 5) {
        return {
          allowed: false,
          reason: `Invalid 5-field cron expression '${manifest.scheduleExpression}'. Expected 5 fields, got ${cronFields.length}`,
        };
      }
    } else if (manifest.scheduleType === "interval") {
      if (typeof manifest.intervalMs !== "number" || manifest.intervalMs <= 0) {
        return { allowed: false, reason: `Interval duration must be a positive number of milliseconds, got ${manifest.intervalMs}` };
      }
      if (manifest.intervalMs < 500) {
        return { allowed: false, reason: `Interval duration ${manifest.intervalMs}ms is too small (minimum allowed is 500ms)` };
      }
    }

    // 2. Destructive command injection check
    for (const pattern of this.destructiveCommands) {
      if (pattern.test(manifest.prompt)) {
        return {
          allowed: false,
          reason: `Cron job prompt contains blocked destructive command pattern: ${pattern.source}`,
        };
      }
    }

    // 3. Recursive cron self-scheduling check
    for (const pattern of this.recursiveCronTools) {
      if (pattern.test(manifest.prompt)) {
        return {
          allowed: false,
          reason: `Cron job prompt contains recursive self-scheduling tool reference: ${pattern.source}`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Sanitizes prompt text to eliminate control characters.
   */
  sanitizePrompt(prompt: string): string {
    return prompt
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\r\n/g, "\n")
      .trim();
  }
}
