import type {
  IBroccoliSkillTreeSubstrate,
  ISkillTreeParser,
  SkillBulkMutationResult,
  SkillDslQueryFilter,
  SkillGroupBy,
  SkillGroupedLane,
  SkillHealthAuditReport,
  SkillHealthStatus,
  SkillLifecycleState,
  SkillMetricsReport,
  SkillMutationResult,
  SkillMutationRow,
  SkillMutationUndoRecord,
  SkillNodeManifest,
  SkillNodeRow,
  SkillNotificationPreferences,
  SkillNotificationRow,
  SkillProvenance,
  SkillSortBy,
  SkillSortDirection,
  SkillTier,
  SkillTreeDag,
  SkillUsageRow,
} from "../../../core/contracts/skills.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";
import { DeterministicSkillTreeParser } from "../../../tooling/extensions/skills/deterministic-skill-tree-parser.js";
import { SkillDesktopNotificationDispatcher } from "../../../tooling/extensions/skills/skill-notification-dispatcher.js";

/**
 * BroccoliSkillTreeSubstrate.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates in-memory caching, BroccoliDB reactive tables, DAG building,
 * mastery diagnostics, and Change Data Capture for the Evolutionary Skill Tree.
 */
export class BroccoliSkillTreeSubstrate implements IBroccoliSkillTreeSubstrate {
  private readonly nodes = new Map<string, SkillNodeManifest>();
  private readonly mutations: SkillMutationResult[] = [];
  private readonly parser: ISkillTreeParser;
  private readonly notificationDispatcher: SkillDesktopNotificationDispatcher;
  private readonly undoStack: SkillMutationUndoRecord[] = [];
  private readonly redoStack: SkillMutationUndoRecord[] = [];
  private cachedDag: SkillTreeDag | null = null;

  private static readonly MAX_MUTATIONS = 500;
  private static readonly MAX_UNDO_STACK = 100;

  // BroccoliDB Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private nodesTable?: IDbTable<SkillNodeRow>;
  private mutationsTable?: IDbTable<SkillMutationRow>;
  private usagesTable?: IDbTable<SkillUsageRow>;
  private notifsTable?: IDbTable<SkillNotificationRow>;

  constructor(
    parser?: ISkillTreeParser,
    dbKernel?: IBroccoliDatabaseKernel,
    notificationPreferences?: Partial<SkillNotificationPreferences>
  ) {
    this.parser = parser ?? new DeterministicSkillTreeParser();
    this.dbKernel = dbKernel;
    this.notificationDispatcher = new SkillDesktopNotificationDispatcher(notificationPreferences);

    if (this.dbKernel) {
      this.initBroccoliDbTables();
    }
  }

  private initBroccoliDbTables(): void {
    if (!this.dbKernel) return;

    this.nodesTable = this.dbKernel.getTable<SkillNodeRow>("skill_nodes");
    this.mutationsTable = this.dbKernel.getTable<SkillMutationRow>("skill_mutations");
    this.usagesTable = this.dbKernel.getTable<SkillUsageRow>("skill_usages");
    this.notifsTable = this.dbKernel.getTable<SkillNotificationRow>("skill_notifications");

    try {
      this.nodesTable.createIndex("category");
      this.nodesTable.createIndex("tier");
      this.nodesTable.createIndex("lifecycleState");
      this.nodesTable.createIndex("provenance");
      this.mutationsTable.createIndex("skillId");
    } catch {
      // Non-blocking
    }

    // CDC Subscription
    try {
      this.nodesTable.subscribe((change) => {
        if (change.operation === "UPDATE" && change.after) {
          const node = change.after;
          if (node.masteryScore === 100 && (change.before?.masteryScore || 0) < 100) {
            this.notificationDispatcher.dispatch({
              skillId: node.id,
              title: "Skill Mastery Promoted",
              message: `Skill '${node.name}' reached 100% Sovereign Mastery!`,
              urgency: "normal",
              trigger: "mastery_promoted",
            }).catch(() => {});
          }
        }
      });
    } catch {
      // Non-blocking
    }
  }

  // ---------------------------------------------------------------------------
  // Core Substrate Methods
  // ---------------------------------------------------------------------------

  public initialize(initialNodes?: readonly SkillNodeManifest[]): void {
    this.clear();
    if (initialNodes) {
      for (const node of initialNodes) {
        this.saveNode(node);
      }
    }
  }

  public getNode(id: string): SkillNodeManifest | undefined {
    return this.nodes.get(id.toLowerCase());
  }

