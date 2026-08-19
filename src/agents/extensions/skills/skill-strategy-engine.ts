import type {
  ISkillStrategyEngine,
  SkillComboSynergy,
  SkillCriticalPath,
  SkillEvolutionMilestone,
  SkillEvolutionPath,
  SkillExecutionPolicy,
  SkillNodeManifest,
  SkillProgressionTrack,
  SkillRecommendation,
  SkillStrategyGoal,
  SkillStrategyPlan,
  SkillStrategyStep,
  SkillTier,
} from "../../../core/contracts/skills.contracts.js";
import { BroccoliSkillTreeSubstrate } from "../../../sessions/extensions/skills/broccoli-skill-tree-substrate.js";

/**
 * SkillStrategyEngine.
 * Part of LUMI's World-Class Evolutionary Skill Tree System (ADR-014).
 *
 * Provides goal-driven skill strategy planning, procedural execution chain formulation,
 * fallback mitigation routing, combinatorial synergy detection, and DAG leveling pathfinding.
 */
export class SkillStrategyEngine implements ISkillStrategyEngine {
  private readonly substrate: BroccoliSkillTreeSubstrate;
  private readonly planCache: Map<string, { plan: SkillStrategyPlan; expiresMs: number }> = new Map();
  private static readonly MAX_CACHE_ENTRIES = 128;
  private static readonly CACHE_TTL_MS = 60_000;

  // Known golden synergy pairings across common disciplines
  private static readonly SYNERGY_DEFINITIONS: readonly {
    pairKey: string;
    skillMatches: readonly (string | RegExp)[];
    name: string;
    description: string;
    fitnessMultiplier: number;
    xpMultiplier: number;
  }[] = [
    {
      pairKey: "search-synthesize",
      skillMatches: [/(search|web|arxiv)/i, /(synthesis|extractor|summarizer|digest)/i],
      name: "Deep Research & Synthesis",
      description: "Co-execution of search and synthesis yields high-fidelity multi-source intelligence.",
      fitnessMultiplier: 1.25,
      xpMultiplier: 1.3,
    },
    {
      pairKey: "db-perf",
      skillMatches: [/(sql|database|query)/i, /(optimization|indexing|profiling|tuning)/i],
      name: "Database Zenith Performance",
      description: "Combining schema understanding with query indexing maximizes execution throughput.",
      fitnessMultiplier: 1.3,
      xpMultiplier: 1.35,
    },
    {
      pairKey: "inspect-mutate",
      skillMatches: [/(ast|eyes|inspect|read)/i, /(mutat|patch|write|hands)/i],
      name: "Anchored Surgical Refactor",
      description: "AST inspection paired with anchored line mutation eliminates hallucination drift.",
      fitnessMultiplier: 1.35,
      xpMultiplier: 1.4,
    },
    {
      pairKey: "code-test",
      skillMatches: [/(code|generate|build)/i, /(test|verify|lint|guard)/i],
      name: "Zero-Defect Engineering",
      description: "Immediate test-driven verification locks in procedural accuracy.",
      fitnessMultiplier: 1.2,
      xpMultiplier: 1.25,
    },
  ];

  constructor(substrate: BroccoliSkillTreeSubstrate) {
    this.substrate = substrate;
  }

