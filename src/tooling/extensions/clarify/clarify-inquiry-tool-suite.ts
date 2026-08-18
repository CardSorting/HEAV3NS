/**
 * clarify-inquiry-tool-suite.ts
 *
 * Model tool surface for the Clarification, Interactive Inquiry & Intent Disambiguation Subsystem:
 * 30 specialized model tools for asking questions, single/multi-choice validation,
 * grill-me interview sessions, decision trees, auto-resolution policies, and SLA telemetry (Phase 85 / ADR-037).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { ClarifyInquirySupervisor } from "../../../agents/extensions/clarify/clarify-inquiry-supervisor.js";
import { BroccoliClarifySubstrate } from "../../../sessions/extensions/clarify/broccoli-clarify-substrate.js";
import { DeterministicClarifyEngine } from "./deterministic-clarify-engine.js";
import { ClarifySnapshotManager } from "../../../sessions/extensions/clarify/clarify-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  ClarifyCategory,
  ClarifyGroupBy,
  ClarifyInputMode,
  ClarifyPriority,
  ClarifySortBy,
  ClarifySortDirection,
  ClarifyStatus,
} from "../../../core/contracts/clarify.contracts.js";

export class ClarifyInquiryToolSuite {
  private readonly supervisor: ClarifyInquirySupervisor;
  private readonly substrate: BroccoliClarifySubstrate;
  private readonly engine: DeterministicClarifyEngine;
  private readonly snapshotManager: ClarifySnapshotManager;

  constructor(
    supervisor?: ClarifyInquirySupervisor,
    substrate?: BroccoliClarifySubstrate,
    engine?: DeterministicClarifyEngine
  ) {
    this.engine = engine ?? new DeterministicClarifyEngine();
    this.substrate = substrate ?? new BroccoliClarifySubstrate();
    this.supervisor = supervisor ?? new ClarifyInquirySupervisor(this.engine, this.substrate);
    this.snapshotManager = new ClarifySnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "ask_clarification",
        description: "Prompts the user with a structured clarifying question, options, and recommended choice.",
        parameters: {
          question: { type: "string", required: true, description: "Question text to ask" },
          choicesJson: { type: "string", description: "JSON array of choice labels or objects [{id, label, isRecommended}]" },
          mode: { type: "string", description: "Input mode: single_select, multi_select, free_text, boolean_confirmation" },
          category: { type: "string", description: "Category: architecture, requirements, scope, design, safety, configuration, budget" },
          priority: { type: "string", description: "Priority: low, medium, high, critical, blocker" },
          timeoutMs: { type: "number", description: "Optional auto-resolution timeout in milliseconds" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("ask_clarification", args);
        },
      },
      {
        name: "resolve_clarification",
        description: "Resolves a pending clarifying inquiry with selected choice IDs or free-text write-in.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID to resolve" },
          selectedChoiceIdsJson: { type: "string", description: "JSON array of selected choice IDs (e.g. ['opt_1'])" },
          writeInResponse: { type: "string", description: "Optional free-text user response" },
          explanation: { type: "string", description: "Optional reason for choice" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("resolve_clarification", args);
        },
      },
      {
        name: "get_clarification",
        description: "Retrieves metadata and status for a specific inquiry ID.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID to fetch" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_clarification", args);
        },
      },
      {
        name: "list_clarifications",
        description: "Lists registered clarifying inquiries with optional limit.",
        parameters: {
          limit: { type: "number", description: "Maximum inquiries to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_clarifications", args);
        },
      },
      {
        name: "cancel_clarification",
        description: "Cancels a pending inquiry.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID to cancel" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("cancel_clarification", args);
        },
      },
      {
        name: "clarify_auto_resolve",
        description: "Evaluates and applies the configured auto-resolution policy for an inquiry.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID to auto-resolve" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_auto_resolve", args);
        },
      },
      {
        name: "clarify_start_grill_me",
        description: "Initiates an interactive Grill-Me interview session with a decision tree.",
        parameters: {
          title: { type: "string", required: true, description: "Interview session title" },
          rootQuestion: { type: "string", required: true, description: "Initial root question" },
          rootChoicesJson: { type: "string", required: true, description: "JSON array of root choices" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_start_grill_me", args);
        },
      },
      {
        name: "clarify_step_decision_tree",
        description: "Advances an active decision tree along a chosen branch.",
        parameters: {
          treeId: { type: "string", required: true, description: "Decision tree ID" },
          inquiryId: { type: "string", required: true, description: "Current inquiry ID" },
          selectedChoiceId: { type: "string", required: true, description: "Selected choice ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_step_decision_tree", args);
        },
      },
      {
        name: "clarify_get_decision_tree",
        description: "Retrieves status and active path of a decision tree.",
        parameters: {
          treeId: { type: "string", required: true, description: "Decision tree ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_get_decision_tree", args);
        },
      },
      {
        name: "clarify_list_decision_trees",
        description: "Lists all active and completed decision trees.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_list_decision_trees", args);
        },
      },
      {
        name: "clarify_audit_health",
        description: "Audits SLA clarification health, blocker count, ambiguity index, and auto-resolution rate.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_audit_health", args);
        },
      },
      {
        name: "clarify_get_metrics",
        description: "Fetches comprehensive telemetry on inquiries, latency, success rate, and blockers.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_get_metrics", args);
        },
      },
      {
        name: "clarify_group_and_sort",
        description: "Organizes inquiries into multi-criteria swimlanes (category, priority, status, mode, frame).",
        parameters: {
          groupBy: { type: "string", description: "Group by: category, priority, status, mode, frame" },
          sortBy: { type: "string", description: "Sort by: timestamp, priority, createdFrame, status" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_group_and_sort", args);
        },
      },
      {
        name: "clarify_search_dsl",
        description: "Searches inquiries using natural query DSL (e.g. 'status:pending priority:critical category:architecture').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_search_dsl", args);
        },
      },
      {
        name: "clarify_render_dashboard",
        description: "Renders an ANSI CLI dashboard summary card for the clarification subsystem.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_render_dashboard", args);
        },
      },
      {
        name: "clarify_render_inquiry_card",
        description: "Renders an interactive ANSI CLI inquiry card for a given inquiry ID.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID to render" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_render_inquiry_card", args);
        },
      },
      {
        name: "clarify_render_decision_tree",
        description: "Renders an ASCII tree visualization of a decision tree.",
        parameters: {
          treeId: { type: "string", required: true, description: "Decision tree ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_render_decision_tree", args);
        },
      },
      {
        name: "clarify_export_html",
        description: "Exports inquiry status and metrics to a standalone single-page HTML web app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_export_html", args);
        },
      },
      {
        name: "clarify_export_markdown",
        description: "Exports inquiry status and SLA diagnostics to a formatted Markdown report.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_export_markdown", args);
        },
      },
      {
        name: "clarify_export_csv",
        description: "Exports the complete inquiry ledger to a CSV format string.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_export_csv", args);
        },
      },
      {
        name: "clarify_bulk_resolve",
        description: "Atomically resolves multiple pending inquiries with their default or recommended choices.",
        parameters: {
          inquiryIdsJson: { type: "string", required: true, description: "JSON array of inquiry IDs" },
          defaultChoiceId: { type: "string", description: "Optional override choice ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_bulk_resolve", args);
        },
      },
      {
        name: "clarify_bulk_cancel",
        description: "Atomically cancels multiple pending inquiries.",
        parameters: {
          inquiryIdsJson: { type: "string", required: true, description: "JSON array of inquiry IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_bulk_cancel", args);
        },
      },
      {
        name: "clarify_undo",
        description: "Reverts the last clarification state mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_undo", args);
        },
      },
      {
        name: "clarify_redo",
        description: "Re-applies the last undone clarification state mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_redo", args);
        },
      },
      {
        name: "clarify_capture_snapshot",
        description: "Captures a frame-perfect snapshot of clarification state in memory.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Execution frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_capture_snapshot", args);
        },
      },
      {
        name: "clarify_restore_snapshot",
        description: "Restores clarification state to a previous frame snapshot in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Execution frame index to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_restore_snapshot", args);
        },
      },
      {
        name: "clarify_list_resolutions",
        description: "Lists historical inquiry resolution records.",
        parameters: {
          limit: { type: "number", description: "Maximum resolutions to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_list_resolutions", args);
        },
      },
      {
        name: "clarify_get_resolution",
        description: "Retrieves the resolution record for a given inquiry ID.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_get_resolution", args);
        },
      },
      {
        name: "clarify_set_policy",
        description: "Updates the auto-resolution policy for an inquiry.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID" },
          policyMode: { type: "string", required: true, description: "Policy: recommended, first, timeout, manual_only" },
          maxWaitMs: { type: "number", description: "Maximum wait time in ms" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_set_policy", args);
        },
      },
      {
        name: "clarify_update_status",
        description: "Updates the status of an inquiry directly.",
        parameters: {
          inquiryId: { type: "string", required: true, description: "Inquiry ID" },
          status: { type: "string", required: true, description: "Status: pending, resolved, timed_out, cancelled" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("clarify_update_status", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "ask_clarification": {
          const question = String(args.question || "").trim();
          if (!question) return { success: false, error: "question is required" };

          let choicesRaw: any[] | undefined;
          if (args.choicesJson) {
            try {
              choicesRaw = JSON.parse(String(args.choicesJson));
            } catch {
              return { success: false, error: "choicesJson must be valid JSON" };
            }
          }

          const mode = (args.mode as ClarifyInputMode) || "single_select";
          const category = (args.category as ClarifyCategory) || "general";
          const priority = (args.priority as ClarifyPriority) || "medium";
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

          const inquiry = this.supervisor.askQuestion(question, choicesRaw, mode, timeoutMs, {
            category,
            priority,
          });

          return {
            success: true,
            inquiryId: inquiry.id,
            question: inquiry.question,
            category: inquiry.category,
            priority: inquiry.priority,
            choicesCount: inquiry.choices.length,
            status: inquiry.status,
          };
        }

        case "resolve_clarification": {
          const inquiryId = String(args.inquiryId || "").trim();
          if (!inquiryId) return { success: false, error: "inquiryId is required" };

          let selectedChoiceIds: string[] | undefined;
          if (args.selectedChoiceIdsJson) {
            try {
              selectedChoiceIds = JSON.parse(String(args.selectedChoiceIdsJson));
            } catch {
              return { success: false, error: "selectedChoiceIdsJson must be valid JSON" };
            }
          }

          const writeIn = typeof args.writeInResponse === "string" ? args.writeInResponse : undefined;
          const explanation = typeof args.explanation === "string" ? args.explanation : undefined;

          const resolution = this.supervisor.resolveInquiry(inquiryId, selectedChoiceIds, writeIn, "user", explanation);
          return { success: true, resolution };
        }

        case "get_clarification": {
          const inquiryId = String(args.inquiryId || "").trim();
          const inq = this.supervisor.getInquiry(inquiryId);
          return { success: inq !== undefined, inquiry: inq };
        }

        case "list_clarifications": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const inquiries = this.supervisor.listInquiries(limit);
          return { success: true, count: inquiries.length, inquiries };
        }

        case "cancel_clarification": {
          const inquiryId = String(args.inquiryId || "").trim();
          const ok = this.supervisor.updateInquiryStatus(inquiryId, "cancelled");
          return { success: ok, inquiryId };
        }

        case "clarify_auto_resolve": {
          const inquiryId = String(args.inquiryId || "").trim();
          const res = this.supervisor.autoResolve(inquiryId);
          return { success: res !== undefined, resolution: res };
        }

        case "clarify_start_grill_me": {
          const title = String(args.title || "").trim();
          const rootQuestion = String(args.rootQuestion || "").trim();
          const rootChoicesJson = String(args.rootChoicesJson || "[]");
          let rootChoices: string[];
          try {
            rootChoices = JSON.parse(rootChoicesJson);
          } catch {
            return { success: false, error: "rootChoicesJson must be valid JSON array" };
          }

          const tree = this.supervisor.startGrillMeInterview(title, rootQuestion, rootChoices);
          return { success: true, tree };
        }

        case "clarify_step_decision_tree": {
          const treeId = String(args.treeId || "");
          const inquiryId = String(args.inquiryId || "");
          const choiceId = String(args.selectedChoiceId || "");
          const ok = this.supervisor.stepDecisionTree(treeId, inquiryId, choiceId);
          return { success: ok, treeId };
        }

        case "clarify_get_decision_tree": {
          const treeId = String(args.treeId || "");
          const tree = this.supervisor.getDecisionTree(treeId);
          return { success: tree !== undefined, tree };
        }

        case "clarify_list_decision_trees": {
          const trees = this.supervisor.listDecisionTrees();
          return { success: true, count: trees.length, trees };
        }

        case "clarify_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "clarify_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "clarify_group_and_sort": {
          const groupBy = (args.groupBy as ClarifyGroupBy) || "category";
          const sortBy = (args.sortBy as ClarifySortBy) || "timestamp";
          const direction = (args.direction as ClarifySortDirection) || "desc";
          const lanes = this.supervisor.getGroupedInquiries(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "clarify_search_dsl": {
          const query = String(args.query || "");
          const inquiries = this.supervisor.queryDsl(query);
          return { success: true, count: inquiries.length, inquiries };
        }

        case "clarify_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderClarifyDashboard(metrics);
          return { success: true, rendered };
        }

        case "clarify_render_inquiry_card": {
          const inquiryId = String(args.inquiryId || "");
          const inq = this.supervisor.getInquiry(inquiryId);
          if (!inq) return { success: false, error: `Inquiry ${inquiryId} not found` };
          const rendered = BroccoliViewRenderer.renderClarifyInquiryCard(inq);
          return { success: true, rendered };
        }

        case "clarify_render_decision_tree": {
          const treeId = String(args.treeId || "");
          const tree = this.supervisor.getDecisionTree(treeId);
          if (!tree) return { success: false, error: `Tree ${treeId} not found` };
          const rendered = BroccoliViewRenderer.renderClarifyDecisionTree(tree);
          return { success: true, rendered };
        }

        case "clarify_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "clarify_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "clarify_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "clarify_bulk_resolve": {
          const idsJson = String(args.inquiryIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "inquiryIdsJson must be valid JSON" };
          }
          const defaultChoice = typeof args.defaultChoiceId === "string" ? args.defaultChoiceId : undefined;
          const result = this.supervisor.bulkResolve(ids, defaultChoice);
          return { success: true, result };
        }

        case "clarify_bulk_cancel": {
          const idsJson = String(args.inquiryIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "inquiryIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkCancel(ids);
          return { success: true, result };
        }

        case "clarify_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "clarify_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "clarify_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "clarify_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreSnapshot(frame);
          return { ...res };
        }

        case "clarify_list_resolutions": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const resolutions = this.supervisor.listResolutions(limit);
          return { success: true, count: resolutions.length, resolutions };
        }

        case "clarify_get_resolution": {
          const inquiryId = String(args.inquiryId || "");
          const resolution = this.supervisor.getResolution(inquiryId);
          return { success: resolution !== undefined, resolution };
        }

        case "clarify_set_policy": {
          const inquiryId = String(args.inquiryId || "");
          const inq = this.supervisor.getInquiry(inquiryId);
          if (!inq) return { success: false, error: `Inquiry ${inquiryId} not found` };
          const mode = args.policyMode as any;
          const updated: any = {
            ...inq,
            autoPolicy: { mode, maxWaitMs: args.maxWaitMs as number },
          };
          this.substrate.recordInquiry(updated);
          return { success: true, inquiryId };
        }

        case "clarify_update_status": {
          const inquiryId = String(args.inquiryId || "");
          const status = args.status as ClarifyStatus;
          const ok = this.supervisor.updateInquiryStatus(inquiryId, status);
          return { success: ok, inquiryId, status };
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