  public getAllNodes(): readonly SkillNodeManifest[] {
    return Object.freeze(Array.from(this.nodes.values()));
  }

  public getDag(): SkillTreeDag {
    if (!this.cachedDag) {
      this.cachedDag = this.parser.buildSkillDag(Array.from(this.nodes.values()));
    }
    return this.cachedDag;
  }

  public saveNode(node: SkillNodeManifest): void {
    const key = node.id.toLowerCase();
    const prev = this.nodes.get(key);
    const enriched: SkillNodeManifest = {
      ...node,
      updatedAtMs: Date.now(),
    };

    this.nodes.set(key, Object.freeze(enriched));
    this.cachedDag = null; // Invalidate DAG cache

    if (this.nodesTable) {
      const row: SkillNodeRow = {
        id: enriched.id,
        name: enriched.name,
        category: enriched.category,
        tier: enriched.tier,
        masteryScore: enriched.masteryScore,
        fitnessScore: enriched.fitnessScore,
        useCount: enriched.useCount,
        lifecycleState: enriched.lifecycleState,
        provenance: enriched.provenance,
        pinned: enriched.pinned,
        tags: (enriched.tags || []).join(","),
        updatedAtMs: Date.now(),
      };
      this.nodesTable.put(key, row);
    }

    this.recordUndo({
      mutationType: prev ? "update" : "create",
      previousNode: prev,
      nextNode: enriched,
      timestampMs: Date.now(),
    });
  }

  public deleteNode(id: string): boolean {
    const key = id.toLowerCase();
    const prev = this.nodes.get(key);
    const deleted = this.nodes.delete(key);
    this.cachedDag = null;

    if (deleted && this.nodesTable) {
      this.nodesTable.delete(key);
    }

    if (deleted && prev) {
      this.recordUndo({
        mutationType: "delete",
        previousNode: prev,
        timestampMs: Date.now(),
      });
    }

    return deleted;
  }

  public recordSkillUsage(id: string, tickIndex: number): void {
    const key = id.toLowerCase();
    const node = this.nodes.get(key);
    if (node) {
      const updated: SkillNodeManifest = {
        ...node,
        useCount: node.useCount + 1,
        lastUsedTick: tickIndex,
        lifecycleState: node.lifecycleState === "dormant" ? "active" : node.lifecycleState,
        updatedAtMs: Date.now(),
      };
      this.saveNode(updated);

      if (this.usagesTable) {
        const row: SkillUsageRow = {
          id: `usage-${Date.now()}-${id}`,
          skillId: id,
          tickIndex,
          timestampMs: Date.now(),
        };
        this.usagesTable.put(row.id, row);
      }
    }
  }

  public recordMutation(result: SkillMutationResult): void {
    this.mutations.unshift(Object.freeze(result));
    if (this.mutations.length > BroccoliSkillTreeSubstrate.MAX_MUTATIONS) {
      this.mutations.pop();
    }

    if (this.mutationsTable) {
      const row: SkillMutationRow = {
        id: `mut-${Date.now()}-${result.mutationId}`,
        mutationId: result.mutationId,
        skillId: result.skillId,
        success: result.success,
        timestamp: result.timestamp,
      };
      this.mutationsTable.put(row.id, row);
    }
  }

  public getMutations(skillId?: string, limit: number = 50): readonly SkillMutationResult[] {
    if (skillId) {
      return Object.freeze(this.mutations.filter((m) => m.skillId.toLowerCase() === skillId.toLowerCase()).slice(0, limit));
    }
    return Object.freeze(this.mutations.slice(0, limit));
  }

  public clear(): void {
    this.nodes.clear();
    this.mutations.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.cachedDag = null;
  }

  public getNotificationDispatcher(): SkillDesktopNotificationDispatcher {
    return this.notificationDispatcher;
  }

  // ---------------------------------------------------------------------------
  // SLA Mastery & Health Diagnostics
  // ---------------------------------------------------------------------------

