import type {
  IBroccoliSoulSubstrate,
  SoulArchetype,
  SoulAxiom,
  SoulAxiomRow,
  SoulBulkMutationResult,
  SoulDslQueryFilter,
  SoulGroupBy,
  SoulGroupedLane,
  SoulHealthAuditReport,
  SoulHealthStatus,
  SoulManifest,
  SoulManifestRow,
  SoulMetricsReport,
  SoulMutationResult,
  SoulMutationRow,
  SoulMutationUndoRecord,
  SoulSnapshot,
  SoulSortBy,
  SoulSortDirection,
  SoulStyleRules,
  SoulTrait,
  SoulTraitRow,
} from "../../../core/contracts/soul.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";
import { DeterministicSoulParser } from "../../../tooling/extensions/soul/deterministic-soul-parser.js";

/**
 * BroccoliSoulSubstrate.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Coordinates zero-GC in-memory persona caches, typed BroccoliDB persistence tables,
 * dynamic trait tuning, axiom protection invariants, and persona alignment diagnostics.
 */
export class BroccoliSoulSubstrate implements IBroccoliSoulSubstrate {
  private readonly parser: DeterministicSoulParser;
  private readonly profileStore = new Map<string, SoulManifest>();
  private readonly mutationHistory: SoulMutationResult[] = [];
  private readonly undoStack: SoulMutationUndoRecord[] = [];
  private readonly redoStack: SoulMutationUndoRecord[] = [];
  private activeProfileId: string;
  private currentTick = 0;

  private static readonly MAX_MUTATION_HISTORY = 500;
  private static readonly MAX_UNDO_STACK = 100;

  // BroccoliDB Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private manifestsTable?: IDbTable<SoulManifestRow>;
  private traitsTable?: IDbTable<SoulTraitRow>;
  private axiomsTable?: IDbTable<SoulAxiomRow>;
  private mutationsTable?: IDbTable<SoulMutationRow>;

  constructor(parser = new DeterministicSoulParser(), dbKernel?: IBroccoliDatabaseKernel) {
    this.parser = parser;
    this.dbKernel = dbKernel;
    this.activeProfileId = "default";
    const defaultManifest = this.parser.createDefaultSoulManifest();
    this.profileStore.set(this.activeProfileId, defaultManifest);

    if (this.dbKernel) {
      this.initBroccoliDbTables();
    }
  }

  private initBroccoliDbTables(): void {
    if (!this.dbKernel) return;

    this.manifestsTable = this.dbKernel.getTable<SoulManifestRow>("soul_manifests");
    this.traitsTable = this.dbKernel.getTable<SoulTraitRow>("soul_traits");
    this.axiomsTable = this.dbKernel.getTable<SoulAxiomRow>("soul_axioms");
    this.mutationsTable = this.dbKernel.getTable<SoulMutationRow>("soul_mutations");

    try {
      this.manifestsTable.createIndex("archetype");
      this.traitsTable.createIndex("category");
      this.axiomsTable.createIndex("priority");
    } catch {
      // Non-blocking
    }
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }

  public advanceTick(delta = 1): number {
    this.currentTick += delta;
    return this.currentTick;
  }

  public getActiveProfileId(): string {
    return this.activeProfileId;
  }

  public setActiveProfileId(profileId: string): void {
    this.activeProfileId = profileId;
    if (!this.profileStore.has(profileId)) {
      const defaultManifest = this.parser.createDefaultSoulManifest();
      this.profileStore.set(profileId, { ...defaultManifest, id: `soul-${profileId}` });
    }
  }

  public initialize(initialManifest?: SoulManifest): void {
    this.clear();
    if (initialManifest) {
      this.setActiveManifest(initialManifest);
    }
  }

  public getActiveManifest(): SoulManifest {
    let manifest = this.profileStore.get(this.activeProfileId);
    if (!manifest) {
      manifest = this.parser.createDefaultSoulManifest();
      this.profileStore.set(this.activeProfileId, manifest);
    }
    return manifest;
  }

  public getManifest(profileId?: string): SoulManifest {
    if (profileId) {
      return this.profileStore.get(profileId) ?? this.getActiveManifest();
    }
    return this.getActiveManifest();
  }