  /**
   * Synthesizes an optimal multi-step procedural execution plan tailored to a specific goal.
   */
  public synthesizeStrategy(goal: SkillStrategyGoal): SkillStrategyPlan {
    const cacheKey = `${goal.prompt}::${goal.policy ?? "balanced_adaptive"}::${goal.categoryHint ?? ""}::${goal.maxDepth ?? 0}::${this.substrate.getAllNodes().length}`;
    const cached = this.planCache.get(cacheKey);
    if (cached && cached.expiresMs > Date.now()) {
      return cached.plan;
    }

    const allNodes = this.substrate.getAllNodes();
    const dag = this.substrate.getDag();
    const policy: SkillExecutionPolicy = goal.policy ?? "balanced_adaptive";
    const promptTerms = goal.prompt.toLowerCase().split(/\s+/).filter(Boolean);

    // 1. Score each skill node against goal requirements
    const scoredSkills: Array<{ node: SkillNodeManifest; score: number; unlocked: boolean }> = [];

    for (const node of allNodes) {
      if (node.lifecycleState === "archived") continue;

      const isUnlocked = dag.unlockedNodeIds.has(node.id);
      let score = 0;

      // Category matching
      if (goal.categoryHint && node.category.toLowerCase() === goal.categoryHint.toLowerCase()) {
        score += 30;
      }

      // Tag and capability matching
      if (goal.requiredCapabilities && goal.requiredCapabilities.length > 0) {
        for (const cap of goal.requiredCapabilities) {
          const capLower = cap.toLowerCase();
          if (node.tags.some((t) => t.toLowerCase() === capLower) || node.name.toLowerCase().includes(capLower)) {
            score += 25;
          }
        }
      }

      // Keyword text matching
      const haystack = `${node.id} ${node.name} ${node.description} ${node.tags.join(" ")}`.toLowerCase();
      for (const term of promptTerms) {
        if (haystack.includes(term)) {
          score += 10;
        }
      }

      // Explicit preferred skills
      if (goal.preferredSkillIds && goal.preferredSkillIds.includes(node.id)) {
        score += 40;
      }

      // Policy adjustments
      switch (policy) {
        case "greedy_mastery":
          score += (node.masteryScore / 100) * 30;
          break;
        case "defensive_sovereign":
          if (node.tier === "sovereign" || node.pinned) score += 35;
          score += (node.masteryScore / 100) * 20;
          break;
        case "exploration_learning":
          if (isUnlocked && node.masteryScore < 60) score += 30;
          break;
        case "min_latency":
          score -= (node.prerequisites.length * 5);
          break;
        case "balanced_adaptive":
        default:
          score += (node.masteryScore / 100) * 15;
          score += node.fitnessScore * 10;
          break;
      }

      // Heavy penalty if locked
      if (!isUnlocked) {
        score -= 20;
      }

      scoredSkills.push({ node, score, unlocked: isUnlocked });
    }

    scoredSkills.sort((a, b) => b.score - a.score);

    // Default fallback if no skills matched
    const defaultNode: SkillNodeManifest = allNodes[0] ?? {
      id: "general-reasoning",
      name: "General Reasoning",
      description: "Default reasoning and execution.",
      category: "general",
      tier: "novice",
      version: "1.0.0",
      author: "system",
      prerequisites: [],
      relatedSkills: [],
      tags: ["general"],
      masteryScore: 50,
      fitnessScore: 0.8,
      useCount: 0,
      lastUsedTick: 0,
      createdTick: 0,
      lifecycleState: "active",
      provenance: "system_bundled",
      pinned: true,
      location: "/skills/general-reasoning/SKILL.md",
      body: "Execute task with general reasoning.",
      contentHash: "hash-gen-0",
      supportFiles: [],
    };

    const primaryCandidate = scoredSkills[0]?.node ?? defaultNode;

    // 2. Formulate ordered execution chain (Prerequisite -> Primary -> Post-Action Synergies)
    const executionChain: SkillStrategyStep[] = [];
    let stepIndex = 1;

    // Add unfulfilled prerequisites that are unlocked
    for (const prereqId of primaryCandidate.prerequisites) {
      const pNode = this.substrate.getNode(prereqId);
      if (pNode && dag.unlockedNodeIds.has(pNode.id)) {
        executionChain.push({
          stepIndex: stepIndex++,
          skillId: pNode.id,
          skillName: pNode.name,
          tier: pNode.tier,
          masteryScore: pNode.masteryScore,
          rationale: `Preparation: Establish grounded prerequisite context using '${pNode.name}'.`,
        });
      }
    }

    // Add primary skill
    executionChain.push({
      stepIndex: stepIndex++,
      skillId: primaryCandidate.id,
      skillName: primaryCandidate.name,
      tier: primaryCandidate.tier,
      masteryScore: primaryCandidate.masteryScore,
      rationale: `Core Action: Execute primary procedural logic with '${primaryCandidate.name}'.`,
    });

    // Add high-scoring complementary skill if available
    const complementary = scoredSkills.find((s) => s.node.id !== primaryCandidate.id && s.unlocked && s.score > 20);
    const maxDepth = goal.maxDepth ?? 3;
    if (complementary && executionChain.length < maxDepth) {
      executionChain.push({
        stepIndex: stepIndex++,
        skillId: complementary.node.id,
        skillName: complementary.node.name,
        tier: complementary.node.tier,
        masteryScore: complementary.node.masteryScore,
        rationale: `Follow-up: Validate or format output via '${complementary.node.name}'.`,
      });
    }

    // 3. Formulate Fallback Chain
    const fallbackChain: SkillStrategyStep[] = [];
    const fallbackCandidates = scoredSkills.filter((s) => s.unlocked && s.node.id !== primaryCandidate.id);
    for (let i = 0; i < Math.min(2, fallbackCandidates.length); i++) {
      const fb = fallbackCandidates[i].node;
      fallbackChain.push({
        stepIndex: i + 1,
        skillId: fb.id,
        skillName: fb.name,
        tier: fb.tier,
        masteryScore: fb.masteryScore,
        rationale: `Mitigation: Fall back to '${fb.name}' if primary execution encounters unexpected hurdles.`,
      });
    }

    // 4. Evaluate Synergies
    const chainIds = executionChain.map((s) => s.skillId);
    const synergies = this.evaluateSynergies(chainIds);

    // 5. Confidence Score & Latency Estimation
    const topScore = scoredSkills[0]?.score ?? 10;
    const confidenceScore = Math.min(1.0, Math.max(0.2, topScore / 100));
    const estimatedLatencyMs = executionChain.length * 0.15; // sub-millisecond execution estimate

    const planId = `strat-${Date.now()}-${primaryCandidate.id}`;
    const rationale = `Selected strategy '${policy}' deploying ${executionChain.length}-step pipeline anchored by '${primaryCandidate.name}' (Tier: ${primaryCandidate.tier.toUpperCase()}, Mastery: ${primaryCandidate.masteryScore}%).`;

    const plan: SkillStrategyPlan = {
      strategyId: planId,
      goal,
      policy,
      primarySkill: primaryCandidate,
      executionChain: Object.freeze(executionChain),
      fallbackChain: Object.freeze(fallbackChain),
      synergies: Object.freeze(synergies),
      confidenceScore,
      estimatedLatencyMs,
      rationale,
      createdMs: Date.now(),
    };

    if (this.planCache.size >= SkillStrategyEngine.MAX_CACHE_ENTRIES) {
      const firstKey = this.planCache.keys().next().value;
      if (firstKey) this.planCache.delete(firstKey);
    }
    this.planCache.set(cacheKey, { plan, expiresMs: Date.now() + SkillStrategyEngine.CACHE_TTL_MS });

    return plan;
  }