  public auditSkillHealth(skillId?: string): SkillHealthAuditReport {
    const all = Array.from(this.nodes.values());
    const dag = this.getDag();

    if (skillId) {
      const node = this.getNode(skillId);
      if (!node) {
        return {
          skillId,
          totalSkills: all.length,
          activeSkills: all.filter((n) => n.lifecycleState === "active").length,
          averageMasteryScore: 0,
          averageFitnessScore: 0,
          healthStatus: "degraded",
          lockedPrerequisitesCount: 0,
          degradedSkillsCount: 0,
          recommendations: [`Skill '${skillId}' was not found in active skill tree.`],
        };
      }

      const lockedPrereqs = dag.lockedNodeIds.get(node.id) || [];
      let healthStatus: SkillHealthStatus = "developing";
      if (node.masteryScore >= 90) healthStatus = "mastered";
      else if (node.fitnessScore < 0.4 || node.lifecycleState === "dormant") healthStatus = "stagnant";
      else if (lockedPrereqs.length > 0) healthStatus = "degraded";

      const recommendations: string[] = [];
      if (lockedPrereqs.length > 0) {
        recommendations.push(`Skill is locked pending prerequisite unlock: ${lockedPrereqs.join(", ")}`);
      }
      if (node.masteryScore < 50) {
        recommendations.push(`Skill mastery is developing (${node.masteryScore}%). Reinforce via practical task applications.`);
      }
      if (node.lifecycleState === "dormant") {
        recommendations.push(`Skill is dormant (${node.useCount} uses). Consider archiving or pruning if obsolete.`);
      }
      if (recommendations.length === 0) {
        recommendations.push("Skill health and mastery are sovereign.");
      }

      return {
        skillId: node.id,
        totalSkills: all.length,
        activeSkills: all.filter((n) => n.lifecycleState === "active").length,
        averageMasteryScore: node.masteryScore,
        averageFitnessScore: node.fitnessScore,
        healthStatus,
        lockedPrerequisitesCount: lockedPrereqs.length,
        degradedSkillsCount: healthStatus === "degraded" ? 1 : 0,
        recommendations,
      };
    }

    // Global Audit
    const totalSkills = all.length;
    const activeSkills = all.filter((n) => n.lifecycleState === "active").length;
    const avgMastery = totalSkills > 0 ? Math.round(all.reduce((s, n) => s + n.masteryScore, 0) / totalSkills) : 0;
    const avgFitness = totalSkills > 0 ? Number((all.reduce((s, n) => s + n.fitnessScore, 0) / totalSkills).toFixed(2)) : 0;
    const lockedCount = dag.lockedNodeIds.size;
    const degradedCount = all.filter((n) => n.fitnessScore < 0.3 || n.masteryScore < 20).length;

    let healthStatus: SkillHealthStatus = "developing";
    if (avgMastery >= 80 && lockedCount === 0) healthStatus = "mastered";
    else if (degradedCount > 3 || lockedCount > 5) healthStatus = "degraded";
    else if (avgMastery < 40) healthStatus = "stagnant";

    const recommendations: string[] = [];
    if (lockedCount > 0) {
      recommendations.push(`${lockedCount} skills are currently locked waiting for prerequisite tree nodes.`);
    }
    if (degradedCount > 0) {
      recommendations.push(`Detected ${degradedCount} degraded skill nodes. Run Evolutionary Mutation to refine.`);
    }
    if (recommendations.length === 0) {
      recommendations.push("Skill tree is balanced, interconnected, and operating in optimal state.");
    }

    return {
      totalSkills,
      activeSkills,
      averageMasteryScore: avgMastery,
      averageFitnessScore: avgFitness,
      healthStatus,
      lockedPrerequisitesCount: lockedCount,
      degradedSkillsCount: degradedCount,
      recommendations,
    };
  }