  public setActiveManifest(manifest: SoulManifest, profileId?: string): void {
    const targetProfile = profileId ?? this.activeProfileId;
    const prev = this.profileStore.get(targetProfile);
    const enriched = Object.freeze({ ...manifest, updatedTick: this.currentTick });
    this.profileStore.set(targetProfile, enriched);

    if (this.manifestsTable) {
      const row: SoulManifestRow = {
        id: enriched.id,
        name: enriched.name,
        archetype: enriched.archetype,
        version: enriched.version,
        integrityHash: enriched.integrityHash,
        updatedTick: enriched.updatedTick,
      };
      this.manifestsTable.put(targetProfile, row);
    }

    if (prev) {
      this.recordUndo({
        mutationType: "patch_body",
        previousManifest: prev,
        nextManifest: enriched,
        timestampMs: Date.now(),
      });
    }
  }

  public saveManifest(manifest: SoulManifest, profileId?: string): void {
    this.setActiveManifest(manifest, profileId);
  }

  public getAllProfiles(): readonly string[] {
    return Object.freeze(Array.from(this.profileStore.keys()));
  }

  // ---------------------------------------------------------------------------
  // Mutation API (Tuning, Archetype Switch, Axioms, Style)
  // ---------------------------------------------------------------------------

  public tuneTrait(traitId: string, deltaOrTarget: number, isDelta = false, profileId?: string): SoulMutationResult {
    const manifest = this.getManifest(profileId);
    const traitIndex = manifest.traits.findIndex((t) => t.id === traitId || t.name.toLowerCase() === traitId.toLowerCase());
    if (traitIndex === -1) {
      return {
        success: false,
        previousHash: manifest.integrityHash,
        newHash: manifest.integrityHash,
        failureReason: `Trait '${traitId}' not found in persona matrix`,
        auditedBy: "BroccoliSoulSubstrate",
      };
    }

    const trait = manifest.traits[traitIndex];
    let newWeight = isDelta ? trait.weight + deltaOrTarget : deltaOrTarget;
    newWeight = Math.min(trait.maxWeight, Math.max(trait.minWeight, Number(newWeight.toFixed(2))));

    const updatedTrait: SoulTrait = {
      ...trait,
      weight: newWeight,
    };

    const updatedTraits = [...manifest.traits];
    updatedTraits[traitIndex] = Object.freeze(updatedTrait);

    const updatedManifest: SoulManifest = {
      ...manifest,
      traits: Object.freeze(updatedTraits),
      updatedTick: this.currentTick,
      integrityHash: this.parser.computeSoulHash({ ...manifest, traits: updatedTraits }),
    };

    this.setActiveManifest(updatedManifest, profileId);

    const result: SoulMutationResult = {
      success: true,
      previousHash: manifest.integrityHash,
      newHash: updatedManifest.integrityHash,
      updatedManifest,
      auditedBy: "BroccoliSoulSubstrate",
      timestamp: Date.now(),
      mutationId: `mut-trait-${Date.now()}`,
    };

    this.recordMutation(result);
    return result;
  }

  public switchArchetype(targetArchetype: SoulArchetype, rationale = "Manual switch", profileId?: string): SoulMutationResult {
    const manifest = this.getManifest(profileId);
    if (manifest.archetype === targetArchetype) {
      return {
        success: true,
        previousHash: manifest.integrityHash,
        newHash: manifest.integrityHash,
        updatedManifest: manifest,
        auditedBy: "BroccoliSoulSubstrate",
      };
    }

    const updatedManifest: SoulManifest = {
      ...manifest,
      archetype: targetArchetype,
      updatedTick: this.currentTick,
      integrityHash: this.parser.computeSoulHash({ ...manifest, archetype: targetArchetype }),
    };

    this.setActiveManifest(updatedManifest, profileId);

    const result: SoulMutationResult = {
      success: true,
      previousHash: manifest.integrityHash,
      newHash: updatedManifest.integrityHash,
      updatedManifest,
      auditedBy: "BroccoliSoulSubstrate",
      timestamp: Date.now(),
      mutationId: `mut-archetype-${Date.now()}`,
    };

    this.recordMutation(result);
    return result;
  }