  /**
   * Evaluates active skill sets to detect combo synergies.
   */
  public evaluateSynergies(skillIds: readonly string[]): readonly SkillComboSynergy[] {
    const detected: SkillComboSynergy[] = [];
    const lowerIds = skillIds.map((id) => id.toLowerCase());

    for (const def of SkillStrategyEngine.SYNERGY_DEFINITIONS) {
      const matchingIds: string[] = [];

      for (const pattern of def.skillMatches) {
        const match = lowerIds.find((id) => {
          if (typeof pattern === "string") return id.includes(pattern.toLowerCase());
          return pattern.test(id);
        });
        if (match) matchingIds.push(match);
      }

      if (matchingIds.length >= def.skillMatches.length) {
        detected.push({
          pairKey: def.pairKey,
          skillIds: Object.freeze(matchingIds),
          name: def.name,
          description: def.description,
          fitnessMultiplier: def.fitnessMultiplier,
          xpMultiplier: def.xpMultiplier,
          active: true,
        });
      }
    }

    return Object.freeze(detected);
  }

  /**
   * Computes the shortest leveling path from current DAG mastery to unlock a target master/sovereign skill.
   */
  public computeEvolutionPath(targetSkillId: string): SkillEvolutionPath {
    const targetNode = this.substrate.getNode(targetSkillId);
    const dag = this.substrate.getDag();

    if (!targetNode) {
      return {
        targetSkillId,
        targetSkillName: targetSkillId,
        targetTier: "novice",
        currentMastery: 0,
        unlocked: false,
        requiredPrerequisites: [],
        recommendedSequence: [],
        totalXpToTarget: 0,
        difficulty: "trivial",
      };
    }

    const isUnlocked = dag.unlockedNodeIds.has(targetNode.id);
    const requiredPrereqs: string[] = [];
    const sequence: Array<{
      skillId: string;
      skillName: string;
      currentMastery: number;
      targetMastery: number;
      estimatedXpNeeded: number;
    }> = [];

    let totalXp = 0;

    // Traverse all prerequisite ancestry
    const visited = new Set<string>();
    const queue = [...targetNode.prerequisites];

    while (queue.length > 0) {
      const pId = queue.shift()!;
      if (visited.has(pId)) continue;
      visited.add(pId);
      requiredPrereqs.push(pId);

      const pNode = this.substrate.getNode(pId);
      if (pNode) {
        const needed = Math.max(0, 50 - pNode.masteryScore); // 50 is unlock threshold
        if (needed > 0) {
          sequence.push({
            skillId: pNode.id,
            skillName: pNode.name,
            currentMastery: pNode.masteryScore,
            targetMastery: 50,
            estimatedXpNeeded: needed,
          });
          totalXp += needed;
        }
        for (const grandPrereq of pNode.prerequisites) {
          queue.push(grandPrereq);
        }
      }
    }

    // Add target skill itself to reach sovereign/master
    const targetThreshold = targetNode.tier === "sovereign" ? 90 : targetNode.tier === "master" ? 75 : 50;
    const targetXpNeeded = Math.max(0, targetThreshold - targetNode.masteryScore);
    sequence.push({
      skillId: targetNode.id,
      skillName: targetNode.name,
      currentMastery: targetNode.masteryScore,
      targetMastery: targetThreshold,
      estimatedXpNeeded: targetXpNeeded,
    });
    totalXp += targetXpNeeded;

    let difficulty: "trivial" | "moderate" | "demanding" | "epic" = "trivial";
    if (totalXp > 150 || requiredPrereqs.length > 3) difficulty = "epic";
    else if (totalXp > 80 || requiredPrereqs.length > 1) difficulty = "demanding";
    else if (totalXp > 30) difficulty = "moderate";

    return {
      targetSkillId: targetNode.id,
      targetSkillName: targetNode.name,
      targetTier: targetNode.tier,
      currentMastery: targetNode.masteryScore,
      unlocked: isUnlocked,
      requiredPrerequisites: Object.freeze(requiredPrereqs),
      recommendedSequence: Object.freeze(sequence),
      totalXpToTarget: totalXp,
      difficulty,
    };
  }

