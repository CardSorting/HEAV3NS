import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IAnchoredSkillMutator,
  IBroccoliSkillTreeSubstrate,
  ISkillTreeParser,
  SkillGroupBy,
  SkillLifecycleState,
  SkillMutationPayload,
  SkillNodeManifest,
  SkillSortBy,
  SkillSortDirection,
  SkillStrategyGoal,
  SkillTier,
  SpecializedBranch,
} from "../../../core/contracts/skills.contracts.js";
import type { Eyes } from "../../base/eyes.js";
import { BroccoliSkillTreeSubstrate } from "../../../sessions/extensions/skills/broccoli-skill-tree-substrate.js";
import { SkillTreeSnapshotManager } from "../../../sessions/extensions/skills/skill-tree-snapshot-manager.js";
import { DeterministicSkillCurator } from "../../../sessions/extensions/skills/deterministic-skill-curator.js";
import { EvolutionarySkillTreeEngine } from "../../../agents/extensions/skills/evolutionary-skill-tree-engine.js";
import { SkillStrategyEngine } from "../../../agents/extensions/skills/skill-strategy-engine.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

/**
 * SkillTreeToolSuite.
 * Part of LUMI's World-Class Evolutionary Skill Tree System (ADR-014).
 *
 * Model tool suite exposing skill DAG inspection, progressive on-demand loading,
 * anchored mutations, mastery scoring, deterministic curation, goal-oriented
 * strategy planning, and autonomous speciation/consolidation.
 */
export class SkillTreeToolSuite {
  private readonly substrate: BroccoliSkillTreeSubstrate;
  private readonly mutator?: IAnchoredSkillMutator;
  private readonly parser?: ISkillTreeParser;
  private readonly eyes?: Eyes;
  private readonly snapshotManager: SkillTreeSnapshotManager;
  private readonly curator: DeterministicSkillCurator;
  private readonly evolutionaryEngine: EvolutionarySkillTreeEngine;
  private readonly strategyEngine: SkillStrategyEngine;