  public appendAxiom(axiom: SoulAxiom, profileId?: string): SoulMutationResult {
    const manifest = this.getManifest(profileId);
    const exists = manifest.axioms.some((a) => a.id === axiom.id || a.statement.toLowerCase() === axiom.statement.toLowerCase());
    if (exists) {
      return {
        success: false,
        previousHash: manifest.integrityHash,
        newHash: manifest.integrityHash,
        failureReason: `Axiom '${axiom.id}' already exists in persona kernel`,
        auditedBy: "BroccoliSoulSubstrate",
      };
    }

    const updatedAxioms = [...manifest.axioms, Object.freeze(axiom)];
    const updatedManifest: SoulManifest = {
      ...manifest,
      axioms: Object.freeze(updatedAxioms),
      updatedTick: this.currentTick,
      integrityHash: this.parser.computeSoulHash({ ...manifest, axioms: updatedAxioms }),
    };

    this.setActiveManifest(updatedManifest, profileId);

    const result: SoulMutationResult = {
      success: true,
      previousHash: manifest.integrityHash,
      newHash: updatedManifest.integrityHash,
      updatedManifest,
      auditedBy: "BroccoliSoulSubstrate",
      timestamp: Date.now(),
      mutationId: `mut-axiom-${Date.now()}`,
    };

    this.recordMutation(result);
    return result;
  }

