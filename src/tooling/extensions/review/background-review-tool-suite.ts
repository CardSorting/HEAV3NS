/**
 * background-review-tool-suite.ts
 *
 * Model tool surface for Autonomous Background Review, Post-Turn Self-Improvement & Insights (Phase 96 / ADR-048 / Target #67):
 * 30 specialized model tools for running reviews, promoting candidate facts/skills, synthesizing titles,
 * computing insights, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  BackgroundReviewGroupBy,
  BackgroundReviewSortBy,
  BackgroundReviewSortDirection,
  ReviewTriggerPolicy,
} from "../../../core/contracts/background-review.contracts.js";
import { BackgroundReviewSupervisor } from "../../../agents/extensions/review/background-review-supervisor.js";
import { ReviewSnapshotManager } from "../../../sessions/extensions/review/review-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class BackgroundReviewToolSuite {
  private readonly supervisor: BackgroundReviewSupervisor;
  private readonly snapshotManager: ReviewSnapshotManager;

  constructor(supervisor: BackgroundReviewSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new ReviewSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "review_evaluate_turn",
        description: "Evaluates a conversation turn to extract candidate facts and reusable skills in the background.",
        parameters: {
          turnIndex: { type: "number", required: true, description: "Turn index" },
          userMessage: { type: "string", required: true, description: "User message" },
          assistantResponse: { type: "string", required: true, description: "Assistant response" },
          toolsUsedJson: { type: "string", description: "Optional JSON array of tool names used" },
          hasError: { type: "boolean", description: "Whether error occurred" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_evaluate_turn", args);
        },
      },
      {
        name: "review_get_turn_review",
        description: "Retrieves a completed turn review by its review ID.",
        parameters: {
          reviewId: { type: "string", required: true, description: "Review ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_turn_review", args);
        },
      },
      {
        name: "review_list_reviews",
        description: "Lists all recorded background turn reviews.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_list_reviews", args);
        },
      },
      {
        name: "review_get_latest_review",
        description: "Retrieves the most recently recorded turn review.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_latest_review", args);
        },
      },
      {
        name: "review_get_all_facts",
        description: "Lists all candidate memory facts extracted across all turns.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_all_facts", args);
        },
      },
      {
        name: "review_get_all_skills",
        description: "Lists all candidate skills extracted across all turns.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_all_skills", args);
        },
      },
      {
        name: "review_generate_session_insights",
        description: "Generates multi-turn token usage and tool breakdown analytics.",
        parameters: {
          sessionId: { type: "string", required: true, description: "Session ID" },
          inputTokens: { type: "number", required: true, description: "Input tokens count" },
          outputTokens: { type: "number", required: true, description: "Output tokens count" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_generate_session_insights", args);
        },
      },
      {
        name: "review_get_latest_insights",
        description: "Retrieves the most recent session insights breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_latest_insights", args);
        },
      },
      {
        name: "review_suggest_session_title",
        description: "Suggests a concise session topic title from opening messages.",
        parameters: {
          firstUserMessage: { type: "string", required: true, description: "First user message" },
          toolsUsedJson: { type: "string", description: "JSON array of tools used" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_suggest_session_title", args);
        },
      },
      {
        name: "review_get_current_title",
        description: "Retrieves the current session title suggestion.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_current_title", args);
        },
      },
      {
        name: "review_set_current_title",
        description: "Sets the current session title explicitly.",
        parameters: {
          title: { type: "string", required: true, description: "Session title" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_set_current_title", args);
        },
      },
      {
        name: "review_get_trigger_policy",
        description: "Retrieves the current background review trigger policy.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_trigger_policy", args);
        },
      },
      {
        name: "review_set_trigger_policy",
        description: "Updates the background review trigger policy (always, on_milestone, manual, disabled).",
        parameters: {
          policy: { type: "string", required: true, description: "always, on_milestone, manual, disabled" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_set_trigger_policy", args);
        },
      },
      {
        name: "review_audit_health",
        description: "Audits background review health, capacity, and learning posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_audit_health", args);
        },
      },
      {
        name: "review_get_metrics",
        description: "Fetches background review metrics, fact/skill totals, and latency percentiles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_get_metrics", args);
        },
      },
      {
        name: "review_group_and_sort",
        description: "Organizes reviews into multi-criteria swimlanes (turn_range, has_skills, category, error_status).",
        parameters: {
          groupBy: { type: "string", description: "Group by: turn_range, has_skills, category, error_status" },
          sortBy: { type: "string", description: "Sort by: turnIndex, timestamp, durationMs" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_group_and_sort", args);
        },
      },
      {
        name: "review_search_dsl",
        description: "Searches turn reviews using Natural Query DSL (e.g. 'min_turn:1 has_skills:true').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_search_dsl", args);
        },
      },
      {
        name: "review_render_dashboard",
        description: "Renders an ANSI CLI summary card with turn reviews and knowledge extracted.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_render_dashboard", args);
        },
      },
      {
        name: "review_render_card",
        description: "Renders an interactive ANSI CLI turn review card.",
        parameters: {
          reviewId: { type: "string", required: true, description: "Review ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_render_card", args);
        },
      },
      {
        name: "review_export_html",
        description: "Exports turn reviews to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_export_html", args);
        },
      },
      {
        name: "review_export_markdown",
        description: "Exports background review diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_export_markdown", args);
        },
      },
      {
        name: "review_export_csv",
        description: "Exports turn reviews to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_export_csv", args);
        },
      },
      {
        name: "review_bulk_purge",
        description: "Atomically purges multiple turn reviews.",
        parameters: {
          reviewIdsJson: { type: "string", required: true, description: "JSON array of review IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_bulk_purge", args);
        },
      },
      {
        name: "review_undo",
        description: "Reverts the last review mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_undo", args);
        },
      },
      {
        name: "review_redo",
        description: "Re-applies the last undone review mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_redo", args);
        },
      },
      {
        name: "review_capture_snapshot",
        description: "Captures a frame-perfect snapshot of review workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_capture_snapshot", args);
        },
      },
      {
        name: "review_restore_snapshot",
        description: "Restores review workspace state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_restore_snapshot", args);
        },
      },
      {
        name: "review_format_fact",
        description: "Formats a candidate fact into human-readable string.",
        parameters: {
          factId: { type: "string", required: true, description: "Fact ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_format_fact", args);
        },
      },
      {
        name: "review_format_skill",
        description: "Formats a candidate skill into human-readable string.",
        parameters: {
          skillId: { type: "string", required: true, description: "Skill ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_format_skill", args);
        },
      },
      {
        name: "review_clear_all",
        description: "Clears all stored background reviews and knowledge artifacts.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("review_clear_all", args);
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
        case "review_evaluate_turn": {
          const turnIndex = typeof args.turnIndex === "number" ? args.turnIndex : 1;
          const userMessage = String(args.userMessage || "");
          const assistantResponse = String(args.assistantResponse || "");
          const hasError = typeof args.hasError === "boolean" ? args.hasError : false;
          let tools: string[] = [];
          if (typeof args.toolsUsedJson === "string") {
            try {
              tools = JSON.parse(args.toolsUsedJson);
            } catch {
              tools = args.toolsUsedJson.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
            }
          }
          const review = this.supervisor.evaluateTurn(turnIndex, userMessage, assistantResponse, tools, hasError);
          return { success: true, review };
        }

        case "review_get_turn_review": {
          const reviewId = String(args.reviewId || "");
          const review = this.supervisor.getSubstrate().getReview(reviewId);
          if (!review) return { success: false, error: `Review '${reviewId}' not found` };
          return { success: true, review };
        }

        case "review_list_reviews": {
          const reviews = this.supervisor.getReviews();
          return { success: true, count: reviews.length, reviews };
        }

        case "review_get_latest_review": {
          const review = this.supervisor.getSubstrate().getLatestReview();
          return { success: true, review };
        }

        case "review_get_all_facts": {
          const facts = this.supervisor.getAllFacts();
          return { success: true, count: facts.length, facts };
        }

        case "review_get_all_skills": {
          const skills = this.supervisor.getAllSkills();
          return { success: true, count: skills.length, skills };
        }

        case "review_generate_session_insights": {
          const sessionId = String(args.sessionId || "session-default");
          const inputTokens = typeof args.inputTokens === "number" ? args.inputTokens : 1000;
          const outputTokens = typeof args.outputTokens === "number" ? args.outputTokens : 500;
          const reviews = this.supervisor.getReviews();
          const digests = reviews.map((r) => r.reviewDigest);
          const insights = this.supervisor.generateSessionInsights(sessionId, digests, inputTokens, outputTokens);
          return { success: true, insights };
        }

        case "review_get_latest_insights": {
          const insights = this.supervisor.getLatestInsights();
          return { success: true, insights };
        }

        case "review_suggest_session_title": {
          const firstUserMessage = String(args.firstUserMessage || "");
          let tools: string[] = [];
          if (typeof args.toolsUsedJson === "string") {
            try {
              tools = JSON.parse(args.toolsUsedJson);
            } catch {
              tools = args.toolsUsedJson.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
            }
          }
          const suggestion = this.supervisor.suggestTitle(firstUserMessage, tools);
          return { success: true, suggestion };
        }

        case "review_get_current_title": {
          const title = this.supervisor.getCurrentTitle();
          return { success: true, title };
        }

        case "review_set_current_title": {
          const title = String(args.title || "");
          this.supervisor.getSubstrate().setCurrentTitle(title);
          return { success: true, title };
        }

        case "review_get_trigger_policy": {
          const policy = this.supervisor.getTriggerPolicy();
          return { success: true, policy };
        }

        case "review_set_trigger_policy": {
          const policy = String(args.policy || "always") as ReviewTriggerPolicy;
          this.supervisor.setTriggerPolicy(policy);
          return { success: true, updatedPolicy: policy };
        }

        case "review_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "review_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "review_group_and_sort": {
          const groupBy = (args.groupBy as BackgroundReviewGroupBy) || "turn_range";
          const sortBy = (args.sortBy as BackgroundReviewSortBy) || "turnIndex";
          const direction = (args.direction as BackgroundReviewSortDirection) || "asc";
          const lanes = this.supervisor.getGroupedReviews(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "review_search_dsl": {
          const query = String(args.query || "");
          const reviews = this.supervisor.queryDsl(query);
          return { success: true, count: reviews.length, reviews };
        }

        case "review_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const rendered = BroccoliViewRenderer.renderBackgroundReviewDashboard({
            totalReviews: health.totalReviews,
            totalCandidateFacts: health.totalCandidateFacts,
            totalCandidateSkills: health.totalCandidateSkills,
            healthStatus: health.healthStatus,
            latestTurnIndex: health.latestTurnIndex,
          });
          return { success: true, rendered };
        }

        case "review_render_card": {
          const reviewId = String(args.reviewId || "");
          const review = this.supervisor.getSubstrate().getReview(reviewId);
          if (!review) return { success: false, error: `Review '${reviewId}' not found` };
          const rendered = BroccoliViewRenderer.renderTurnReviewCard({
            reviewId: review.reviewId,
            turnIndex: review.turnIndex,
            userGoal: review.reviewDigest.userGoal,
            assistantActionSummary: review.reviewDigest.assistantActionSummary,
            factsCount: review.candidateFacts.length,
            skillsCount: review.candidateSkills.length,
            durationMs: review.durationMs,
          });
          return { success: true, rendered };
        }

        case "review_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "review_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "review_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "review_bulk_purge": {
          const idsJson = String(args.reviewIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "reviewIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "review_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "review_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "review_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "review_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "review_format_fact": {
          const factId = String(args.factId || "");
          const facts = this.supervisor.getAllFacts();
          const fact = facts.find((f) => f.factId === factId);
          if (!fact) return { success: false, error: `Fact '${factId}' not found` };
          const formatted = (this.supervisor as any).evaluator?.formatCandidateFact(fact) || fact.object;
          return { success: true, formatted };
        }

        case "review_format_skill": {
          const skillId = String(args.skillId || "");
          const skills = this.supervisor.getAllSkills();
          const skill = skills.find((s) => s.skillId === skillId);
          if (!skill) return { success: false, error: `Skill '${skillId}' not found` };
          const formatted = (this.supervisor as any).evaluator?.formatCandidateSkill(skill) || skill.title;
          return { success: true, formatted };
        }

        case "review_clear_all": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
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
