/**
 * integrations-tool-suite.ts
 *
 * Model tool surface for the Enterprise Integrations Hub Subsystem (Phase 96 / ADR-126 / Target #72):
 * 30 specialized model tools covering unified cross-service schemas (GitHub, Linear, Notion, Stripe, Supabase, Sentry, Vercel),
 * 1-click workflow recipe automation, rate limiting, DSL search, swimlanes, dashboards, and exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IntegrationCategory,
  IntegrationProviderType,
  IntegrationsGroupBy,
  IntegrationsSortBy,
  IntegrationsSortDirection,
  IssuePriority,
  IssueStatus,
} from "../../../core/contracts/integrations.contracts.js";
import { IntegrationsSupervisor } from "../../../agents/extensions/integrations/integrations-supervisor.js";
import { BroccoliIntegrationsSubstrate } from "../../../sessions/extensions/integrations/broccoli-integrations-substrate.js";
import { IntegrationsSnapshotManager } from "../../../sessions/extensions/integrations/integrations-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import { DeterministicIntegrationsEngine } from "./deterministic-integrations-engine.js";

export class IntegrationsToolSuite {
  private readonly supervisor: IntegrationsSupervisor;
  private readonly snapshotManager: IntegrationsSnapshotManager;

  constructor(
    supervisorOrSubstrate?: IntegrationsSupervisor | BroccoliIntegrationsSubstrate,
    engine?: DeterministicIntegrationsEngine
  ) {
    if (supervisorOrSubstrate instanceof IntegrationsSupervisor) {
      this.supervisor = supervisorOrSubstrate;
    } else {
      const sub = supervisorOrSubstrate || new BroccoliIntegrationsSubstrate();
      const eng = engine || new DeterministicIntegrationsEngine();
      this.supervisor = new IntegrationsSupervisor(sub, eng);
    }
    this.snapshotManager = new IntegrationsSnapshotManager(this.supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "integrations_connect_service",
        description: "Connects a service provider (GitHub, Linear, Notion, Stripe, Supabase, Sentry, Vercel) in live or sandbox mode.",
        parameters: {
          provider: { type: "string", required: true, description: "Provider: github, linear, notion, stripe, supabase, sentry, vercel" },
          name: { type: "string", description: "Friendly name" },
          isMock: { type: "boolean", description: "Sandbox mode. Default: true" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_connect_service", args);
        },
      },
      {
        name: "integrations_disconnect_service",
        description: "Disconnects an active integration connection by connection ID.",
        parameters: {
          connectionId: { type: "string", required: true, description: "Connection ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_disconnect_service", args);
        },
      },
      {
        name: "integrations_list_connections",
        description: "Lists all active and configured third-party integration connections.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_list_connections", args);
        },
      },
      {
        name: "integrations_get_connection",
        description: "Retrieves integration connection metadata by ID.",
        parameters: {
          connectionId: { type: "string", required: true, description: "Connection ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_get_connection", args);
        },
      },
      {
        name: "integrations_list_services_catalog",
        description: "Lists all supported platforms and their capabilities in the service catalog.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_list_services_catalog", args);
        },
      },
      {
        name: "integrations_query_issues",
        description: "Queries unified issues across GitHub and Linear.",
        parameters: {
          provider: { type: "string", description: "Filter provider: github, linear" },
          status: { type: "string", description: "Filter status: TODO, IN_PROGRESS, DONE" },
          priority: { type: "string", description: "Filter priority: URGENT, HIGH, MEDIUM, LOW" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_query_issues", args);
        },
      },
      {
        name: "integrations_create_issue",
        description: "Creates a unified issue in GitHub or Linear.",
        parameters: {
          provider: { type: "string", required: true, description: "github or linear" },
          title: { type: "string", required: true, description: "Issue title" },
          description: { type: "string", description: "Description markdown" },
          priority: { type: "string", description: "Priority: URGENT, HIGH, MEDIUM, LOW" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_create_issue", args);
        },
      },
      {
        name: "integrations_update_issue",
        description: "Updates an existing unified issue status or priority.",
        parameters: {
          issueId: { type: "string", required: true, description: "Issue ID" },
          status: { type: "string", description: "New status" },
          priority: { type: "string", description: "New priority" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_update_issue", args);
        },
      },
      {
        name: "integrations_query_customers",
        description: "Queries unified customer records from Stripe.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_query_customers", args);
        },
      },
      {
        name: "integrations_query_alerts",
        description: "Queries Sentry error tracking alerts.",
        parameters: {
          level: { type: "string", description: "Filter level: FATAL, ERROR, WARNING" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_query_alerts", args);
        },
      },
      {
        name: "integrations_query_documents",
        description: "Queries documentation pages from Notion.",
        parameters: {
          query: { type: "string", description: "Search keyword" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_query_documents", args);
        },
      },
      {
        name: "integrations_list_recipes",
        description: "Lists all available 1-click workflow automation recipes.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_list_recipes", args);
        },
      },
      {
        name: "integrations_execute_recipe",
        description: "Executes a multi-step workflow recipe by recipe ID.",
        parameters: {
          recipeId: { type: "string", required: true, description: "Recipe ID" },
          parametersJson: { type: "string", description: "JSON parameters" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_execute_recipe", args);
        },
      },
      {
        name: "integrations_install_recipe",
        description: "Installs and enables a pre-built workflow recipe.",
        parameters: {
          recipeId: { type: "string", required: true, description: "Recipe ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_install_recipe", args);
        },
      },
      {
        name: "integrations_get_recipe_executions",
        description: "Retrieves execution run history for workflow recipes.",
        parameters: {
          recipeId: { type: "string", description: "Optional recipe ID filter" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_get_recipe_executions", args);
        },
      },
      {
        name: "integrations_check_rate_limit",
        description: "Checks rate limit bucket availability for an integration endpoint.",
        parameters: {
          provider: { type: "string", required: true, description: "Provider key" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_check_rate_limit", args);
        },
      },
      {
        name: "integrations_audit_health",
        description: "Audits overall health matrix, active providers, and SLA status.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_audit_health", args);
        },
      },
      {
        name: "integrations_get_metrics",
        description: "Fetches aggregated integration metrics, total requests, error rate, and latencies.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_get_metrics", args);
        },
      },
      {
        name: "integrations_group_and_sort",
        description: "Organizes integrations into multi-criteria swimlanes (category, provider, status).",
        parameters: {
          groupBy: { type: "string", description: "category, provider, status" },
          sortBy: { type: "string", description: "name, createdAt, totalRequests" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_group_and_sort", args);
        },
      },
      {
        name: "integrations_search_dsl",
        description: "Searches connections using Natural Query DSL (e.g. 'provider:github connected:true').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_search_dsl", args);
        },
      },
      {
        name: "integrations_render_dashboard",
        description: "Renders an ANSI CLI summary card with connection status, recipes, and health.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_render_dashboard", args);
        },
      },
      {
        name: "integrations_render_recipe_card",
        description: "Renders an interactive ANSI CLI workflow recipe descriptor card.",
        parameters: {
          recipeId: { type: "string", required: true, description: "Recipe ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_render_recipe_card", args);
        },
      },
      {
        name: "integrations_export_html_view",
        description: "Exports integration catalog and recipe registry to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_export_html_view", args);
        },
      },
      {
        name: "integrations_export_markdown_report",
        description: "Exports integrations hub status report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_export_markdown_report", args);
        },
      },
      {
        name: "integrations_export_csv_report",
        description: "Exports connection ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_export_csv_report", args);
        },
      },
      {
        name: "integrations_bulk_purge",
        description: "Atomically purges multiple integration connections.",
        parameters: {
          connectionIdsJson: { type: "string", required: true, description: "JSON array of connection IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_bulk_purge", args);
        },
      },
      {
        name: "integrations_undo",
        description: "Reverts the last integration mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_undo", args);
        },
      },
      {
        name: "integrations_redo",
        description: "Re-applies the last undone integration mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_redo", args);
        },
      },
      {
        name: "integrations_capture_snapshot",
        description: "Captures a frame-perfect snapshot of integrations workspace state.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_capture_snapshot", args);
        },
      },
      {
        name: "integrations_restore_snapshot",
        description: "Restores integrations state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("integrations_restore_snapshot", args);
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
        case "integrations_connect_service": {
          const provider = (String(args.provider || "github").toLowerCase()) as IntegrationProviderType;
          const connName = args.name ? String(args.name) : undefined;
          const isMock = typeof args.isMock === "boolean" ? args.isMock : true;
          const res = this.supervisor.connectService(provider, connName, undefined, isMock);
          return { ...res };
        }

        case "integrations_disconnect_service": {
          const connectionId = String(args.connectionId || "");
          const res = this.supervisor.disconnectService(connectionId);
          return { success: res };
        }

        case "integrations_list_connections": {
          const connections = this.supervisor.listConnections();
          return { success: true, count: connections.length, connections };
        }

        case "integrations_get_connection": {
          const connectionId = String(args.connectionId || "");
          const conn = this.supervisor.getConnection(connectionId);
          if (!conn) return { success: false, error: `Connection '${connectionId}' not found` };
          return { success: true, connection: conn };
        }

        case "integrations_list_services_catalog": {
          const catalog = this.supervisor.getServiceCatalog();
          return { success: true, catalog };
        }

        case "integrations_query_issues": {
          const provider = args.provider ? (String(args.provider).toLowerCase() as IntegrationProviderType) : undefined;
          const status = args.status ? (String(args.status) as IssueStatus) : undefined;
          const priority = args.priority ? (String(args.priority) as IssuePriority) : undefined;
          const issues = this.supervisor.queryIssues({ provider, status, priority });
          return { success: true, count: issues.length, issues };
        }

        case "integrations_create_issue": {
          const provider = (String(args.provider || "github").toLowerCase()) as IntegrationProviderType;
          const title = String(args.title || "Untitled Issue");
          const description = args.description ? String(args.description) : "";
          const priority = (args.priority as IssuePriority) || "MEDIUM";
          const res = this.supervisor.createIssue(provider, title, description, priority);
          return { ...res };
        }

        case "integrations_update_issue": {
          const issueId = String(args.issueId || "");
          const status = args.status as IssueStatus | undefined;
          const priority = args.priority as IssuePriority | undefined;
          const res = this.supervisor.updateIssue(issueId, { status, priority });
          return { ...res };
        }

        case "integrations_query_customers": {
          const customers = this.supervisor.queryCustomers();
          return { success: true, count: customers.length, customers };
        }

        case "integrations_query_alerts": {
          const level = args.level ? String(args.level) : undefined;
          const alerts = this.supervisor.queryAlerts(level as any);
          return { success: true, count: alerts.length, alerts };
        }

        case "integrations_query_documents": {
          const query = args.query ? String(args.query) : undefined;
          const documents = this.supervisor.queryDocuments(query);
          return { success: true, count: documents.length, documents };
        }

        case "integrations_list_recipes": {
          const recipes = this.supervisor.listRecipes();
          return { success: true, count: recipes.length, recipes };
        }

        case "integrations_execute_recipe": {
          const recipeId = String(args.recipeId || "");
          let params: Record<string, unknown> = {};
          if (typeof args.parametersJson === "string") {
            try {
              params = JSON.parse(args.parametersJson);
            } catch {
              params = {};
            }
          }
          const res = this.supervisor.executeRecipe(recipeId, params);
          return { ...res };
        }

        case "integrations_install_recipe": {
          const recipeId = String(args.recipeId || "");
          const res = this.supervisor.installRecipe(recipeId);
          return { ...res };
        }

        case "integrations_get_recipe_executions": {
          const recipeId = args.recipeId ? String(args.recipeId) : undefined;
          const executions = this.supervisor.listRecipeExecutions(recipeId);
          return { success: true, count: executions.length, executions };
        }

        case "integrations_check_rate_limit": {
          const provider = String(args.provider || "github");
          const limitRes = this.supervisor.getEngine().checkRateLimit(provider);
          return { success: true, provider, ...limitRes };
        }

        case "integrations_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "integrations_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "integrations_group_and_sort": {
          const groupBy = (args.groupBy as IntegrationsGroupBy) || "category";
          const sortBy = (args.sortBy as IntegrationsSortBy) || "name";
          const direction = (args.direction as IntegrationsSortDirection) || "asc";
          const lanes = this.supervisor.getGroupedConnections(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "integrations_search_dsl": {
          const query = String(args.query || "");
          const connections = this.supervisor.queryDsl(query);
          return { success: true, count: connections.length, connections };
        }

        case "integrations_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderIntegrationsDashboard({
            totalConnections: metrics.totalConnections,
            activeConnections: health.activeConnections,
            totalRecipes: metrics.totalRecipes,
            totalRequests: metrics.totalRequests,
            overallStatus: health.overallStatus,
          });
          return { success: true, rendered };
        }

        case "integrations_render_recipe_card": {
          const recipeId = String(args.recipeId || "");
          const recipe = this.supervisor.getSubstrate().getRecipe(recipeId);
          if (!recipe) return { success: false, error: `Recipe '${recipeId}' not found` };
          const rendered = BroccoliViewRenderer.renderIntegrationRecipeCard({
            recipeId: recipe.recipeId,
            title: recipe.title,
            category: recipe.category,
            triggerEvent: recipe.triggerEvent,
            stepsCount: recipe.steps.length,
            executionCount: recipe.executionCount,
          });
          return { success: true, rendered };
        }

        case "integrations_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "integrations_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "integrations_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "integrations_bulk_purge": {
          const idsJson = String(args.connectionIdsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "connectionIdsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "integrations_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "integrations_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "integrations_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "integrations_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
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