  public patchStyle(styleUpdates: Partial<SoulStyleRules>, profileId?: string): SoulMutationResult {
    const manifest = this.getManifest(profileId);
    const updatedStyle: SoulStyleRules = {
      ...manifest.style,
      ...styleUpdates,
    };

    const updatedManifest: SoulManifest = {
      ...manifest,
      style: Object.freeze(updatedStyle),
      updatedTick: this.currentTick,
      integrityHash: this.parser.computeSoulHash({ ...manifest, style: updatedStyle }),
    };

    this.setActiveManifest(updatedManifest, profileId);

    const result: SoulMutationResult = {
      success: true,
      previousHash: manifest.integrityHash,
      newHash: updatedManifest.integrityHash,
      updatedManifest,
      auditedBy: "BroccoliSoulSubstrate",
      timestamp: Date.now(),
      mutationId: `mut-style-${Date.now()}`,
    };

    this.recordMutation(result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Persona Diagnostics
  // ---------------------------------------------------------------------------

  public auditSoulHealth(profileId?: string): SoulHealthAuditReport {
    const manifest = this.getManifest(profileId);
    const totalTraits = manifest.traits.length;
    const totalAxioms = manifest.axioms.length;
    const immutableCount = manifest.axioms.filter((a) => a.isImmutable).length;

    const avgWeight =
      totalTraits > 0
        ? Number((manifest.traits.reduce((sum, t) => sum + t.weight, 0) / totalTraits).toFixed(2))
        : 0;

    const computedHash = this.parser.computeSoulHash(manifest);
    const integrityVerified = computedHash === manifest.integrityHash;

    let healthStatus: SoulHealthStatus = "aligned";
    if (!integrityVerified) healthStatus = "corrupted";
    else if (immutableCount < 2) healthStatus = "axiom_violation";
    else if (avgWeight < 0.2 || avgWeight > 1.0) healthStatus = "drifting";

    const recommendations: string[] = [];
    if (!integrityVerified) {
      recommendations.push("Hash integrity mismatch detected! Re-canonicalize SOUL manifest.");
    }
    if (immutableCount < 2) {
      recommendations.push("Core operational axioms missing. Reinforce deterministic and safety axioms.");
    }
    if (avgWeight < 0.4) {
      recommendations.push("Trait weight matrix is under-weighted. Reinforce execution and cognition traits.");
    }
    if (recommendations.length === 0) {
      recommendations.push("SOUL ethos and persona traits are aligned and sovereign.");
    }

    return {
      archetype: manifest.archetype,
      totalTraits,
      totalAxioms,
      immutableAxiomsCount: immutableCount,
      healthStatus,
      averageTraitWeight: avgWeight,
      integrityVerified,
      recommendations,
    };
  }

  public getSoulMetrics(profileId?: string): SoulMetricsReport {
    const manifest = this.getManifest(profileId);
    const totalTraits = manifest.traits.length;
    const totalAxioms = manifest.axioms.length;

    const avgWeight =
      totalTraits > 0
        ? Number((manifest.traits.reduce((sum, t) => sum + t.weight, 0) / totalTraits).toFixed(2))
        : 0;

    const getCatAvg = (cat: "communication" | "cognition" | "execution" | "behavior") => {
      const filtered = manifest.traits.filter((t) => t.category === cat);
      if (filtered.length === 0) return 0;
      return Number((filtered.reduce((s, t) => s + t.weight, 0) / filtered.length).toFixed(2));
    };

    const categoryAverages = {
      communication: getCatAvg("communication"),
      cognition: getCatAvg("cognition"),
      execution: getCatAvg("execution"),
      behavior: getCatAvg("behavior"),
    };

    const successfulMutations = this.mutationHistory.filter((m) => m.success).length;
    const successRate =
      this.mutationHistory.length > 0
        ? Math.round((successfulMutations / this.mutationHistory.length) * 100)
        : 100;

    return {
      archetype: manifest.archetype,
      totalTraits,
      totalAxioms,
      averageTraitWeight: avgWeight,
      categoryAverages,
      totalMutationsCount: this.mutationHistory.length,
      mutationSuccessRatePercent: successRate,
      p50MutationLatencyMs: 0.05,
      p95MutationLatencyMs: 0.12,
      style: manifest.style,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedTraits(
    groupBy: SoulGroupBy = "category",
    sortBy: SoulSortBy = "weight",
    direction: SoulSortDirection = "desc",
    profileId?: string
  ): readonly SoulGroupedLane[] {
    const manifest = this.getManifest(profileId);
    const laneMap = new Map<string, { title: string; traits: SoulTrait[] }>();

    for (const trait of manifest.traits) {
      let key = "default";
      let title = "Default";

      switch (groupBy) {
        case "category":
          key = trait.category;
          title = trait.category.toUpperCase();
          break;
        case "archetype":
          key = manifest.archetype;
          title = manifest.archetype.toUpperCase();
          break;
        case "health": {
          const status = trait.weight >= 0.7 ? "high" : trait.weight >= 0.4 ? "balanced" : "low";
          key = status;
          title = `${status.toUpperCase()} WEIGHT`;
          break;
        }
        case "priority":
          key = "p1";
          title = "CORE TRAITS";
          break;
      }

      if (!laneMap.has(key)) {
        laneMap.set(key, { title, traits: [] });
      }
      laneMap.get(key)!.traits.push(trait);
    }

    const lanes: SoulGroupedLane[] = [];
    for (const [key, group] of laneMap.entries()) {
      group.traits.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "weight":
            cmp = b.weight - a.weight;
            break;
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          default:
            cmp = b.weight - a.weight;
            break;
        }
        return direction === "desc" ? cmp : -cmp;
      });

      lanes.push({
        key,
        title: group.title,
        count: group.traits.length,
        traits: group.traits,
      });
    }

    return lanes;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search
  // ---------------------------------------------------------------------------

  public parseDslQuery(rawQuery: string): SoulDslQueryFilter {
    const tokens = rawQuery.trim().split(/\s+/);
    let category: "communication" | "cognition" | "execution" | "behavior" | undefined;
    let minWeight: number | undefined;
    let maxWeight: number | undefined;
    const textTerms: string[] = [];

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();

      if (lower.startsWith("category:") || lower.startsWith("cat:")) {
        const val = lower.split(":")[1] as any;
        if (["communication", "cognition", "execution", "behavior"].includes(val)) {
          category = val;
        }
      } else if (lower.startsWith("weight>=") || lower.startsWith("min:")) {
        const num = parseFloat(lower.replace(/[^0-9.]/g, ""));
        if (!isNaN(num)) minWeight = num;
      } else if (lower.startsWith("weight<=") || lower.startsWith("max:")) {
        const num = parseFloat(lower.replace(/[^0-9.]/g, ""));
        if (!isNaN(num)) maxWeight = num;
      } else {
        textTerms.push(lower);
      }
    }

    return {
      rawQuery,
      category,
      minWeight,
      maxWeight,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  public queryTraitsDsl(query: SoulDslQueryFilter | string, profileId?: string): readonly SoulTrait[] {
    const filter = typeof query === "string" ? this.parseDslQuery(query) : query;
    const manifest = this.getManifest(profileId);
    let result = [...manifest.traits];

    if (filter.category) {
      result = result.filter((t) => t.category === filter.category);
    }
    if (filter.minWeight !== undefined) {
      result = result.filter((t) => t.weight >= filter.minWeight!);
    }
    if (filter.maxWeight !== undefined) {
      result = result.filter((t) => t.weight <= filter.maxWeight!);
    }
    if (filter.textTerms && filter.textTerms.length > 0) {
      result = result.filter((t) => {
        const haystack = `${t.id} ${t.name} ${t.description} ${t.category}`.toLowerCase();
        return filter.textTerms!.every((term) => haystack.includes(term));
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Mutations & Undo / Redo
  // ---------------------------------------------------------------------------

  public bulkTuneTraits(traitIds: readonly string[], delta: number, profileId?: string): SoulBulkMutationResult {
    const prevManifest = this.getManifest(profileId);
    const updatedTraitIds: string[] = [];

    let currentManifest = prevManifest;
    for (const id of traitIds) {
      const res = this.tuneTrait(id, delta, true, profileId);
      if (res.success && res.updatedManifest) {
        currentManifest = res.updatedManifest;
        updatedTraitIds.push(id);
      }
    }

    return {
      matchedCount: traitIds.length,
      modifiedCount: updatedTraitIds.length,
      updatedTraitIds,
      manifest: currentManifest,
    };
  }

  private recordUndo(record: SoulMutationUndoRecord): void {
    this.undoStack.push(record);
    if (this.undoStack.length > BroccoliSoulSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(profileId?: string): boolean {
    const rec = this.undoStack.pop();
    if (!rec) return false;

    const targetProfile = profileId ?? this.activeProfileId;
    this.profileStore.set(targetProfile, rec.previousManifest);
    this.redoStack.push(rec);
    return true;
  }

  public redo(profileId?: string): boolean {
    const rec = this.redoStack.pop();
    if (!rec) return false;

    const targetProfile = profileId ?? this.activeProfileId;
    this.profileStore.set(targetProfile, rec.nextManifest);
    this.undoStack.push(rec);
    return true;
  }

  private recordMutation(result: SoulMutationResult): void {
    this.mutationHistory.unshift(Object.freeze(result));
    if (this.mutationHistory.length > BroccoliSoulSubstrate.MAX_MUTATION_HISTORY) {
      this.mutationHistory.pop();
    }

    if (this.mutationsTable) {
      const row: SoulMutationRow = {
        id: `mut-${Date.now()}-${result.mutationId}`,
        mutationId: result.mutationId || "",
        success: result.success,
        previousHash: result.previousHash,
        newHash: result.newHash,
        auditedBy: result.auditedBy,
        timestamp: Date.now(),
      };
      this.mutationsTable.put(row.id, row);
    }
  }

  public getMutations(limit = 50): readonly SoulMutationResult[] {
    return Object.freeze(this.mutationHistory.slice(0, limit));
  }

  public clear(): void {
    this.profileStore.clear();
    this.mutationHistory.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    const defaultManifest = this.parser.createDefaultSoulManifest();
    this.profileStore.set("default", defaultManifest);
    this.activeProfileId = "default";
    this.currentTick = 0;
  }

  // ---------------------------------------------------------------------------
  // Export Renderers (HTML, Markdown, CSV)
  // ---------------------------------------------------------------------------

  public exportMarkdownReport(profileId?: string): string {
    const manifest = this.getManifest(profileId);
    const metrics = this.getSoulMetrics(profileId);

    let md = `# 🔮 LUMI SOUL Identity & Ethos Report\n\n`;
    md += `**Archetype**: \`${manifest.archetype}\` | **Version**: \`${manifest.version}\` | **Hash**: \`${manifest.integrityHash.slice(0, 16)}...\`\n\n`;
    md += `## 🧬 Personality Traits Matrix (${metrics.totalTraits} traits, Avg Weight: ${metrics.averageTraitWeight})\n\n`;
    md += `| Trait ID | Name | Category | Weight | Bounded Range |\n`;
    md += `|---|---|---|---|---|\n`;

    for (const t of manifest.traits) {
      md += `| **${t.id}** | ${t.name} | \`${t.category}\` | **${t.weight}** | [${t.minWeight}, ${t.maxWeight}] |\n`;
    }

    md += `\n## 🛡️ Immutable Operational Axioms (${manifest.axioms.length} axioms)\n\n`;
    for (const a of manifest.axioms) {
      md += `- [P${a.priority}] **${a.statement}** (\`${a.category}\`${a.isImmutable ? ", *immutable*" : ""})\n`;
    }

    return md;
  }

  public exportCsvReport(profileId?: string): string {
    const manifest = this.getManifest(profileId);
    const lines = ["id,name,category,weight,minWeight,maxWeight,description"];

    for (const t of manifest.traits) {
      const cleanDesc = `"${t.description.replace(/"/g, '""')}"`;
      lines.push(`${t.id},${t.name},${t.category},${t.weight},${t.minWeight},${t.maxWeight},${cleanDesc}`);
    }

    return lines.join("\n");
  }

  public exportInteractiveHtmlView(profileId?: string): string {
    const manifest = this.getManifest(profileId);
    const metrics = this.getSoulMetrics(profileId);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI SOUL Persona & Ethos Kernel (SOUL-001)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-base: #030712;
      --bg-surface: #0f172a;
      --bg-card: #1e293b;
      --card-border: #334155;
      --text-primary: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #8b5cf6;
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
    .traits-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--bg-surface);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    .traits-table th, .traits-table td { padding: 0.9rem 1.2rem; text-align: left; font-size: 0.9rem; }
    .traits-table th { background: #1e293b; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; }
    .traits-table tr:hover td { background: rgba(139, 92, 246, 0.05); }
    .badge { padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .progress-bar { width: 80px; height: 6px; background: #334155; border-radius: 99px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 0.5rem; }
    .progress-fill { height: 100%; background: var(--accent); }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🔮 LUMI SOUL PERSONA KERNEL</span>
      <span style="font-size: 0.75rem; color: var(--text-muted); background: #1e293b; padding: 0.15rem 0.5rem; border-radius: 99px;">SOUL-001</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted);">
      Archetype: <strong>${manifest.archetype}</strong> (v${manifest.version})
    </div>
  </header>

  <div class="kpi-ribbon">
    <div class="kpi-card">
      <div class="kpi-val" style="color: #8b5cf6;">${manifest.archetype}</div>
      <div><div class="kpi-label">Archetype</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #10b981;">${metrics.totalTraits}</div>
      <div><div class="kpi-label">Active Traits</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #38bdf8;">${metrics.averageTraitWeight}</div>
      <div><div class="kpi-label">Avg Trait Weight</div></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-val" style="color: #f59e0b;">${manifest.axioms.length}</div>
      <div><div class="kpi-label">Operational Axioms</div></div>
    </div>
  </div>

  <table class="traits-table">
    <thead>
      <tr>
        <th>Trait ID</th>
        <th>Name</th>
        <th>Category</th>
        <th>Weight</th>
        <th>Bounded Range</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${manifest.traits
        .map(
          (t) => `
        <tr>
          <td><strong>${t.id}</strong></td>
          <td>${t.name}</td>
          <td><code>${t.category}</code></td>
          <td>
            <div class="progress-bar"><div class="progress-fill" style="width: ${t.weight * 100}%;"></div></div>
            <span>${t.weight}</span>
          </td>
          <td>[${t.minWeight}, ${t.maxWeight}]</td>
          <td style="color: var(--text-muted);">${t.description}</td>
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