  /**
   * Suggests the next most impactful skills to practice or unlock based on active context.
   */
  public recommendNextSkills(context: string, limit: number = 5): readonly SkillRecommendation[] {
    const all = this.substrate.getAllNodes();
    const dag = this.substrate.getDag();
    const contextLower = context.toLowerCase();

    const recommendations: SkillRecommendation[] = [];

    for (const node of all) {
      if (node.lifecycleState === "archived") continue;

      const isUnlocked = dag.unlockedNodeIds.has(node.id);
      let score = 0;
      let reason = "Standard progression opportunity.";

      // Check if unlocked and developing
      if (isUnlocked && node.masteryScore < 75) {
        score += 50 - Math.abs(50 - node.masteryScore);
        reason = `Unlocked skill currently developing at ${node.masteryScore}%. Practice to reach Master status.`;
      }

      // Check if this node blocks dependent children
      const dependents = dag.dependentsEdges.get(node.id) || [];
      if (dependents.length > 0 && node.masteryScore < 50) {
        score += dependents.length * 20;
        reason = `Key prerequisite bottleneck: Raising to 50% will unblock ${dependents.length} downstream skills (${dependents.join(", ")}).`;
      }

      // Context relevance
      if (contextLower.includes(node.name.toLowerCase()) || contextLower.includes(node.category.toLowerCase())) {
        score += 30;
        reason = `Directly relevant to current activity (${node.category}).`;
      }

      recommendations.push({
        skill: node,
        score,
        reason,
      });
    }

    recommendations.sort((a, b) => b.score - a.score);
    return Object.freeze(recommendations.slice(0, limit));
  }

