import type {
  IEvolutionarySkillEngine,
  SkillEvolutionSignal,
  SkillNodeManifest,
  IBroccoliSkillTreeSubstrate,
  SkillTier,
} from "../../../core/contracts/skills.contracts.js";

export class EvolutionarySkillTreeEngine implements IEvolutionarySkillEngine {
  private readonly substrate: IBroccoliSkillTreeSubstrate;

  constructor(substrate: IBroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
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
    const responseLower = trajectory.response.toLowerCase();

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
          type: "new_technique" as any,
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
    };

    this.substrate.saveNode(updated);
    return newMastery;
  }
}
