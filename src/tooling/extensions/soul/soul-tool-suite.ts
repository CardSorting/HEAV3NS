import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SoulArchetype,
  SoulAxiom,
  SoulGroupBy,
  SoulSortBy,
  SoulSortDirection,
  SoulStyleRules,
} from "../../../core/contracts/soul.contracts.js";
import { DeterministicSoulParser } from "./deterministic-soul-parser.js";
import { AnchoredSoulMutator } from "./anchored-soul-mutator.js";
import { BroccoliSoulSubstrate } from "../../../sessions/extensions/soul/broccoli-soul-substrate.js";
import { SoulSnapshotManager } from "../../../sessions/extensions/soul/soul-snapshot-manager.js";
import { SoulThreatGuard } from "../../../agents/extensions/soul/soul-threat-guard.js";
import { SoulPromptComposer } from "../../../agents/extensions/soul/soul-prompt-composer.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

/**
 * SoulToolSuite.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Model tool suite exposing persona inspection, trait tuning, archetype switching,
 * integrity verification, SLA diagnostics, and snapshot management.
 */
export class SoulToolSuite {
  private readonly parser: DeterministicSoulParser;
  private readonly mutator: AnchoredSoulMutator;
  private substrate: BroccoliSoulSubstrate;
  private readonly snapshotManager: SoulSnapshotManager;
  private readonly threatGuard: SoulThreatGuard;
  private readonly promptComposer: SoulPromptComposer;

  constructor(
    parser = new DeterministicSoulParser(),
    mutator = new AnchoredSoulMutator(),
    substrate?: BroccoliSoulSubstrate
  ) {
    this.parser = parser;
    this.mutator = mutator;
    this.substrate = substrate ?? new BroccoliSoulSubstrate(parser);
    this.snapshotManager = new SoulSnapshotManager(this.substrate, this.parser);
    this.threatGuard = new SoulThreatGuard();
    this.promptComposer = new SoulPromptComposer();
  }

