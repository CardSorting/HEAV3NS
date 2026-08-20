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
      {
        name: "soul_list_presets",
        description: "List standard pre-configured persona presets (Executive Briefing, Socratic Mentor, Code Reviewer, Brainstormer, Security Sentinel, ELI5, Zen).",
        parameters: {
          category: { type: "string", description: "Optional category filter: 'productivity', 'education', 'engineering', 'creative', 'compliance'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_list_presets", args, cwd);
        },
      },
      {
        name: "soul_apply_preset",
        description: "Apply a pre-configured persona preset bundle in 1 step with automatic bookmark checkpointing.",
        parameters: {
          presetId: { type: "string", required: true, description: "ID of preset to apply (e.g. 'executive_briefing', 'socratic_mentor', 'deep_code_review', 'creative_brainstorm', 'security_sentinel', 'eli5_explainer', 'zen_focus')" },
          rationale: { type: "string", description: "Reason for applying the preset" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_apply_preset", args, cwd);
        },
      },
      {
        name: "soul_explain_diff",
        description: "Generate a human-readable narrative diff comparing the current persona against baseline or previous revision.",
        parameters: {
          previousHash: { type: "string", description: "Optional previous manifest hash" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_explain_diff", args, cwd);
        },
      },
      {
        name: "soul_search_fuzzy",
        description: "Search traits using natural language synonyms and fuzzy edit distance (e.g. 'friendly', 'brevity', 'math', 'strict').",
        parameters: {
          query: { type: "string", required: true, description: "Search term or natural phrase" },
          limit: { type: "number", description: "Max suggestions to return" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_search_fuzzy", args, cwd);
        },
      },
      {
        name: "soul_suggest_corrections",
        description: "Get 'Did you mean?' suggestions for typo-tolerant trait searching.",
        parameters: {
          query: { type: "string", required: true, description: "Query with possible typo" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_suggest_corrections", args, cwd);
        },
      },
      {
        name: "soul_create_bookmark",
        description: "Create a named semantic bookmark/checkpoint of the active SOUL manifest.",
        parameters: {
          label: { type: "string", required: true, description: "Human-readable label for bookmark" },
          description: { type: "string", description: "Description of checkpoint state" },
          tags: { type: "string", description: "Comma-separated tags (e.g. 'baseline,production')" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_create_bookmark", args, cwd);
        },
      },
      {
        name: "soul_list_bookmarks",
        description: "List all named bookmarks with optional tag filtering.",
        parameters: {
          tag: { type: "string", description: "Optional tag filter" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_list_bookmarks", args, cwd);
        },
      },
      {
        name: "soul_restore_bookmark",
        description: "Restore SOUL manifest state from a named bookmark or label.",
        parameters: {
          bookmarkIdOrLabel: { type: "string", required: true, description: "Bookmark ID or label" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_restore_bookmark", args, cwd);
        },
      },
      {
        name: "soul_delete_bookmark",
        description: "Delete a named bookmark.",
        parameters: {
          bookmarkIdOrLabel: { type: "string", required: true, description: "Bookmark ID or label" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_delete_bookmark", args, cwd);
        },
      },
      {
        name: "soul_export_format",
        description: "Export SOUL manifest to industry standard formats (character_card_v2, openai_gpt_schema, anthropic_claude_xml, json_ld_agent, soul_markdown).",
        parameters: {
          format: { type: "string", required: true, description: "Format: 'character_card_v2', 'openai_gpt_schema', 'anthropic_claude_xml', 'json_ld_agent', 'soul_markdown'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_export_format", args, cwd);
        },
      },
      {
        name: "soul_import_format",
        description: "Import SOUL manifest from raw JSON or XML text in industry standard formats.",
        parameters: {
          content: { type: "string", required: true, description: "Raw JSON or XML text to import" },
          format: { type: "string", description: "Optional explicit format: 'character_card_v2', 'openai_gpt_schema', 'anthropic_claude_xml', 'soul_markdown'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_import_format", args, cwd);
        },
      },
      {
        name: "soul_get_taxonomy",
        description: "Get 3-level hierarchical taxonomy with non-technical guidance and trait explanations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_taxonomy", args, cwd);
        },
      },
      {
        name: "soul_get_audit_trail",
        description: "Fetch human-readable mutation audit trail with plain English explanations and before/after hashes.",
        parameters: {
          limit: { type: "number", description: "Max entries" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_audit_trail", args, cwd);
        },
      },
      {
        name: "soul_forge_custom",
        description: "Create a custom SOUL persona in 1 step directly from a plain-English user prompt description.",
        parameters: {
          prompt: { type: "string", required: true, description: "Natural language description of desired agent persona (e.g. 'A patient Python mentor who explains concepts with simple analogies')" },
          name: { type: "string", description: "Optional name for the custom persona" },
          appliedPacks: { type: "string", description: "Comma-separated personality packs (e.g. 'humor_wit,zero_fluff')" },
          profileId: { type: "string", description: "Optional profile identifier to save into" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_forge_custom", args, cwd);
        },
      },
      {
        name: "soul_wizard_get_questions",
        description: "Fetch the 5-step guided wizard questionnaire structure with friendly multiple-choice options.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_wizard_get_questions", args, cwd);
        },
      },
      {
        name: "soul_wizard_submit",
        description: "Build a complete custom SOUL persona from wizard questionnaire choices.",
        parameters: {
          roleOrGoal: { type: "string", required: true, description: "Role or purpose (e.g. 'coder', 'tutor', 'executive', 'security')" },
          personalityVibe: { type: "string", required: true, description: "Vibe: 'warm_encouraging', 'direct_efficient', 'deep_analytical', 'playful_witty', 'formal_executive'" },
          communicationStyle: { type: "string", required: true, description: "Format: 'bullet_points', 'step_by_step', 'conversational', 'code_first'" },
          strictnessLevel: { type: "string", description: "Strictness: 'balanced', 'uncompromising', 'flexible'" },
          name: { type: "string", description: "Optional custom name" },
          customRules: { type: "string", description: "Optional comma-separated custom rules" },
          appliedPacks: { type: "string", description: "Optional comma-separated personality pack IDs" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_wizard_submit", args, cwd);
        },
      },
      {
        name: "soul_clone_and_modify",
        description: "Clone and tweak an existing persona profile without touching boilerplate or raw JSON.",
        parameters: {
          sourceProfileId: { type: "string", required: true, description: "Source profile identifier to clone from" },
          newProfileId: { type: "string", required: true, description: "New profile identifier" },
          name: { type: "string", description: "Optional new persona name" },
          summary: { type: "string", description: "Optional new summary" },
          tone: { type: "string", description: "Optional tone override: 'direct', 'analytical', 'formal', 'concise', 'collaborative'" },
          verbosity: { type: "string", description: "Optional verbosity override: 'terse', 'balanced', 'detailed'" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_clone_and_modify", args, cwd);
        },
      },
      {
        name: "soul_list_personality_packs",
        description: "List modular personality add-on packs ('Power-Ups') like Humor & Wit, Math Rigor, Zero-Fluff, ELI5, and Security Sentinel.",
        parameters: {},
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_list_personality_packs", args, cwd);
        },
      },
      {
        name: "soul_apply_personality_pack",
        description: "Mix and match a modular personality pack into the active persona.",
        parameters: {
          packId: { type: "string", required: true, description: "Pack ID (e.g. 'humor_wit', 'zero_fluff', 'math_rigor', 'eli5_simplicity', 'deep_empathy', 'adversarial_security', 'pedantic_linter')" },
          profileId: { type: "string", description: "Optional target profile ID" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_apply_personality_pack", args, cwd);
        },
      },
      {
        name: "soul_lint_persona",
        description: "Proactively inspect the persona for conflicting traits, uncalibrated weights, or missing safety rules.",
        parameters: {
          profileId: { type: "string", description: "Optional profile ID to lint" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_lint_persona", args, cwd);
        },
      },
      {
        name: "soul_autofix_persona",
        description: "One-click automatic resolution of all detected persona contradictions and issues.",
        parameters: {
          profileId: { type: "string", description: "Optional profile ID to autofix" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_autofix_persona", args, cwd);
        },
      },
      {
        name: "soul_sync_directory",
        description: "Auto-scan and synchronize all dropped SOUL persona files (*.soul.md, *.card.json, *.gpt.json, *.claude.xml) in the dedicated .lumi/souls/ directory.",
        parameters: {
          directoryPath: { type: "string", description: "Optional custom directory path to sync (defaults to .lumi/souls/)" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_sync_directory", args, cwd);
        },
      },
      {
        name: "soul_export_to_directory",
        description: "Export an active or specified SOUL into the dedicated .lumi/souls/ directory for instant drag-and-drop sharing or git commits.",
        parameters: {
          profileId: { type: "string", description: "Optional profile ID to export" },
          format: { type: "string", description: "Format: 'soul_markdown', 'character_card_v2', 'openai_gpt_schema', 'anthropic_claude_xml', 'json_ld_agent'" },
          filename: { type: "string", description: "Optional custom target filename" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_export_to_directory", args, cwd);
        },
      },
      {
        name: "soul_get_drop_vault_status",
        description: "Inspect the status, directory path, total dropped files, and template availability of the SOUL dedicated drop vault.",
        parameters: {
          directoryPath: { type: "string", description: "Optional custom directory path" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_get_drop_vault_status", args, cwd);
        },
      },
      {
        name: "soul_ingest_dropped_file",
        description: "Ingest a single dropped persona file by path and auto-register it into the active profile store.",
        parameters: {
          filePath: { type: "string", required: true, description: "Absolute or relative path to the dropped persona file" },
        },
        execute: async (args: Record<string, unknown>, cwd?: string) => {
          return this.executeTool("soul_ingest_dropped_file", args, cwd);
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
            "socratic_mentor",
            "creative_collaborator",
            "executive_assistant",
            "data_scientist",
            "domain_specialist",
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

        case "soul_list_presets": {
          const category = args.category as any;
          const presets = this.substrate.listPresets(category);
          return { success: true, presets };
        }

        case "soul_apply_preset": {
          const presetId = String(args.presetId || "");
          const rationale = typeof args.rationale === "string" ? args.rationale : "Applied preset";
          const res = this.substrate.applyPreset(presetId, rationale);
          return { success: res.success, result: res };
        }

        case "soul_explain_diff": {
          const previousHash = typeof args.previousHash === "string" ? args.previousHash : undefined;
          const diff = this.substrate.getDiffReport(previousHash);
          return { success: true, diff };
        }

        case "soul_search_fuzzy": {
          const query = String(args.query || "");
          const limit = typeof args.limit === "number" ? args.limit : 5;
          const suggestions = this.substrate.queryTraitsFuzzy(query, limit);
          return { success: true, suggestions };
        }

        case "soul_suggest_corrections": {
          const query = String(args.query || "");
          const suggestions = this.substrate.suggestCorrections(query);
          return { success: true, suggestions };
        }

        case "soul_create_bookmark": {
          const label = String(args.label || "checkpoint");
          const description = typeof args.description === "string" ? args.description : "";
          const tags = typeof args.tags === "string" ? args.tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
          const bookmark = this.substrate.createBookmark(label, description, tags);
          return { success: true, bookmark };
        }

        case "soul_list_bookmarks": {
          const tag = typeof args.tag === "string" ? args.tag : undefined;
          const bookmarks = this.substrate.listBookmarks(tag);
          return { success: true, bookmarks };
        }

        case "soul_restore_bookmark": {
          const idOrLabel = String(args.bookmarkIdOrLabel || "");
          const restored = this.substrate.restoreBookmark(idOrLabel);
          return { success: restored, restored };
        }

        case "soul_delete_bookmark": {
          const idOrLabel = String(args.bookmarkIdOrLabel || "");
          const deleted = this.substrate.deleteBookmark(idOrLabel);
          return { success: deleted, deleted };
        }

        case "soul_export_format": {
          const format = (args.format as any) || "soul_markdown";
          const exported = this.substrate.exportFormat(format);
          return { success: true, format, content: exported };
        }

        case "soul_import_format": {
          const content = String(args.content || "");
          const format = args.format as any;
          const importRes = this.substrate.importFormat(content, format);
          return { success: importRes.success, result: importRes };
        }

        case "soul_get_taxonomy": {
          const taxonomy = this.substrate.getTaxonomy();
          return { success: true, taxonomy };
        }

        case "soul_get_audit_trail": {
          const limit = Number(args.limit) || 50;
          const auditTrail = this.substrate.getAuditTrail(limit);
          return { success: true, auditTrail };
        }

        case "soul_forge_custom": {
          const prompt = String(args.prompt || "");
          const name = typeof args.name === "string" ? args.name : undefined;
          const appliedPacks = typeof args.appliedPacks === "string"
            ? args.appliedPacks.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined;
          const profileId = typeof args.profileId === "string" ? args.profileId : undefined;
          const manifest = this.substrate.forgeCustomSoul(prompt, { name, appliedPacks }, profileId);
          return { success: true, manifest };
        }

        case "soul_wizard_get_questions": {
          const questions = this.substrate.getWizardQuestions();
          return { success: true, questions };
        }

        case "soul_wizard_submit": {
          const roleOrGoal = String(args.roleOrGoal || "custom");
          const personalityVibe = String(args.personalityVibe || "warm_encouraging");
          const communicationStyle = String(args.communicationStyle || "conversational");
          const strictnessLevel = String(args.strictnessLevel || "balanced");
          const customRules = typeof args.customRules === "string"
            ? args.customRules.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined;
          const appliedPacks = typeof args.appliedPacks === "string"
            ? args.appliedPacks.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined;
          const name = typeof args.name === "string" ? args.name : undefined;

          const manifest = this.substrate.buildSoulFromWizard({
            name,
            roleOrGoal,
            personalityVibe,
            communicationStyle,
            strictnessLevel,
            customRules,
            appliedPacks,
          });
          return { success: true, manifest };
        }

        case "soul_clone_and_modify": {
          const sourceProfileId = String(args.sourceProfileId || "default");
          const newProfileId = String(args.newProfileId || `fork-${Date.now()}`);
          const name = typeof args.name === "string" ? args.name : undefined;
          const summary = typeof args.summary === "string" ? args.summary : undefined;
          const style: { tone?: SoulStyleRules["tone"]; verbosity?: SoulStyleRules["verbosity"] } = {};
          if (typeof args.tone === "string") style.tone = args.tone as any;
          if (typeof args.verbosity === "string") style.verbosity = args.verbosity as any;

          const manifest = this.substrate.cloneAndModifyProfile(sourceProfileId, newProfileId, {
            name,
            summary,
            style,
          });
          return { success: true, manifest };
        }

        case "soul_list_personality_packs": {
          const packs = this.substrate.listPersonalityPacks();
          return { success: true, packs };
        }

        case "soul_apply_personality_pack": {
          const packId = String(args.packId || "");
          const profileId = typeof args.profileId === "string" ? args.profileId : undefined;
          const res = this.substrate.applyPersonalityPack(packId, profileId);
          return { success: res.success, result: res };
        }

        case "soul_lint_persona": {
          const profileId = typeof args.profileId === "string" ? args.profileId : undefined;
          const report = this.substrate.lintProfile(profileId);
          return { success: true, report };
        }

        case "soul_autofix_persona": {
          const profileId = typeof args.profileId === "string" ? args.profileId : undefined;
          const res = this.substrate.autoFixProfile(profileId);
          return { success: res.success, result: res };
        }

        case "soul_sync_directory": {
          const directoryPath = typeof args.directoryPath === "string" ? args.directoryPath : undefined;
          const report = this.substrate.syncDropDirectory(directoryPath);
          return { success: true, report };
        }

        case "soul_export_to_directory": {
          const profileId = typeof args.profileId === "string" ? args.profileId : undefined;
          const format = (args.format as any) || "soul_markdown";
          const filename = typeof args.filename === "string" ? args.filename : undefined;
          const filePath = this.substrate.exportToDropDirectory(profileId, format, filename);
          return { success: true, filePath, format };
        }

        case "soul_get_drop_vault_status": {
          const directoryPath = typeof args.directoryPath === "string" ? args.directoryPath : undefined;
          const status = this.substrate.getDropVaultStatus();
          return { success: true, status };
        }

        case "soul_ingest_dropped_file": {
          const filePath = String(args.filePath || "");
          const res = this.substrate.ingestDroppedFile(filePath);
          return { success: res.success, result: res };
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