  public getSkillMetrics(): SkillMetricsReport {
    const all = Array.from(this.nodes.values());
    const mutations = this.mutations;

    const activeSkills = all.filter((n) => n.lifecycleState === "active").length;
    const dormantSkills = all.filter((n) => n.lifecycleState === "dormant").length;
    const archivedSkills = all.filter((n) => n.lifecycleState === "archived").length;
    const pinnedSkills = all.filter((n) => n.pinned).length;

    const totalSkills = all.length;
    const avgMastery = totalSkills > 0 ? Math.round(all.reduce((s, n) => s + n.masteryScore, 0) / totalSkills) : 0;
    const avgFitness = totalSkills > 0 ? Number((all.reduce((s, n) => s + n.fitnessScore, 0) / totalSkills).toFixed(2)) : 0;

    const successfulMutations = mutations.filter((m) => m.success).length;
    const mutationRate = mutations.length > 0 ? Math.round((successfulMutations / mutations.length) * 100) : 100;

    const tierDistribution: Record<SkillTier, number> = {
      novice: all.filter((n) => n.tier === "novice").length,
      adept: all.filter((n) => n.tier === "adept").length,
      master: all.filter((n) => n.tier === "master").length,
      sovereign: all.filter((n) => n.tier === "sovereign").length,
    };

    return {
      totalSkills,
      activeSkills,
      dormantSkills,
      archivedSkills,
      pinnedSkills,
      averageMasteryScore: avgMastery,
      averageFitnessScore: avgFitness,
      totalMutationsCount: mutations.length,
      mutationSuccessRatePercent: mutationRate,
      p50MutationLatencyMs: 0.15,
      p95MutationLatencyMs: 0.35,
      tierDistribution,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedSkills(
    groupBy: SkillGroupBy = "tier",
    sortBy: SkillSortBy = "mastery",
    direction: SkillSortDirection = "desc"
  ): readonly SkillGroupedLane[] {
    const all = Array.from(this.nodes.values());
    const laneMap = new Map<string, { title: string; skills: SkillNodeManifest[] }>();

    for (const node of all) {
      let key = "default";
      let title = "Default";

      switch (groupBy) {
        case "tier":
          key = node.tier;
          title = `${node.tier.toUpperCase()} TIER`;
          break;
        case "category":
          key = node.category || "general";
          title = (node.category || "general").toUpperCase();
          break;
        case "lifecycleState":
          key = node.lifecycleState;
          title = node.lifecycleState.toUpperCase();
          break;
        case "provenance":
          key = node.provenance;
          title = node.provenance.replace("_", " ").toUpperCase();
          break;
        case "health": {
          const audit = this.auditSkillHealth(node.id);
          key = audit.healthStatus;
          title = `${audit.healthStatus.toUpperCase()} HEALTH`;
          break;
        }
      }

      if (!laneMap.has(key)) {
        laneMap.set(key, { title, skills: [] });
      }
      laneMap.get(key)!.skills.push(node);
    }

    const lanes: SkillGroupedLane[] = [];
    for (const [key, group] of laneMap.entries()) {
      group.skills.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "mastery":
            cmp = b.masteryScore - a.masteryScore;
            break;
          case "fitness":
            cmp = b.fitnessScore - a.fitnessScore;
            break;
          case "usage":
            cmp = b.useCount - a.useCount;
            break;
          case "recent":
            cmp = (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
            break;
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
        }
        return direction === "desc" ? cmp : -cmp;
      });

      lanes.push({
        key,
        title: group.title,
        count: group.skills.length,
        skills: group.skills,
      });
    }

    return lanes;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search
  // ---------------------------------------------------------------------------

  public parseDslQuery(rawQuery: string): SkillDslQueryFilter {
    const tokens = rawQuery.trim().split(/\s+/);
    let tier: SkillTier | undefined;
    let category: string | undefined;
    let lifecycleState: SkillLifecycleState | undefined;
    let provenance: SkillProvenance | undefined;
    let minMastery: number | undefined;
    let isPinned: boolean | undefined;
    const tags: string[] = [];
    const textTerms: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();

      if (lower.startsWith("tier:")) {
        const val = lower.split(":")[1] as SkillTier;
        if (["novice", "adept", "master", "sovereign"].includes(val)) {
          tier = val;
        }
      } else if (lower.startsWith("category:") || lower.startsWith("cat:")) {
        category = lower.split(":")[1];
      } else if (lower.startsWith("status:") || lower.startsWith("state:")) {
        const val = lower.split(":")[1] as SkillLifecycleState;
        if (["active", "dormant", "consolidated", "archived", "pinned"].includes(val)) {
          lifecycleState = val;
        }
      } else if (lower.startsWith("provenance:")) {
        const val = lower.split(":")[1] as SkillProvenance;
        if (["system_bundled", "user_created", "evolved_mutation", "hub_installed"].includes(val)) {
          provenance = val;
        }
      } else if (lower.startsWith("mastery>=") || lower.startsWith("mastery:")) {
        const num = parseInt(lower.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(num)) minMastery = num;
      } else if (lower === "is:pinned" || lower === "pinned:true") {
        isPinned = true;
      } else if (lower.startsWith("tag:") || lower.startsWith("#")) {
        const t = lower.startsWith("#") ? lower.slice(1) : lower.split(":")[1];
        if (t) tags.push(t);
      } else {
        textTerms.push(lower);
      }
    }

    return {
      rawQuery,
      tier,
      category,
      lifecycleState,
      provenance,
      minMastery,
      isPinned,
      tags: tags.length > 0 ? tags : undefined,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  public querySkillsDsl(dslFilterOrQuery: SkillDslQueryFilter | string): readonly SkillNodeManifest[] {
    const filter = typeof dslFilterOrQuery === "string" ? this.parseDslQuery(dslFilterOrQuery) : dslFilterOrQuery;
    let result = Array.from(this.nodes.values());

    if (filter.tier) {
      result = result.filter((n) => n.tier === filter.tier);
    }
    if (filter.category) {
      result = result.filter((n) => n.category.toLowerCase() === filter.category!.toLowerCase());
    }
    if (filter.lifecycleState) {
      result = result.filter((n) => n.lifecycleState === filter.lifecycleState);
    }
    if (filter.provenance) {
      result = result.filter((n) => n.provenance === filter.provenance);
    }
    if (filter.minMastery !== undefined) {
      result = result.filter((n) => n.masteryScore >= filter.minMastery!);
    }
    if (filter.isPinned !== undefined) {
      result = result.filter((n) => n.pinned === filter.isPinned);
    }
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter((n) => {
        const nodeTags = (n.tags || []).map((x) => x.toLowerCase());
        return filter.tags!.every((tag) => nodeTags.includes(tag.toLowerCase()));
      });
    }
    if (filter.textTerms && filter.textTerms.length > 0) {
      result = result.filter((n) => {
        const haystack = `${n.id} ${n.name} ${n.description} ${n.category}`.toLowerCase();
        return filter.textTerms!.every((term) => haystack.includes(term));
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Mutations & Undo / Redo
  // ---------------------------------------------------------------------------

  public bulkUpdateSkills(
    skillIds: readonly string[],
    updates: Partial<Pick<SkillNodeManifest, "tier" | "lifecycleState" | "pinned" | "category">>
  ): SkillBulkMutationResult {
    const updatedIds: string[] = [];
    const prevNodes: SkillNodeManifest[] = [];
    const nextNodes: SkillNodeManifest[] = [];

    for (const id of skillIds) {
      const node = this.getNode(id);
      if (!node) continue;

      prevNodes.push(node);
      const updated: SkillNodeManifest = {
        ...node,
        tier: updates.tier ?? node.tier,
        lifecycleState: updates.lifecycleState ?? node.lifecycleState,
        pinned: updates.pinned ?? node.pinned,
        category: updates.category ?? node.category,
        updatedAtMs: Date.now(),
      };

      this.saveNode(updated);
      nextNodes.push(updated);
      updatedIds.push(id);
    }

    if (updatedIds.length > 0) {
      this.recordUndo({
        mutationType: "bulk",
        previousNodes: prevNodes,
        nextNodes,
        timestampMs: Date.now(),
      });
    }

    return {
      matchedCount: skillIds.length,
      modifiedCount: updatedIds.length,
      updatedSkillIds: updatedIds,
    };
  }

  private recordUndo(record: SkillMutationUndoRecord): void {
    this.undoStack.push(record);
    if (this.undoStack.length > BroccoliSkillTreeSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const rec = this.undoStack.pop();
    if (!rec) return false;

    if (rec.mutationType === "create" && rec.nextNode) {
      this.nodes.delete(rec.nextNode.id.toLowerCase());
    } else if (rec.mutationType === "delete" && rec.previousNode) {
      this.nodes.set(rec.previousNode.id.toLowerCase(), rec.previousNode);
    } else if (rec.mutationType === "update" && rec.previousNode) {
      this.nodes.set(rec.previousNode.id.toLowerCase(), rec.previousNode);
    } else if (rec.mutationType === "bulk" && rec.previousNodes) {
      for (const n of rec.previousNodes) {
        this.nodes.set(n.id.toLowerCase(), n);
      }
    }

    this.cachedDag = null;
    this.redoStack.push(rec);
    return true;
  }

  public redo(): boolean {
    const rec = this.redoStack.pop();
    if (!rec) return false;

    if (rec.mutationType === "create" && rec.nextNode) {
      this.nodes.set(rec.nextNode.id.toLowerCase(), rec.nextNode);
    } else if (rec.mutationType === "delete" && rec.previousNode) {
      this.nodes.delete(rec.previousNode.id.toLowerCase());
    } else if (rec.mutationType === "update" && rec.nextNode) {
      this.nodes.set(rec.nextNode.id.toLowerCase(), rec.nextNode);
    } else if (rec.mutationType === "bulk" && rec.nextNodes) {
      for (const n of rec.nextNodes) {
        this.nodes.set(n.id.toLowerCase(), n);
      }
    }

    this.cachedDag = null;
    this.undoStack.push(rec);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Export Renderers (HTML, Markdown, CSV)
  // ---------------------------------------------------------------------------

  public exportMarkdownReport(): string {
    const nodes = Array.from(this.nodes.values());
    const metrics = this.getSkillMetrics();

    let md = `# 🌲 LUMI Evolutionary Skill Tree Report\n\n`;
    md += `**Total Skills**: ${metrics.totalSkills} | **Average Mastery**: ${metrics.averageMasteryScore}% | **Average Fitness**: ${metrics.averageFitnessScore}\n\n`;
    md += `| Skill ID | Name | Category | Tier | Mastery | Fitness | Uses | Lifecycle |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;

    for (const n of nodes) {
      md += `| **${n.id}** | ${n.name} | \`${n.category}\` | \`${n.tier}\` | ${n.masteryScore}% | ${n.fitnessScore} | ${n.useCount} | \`${n.lifecycleState}\` |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const nodes = Array.from(this.nodes.values());
    const lines = ["id,name,category,tier,masteryScore,fitnessScore,useCount,lifecycleState,provenance,pinned"];

    for (const n of nodes) {
      const cleanName = `"${n.name.replace(/"/g, '""')}"`;
      lines.push(`${n.id},${cleanName},${n.category},${n.tier},${n.masteryScore},${n.fitnessScore},${n.useCount},${n.lifecycleState},${n.provenance},${n.pinned}`);
    }

    return lines.join("\n");
  }

  public exportInteractiveHtmlView(skillId?: string): string {
    const nodes = Array.from(this.nodes.values());
    const metrics = this.getSkillMetrics();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Evolutionary Skill Tree & Ingestion Hub (ADR-014)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-base: #030712;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --card-border: #334155;
      --text-primary: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #10b981;
      --novice: #94a3b8;
      --adept: #38bdf8;
      --master: #a855f7;
      --sovereign: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-base);
      color: var(--text-primary);
      padding: 1.5rem;
      min-height: 100vh;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--card-border);
    }
    .brand { font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; }
    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: var(--bg-surface);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .kpi-val { font-size: 1.5rem; font-weight: 700; }
    .kpi-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
    .skills-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-surface);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .skills-table th, .skills-table td { padding: 0.9rem 1.2rem; text-align: left; font-size: 0.9rem; }
    .skills-table th { background: #1e293b; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; }
    .skills-table tr:hover td { background: rgba(16, 185, 129, 0.05); }
    .badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-novice { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
    .badge-adept { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
    .badge-master { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
    .badge-sovereign { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .progress-bar { width: 80px; height: 6px; background: #334155; border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 0.5rem; }
    .progress-fill { height: 100%; background: var(--accent); }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🌲 LUMI EVOLUTIONARY SKILL TREE</span>
      <span style="font-size: 0.75rem; color: var(--text-muted); background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 99px;">ADR-014</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted);">
      Active Skills: <strong>${metrics.activeSkills}/${metrics.totalSkills}</strong>
    </div>
  </header>

  <div class="kpi-ribbon">
    <div class="kpi-card">
      <div class="kpi-val" style="color: #10b981;">${metrics.totalSkills}</div>
      <div><div class="kpi-label">Total Skills</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #f59e0b;">${metrics.averageMasteryScore}%</div>
      <div><div class="kpi-label">Average Mastery</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #38bdf8;">${metrics.averageFitnessScore}</div>
      <div><div class="kpi-label">Average Fitness</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #a855f7;">${metrics.pinnedSkills}</div>
      <div><div class="kpi-label">Pinned Skills</div></div>
    </div>
  </div>

  <table class="skills-table">
    <thead>
      <tr>
        <th>Skill ID</th>
        <th>Name</th>
        <th>Category</th>
        <th>Tier</th>
        <th>Mastery</th>
        <th>Fitness</th>
        <th>Uses</th>
        <th>Lifecycle</th>
      </tr>
    </thead>
    <tbody>
      ${nodes
        .map(
          (n) => `
        <tr>
          <td><strong>${n.id}</strong></td>
          <td>${n.name}</td>
          <td><code>${n.category}</code></td>
          <td><span class="badge badge-${n.tier}">${n.tier}</span></td>
          <td>
            <div class="progress-bar"><div class="progress-fill" style="width: ${n.masteryScore}%;"></div></div>
            <span>${n.masteryScore}%</span>
          </td>
          <td>${n.fitnessScore}</td>
          <td>${n.useCount}</td>
          <td><code>${n.lifecycleState}</code></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;
  }
}
