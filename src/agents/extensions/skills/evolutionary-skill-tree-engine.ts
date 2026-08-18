import type {
  IEvolutionarySkillEngine,
  SkillBulkMutationResult,
  SkillDslQueryFilter,
  SkillEvolutionSignal,
  SkillGroupBy,
  SkillGroupedLane,
  SkillHealthAuditReport,
  SkillMetricsReport,
  SkillNodeManifest,
  SkillSortBy,
  SkillSortDirection,
  SkillTier,
} from "../../../core/contracts/skills.contracts.js";
import { BroccoliSkillTreeSubstrate } from "../../../sessions/extensions/skills/broccoli-skill-tree-substrate.js";
import type { SkillDesktopNotificationDispatcher } from "../../../tooling/extensions/skills/skill-notification-dispatcher.js";

export class EvolutionarySkillTreeEngine implements IEvolutionarySkillEngine {
  private readonly substrate: BroccoliSkillTreeSubstrate;

  constructor(substrate: BroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
  }

  public getSubstrate(): BroccoliSkillTreeSubstrate {
    return this.substrate;
  }

  public getNotificationDispatcher(): SkillDesktopNotificationDispatcher {
    return this.substrate.getNotificationDispatcher();
  }

  /**
   * Evaluates turn trajectory Step_t to detect learning/evolution signals.
   */
  analyzeTrajectory(trajectory: {
    prompt: string;
    response: string;
    toolCalls?: readonly { name: string; args: unknown; result: unknown }[];
    userCorrections?: readonly string[];
    tickIndex: number;
  }): readonly SkillEvolutionSignal[] {
    const signals: SkillEvolutionSignal[] = [];
    const promptLower = trajectory.prompt.toLowerCase();

    // 1. User Correction Signals (Frustration / style / workflow correction)
    const correctionPhrases = [
      "stop doing",
      "don't format",
      "do not format",
      "why are you explaining",
      "just give me the",
      "you always",
      "remember this",
      "next time",
      "wrong approach",
    ];

    for (const phrase of correctionPhrases) {
      if (promptLower.includes(phrase)) {
        signals.push({
          type: "user_correction",
          context: `User correction detected: "${phrase}" in turn prompt.`,
          confidence: 0.95,
          suggestedAction: "patch_loaded",
        });
        break;
      }
    }

    // 2. Explicit user corrections list
    if (trajectory.userCorrections && trajectory.userCorrections.length > 0) {
      for (const corr of trajectory.userCorrections) {
        signals.push({
          type: "user_correction",
          context: `Explicit user correction: ${corr}`,
          confidence: 1.0,
          suggestedAction: "patch_loaded",
        });
      }
    }

    // 3. New Technique / Workaround Signal (Tool retries or multi-step discovery)
    if (trajectory.toolCalls && trajectory.toolCalls.length >= 3) {
      const toolNames = trajectory.toolCalls.map((t) => t.name);
      const uniqueTools = new Set(toolNames);
      if (uniqueTools.size >= 2) {
        signals.push({
          type: "tool_workaround",
          context: `Multi-tool execution chain synthesized across: ${Array.from(uniqueTools).join(", ")}.`,
          confidence: 0.8,
          suggestedAction: "add_support_file",
        });
      }
    }

    return Object.freeze(signals);
  }

  /**
   * Computes Evolutionary Fitness F based on success rate, activity, and stability.
   */
  calculateFitness(node: SkillNodeManifest, currentTick: number): number {
    const useFactor = Math.min(1.0, node.useCount / 20.0);
    const masteryFactor = node.masteryScore / 100.0;
    const elapsed = Math.max(0, currentTick - node.lastUsedTick);
    const stalenessPenalty = Math.min(0.5, elapsed / 5000.0);

    const fitness = 0.4 * masteryFactor + 0.4 * useFactor + 0.2 * (node.pinned ? 1.0 : 0.8) - stalenessPenalty;
    return Math.min(1.0, Math.max(0.0, fitness));
  }

  /**
   * Updates skill mastery score and upgrades tier upon reaching thresholds:
   * - Novice: 0-49%
   * - Adept: 50-74%
   * - Master: 75-89%
   * - Sovereign: 90-100%
   */
  updateMastery(nodeId: string, success: boolean): number {
    const node = this.substrate.getNode(nodeId);
    if (!node) return 0;

    let newMastery = success ? Math.min(100, node.masteryScore + 5) : Math.max(0, node.masteryScore - 8);

    let newTier: SkillTier = "novice";
    if (newMastery >= 90) newTier = "sovereign";
    else if (newMastery >= 75) newTier = "master";
    else if (newMastery >= 50) newTier = "adept";

    const updated: SkillNodeManifest = {
      ...node,
      masteryScore: newMastery,
      tier: newTier,
      updatedAtMs: Date.now(),
    };

    this.substrate.saveNode(updated);

    if (newMastery >= 90 && node.masteryScore < 90) {
      this.substrate.getNotificationDispatcher().dispatch({
        skillId: node.id,
        title: "Skill Mastery Sovereign",
        message: `Skill '${node.name}' has achieved Sovereign mastery status (${newMastery}%).`,
        urgency: "normal",
        trigger: "mastery_promoted",
      }).catch(() => {});
    }

    return newMastery;
  }

  // ---------------------------------------------------------------------------
  // Substrate Facade Wrappers
  // ---------------------------------------------------------------------------

  public auditSkillHealth(skillId?: string): SkillHealthAuditReport {
    return this.substrate.auditSkillHealth(skillId);
  }

  public getSkillMetrics(): SkillMetricsReport {
    return this.substrate.getSkillMetrics();
  }

  public getGroupedSkills(
    groupBy?: SkillGroupBy,
    sortBy?: SkillSortBy,
    direction?: SkillSortDirection
  ): readonly SkillGroupedLane[] {
    return this.substrate.getGroupedSkills(groupBy, sortBy, direction);
  }

  public querySkillsDsl(query: SkillDslQueryFilter | string): readonly SkillNodeManifest[] {
    return this.substrate.querySkillsDsl(query);
  }

  public bulkUpdateSkills(
    skillIds: readonly string[],
    updates: Partial<Pick<SkillNodeManifest, "tier" | "lifecycleState" | "pinned" | "category">>
  ): SkillBulkMutationResult {
    return this.substrate.bulkUpdateSkills(skillIds, updates);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportInteractiveHtmlView(skillId?: string): string {
    return this.substrate.exportInteractiveHtmlView(skillId);
  }

  public exportMarkdownReport(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsvReport(): string {
    return this.substrate.exportCsvReport();
  }
}