  setSubstrate(substrate: BroccoliSoulSubstrate): void {
    this.substrate = substrate;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "soul_view",
        description: "Inspect active AI agent SOUL manifest, immutable operational axioms, dynamic traits, and style rules.",
        parameters: {
          profileId: { type: "string", description: "Optional profile identifier to view" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_view", args, cwd);
        },
      },
      {
        name: "soul_tune_trait",
        description: "Safely tune a dynamic personality trait weight within predefined mathematical bounds.",
        parameters: {
          traitId: { type: "string", required: true, description: "Identifier of the trait to tune" },
          weight: { type: "number", required: true, description: "Target weight between 0.0 and 1.0" },
          rationale: { type: "string", description: "Technical justification for modifying the persona trait" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_tune_trait", args, cwd);
        },
      },
      {
        name: "soul_audit_integrity",
        description: "Perform cryptographic SHA-256 verification and immutable axiom compliance check on the active SOUL.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_audit_integrity", args, cwd);
        },
      },
      {
        name: "soul_switch_archetype",
        description: "Switch active agent archetype persona (e.g., 'game_engine_architect', 'formal_verifier', 'security_sentinel').",
        parameters: {
          archetype: { type: "string", required: true, description: "Target archetype persona" },
          rationale: { type: "string", description: "Reason for archetype switch" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_switch_archetype", args, cwd);
        },
      },
      {
        name: "soul_append_axiom",
        description: "Append a new operational or safety axiom to the persona ethos kernel.",
        parameters: {
          id: { type: "string", required: true, description: "Axiom ID" },
          statement: { type: "string", required: true, description: "Axiom rule statement" },
          priority: { type: "number", description: "Priority level (1-10)" },
          category: { type: "string", description: "Category: 'determinism', 'safety', 'integrity', 'performance'" },
          isImmutable: { type: "boolean", description: "Whether axiom is protected from mutation" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_append_axiom", args, cwd);
        },
      },
      {
        name: "soul_patch_style",
        description: "Update style directives (tone, verbosity, codePreference, mathematicalRigor).",
        parameters: {
          tone: { type: "string", description: "Tone: 'direct', 'analytical', 'formal', 'concise', 'collaborative'" },
          verbosity: { type: "string", description: "Verbosity: 'terse', 'balanced', 'detailed'" },
          codePreference: { type: "string", description: "Code style: 'typescript_strict', 'idiomatic_zero_gc', 'minimal_diff'" },
          mathematicalRigor: { type: "string", description: "Rigor: 'informal', 'rigorous', 'axiomatic'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_patch_style", args, cwd);
        },
      },
      {
        name: "soul_audit_health",
        description: "Perform SLA health and persona alignment diagnostics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_audit_health", args, cwd);
        },
      },
      {
        name: "soul_get_metrics",
        description: "Get aggregate telemetry: total traits, category averages, and mutation success rate.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_metrics", args, cwd);
        },
      },
      {
        name: "soul_group_and_sort",
        description: "Group and sort traits into multi-criteria swimlanes.",
        parameters: {
          groupBy: { type: "string", description: "Group by: 'category', 'archetype', 'priority', 'health'" },
          sortBy: { type: "string", description: "Sort by: 'weight', 'priority', 'name'" },
          direction: { type: "string", description: "Sort direction: 'asc' or 'desc'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_group_and_sort", args, cwd);
        },
      },
      {
        name: "soul_search_dsl",
        description: "Search personality traits using natural query DSL (e.g. 'category:cognition weight>=0.7 keyword').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_search_dsl", args, cwd);
        },
      },
      {
        name: "soul_render_dashboard",
        description: "Render a human-readable ANSI CLI summary card for the SOUL persona.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_render_dashboard", args, cwd);
        },
      },
      {
        name: "soul_render_traits",
        description: "Render an ANSI CLI trait matrix with weight meters.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_render_traits", args, cwd);
        },
      },
      {
        name: "soul_export_html",
        description: "Export the SOUL persona state into an interactive single-page HTML application.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_export_html", args, cwd);
        },
      },
      {
        name: "soul_export_markdown",
        description: "Export SOUL manifest and trait matrix as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_export_markdown", args, cwd);
        },
      },
      {
        name: "soul_export_csv",
        description: "Export traits and weights as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_export_csv", args, cwd);
        },
      },
      {
        name: "soul_bulk_tune",
        description: "Tune multiple traits atomically by a delta offset.",
        parameters: {
          traitIds: { type: "string", required: true, description: "Comma-separated trait IDs" },
          delta: { type: "number", required: true, description: "Delta weight adjustment" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_bulk_tune", args, cwd);
        },
      },
      {
        name: "soul_undo",
        description: "Undo the last SOUL mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_undo", args, cwd);
        },
      },
      {
        name: "soul_redo",
        description: "Redo the previously undone SOUL mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_redo", args, cwd);
        },
      },
      {
        name: "soul_snapshot_create",
        description: "Capture an O(1) state snapshot of the active SOUL manifest.",
        parameters: {
          frameIndex: { type: "number", description: "Snapshot frame identifier" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_snapshot_create", args, cwd);
        },
      },
      {
        name: "soul_snapshot_restore",
        description: "Restore SOUL persona state from a previously captured snapshot.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index to restore" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_snapshot_restore", args, cwd);
        },
      },
      {
        name: "soul_reset_manifest",
        description: "Reset the SOUL manifest to default baseline template.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_reset_manifest", args, cwd);
        },
      },
      {
        name: "soul_validate_threat",
        description: "Validate a mutation intent against adversarial injection and axiom corruption.",
        parameters: {
          intentType: { type: "string", required: true, description: "Intent type" },
          rationale: { type: "string", description: "Rationale string" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_validate_threat", args, cwd);
        },
      },
      {
        name: "soul_compose_prompt",
        description: "Compose systemic persona prompt injection header.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_compose_prompt", args, cwd);
        },
      },
      {
        name: "soul_get_archetypes",
        description: "List all standard and custom SOUL archetypes.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_archetypes", args, cwd);
        },
      },
      {
        name: "soul_get_profiles",
        description: "List all active profile spaces in substrate.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_profiles", args, cwd);
        },
      },
      {
        name: "soul_set_active_profile",
        description: "Switch active profile context.",
        parameters: {
          profileId: { type: "string", required: true, description: "Profile ID to activate" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_set_active_profile", args, cwd);
        },
      },
      {
        name: "soul_patch_raw_body",
        description: "Patch raw markdown persona instructions with search-and-replace anchor.",
        parameters: {
          searchAnchor: { type: "string", required: true, description: "Anchor text" },
          replaceWith: { type: "string", required: true, description: "Replacement text" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_patch_raw_body", args, cwd);
        },
      },
      {
        name: "soul_inspect_axioms",
        description: "Inspect list of immutable and operational axioms with category classifications.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_inspect_axioms", args, cwd);
        },
      },
      {
        name: "soul_rebalance_traits",
        description: "Rebalance traits to baseline archetype defaults.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_rebalance_traits", args, cwd);
        },
      },
      {
        name: "soul_get_history",
        description: "Fetch historical mutation results for SOUL evolution.",
        parameters: {
          limit: { type: "number", description: "Max history records" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_history", args, cwd);
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
        case "soul_view": {
          const profileId = typeof args.profileId === "string" ? args.profileId : undefined;
          const manifest = this.substrate.getManifest(profileId);
          this.mutator.recordForensicRead(manifest.id, manifest.integrityHash);
          return { success: true, data: manifest, manifest };
        }

        case "soul_tune_trait": {
          const traitId = String(args.traitId || "");
          const weight = Number(args.weight) || 0.5;
          const res = this.substrate.tuneTrait(traitId, weight, false);
          return { success: res.success, result: res };
        }

        case "soul_audit_integrity": {
          const manifest = this.substrate.getActiveManifest();
          const computedHash = this.parser.computeSoulHash(manifest);
          const valid = computedHash === manifest.integrityHash;
          const data = {
            status: valid ? "OPTIMAL" : "DEGRADED",
            valid,
            manifestHash: manifest.integrityHash,
            computedHash,
            immutableAxiomsCount: manifest.axioms.filter((a) => a.isImmutable).length,
          };
          return {
            success: valid,
            manifestHash: manifest.integrityHash,
            computedHash,
            valid,
            immutableAxiomsCount: manifest.axioms.filter((a) => a.isImmutable).length,
            data,
          };
        }

        case "soul_switch_archetype": {
          const archetype = args.archetype as SoulArchetype;
          const rationale = typeof args.rationale === "string" ? args.rationale : "Manual switch";
          const res = this.substrate.switchArchetype(archetype, rationale);
          return { success: res.success, result: res };
        }

        case "soul_append_axiom": {
          const axiom: SoulAxiom = {
            id: String(args.id || `axiom-${Date.now()}`),
            statement: String(args.statement || ""),
            priority: Number(args.priority) || 5,
            category: (args.category as any) || "determinism",
            isImmutable: Boolean(args.isImmutable),
          };
          const res = this.substrate.appendAxiom(axiom);
          return { success: res.success, result: res };
        }

        case "soul_patch_style": {
          const styleUpdates: {
            tone?: SoulStyleRules["tone"];
            verbosity?: SoulStyleRules["verbosity"];
            codePreference?: SoulStyleRules["codePreference"];
            mathematicalRigor?: SoulStyleRules["mathematicalRigor"];
          } = {};
          if (typeof args.tone === "string") styleUpdates.tone = args.tone as any;
          if (typeof args.verbosity === "string") styleUpdates.verbosity = args.verbosity as any;
          if (typeof args.codePreference === "string") styleUpdates.codePreference = args.codePreference as any;
          if (typeof args.mathematicalRigor === "string") styleUpdates.mathematicalRigor = args.mathematicalRigor as any;
          const res = this.substrate.patchStyle(styleUpdates);
          return { success: res.success, result: res };
        }

        case "soul_audit_health": {
          const audit = this.substrate.auditSoulHealth();
          return { success: true, audit };
        }

        case "soul_get_metrics": {
          const metrics = this.substrate.getSoulMetrics();
          return { success: true, metrics };
        }

        case "soul_group_and_sort": {
          const groupBy = (args.groupBy as SoulGroupBy) || "category";
          const sortBy = (args.sortBy as SoulSortBy) || "weight";
          const direction = (args.direction as SoulSortDirection) || "desc";
          const lanes = this.substrate.getGroupedTraits(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "soul_search_dsl": {
          const query = String(args.query || "");
          const traits = this.substrate.queryTraitsDsl(query);
          return { success: true, traits };
        }

        case "soul_render_dashboard": {
          const manifest = this.substrate.getActiveManifest();
          const rendered = BroccoliViewRenderer.renderSoulDashboard(manifest as any);
          return { success: true, rendered };
        }

        case "soul_render_traits": {
          const manifest = this.substrate.getActiveManifest();
          const rendered = BroccoliViewRenderer.renderTraitMatrix(manifest.traits as any);
          return { success: true, rendered };
        }

        case "soul_export_html": {
          const html = this.substrate.exportInteractiveHtmlView();
          return { success: true, html };
        }

        case "soul_export_markdown": {
          const markdown = this.substrate.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "soul_export_csv": {
          const csv = this.substrate.exportCsvReport();
          return { success: true, csv };
        }

        case "soul_bulk_tune": {
          const traitIds = String(args.traitIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const delta = Number(args.delta) || 0.05;
          const res = this.substrate.bulkTuneTraits(traitIds, delta);
          return { success: res.modifiedCount > 0, result: res };
        }

        case "soul_undo": {
          const success = this.substrate.undo();
          return { success };
        }

        case "soul_redo": {
          const success = this.substrate.redo();
          return { success };
        }

        case "soul_snapshot_create": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 0;
          const snap = this.snapshotManager.createSnapshot(frame);
          return { success: true, snapshot: snap };
        }

        case "soul_snapshot_restore": {
          const frame = Number(args.frameIndex) || 0;
          const restored = this.snapshotManager.restoreSnapshot(frame);
          return { success: restored, restored };
        }

        case "soul_reset_manifest": {
          this.substrate.clear();
          return { success: true, manifest: this.substrate.getActiveManifest() };
        }

        case "soul_validate_threat": {
          const manifest = this.substrate.getActiveManifest();
          const intent = {
            type: (args.intentType as any) || "tune_trait",
            rationale: String(args.rationale || ""),
          };
          const guardRes = this.threatGuard.validateMutation(manifest, intent as any);
          return { success: guardRes.isSafe, result: guardRes };
        }

        case "soul_compose_prompt": {
          const manifest = this.substrate.getActiveManifest();
          const prompt = this.promptComposer.composeIdentityPrompt(manifest);
          return { success: true, prompt };
        }

        case "soul_get_archetypes": {
          const archetypes: SoulArchetype[] = [
            "lumi_core",
            "game_engine_architect",
            "formal_verifier",
            "autonomous_critic",
            "security_sentinel",
            "custom_persona",
          ];
          return { success: true, archetypes };
        }

        case "soul_get_profiles": {
          const profiles = this.substrate.getAllProfiles();
          return { success: true, profiles, activeProfileId: this.substrate.getActiveProfileId() };
        }

        case "soul_set_active_profile": {
          const profileId = String(args.profileId || "default");
          this.substrate.setActiveProfileId(profileId);
          return { success: true, activeProfileId: profileId };
        }

        case "soul_patch_raw_body": {
          const manifest = this.substrate.getActiveManifest();
          const anchor = String(args.searchAnchor || "");
          const replace = String(args.replaceWith || "");
          if (!manifest.rawBody.includes(anchor)) {
            return { success: false, error: `Search anchor '${anchor}' not found in rawBody` };
          }
          const updatedBody = manifest.rawBody.replace(anchor, replace);
          this.substrate.saveManifest({
            ...manifest,
            rawBody: updatedBody,
            integrityHash: this.parser.computeSoulHash({ ...manifest, rawBody: updatedBody }),
          });
          return { success: true };
        }

        case "soul_inspect_axioms": {
          const manifest = this.substrate.getActiveManifest();
          return { success: true, axioms: manifest.axioms };
        }

        case "soul_rebalance_traits": {
          const manifest = this.substrate.getActiveManifest();
          const defaultManifest = this.parser.createDefaultSoulManifest();
          this.substrate.saveManifest({
            ...manifest,
            traits: defaultManifest.traits,
            integrityHash: this.parser.computeSoulHash({ ...manifest, traits: defaultManifest.traits }),
          });
          return { success: true, traits: defaultManifest.traits };
        }

        case "soul_get_history": {
          const limit = Number(args.limit) || 50;
          const history = this.substrate.getMutations(limit);
          return { success: true, history };
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