  /**
   * Returns guided role-based progression tracks with dynamic completion calculations.
   */
  public getProgressionTracks(): readonly SkillProgressionTrack[] {
    const all = this.substrate.getAllNodes();
    const nodeMap = new Map(all.map((n) => [n.id.toLowerCase(), n]));

    const trackTemplates: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      targetRole: string;
      stages: Array<{
        stageIndex: number;
        title: string;
        requiredSkillIds: string[];
        minimumMastery: number;
        unlockedReward: string;
      }>;
    }> = [
      {
        id: "fullstack-architect",
        name: "Full-Stack Architecture Track",
        description: "Master frontend perception, anchored refactoring, and zero-defect deployment.",
        icon: "🏗️",
        targetRole: "Principal Full-Stack Engineer",
        stages: [
          {
            stageIndex: 1,
            title: "Foundational Perception",
            requiredSkillIds: ["web-search", "ast-eyes", "read-file"],
            minimumMastery: 50,
            unlockedReward: "Unlock AST Deep Structural Inspection",
          },
          {
            stageIndex: 2,
            title: "Anchored Surgical Mutation",
            requiredSkillIds: ["anchored-mutator", "hands-patch"],
            minimumMastery: 75,
            unlockedReward: "Unlock Zero-Drift Patching Multiplier (+25% XP)",
          },
          {
            stageIndex: 3,
            title: "Sovereign Engineering",
            requiredSkillIds: ["test-verification", "guardrail-governor"],
            minimumMastery: 90,
            unlockedReward: "Crown of Sovereign Architecture 👑",
          },
        ],
      },
      {
        id: "data-engineering",
        name: "Data Platform & Analytics Track",
        description: "Build robust database query pipelines, composite indexing, and distributed persistence.",
        icon: "📊",
        targetRole: "Lead Data Systems Architect",
        stages: [
          {
            stageIndex: 1,
            title: "SQL & Schema Basics",
            requiredSkillIds: ["sql-basics", "schema-builder"],
            minimumMastery: 50,
            unlockedReward: "Unlock EXPLAIN Query Analyzer",
          },
          {
            stageIndex: 2,
            title: "Query & Index Optimization",
            requiredSkillIds: ["db-optimization", "index-tuning"],
            minimumMastery: 75,
            unlockedReward: "Unlock Database Zenith Combo (+35% XP)",
          },
          {
            stageIndex: 3,
            title: "Distributed High-Throughput Storage",
            requiredSkillIds: ["distributed-transactions", "broccolidb-storage"],
            minimumMastery: 90,
            unlockedReward: "Crown of Distributed Data Mastery 👑",
          },
        ],
      },
      {
        id: "research-synthesis",
        name: "AI Knowledge & Research Track",
        description: "Orchestrate multi-source research extraction and executive briefing synthesis.",
        icon: "🧠",
        targetRole: "Research Intelligence Lead",
        stages: [
          {
            stageIndex: 1,
            title: "Corpus Extraction",
            requiredSkillIds: ["web-search", "arxiv-search"],
            minimumMastery: 50,
            unlockedReward: "Unlock Deep Multi-Source Cross-Referencing",
          },
          {
            stageIndex: 2,
            title: "Briefing Synthesis",
            requiredSkillIds: ["paper-synthesis", "latex-formatter"],
            minimumMastery: 75,
            unlockedReward: "Unlock Research & Synthesis Combo (+25% Fitness)",
          },
          {
            stageIndex: 3,
            title: "Autonomous Knowledge Crystallization",
            requiredSkillIds: ["knowledge-crystallizer", "executive-briefing"],
            minimumMastery: 90,
            unlockedReward: "Crown of Omniscient Synthesis 👑",
          },
        ],
      },
      {
        id: "autonomous-cognition",
        name: "Autonomous Cognition & Speciation Track",
        description: "Evolve procedural workflows, trajectory self-healing, and dynamic speciation.",
        icon: "🧬",
        targetRole: "Autonomous Intelligence Sovereign",
        stages: [
          {
            stageIndex: 1,
            title: "Trajectory Analysis",
            requiredSkillIds: ["trajectory-analysis", "signal-detection"],
            minimumMastery: 50,
            unlockedReward: "Unlock Automated Feedback Sensing",
          },
          {
            stageIndex: 2,
            title: "Speciation & Specialization",
            requiredSkillIds: ["speciation-engine", "lineage-tracker"],
            minimumMastery: 75,
            unlockedReward: "Unlock Generation 2 Branching Multiplier",
          },
          {
            stageIndex: 3,
            title: "Sovereign Consolidation",
            requiredSkillIds: ["anti-degeneration-guard", "monolith-crystallizer"],
            minimumMastery: 90,
            unlockedReward: "Crown of Autonomous Evolution 👑",
          },
        ],
      },
    ];

