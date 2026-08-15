import type { SwarmTaskManifest } from "../../../core/contracts/delegation.contracts.js";

/**
 * SubagentLifecycleGuard.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Enforces delegation tree depth boundaries, prevents recursion deadlocks,
 * and strips forbidden interactive tools from subagent execution contexts.
 */
export class SubagentLifecycleGuard {
  private readonly maxAllowedDepth = 3;
  private readonly forbiddenSubagentTools = new Set<string>([
    "delegate_task",
    "delegate_batch",
    "clarify",
    "interactive_prompt",
    "shutdown_monolith",
  ]);

  /**
   * Validates whether a subagent task can be safely spawned.
   */
  canSpawnSubagent(manifest: SwarmTaskManifest): { allowed: boolean; reason?: string } {
    if (manifest.depth >= this.maxAllowedDepth) {
      return {
        allowed: false,
        reason: `Maximum delegation depth exceeded: depth ${manifest.depth} >= limit ${this.maxAllowedDepth}`,
      };
    }

    if (!manifest.goal || manifest.goal.trim().length === 0) {
      return {
        allowed: false,
        reason: "Subagent task goal cannot be empty",
      };
    }

    return { allowed: true };
  }

  /**
   * Filters and sanitizes the toolset available to a delegated subagent.
   */
  filterSubagentTools(tools: readonly string[]): readonly string[] {
    const safeTools = tools.filter((tool) => !this.forbiddenSubagentTools.has(tool));
    return Object.freeze(safeTools);
  }

  /**
   * Sanitizes subagent summary text before merging into the parent context.
   */
  sanitizeSubagentOutput(output: string): string {
    if (!output) return "";
    // Remove control codes and normalize whitespace
    return output
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\r\n/g, "\n")
      .trim();
  }
}