  constructor(
    substrate: IBroccoliSkillTreeSubstrate,
    mutator?: IAnchoredSkillMutator,
    parser?: ISkillTreeParser,
    eyes?: Eyes
  ) {
    this.substrate = substrate as BroccoliSkillTreeSubstrate;
    this.mutator = mutator;
    this.parser = parser;
    this.eyes = eyes;
    this.snapshotManager = new SkillTreeSnapshotManager(this.substrate);
    this.curator = new DeterministicSkillCurator(this.substrate);
    this.evolutionaryEngine = new EvolutionarySkillTreeEngine(this.substrate);
    this.strategyEngine = new SkillStrategyEngine(this.substrate);
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "skill_list_tree",
        description: "List the agent's Skill Tree DAG with tier levels, mastery ratings, and unlock states.",
        parameters: {
          category: { type: "string", description: "Optional category filter" },
          includeLocked: { type: "boolean", description: "Whether to include locked skills" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_list_tree", args, cwd);
        },
      },
      {
        name: "skill_view",
        description: "Load a skill's full instructions (SKILL.md) or a linked reference file on demand.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID to view" },
          filePath: { type: "string", description: "Optional support file path" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_view", args, cwd);
        },
      },
      {
        name: "skill_mutate",
        description: "Apply anchored evolutionary mutation to a skill node or support files.",
        parameters: {
          mutationId: { type: "string", required: true, description: "Mutation ID" },
          targetSkillId: { type: "string", required: true, description: "Target skill ID" },
          action: { type: "string", required: true, description: "Action: 'create', 'patch', 'rewrite', 'add_support_file', 'archive'" },
          reason: { type: "string", required: true, description: "Reason for mutation" },
          tickIndex: { type: "number", description: "Current tick" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_mutate", args, cwd);
        },
      },
      {
        name: "skill_strategy_plan",
        description: "Synthesize an optimal multi-step procedural execution plan tailored to a goal/task.",
        parameters: {
          prompt: { type: "string", required: true, description: "Task / objective description" },
          policy: { type: "string", description: "Policy: 'greedy_mastery', 'balanced_adaptive', 'exploration_learning', 'min_latency', 'defensive_sovereign'" },
          categoryHint: { type: "string", description: "Optional category hint" },
          maxDepth: { type: "number", description: "Max execution steps in chain" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_strategy_plan", args, cwd);
        },
      },
      {
        name: "skill_strategy_synergies",
        description: "Detect combinatorial synergies and combo multipliers across active skill sets.",
        parameters: {
          skillIds: { type: "string", required: true, description: "Comma-separated skill IDs" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_strategy_synergies", args, cwd);
        },
      },
      {
        name: "skill_evolution_path",
        description: "Calculate the shortest leveling and prerequisite unlock path to reach a target master/sovereign skill.",
        parameters: {
          targetSkillId: { type: "string", required: true, description: "Target skill ID to unlock/master" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_evolution_path", args, cwd);
        },
      },
      {
        name: "skill_speciate",
        description: "Autonomous speciation: Split an overloaded skill into specialized child branches with preserved lineage.",
        parameters: {
          skillId: { type: "string", required: true, description: "Parent skill ID to speciate" },
          branchesJson: { type: "string", required: true, description: "JSON array of SpecializedBranch objects" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_speciate", args, cwd);
        },
      },
      {
        name: "skill_consolidate",
        description: "Autonomous consolidation: Merge multiple overlapping skills into a unified cohesive skill.",
        parameters: {
          skillIds: { type: "string", required: true, description: "Comma-separated skill IDs to merge" },
          mergedId: { type: "string", required: true, description: "Consolidated skill ID" },
          mergedName: { type: "string", required: true, description: "Consolidated skill name" },
          mergedCategory: { type: "string", description: "Consolidated category" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_consolidate", args, cwd);
        },
      },
      {
        name: "skill_get_lineage",
        description: "Retrieve complete ancestral evolution lineage, generation, and speciation history for a skill.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID to inspect" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_get_lineage", args, cwd);
        },
      },
      {
        name: "skill_recommend_next",
        description: "Suggest the next most impactful skills to practice or unlock based on active context.",
        parameters: {
          context: { type: "string", description: "Current work context or domain" },
          limit: { type: "number", description: "Maximum recommendations to return" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_recommend_next", args, cwd);
        },
      },
      {
        name: "skill_get_node",
        description: "Retrieve complete specification for a specific skill node.",
        parameters: {
          id: { type: "string", required: true, description: "Skill ID to retrieve" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_get_node", args, cwd);
        },
      },
      {
        name: "skill_get_dag",
        description: "Get the complete topological order, unlocked/locked sets, and cycle analysis of the skill tree.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_get_dag", args, cwd);
        },
      },
      {
        name: "skill_record_usage",
        description: "Record execution usage of a skill to increment use counts and reset staleness decay.",
        parameters: {
          id: { type: "string", required: true, description: "Skill ID used" },
          tickIndex: { type: "number", description: "Tick index" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_record_usage", args, cwd);
        },
      },
      {
        name: "skill_audit_health",
        description: "Perform SLA mastery and prerequisite health diagnostics across skills.",
        parameters: {
          skillId: { type: "string", description: "Optional specific skill ID" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_audit_health", args, cwd);
        },
      },
      {
        name: "skill_get_metrics",
        description: "Get aggregate telemetry: total skills, tier distribution, average mastery/fitness, and mutation success rate.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_get_metrics", args, cwd);
        },
      },
      {
        name: "skill_group_and_sort",
        description: "Group and sort skills into multi-criteria swimlanes.",
        parameters: {
          groupBy: { type: "string", description: "Group by: 'tier', 'category', 'lifecycleState', 'provenance', 'health'" },
          sortBy: { type: "string", description: "Sort by: 'mastery', 'fitness', 'usage', 'recent', 'name'" },
          direction: { type: "string", description: "Sort direction: 'asc' or 'desc'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_group_and_sort", args, cwd);
        },
      },
      {
        name: "skill_search_dsl",
        description: "Search skills using natural query DSL (e.g. 'tier:master category:development tag:p0 mastery>=80 auth').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_search_dsl", args, cwd);
        },
      },
      {
        name: "skill_render_dashboard",
        description: "Render a human-readable ANSI CLI summary card for a skill node.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID to render" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_render_dashboard", args, cwd);
        },
      },
      {
        name: "skill_render_dag",
        description: "Render an ASCII / Unicode hierarchy tree of the Skill DAG.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_render_dag", args, cwd);
        },
      },
      {
        name: "skill_export_html",
        description: "Export the full skill tree state into an interactive single-page HTML application.",
        parameters: {
          skillId: { type: "string", description: "Optional skill ID focus" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_export_html", args, cwd);
        },
      },
      {
        name: "skill_export_markdown",
        description: "Export skill tree matrix and mastery scores as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_export_markdown", args, cwd);
        },
      },
      {
        name: "skill_export_csv",
        description: "Export skills and mastery scores as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_export_csv", args, cwd);
        },
      },
      {
        name: "skill_send_notification",
        description: "Dispatch a desktop or terminal notification for skill updates.",
        parameters: {
          skillId: { type: "string", description: "Associated skill ID" },
          title: { type: "string", required: true, description: "Notification title" },
          message: { type: "string", required: true, description: "Notification body" },
          urgency: { type: "string", description: "Urgency: 'low', 'normal', 'critical'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_send_notification", args, cwd);
        },
      },
      {
        name: "skill_get_notifications",
        description: "Fetch notification history for skill events.",
        parameters: {
          limit: { type: "number", description: "Max records to return" },
          unreadOnly: { type: "boolean", description: "Filter only unread" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_get_notifications", args, cwd);
        },
      },
      {
        name: "skill_configure_notifications",
        description: "Configure desktop alert sound, DND, and urgency filters for skills.",
        parameters: {
          enabled: { type: "boolean", description: "Enable master switch" },
          soundEnabled: { type: "boolean", description: "Audio chimes" },
          dndEnabled: { type: "boolean", description: "Do Not Disturb" },
          minUrgency: { type: "string", description: "Minimum urgency threshold" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_configure_notifications", args, cwd);
        },
      },
      {
        name: "skill_bulk_update",
        description: "Apply batch updates across multiple skills atomically.",
        parameters: {
          skillIds: { type: "string", required: true, description: "Comma-separated skill IDs" },
          tier: { type: "string", description: "New tier" },
          lifecycleState: { type: "string", description: "New lifecycle state" },
          pinned: { type: "boolean", description: "New pinned state" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_bulk_update", args, cwd);
        },
      },
      {
        name: "skill_undo",
        description: "Undo the last skill node creation, update, or mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_undo", args, cwd);
        },
      },
      {
        name: "skill_redo",
        description: "Redo the previously undone skill mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_redo", args, cwd);
        },
      },
      {
        name: "skill_snapshot_create",
        description: "Capture an O(1) state snapshot of all skill nodes.",
        parameters: {
          tick: { type: "number", description: "Snapshot tick identifier" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_snapshot_create", args, cwd);
        },
      },
      {
        name: "skill_snapshot_restore",
        description: "Restore skill tree state from a previously captured snapshot.",
        parameters: {
          snapshotId: { type: "string", description: "Snapshot ID to restore" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_snapshot_restore", args, cwd);
        },
      },
      {
        name: "skill_curator_evaluate_decay",
        description: "Detect stale or archivable skills based on staleness tick thresholds.",
        parameters: {
          currentTick: { type: "number", description: "Current tick index" },
          staleThreshold: { type: "number", description: "Ticks before stale" },
          archiveThreshold: { type: "number", description: "Ticks before archivable" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_curator_evaluate_decay", args, cwd);
        },
      },
      {
        name: "skill_curator_consolidation_clusters",
        description: "Detect overlapping skill clusters that could be consolidated.",
        parameters: {
          similarityThreshold: { type: "number", description: "Similarity threshold (0.0 to 1.0)" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_curator_consolidation_clusters", args, cwd);
        },
      },
      {
        name: "skill_pin_toggle",
        description: "Toggle pinned status for a skill to protect it from automatic pruning.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID to toggle" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_pin_toggle", args, cwd);
        },
      },
      {
        name: "skill_reinforce_mastery",
        description: "Reinforce or penalize skill mastery score based on task outcomes.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID" },
          success: { type: "boolean", required: true, description: "Task outcome success" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_reinforce_mastery", args, cwd);
        },
      },
      {
        name: "skill_create_node",
        description: "Create and register a new skill node in the active tree.",
        parameters: {
          id: { type: "string", required: true, description: "Skill ID" },
          name: { type: "string", required: true, description: "Skill name" },
          category: { type: "string", description: "Skill category" },
          tier: { type: "string", description: "Tier: 'novice', 'adept', 'master', 'sovereign'" },
          body: { type: "string", description: "SKILL.md instructions content" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_create_node", args, cwd);
        },
      },
      {
        name: "skill_delete_node",
        description: "Delete a skill node from the active tree.",
        parameters: {
          id: { type: "string", required: true, description: "Skill ID to delete" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_delete_node", args, cwd);
        },
      },
      {
        name: "skill_strategy_critical_path",
        description: "Analyze the DAG critical path and find prerequisite bottlenecks.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_strategy_critical_path", args, cwd);
        },
      },
      {
        name: "skill_speciate_evaluate",
        description: "Evaluate if a skill is overloaded and ready for autonomous speciation.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID to evaluate" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_speciate_evaluate", args, cwd);
        },
      },
      {
        name: "skill_transaction_begin",
        description: "Begin an isolated atomic transaction across multi-skill mutations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_transaction_begin", args, cwd);
        },
      },
      {
        name: "skill_transaction_commit",
        description: "Commit the active multi-skill transaction.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_transaction_commit", args, cwd);
        },
      },
      {
        name: "skill_transaction_rollback",
        description: "Rollback and revert the active multi-skill transaction.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_transaction_rollback", args, cwd);
        },
      },
      {
        name: "skill_strategy_optimize_latency",
        description: "Optimize an existing strategy plan to stay within a maximum latency budget (ms).",
        parameters: {
          prompt: { type: "string", required: true, description: "Task / goal prompt" },
          maxLatencyMs: { type: "number", required: true, description: "Maximum latency budget in milliseconds" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_strategy_optimize_latency", args, cwd);
        },
      },
      {
        name: "skill_estimate_uncertainty",
        description: "Estimate Bayesian epistemic uncertainty and confidence intervals for a skill's competencies.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_estimate_uncertainty", args, cwd);
        },
      },
      {
        name: "skill_auto_remediate_health",
        description: "Automatically repair structural anomalies and broken prerequisite edges in the active tree.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("skill_auto_remediate_health", args, cwd);
        },
      },
    ];
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "skill_strategy_plan": {
          const prompt = String(args.prompt || "");
          const policy = typeof args.policy === "string" ? (args.policy as any) : "balanced_adaptive";
          const categoryHint = typeof args.categoryHint === "string" ? args.categoryHint : undefined;
          const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : undefined;

          const plan = this.strategyEngine.synthesizeStrategy({
            prompt,
            policy,
            categoryHint,
            maxDepth,
          });
          return { success: true, plan };
        }

        case "skill_strategy_synergies": {
          const skillIds = String(args.skillIds || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const synergies = this.strategyEngine.evaluateSynergies(skillIds);
          return { success: true, count: synergies.length, synergies };
        }

        case "skill_evolution_path": {
          const targetSkillId = String(args.targetSkillId || "");
          const path = this.strategyEngine.computeEvolutionPath(targetSkillId);
          return { success: true, path };
        }

        case "skill_speciate": {
          const skillId = String(args.skillId || "");
          const branchesJson = String(args.branchesJson || "[]");
          const branches: SpecializedBranch[] = JSON.parse(branchesJson);
          const children = this.evolutionaryEngine.speciateSkill(skillId, branches);
          return { success: children.length > 0, count: children.length, children };
        }

        case "skill_consolidate": {
          const skillIds = String(args.skillIds || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const mergedId = String(args.mergedId || "");
          const mergedName = String(args.mergedName || "Consolidated Skill");
          const mergedCategory = String(args.mergedCategory || "general");
          const merged = this.evolutionaryEngine.consolidateSkills(skillIds, mergedId, mergedName, mergedCategory);
          return { success: true, mergedNode: merged };
        }

        case "skill_get_lineage": {
          const skillId = String(args.skillId || "");
          const lineage = this.evolutionaryEngine.getLineage(skillId);
          return { success: lineage !== undefined, skillId, lineage };
        }

        case "skill_recommend_next": {
          const context = String(args.context || "");
          const limit = typeof args.limit === "number" ? args.limit : 5;
          const recommendations = this.strategyEngine.recommendNextSkills(context, limit);
          return { success: true, count: recommendations.length, recommendations };
        }

        case "skill_list_tree": {
          const dag = this.substrate.getDag();
          const category = typeof args.category === "string" ? args.category.toLowerCase() : undefined;
          const includeLocked = args.includeLocked !== false;

          const results: Array<{
            id: string;
            name: string;
            description: string;
            category: string;
            tier: string;
            masteryScore: number;
            unlocked: boolean;
            missingPrerequisites?: readonly string[];
            relatedSkills: readonly string[];
          }> = [];

          for (const [id, node] of dag.nodes.entries()) {
            if (category && node.category.toLowerCase() !== category) continue;
            const isUnlocked = dag.unlockedNodeIds.has(id);
            if (!isUnlocked && !includeLocked) continue;

            results.push({
              id: node.id,
              name: node.name,
              description: node.description,
              category: node.category,
              tier: node.tier,
              masteryScore: node.masteryScore,
              unlocked: isUnlocked,
              missingPrerequisites: isUnlocked ? undefined : dag.lockedNodeIds.get(id),
              relatedSkills: node.relatedSkills,
            });
          }

          return {
            success: true,
            totalSkills: results.length,
            unlockedCount: results.filter((r) => r.unlocked).length,
            skills: results,
          };
        }

        case "skill_view": {
          const skillId = String(args.skillId ?? "");
          const node = this.substrate.getNode(skillId);
          if (!node) return { success: false, error: `Skill '${skillId}' not found` };

          if (this.mutator) {
            this.mutator.markSkillRead(node.id);
          }

          const filePath = typeof args.filePath === "string" ? args.filePath : undefined;
          if (filePath) {
            const support = node.supportFiles.find((s) => s.relativePath === filePath);
            if (!support) return { success: false, error: `Support file '${filePath}' not found in skill '${skillId}'` };
            return { success: true, skillId: node.id, filePath, content: support.content };
          }

          return { success: true, node, body: node.body };
        }

        case "skill_mutate": {
          if (!this.mutator) return { success: false, error: "AnchoredSkillMutator not configured" };
          const payload = args as unknown as SkillMutationPayload;
          const currentDag = this.substrate.getDag();
          const result = await this.mutator.applyMutation(payload, currentDag);
          this.substrate.recordMutation(result);
          return { success: result.success, result };
        }

        case "skill_get_node": {
          const id = String(args.id || "");
          const node = this.substrate.getNode(id);
          return { success: node !== undefined, node };
        }

        case "skill_get_dag": {
          const dag = this.substrate.getDag();
          return {
            success: true,
            topologicalOrder: dag.topologicalOrder,
            unlockedNodeIds: Array.from(dag.unlockedNodeIds),
            lockedNodeIds: Object.fromEntries(dag.lockedNodeIds.entries()),
            cycles: dag.cycles,
          };
        }

        case "skill_record_usage": {
          const id = String(args.id || "");
          const tickIndex = Number(args.tickIndex) || 0;
          this.substrate.recordSkillUsage(id, tickIndex);
          return { success: true, id, tickIndex };
        }

        case "skill_audit_health": {
          const skillId = typeof args.skillId === "string" ? args.skillId : undefined;
          const audit = this.substrate.auditSkillHealth(skillId);
          return { success: true, audit };
        }

        case "skill_get_metrics": {
          const metrics = this.substrate.getSkillMetrics();
          return { success: true, metrics };
        }

        case "skill_group_and_sort": {
          const groupBy = (args.groupBy as SkillGroupBy) || "tier";
          const sortBy = (args.sortBy as SkillSortBy) || "mastery";
          const direction = (args.direction as SkillSortDirection) || "desc";
          const lanes = this.substrate.getGroupedSkills(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "skill_search_dsl": {
          const query = String(args.query || "");
          const results = this.substrate.querySkillsDsl(query);
          return { success: true, results };
        }

        case "skill_render_dashboard": {
          const skillId = String(args.skillId || "");
          const node = this.substrate.getNode(skillId);
          if (!node) return { success: false, error: `Skill '${skillId}' not found` };
          const rendered = BroccoliViewRenderer.renderSkillDashboard(node as any);
          return { success: true, rendered };
        }

        case "skill_render_dag": {
          const dag = this.substrate.getDag();
          const rendered = BroccoliViewRenderer.renderSkillTreeDag(dag as any);
          return { success: true, rendered };
        }

        case "skill_export_html": {
          const skillId = typeof args.skillId === "string" ? args.skillId : undefined;
          const html = this.substrate.exportInteractiveHtmlView(skillId);
          return { success: true, html };
        }

        case "skill_export_markdown": {
          const markdown = this.substrate.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "skill_export_csv": {
          const csv = this.substrate.exportCsvReport();
          return { success: true, csv };
        }

        case "skill_send_notification": {
          const res = await this.substrate.getNotificationDispatcher().dispatch({
            skillId: typeof args.skillId === "string" ? args.skillId : undefined,
            title: String(args.title || "LUMI Skill Notification"),
            message: String(args.message || ""),
            urgency: (args.urgency as any) || "normal",
            trigger: "custom",
          });
          return { success: res.dispatched, result: res };
        }

        case "skill_get_notifications": {
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const unreadOnly = Boolean(args.unreadOnly);
          const notifications = this.substrate.getNotificationDispatcher().getHistory(limit, unreadOnly);
          return { success: true, notifications };
        }

        case "skill_configure_notifications": {
          const updates: Record<string, unknown> = {};
          if (args.enabled !== undefined) updates.enabled = Boolean(args.enabled);
          if (args.soundEnabled !== undefined) updates.soundEnabled = Boolean(args.soundEnabled);
          if (args.dndEnabled !== undefined) updates.dndEnabled = Boolean(args.dndEnabled);
          if (args.minUrgency !== undefined) updates.minUrgency = args.minUrgency;

          const prefs = this.substrate.getNotificationDispatcher().updatePreferences(updates as any);
          return { success: true, preferences: prefs };
        }

        case "skill_bulk_update": {
          const skillIds = String(args.skillIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const tier = typeof args.tier === "string" ? (args.tier as SkillTier) : undefined;
          const lifecycleState = typeof args.lifecycleState === "string" ? (args.lifecycleState as SkillLifecycleState) : undefined;
          const pinned = args.pinned !== undefined ? Boolean(args.pinned) : undefined;

          const res = this.substrate.bulkUpdateSkills(skillIds, { tier, lifecycleState, pinned });
          return { success: res.modifiedCount > 0, result: res };
        }

        case "skill_undo": {
          const success = this.substrate.undo();
          return { success };
        }

        case "skill_redo": {
          const success = this.substrate.redo();
          return { success };
        }

        case "skill_snapshot_create": {
          const tick = typeof args.tick === "number" ? args.tick : 0;
          const snapshotId = this.snapshotManager.createSnapshot(tick);
          return { success: true, snapshotId };
        }

        case "skill_snapshot_restore": {
          const snapshotId = String(args.snapshotId || "");
          const restored = this.snapshotManager.restoreSnapshot(snapshotId);
          return { success: restored, snapshotId };
        }

        case "skill_curator_evaluate_decay": {
          const currentTick = Number(args.currentTick) || 1000;
          const staleThreshold = Number(args.staleThreshold) || 100;
          const archiveThreshold = Number(args.archiveThreshold) || 500;
          const decay = this.curator.evaluateDecay(currentTick, staleThreshold, archiveThreshold);
          return { success: true, decay };
        }

        case "skill_curator_consolidation_clusters": {
          const threshold = Number(args.similarityThreshold) || 0.8;
          const clusters = this.curator.detectConsolidationClusters(threshold);
          return { success: true, clusters };
        }

        case "skill_pin_toggle": {
          const skillId = String(args.skillId || "");
          const node = this.substrate.getNode(skillId);
          if (!node) return { success: false, error: `Skill '${skillId}' not found` };
          const updated: SkillNodeManifest = {
            ...node,
            pinned: !node.pinned,
            updatedAtMs: Date.now(),
          };
          this.substrate.saveNode(updated);
          return { success: true, skillId: node.id, pinned: updated.pinned };
        }

        case "skill_reinforce_mastery": {
          const skillId = String(args.skillId || "");
          const success = Boolean(args.success);
          const newMastery = this.evolutionaryEngine.updateMastery(skillId, success);
          return { success: true, skillId, masteryScore: newMastery };
        }

        case "skill_create_node": {
          const id = String(args.id || "").toLowerCase();
          const name = String(args.name || "Untitled Skill");
          const category = String(args.category || "general");
          const tier = (args.tier as SkillTier) || "novice";
          const body = String(args.body || "");

          const node: SkillNodeManifest = {
            id,
            name,
            description: name,
            category,
            tier,
            version: "1.0.0",
            author: "agent",
            prerequisites: [],
            relatedSkills: [],
            tags: [],
            masteryScore: 50,
            fitnessScore: 0.8,
            useCount: 0,
            lastUsedTick: 0,
            createdTick: 0,
            lifecycleState: "active",
            provenance: "user_created",
            pinned: false,
            location: `/skills/${id}/SKILL.md`,
            body,
            contentHash: "hash-new",
            supportFiles: [],
            updatedAtMs: Date.now(),
          };

          this.substrate.saveNode(node);
          return { success: true, node };
        }

        case "skill_delete_node": {
          const id = String(args.id || "").toLowerCase();
          const deleted = this.substrate.deleteNode ? this.substrate.deleteNode(id) : false;
          return { success: deleted, id, deleted };
        }

        case "skill_strategy_critical_path": {
          const criticalPath = this.strategyEngine.computeCriticalPath();
          return { success: true, criticalPath };
        }

        case "skill_speciate_evaluate": {
          const skillId = String(args.skillId || "").toLowerCase();
          const evalResult = this.evolutionaryEngine.evaluateSpeciationOpportunity(skillId);
          return { success: true, evaluation: evalResult };
        }

        case "skill_transaction_begin": {
          const tx = this.substrate.beginTransaction();
          return { success: true, transaction: tx };
        }

        case "skill_transaction_commit": {
          const ok = this.substrate.commitTransaction();
          return { success: ok, committed: ok };
        }

        case "skill_transaction_rollback": {
          const ok = this.substrate.rollbackTransaction();
          return { success: ok, rolledBack: ok };
        }

        case "skill_strategy_optimize_latency": {
          const prompt = String(args.prompt || "");
          const maxLatencyMs = typeof args.maxLatencyMs === "number" ? args.maxLatencyMs : 0.3;
          const initialPlan = this.strategyEngine.synthesizeStrategy({ prompt, policy: "balanced_adaptive" });
          const optimizedPlan = this.strategyEngine.optimizePipelineForCostAndLatency(initialPlan, maxLatencyMs);
          return { success: true, initialPlan, optimizedPlan };
        }

        case "skill_estimate_uncertainty": {
          const skillId = String(args.skillId || "").toLowerCase();
          const uncertainty = this.evolutionaryEngine.estimateCompetencyUncertainty(skillId);
          return { success: true, uncertainty };
        }

        case "skill_auto_remediate_health": {
          const report = this.evolutionaryEngine.autoRemediateHealthIssues ? this.evolutionaryEngine.autoRemediateHealthIssues() : { repairedCount: 0, brokenEdgesFixed: 0, unlockedOrphansCount: 0, actionsTaken: [], healthStatusAfter: "mastered" as const };
          return { success: true, report };
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