    return Object.freeze(
      trackTemplates.map((t) => {
        let totalRequired = 0;
        let totalCompleted = 0;

        for (const stage of t.stages) {
          for (const reqId of stage.requiredSkillIds) {
            totalRequired++;
            const node = nodeMap.get(reqId.toLowerCase());
            if (node && node.masteryScore >= stage.minimumMastery) {
              totalCompleted++;
            }
          }
        }

        const progressPercent = totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 0;

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          targetRole: t.targetRole,
          stages: Object.freeze(t.stages),
          progressPercent,
        };
      })
    );
  }

  /**
   * Computes gamified evolution milestones and quest achievements.
   */
  public getEvolutionMilestones(): readonly SkillEvolutionMilestone[] {
    const all = this.substrate.getAllNodes();
    const metrics = this.substrate.getSkillMetrics();
    const dag = this.substrate.getDag();

    const totalNodes = all.length;
    const masterNodes = all.filter((n) => n.tier === "master" || n.tier === "sovereign").length;
    const sovereignNodes = all.filter((n) => n.tier === "sovereign").length;
    const speciatedNodes = all.filter((n) => n.lineage && n.lineage.generation >= 2).length;
    const pinnedCount = all.filter((n) => n.pinned).length;

    const milestones: SkillEvolutionMilestone[] = [
      {
        id: "first-step",
        title: "Pioneer Spark",
        description: "Initialize and unlock your first operational skill in the DAG.",
        icon: "🌱",
        unlocked: totalNodes >= 1,
        progress: Math.min(1.0, totalNodes / 1),
        requirementText: "Have at least 1 skill in the tree",
        rewardPerk: "+5% Base XP Gain",
      },
      {
        id: "adept-trio",
        title: "Adept Mastery Trio",
        description: "Advance at least 3 skills to Adept level (50%+ mastery).",
        icon: "🥈",
        unlocked: all.filter((n) => n.masteryScore >= 50).length >= 3,
        progress: Math.min(1.0, all.filter((n) => n.masteryScore >= 50).length / 3),
        requirementText: "Have 3 skills with >= 50% mastery",
        rewardPerk: "Unlocks Level-2 Synergy Combos",
      },
      {
        id: "sovereign-crown",
        title: "Sovereign Grandmaster",
        description: "Achieve Sovereign status (90%+ mastery) on any core skill.",
        icon: "👑",
        unlocked: sovereignNodes >= 1,
        progress: Math.min(1.0, sovereignNodes / 1),
        requirementText: "Promote 1 skill to Sovereign Tier (90%+)",
        rewardPerk: "Permanent Immunity from Decay Pruning",
      },
      {
        id: "synergy-alchemist",
        title: "Synergy Alchemist",
        description: "Trigger dual combo synergies in a single execution plan.",
        icon: "⚡",
        unlocked: all.some((n) => n.synergies && n.synergies.length > 0) || totalNodes >= 4,
        progress: Math.min(1.0, totalNodes / 4),
        requirementText: "Execute a multi-skill plan with active combo bonuses",
        rewardPerk: "+15% Composite Execution Speed",
      },
      {
        id: "speciation-lineage",
        title: "Evolutionary Speciator",
        description: "Evolve and speciate a skill into Generation 2 child branches.",
        icon: "🧬",
        unlocked: speciatedNodes >= 1,
        progress: Math.min(1.0, speciatedNodes / 1),
        requirementText: "Perform autonomous skill speciation",
        rewardPerk: "Unlocks Generation 3 Deep Specialization",
      },
      {
        id: "golden-vault",
        title: "Golden Vault Guardian",
        description: "Pin 2 or more mission-critical skills to protect them from pruning.",
        icon: "📌",
        unlocked: pinnedCount >= 2,
        progress: Math.min(1.0, pinnedCount / 2),
        requirementText: "Pin at least 2 skills in the Tree",
        rewardPerk: "Instant Frame-Perfect Undo/Redo Depth x2",
      },
    ];

    return Object.freeze(milestones);
  }

  /**
   * Identifies the topological critical path and prerequisite bottlenecks in the skill DAG.
   */
  public computeCriticalPath(): SkillCriticalPath {
    const dag = this.substrate.getDag();
    const all = this.substrate.getAllNodes();

    // 1. Calculate prerequisite depth for each node
    const depthMap = new Map<string, number>();
    const calculateDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      if (depthMap.has(id)) return depthMap.get(id)!;
      visited.add(id);

      const prereqs = dag.prerequisiteEdges.get(id) || [];
      let maxPrereqDepth = 0;
      for (const p of prereqs) {
        maxPrereqDepth = Math.max(maxPrereqDepth, calculateDepth(p, new Set(visited)));
      }

      const depth = maxPrereqDepth + 1;
      depthMap.set(id, depth);
      return depth;
    };

    for (const node of all) {
      calculateDepth(node.id);
    }

    // 2. Find longest chain
    let maxDepth = 0;
    let criticalTail = "";
    for (const [id, depth] of depthMap.entries()) {
      if (depth > maxDepth) {
        maxDepth = depth;
        criticalTail = id;
      }
    }

    const criticalChain: string[] = [];
    let current: string | undefined = criticalTail;
    while (current) {
      criticalChain.unshift(current);
      const prereqs = dag.prerequisiteEdges.get(current) || [];
      let deepestPrereq: string | undefined;
      let deepestVal = -1;
      for (const p of prereqs) {
        const d = depthMap.get(p) || 0;
        if (d > deepestVal) {
          deepestVal = d;
          deepestPrereq = p;
        }
      }
      current = deepestPrereq;
    }

    // 3. Find bottleneck nodes (unmastered nodes blocking the highest count of downstream dependents)
    const bottleneckNodes: Array<{
      skillId: string;
      skillName: string;
      blockedDownstreamCount: number;
      currentMastery: number;
    }> = [];

    for (const node of all) {
      if (node.masteryScore < 50) {
        const dependents = dag.dependentsEdges.get(node.id) || [];
        if (dependents.length > 0) {
          bottleneckNodes.push({
            skillId: node.id,
            skillName: node.name,
            blockedDownstreamCount: dependents.length,
            currentMastery: node.masteryScore,
          });
        }
      }
    }

    bottleneckNodes.sort((a, b) => b.blockedDownstreamCount - a.blockedDownstreamCount);

    return {
      criticalPathNodeIds: Object.freeze(criticalChain),
      totalPrerequisiteDepth: maxDepth,
      bottleneckNodes: Object.freeze(bottleneckNodes),
    };
  }

  /**
   * Maps natural language non-technical user intent queries to recommended skill nodes.
   */
  public searchSkillsNaturalIntent(intentQuery: string, limit = 5): readonly SkillRecommendation[] {
    const all = this.substrate.getAllNodes();
    const q = intentQuery.toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length > 2);

    const synonymMap: Record<string, string[]> = {
      fix: ["mutate", "patch", "repair", "refactor"],
      search: ["find", "web", "arxiv", "locate", "query"],
      database: ["sql", "storage", "index", "schema", "table"],
      test: ["verify", "lint", "guard", "check", "assert"],
      write: ["create", "generate", "document", "hands"],
      read: ["ast", "eyes", "inspect", "parse"],
    };

    const expandedTokens = new Set(tokens);
    for (const token of tokens) {
      for (const [key, syns] of Object.entries(synonymMap)) {
        if (token.includes(key) || syns.includes(token)) {
          expandedTokens.add(key);
          for (const s of syns) expandedTokens.add(s);
        }
      }
    }

    const scored: Array<{ skill: SkillNodeManifest; score: number; reason: string }> = [];

    for (const node of all) {
      let score = 0;
      const haystack = `${node.id} ${node.name} ${node.description} ${node.category} ${node.tags.join(" ")}`.toLowerCase();

      for (const exp of expandedTokens) {
        if (haystack.includes(exp)) {
          score += 15;
        }
      }

      if (score > 0) {
        score += (node.masteryScore / 100) * 10;
        scored.push({
          skill: node,
          score,
          reason: `Matched intent keywords in ${node.category} discipline.`,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return Object.freeze(scored.slice(0, limit));
  }

  /**
   * Optimizes an execution pipeline to strictly respect a maximum latency budget (ms)
   * while maximizing confidence by pruning lowest-impact non-primary stages.
   */
  public optimizePipelineForCostAndLatency(plan: SkillStrategyPlan, maxLatencyMs: number): SkillStrategyPlan {
    if (plan.estimatedLatencyMs <= maxLatencyMs || plan.executionChain.length <= 1) {
      return plan;
    }

    const primaryStep = plan.executionChain.find((s) => s.skillId === plan.primarySkill.id) || plan.executionChain[0];
    const otherSteps = plan.executionChain.filter((s) => s.skillId !== primaryStep.skillId);

    const stepCost = 0.15;
    const maxAllowedSteps = Math.max(1, Math.floor(maxLatencyMs / stepCost));

    otherSteps.sort((a, b) => b.masteryScore - a.masteryScore);
    const retainedOthers = otherSteps.slice(0, maxAllowedSteps - 1);

    const newChain = [primaryStep, ...retainedOthers];
    newChain.sort((a, b) => a.stepIndex - b.stepIndex);
    const reindexedChain = newChain.map((step, idx) => ({ ...step, stepIndex: idx + 1 }));

    const chainIds = reindexedChain.map((s) => s.skillId);
    const synergies = this.evaluateSynergies(chainIds);

    return {
      ...plan,
      strategyId: `${plan.strategyId}-opt`,
      executionChain: Object.freeze(reindexedChain),
      synergies: Object.freeze(synergies),
      estimatedLatencyMs: reindexedChain.length * stepCost,
      rationale: `${plan.rationale} [Optimized for <=${maxLatencyMs}ms budget: ${reindexedChain.length} stages retained]`,
    };
  }
}



