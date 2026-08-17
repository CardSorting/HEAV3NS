/**
 * integrations-tool-suite.ts
 *
 * Model tool surface for the Enterprise Integrations Hub Subsystem (Phase 96 / ADR-126).
 * Exposes 18 specialized model tools covering unified cross-service schemas (GitHub, Linear, Notion, Stripe, Supabase, Sentry, Vercel),
 * 1-click workflow recipe automation, connection lifecycle, and live ASCII health matrix telemetry.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IntegrationProviderType,
  IssuePriority,
  IssueStatus,
} from "../../../core/contracts/integrations.contracts.js";
import { IntegrationsSupervisor } from "../../../agents/extensions/integrations/integrations-supervisor.js";
import { BroccoliIntegrationsSubstrate } from "../../../sessions/extensions/integrations/broccoli-integrations-substrate.js";
import { DeterministicIntegrationsEngine } from "./deterministic-integrations-engine.js";

export class IntegrationsToolSuite {
  private readonly supervisor: IntegrationsSupervisor;

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
  }

  public getTools(): ToolDefinition[] {
    return [
      // 1. integrations_connect_service
      {
        name: "integrations_connect_service",
        description: "Connects and authenticates a third-party service provider (GitHub, Linear, Notion, Stripe, Supabase, Sentry, Vercel, Google Workspace) in live or sandbox mock mode.",
        parameters: {
          provider: { type: "string", required: true, description: "Provider name: github, linear, notion, stripe, supabase, sentry, vercel, google_workspace" },
          name: { type: "string", description: "Friendly connection name" },
          isMock: { type: "boolean", description: "Use deterministic sandbox mock mode. Default: true" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const provider = (String(args.provider || "github").toLowerCase()) as IntegrationProviderType;
          const name = args.name ? String(args.name) : undefined;
          const isMock = typeof args.isMock === "boolean" ? args.isMock : true;

          const res = this.supervisor.connectService(provider, name, undefined, isMock);

          if (!res.success || !res.connection) {
            return { success: false, error: res.error || "Failed to connect service" };
          }

          return {
            success: true,
            connectionId: res.connection.connectionId,
            provider: res.connection.provider,
            name: res.connection.name,
            category: res.connection.category,
            isMock: res.connection.isMock,
            message: `✓ Connected to [${res.connection.name}] (${res.connection.isMock ? "Sandbox Mock Mode" : "Live API"}).`,
          };
        },
      },

      // 2. integrations_disconnect_service
      {
        name: "integrations_disconnect_service",
        description: "Disconnects and removes an active integration connection.",
        parameters: {
          connectionId: { type: "string", required: true, description: "Connection ID to disconnect" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const connectionId = String(args.connectionId || "");
          const removed = this.supervisor.disconnectService(connectionId);

          return {
            success: true,
            removed,
            message: removed ? `✓ Connection '${connectionId}' has been disconnected.` : `Connection '${connectionId}' not found.`,
          };
        },
      },

      // 3. integrations_query_catalog
      {
        name: "integrations_query_catalog",
        description: "Lists all available enterprise integrations in the catalog with category tags, descriptions, popular recipes, and supported features.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const catalog = this.supervisor.listCatalog();

          const tableRows = catalog.map((c) =>
            `| ${c.iconEmoji} ${c.displayName.padEnd(16)} | ${c.category.padEnd(20)} | ${c.supportedFeatures.join(", ")} |`
          ).join("\n");

          const dashboard =
            `+-----------------------------------------------------------------------------------------+\n` +
            `| LUMI Enterprise Integrations App Catalog                                                |\n` +
            `+-----------------------------------------------------------------------------------------+\n` +
            `| Provider         | Category             | Supported Capabilities                        |\n` +
            `+------------------+----------------------+-----------------------------------------------+\n` +
            tableRows + "\n" +
            `+-----------------------------------------------------------------------------------------+`;

          return {
            success: true,
            totalProviders: catalog.length,
            catalog,
            formattedDashboard: dashboard,
          };
        },
      },

      // 4. integrations_query_unified_issues
      {
        name: "integrations_query_unified_issues",
        description: "Searches unified issues across all connected issue tracking platforms (GitHub Issues, Linear Issues, Jira).",
        parameters: {
          service: { type: "string", description: "Filter by source service: github, linear" },
          query: { type: "string", description: "Search query text in title or description" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const service = args.service ? ((String(args.service).toLowerCase()) as IntegrationProviderType) : undefined;
          const query = args.query ? String(args.query) : undefined;

          const issues = this.supervisor.queryUnifiedIssues(service, query);

          return {
            success: true,
            totalIssues: issues.length,
            issues,
            summary: `Found ${issues.length} unified issue(s) matching criteria.`,
          };
        },
      },

      // 5. integrations_create_unified_issue
      {
        name: "integrations_create_unified_issue",
        description: "Creates an issue seamlessly in either GitHub or Linear using a normalized schema.",
        parameters: {
          title: { type: "string", required: true, description: "Issue title" },
          description: { type: "string", required: true, description: "Issue markdown description" },
          service: { type: "string", description: "Target service: linear, github. Default: linear" },
          priority: { type: "string", description: "Priority: URGENT, HIGH, MEDIUM, LOW. Default: MEDIUM" },
          assignee: { type: "string", description: "Assignee handle" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const title = String(args.title || "");
          const description = String(args.description || "");
          const service = (String(args.service || "linear").toLowerCase()) as IntegrationProviderType;
          const priority = (String(args.priority || "MEDIUM").toUpperCase()) as IssuePriority;
          const assignee = args.assignee ? String(args.assignee) : undefined;

          const res = this.supervisor.createUnifiedIssue({
            title,
            description,
            sourceService: service,
            priority,
            assignee,
            status: "TODO" as IssueStatus,
          });

          if (!res.success || !res.issue) {
            return { success: false, error: res.error || "Failed to create issue" };
          }

          return {
            success: true,
            issueId: res.issue.id,
            title: res.issue.title,
            service: res.issue.sourceService,
            priority: res.issue.priority,
            url: res.issue.url,
            message: `✓ Created unified issue [${res.issue.id}] in ${res.issue.sourceService.toUpperCase()}: "${res.issue.title}".`,
          };
        },
      },

      // 6. integrations_query_unified_customers
      {
        name: "integrations_query_unified_customers",
        description: "Searches unified customer and billing accounts across Stripe, Supabase Auth, and CRM data.",
        parameters: {
          service: { type: "string", description: "Filter by source service: stripe, supabase" },
          query: { type: "string", description: "Search by customer name or email" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const service = args.service ? ((String(args.service).toLowerCase()) as IntegrationProviderType) : undefined;
          const query = args.query ? String(args.query) : undefined;

          const customers = this.supervisor.queryUnifiedCustomers(service, query);

          return {
            success: true,
            totalCustomers: customers.length,
            customers,
            summary: `Found ${customers.length} unified customer record(s).`,
          };
        },
      },

      // 7. integrations_query_unified_documents
      {
        name: "integrations_query_unified_documents",
        description: "Searches unified documents and specifications across Notion, Google Docs, and GitHub wikis.",
        parameters: {
          service: { type: "string", description: "Filter by service: notion, google_workspace" },
          query: { type: "string", description: "Search query" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const service = args.service ? ((String(args.service).toLowerCase()) as IntegrationProviderType) : undefined;
          const query = args.query ? String(args.query) : undefined;

          const documents = this.supervisor.queryUnifiedDocuments(service, query);

          return {
            success: true,
            totalDocuments: documents.length,
            documents,
            summary: `Found ${documents.length} unified document(s).`,
          };
        },
      },

      // 8. integrations_query_unified_alerts
      {
        name: "integrations_query_unified_alerts",
        description: "Searches unified error alerts and build failures across Sentry, Vercel, and GitHub Actions.",
        parameters: {
          service: { type: "string", description: "Filter by service: sentry, vercel, github" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const service = args.service ? ((String(args.service).toLowerCase()) as IntegrationProviderType) : undefined;
          const alerts = this.supervisor.queryUnifiedAlerts(service);

          return {
            success: true,
            totalAlerts: alerts.length,
            alerts,
            summary: `Found ${alerts.length} active alert(s) across monitoring services.`,
          };
        },
      },

      // 9. integrations_execute_workflow_recipe
      {
        name: "integrations_execute_workflow_recipe",
        description: "Executes a pre-configured multi-step automation workflow recipe (e.g. sentry_to_linear, github_pr_to_gateway, stripe_charge_invoice, notion_doc_to_supabase).",
        parameters: {
          recipeId: { type: "string", required: true, description: "Recipe identifier (e.g. sentry_to_linear)" },
          customInputsJson: { type: "string", description: "Optional JSON parameters for step interpolation" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const recipeId = String(args.recipeId || "sentry_to_linear");
          let customInputs: Record<string, unknown> = {};
          try {
            customInputs = JSON.parse(String(args.customInputsJson || "{}"));
          } catch {
            customInputs = {};
          }

          const res = this.supervisor.executeRecipe(recipeId, customInputs);

          if (!res.success || !res.result) {
            return { success: false, error: res.error || "Failed to execute recipe" };
          }

          return {
            success: true,
            executionId: res.result.executionId,
            recipeId: res.result.recipeId,
            stepsExecuted: res.result.stepsExecuted,
            durationMs: res.result.totalDurationMs,
            stepResults: res.result.stepResults,
            message: `✓ Workflow Recipe '${recipeId}' executed successfully (${res.result.stepsExecuted} steps in ${res.result.totalDurationMs.toFixed(2)}ms).`,
          };
        },
      },

      // 10. integrations_manage_webhook_trigger
      {
        name: "integrations_manage_webhook_trigger",
        description: "Lists installed automation recipes or inspects execution history.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const recipes = this.supervisor.listRecipes();

          return {
            success: true,
            totalRecipes: recipes.length,
            recipes,
            summary: `Found ${recipes.length} installed automation recipe(s).`,
          };
        },
      },

      // 11. integrations_query_github
      {
        name: "integrations_query_github",
        description: "Deep inspection of GitHub pull requests, issues, commit logs, and repository status.",
        parameters: {
          action: { type: "string", description: "Action: list_prs, list_issues, get_repo. Default: list_prs" },
          repo: { type: "string", description: "Repository (e.g. lumi/lumi-new)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "list_prs");
          return this.supervisor.queryGithub(action, args);
        },
      },

      // 12. integrations_query_linear
      {
        name: "integrations_query_linear",
        description: "Deep inspection of Linear sprint cycles, projects, roadmap milestones, and issues.",
        parameters: {
          action: { type: "string", description: "Action: list_issues, get_cycle. Default: list_issues" },
          team: { type: "string", description: "Team key (e.g. ENG)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "list_issues");
          return this.supervisor.queryLinear(action, args);
        },
      },

      // 13. integrations_query_notion
      {
        name: "integrations_query_notion",
        description: "Searches Notion workspaces, inspects databases, and reads document pages.",
        parameters: {
          action: { type: "string", description: "Action: search, get_database. Default: search" },
          query: { type: "string", description: "Search keyword" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "search");
          return this.supervisor.queryNotion(action, args);
        },
      },

      // 14. integrations_manage_stripe
      {
        name: "integrations_manage_stripe",
        description: "Inspects Stripe customers, payment balances, active subscriptions, and invoices.",
        parameters: {
          action: { type: "string", description: "Action: list_customers, get_balance. Default: list_customers" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "list_customers");
          return this.supervisor.manageStripe(action, args);
        },
      },

      // 15. integrations_query_supabase
      {
        name: "integrations_query_supabase",
        description: "Introspects Supabase PostgreSQL tables, schema columns, and auth users.",
        parameters: {
          action: { type: "string", description: "Action: list_tables, query. Default: list_tables" },
          projectRef: { type: "string", description: "Project reference ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "list_tables");
          return this.supervisor.querySupabase(action, args);
        },
      },

      // 16. integrations_inspect_sentry
      {
        name: "integrations_inspect_sentry",
        description: "Inspects Sentry application crash logs, exception stack traces, and crash-free session rates.",
        parameters: {
          action: { type: "string", description: "Action: list_issues. Default: list_issues" },
          project: { type: "string", description: "Project identifier" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "list_issues");
          return this.supervisor.inspectSentry(action, args);
        },
      },

      // 17. integrations_manage_vercel
      {
        name: "integrations_manage_vercel",
        description: "Audits Vercel frontend deployments, production aliases, and build logs.",
        parameters: {
          action: { type: "string", description: "Action: list_deployments. Default: list_deployments" },
          project: { type: "string", description: "Project name" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const action = String(args.action || "list_deployments");
          return this.supervisor.manageVercel(action, args);
        },
      },

      // 18. integrations_manage_config
      {
        name: "integrations_manage_config",
        description: "Enables or disables the Enterprise Integrations Hub, toggles sandbox mock mode, and configures rate limits.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable integrations skill" },
          sandboxModeEnabled: { type: "boolean", description: "Toggle deterministic sandbox mock mode" },
          rateLimitPerMinute: { type: "number", description: "Outbound request rate limit per minute" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.sandboxModeEnabled === "boolean") updates.sandboxModeEnabled = args.sandboxModeEnabled;
          if (typeof args.rateLimitPerMinute === "number") updates.rateLimitPerMinute = args.rateLimitPerMinute;

          const updated = this.supervisor.updateConfig(updates);

          return {
            success: true,
            status: updated.enabled ? "ACTIVE (ENABLED)" : "DISABLED (FAIL-CLOSED)",
            sandboxMode: updated.sandboxModeEnabled ? "ENABLED (Deterministic Mocks)" : "DISABLED (Live Endpoints)",
            config: updated,
            message: updated.enabled
              ? `✓ Enterprise Integrations Hub is now ENABLED for [${updated.allowedProviders.join(", ")}].`
              : "✓ Enterprise Integrations Hub is now DISABLED (Fail-Closed).",
          };
        },
      },
    ];
  }
}
