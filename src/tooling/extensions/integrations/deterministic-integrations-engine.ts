/**
 * deterministic-integrations-engine.ts
 *
 * Deterministic service request router, cross-service schema normalizer,
 * multi-step workflow recipe runner, and sandbox mock seed generator (Phase 96 / ADR-126).
 */

import type {
  IntegrationCategory,
  IntegrationProviderType,
  IntegrationRecipe,
  ServiceCatalogEntry,
  UnifiedAlert,
  UnifiedCustomer,
  UnifiedDocument,
  UnifiedIssue,
  WorkflowExecutionResult,
  WorkflowStep,
} from "../../../core/contracts/integrations.contracts.js";

export class DeterministicIntegrationsEngine {
  private readonly rateLimitBuckets: Map<string, { tokens: number; lastRefillMs: number }> = new Map();

  private readonly serviceCatalog: readonly ServiceCatalogEntry[] = [
    {
      provider: "github",
      displayName: "GitHub",
      category: "developer_tools",
      description: "Code repositories, pull requests, issue tracking, CI/CD workflow runs, and commit logs.",
      iconEmoji: "🐙",
      popularRecipes: ["github_pr_to_gateway", "sync_github_issues_to_linear"],
      supportedFeatures: ["issues", "pull_requests", "commits", "actions_workflows", "webhooks"],
    },
    {
      provider: "linear",
      displayName: "Linear",
      category: "productivity",
      description: "High-velocity issue tracking, sprint cycles, product roadmaps, and team boards.",
      iconEmoji: "📐",
      popularRecipes: ["sentry_to_linear", "linear_cycle_digest"],
      supportedFeatures: ["issues", "cycles", "projects", "teams", "comments"],
    },
    {
      provider: "notion",
      displayName: "Notion",
      category: "productivity",
      description: "Connected workspace for documentation, team wikis, relational databases, and meeting notes.",
      iconEmoji: "📝",
      popularRecipes: ["notion_doc_to_supabase", "sync_specs_to_notion"],
      supportedFeatures: ["pages", "databases", "blocks", "search"],
    },
    {
      provider: "stripe",
      displayName: "Stripe",
      category: "finance_commerce",
      description: "Global payments infrastructure, subscriptions, invoices, and customer billing accounts.",
      iconEmoji: "💳",
      popularRecipes: ["stripe_charge_invoice", "notify_failed_payments"],
      supportedFeatures: ["customers", "payment_intents", "subscriptions", "invoices", "webhooks"],
    },
    {
      provider: "supabase",
      displayName: "Supabase",
      category: "database_backend",
      description: "Postgres database platform, table introspection, auth users, and file storage buckets.",
      iconEmoji: "⚡",
      popularRecipes: ["sync_customers_to_supabase", "backup_tables"],
      supportedFeatures: ["tables", "sql_queries", "auth_users", "storage_buckets"],
    },
    {
      provider: "sentry",
      displayName: "Sentry",
      category: "devops_monitoring",
      description: "Application performance monitoring, crash diagnostics, exception stack traces, and releases.",
      iconEmoji: "🛡️",
      popularRecipes: ["sentry_to_linear", "sentry_fatal_alert_to_slack"],
      supportedFeatures: ["issues", "events", "stack_traces", "releases", "alerts"],
    },
    {
      provider: "vercel",
      displayName: "Vercel",
      category: "cloud_infrastructure",
      description: "Frontend cloud platform, serverless deployments, build logs, and custom domain aliases.",
      iconEmoji: "▲",
      popularRecipes: ["vercel_deploy_alert", "audit_build_logs"],
      supportedFeatures: ["deployments", "build_logs", "domains", "projects"],
    },
    {
      provider: "google_workspace",
      displayName: "Google Workspace",
      category: "productivity",
      description: "Calendar scheduling, Google Drive file sharing, Google Docs collaboration, and Meet links.",
      iconEmoji: "📅",
      popularRecipes: ["calendar_meeting_briefing", "drive_spec_sync"],
      supportedFeatures: ["calendar_events", "drive_files", "docs", "contacts"],
    },
  ];

  private readonly defaultRecipes: readonly IntegrationRecipe[] = [
    {
      recipeId: "sentry_to_linear",
      title: "Sentry Exception to Linear Issue",
      description: "Automatically creates a high-priority Linear issue when a Fatal/Error exception occurs in Sentry.",
      category: "devops_monitoring",
      triggerEvent: "sentry.issue_created",
      steps: [
        { stepId: "s1", service: "sentry", actionType: "get_issue_details", parameters: {} },
        { stepId: "s2", service: "linear", actionType: "create_issue", parameters: { priority: "HIGH", team: "ENG" } },
      ],
      isInstalled: true,
      executionCount: 0,
      createdAt: Date.now(),
    },
    {
      recipeId: "github_pr_to_gateway",
      title: "GitHub Pull Request Review Announcement",
      description: "Dispatches an interactive approval card to Telegram / Slack when a GitHub PR is opened.",
      category: "developer_tools",
      triggerEvent: "github.pull_request_opened",
      steps: [
        { stepId: "s1", service: "github", actionType: "inspect_pr", parameters: {} },
        { stepId: "s2", service: "github", actionType: "notify_reviewers", parameters: {} },
      ],
      isInstalled: true,
      executionCount: 0,
      createdAt: Date.now(),
    },
    {
      recipeId: "stripe_charge_invoice",
      title: "Stripe Automatic Invoice Generation",
      description: "Generates and sends a PDF invoice when a Stripe payment intent succeeds.",
      category: "finance_commerce",
      triggerEvent: "stripe.payment_succeeded",
      steps: [
        { stepId: "s1", service: "stripe", actionType: "get_payment_intent", parameters: {} },
        { stepId: "s2", service: "stripe", actionType: "create_invoice", parameters: { auto_finalize: true } },
      ],
      isInstalled: true,
      executionCount: 0,
      createdAt: Date.now(),
    },
    {
      recipeId: "notion_doc_to_supabase",
      title: "Notion Spec Sync to Supabase Table",
      description: "Mirrors product requirement docs from Notion pages into a relational Postgres table in Supabase.",
      category: "database_backend",
      triggerEvent: "notion.page_updated",
      steps: [
        { stepId: "s1", service: "notion", actionType: "fetch_page_content", parameters: {} },
        { stepId: "s2", service: "supabase", actionType: "upsert_row", parameters: { table: "product_specs" } },
      ],
      isInstalled: true,
      executionCount: 0,
      createdAt: Date.now(),
    },
  ];

  public getCatalog(): readonly ServiceCatalogEntry[] {
    return this.serviceCatalog;
  }

  public getCatalogEntry(provider: IntegrationProviderType): ServiceCatalogEntry | undefined {
    return this.serviceCatalog.find((c) => c.provider === provider);
  }

  public getDefaultRecipes(): readonly IntegrationRecipe[] {
    return this.defaultRecipes;
  }

  /**
   * Generates deterministic mock seed data for offline / sandbox testing.
   */
  public generateSandboxDataset(): {
    issues: readonly UnifiedIssue[];
    customers: readonly UnifiedCustomer[];
    alerts: readonly UnifiedAlert[];
    documents: readonly UnifiedDocument[];
  } {
    const now = Date.now();

    const issues: UnifiedIssue[] = [
      {
        id: "iss_gh_101",
        title: "Fix memory fragmentation in contig slab allocator",
        description: "Enforce zero-GC invariant across high-throughput turn ticks.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assignee: "alex_dev",
        labels: ["performance", "memory-slab", "core"],
        url: "https://github.com/lumi/lumi-new/issues/101",
        sourceService: "github",
        sourceId: "101",
        createdAt: now - 3600000 * 24,
        updatedAt: now - 3600000 * 2,
      },
      {
        id: "iss_lin_202",
        title: "Design omnichannel customer timeline cards in UI",
        description: "Mirror Front / Intercom style contact card resolution with VIP badge.",
        status: "TODO",
        priority: "URGENT",
        assignee: "sarah_ui",
        labels: ["ux", "omnichannel", "v3"],
        url: "https://linear.app/lumi/issue/ENG-202",
        sourceService: "linear",
        sourceId: "ENG-202",
        createdAt: now - 3600000 * 12,
        updatedAt: now - 3600000,
      },
      {
        id: "iss_gh_103",
        title: "Implement constant-time HMAC webhook verification",
        description: "Prevent timing attack vulnerability on external webhook ingress.",
        status: "DONE",
        priority: "URGENT",
        assignee: "crypto_sec",
        labels: ["security", "crypto", "gateway"],
        url: "https://github.com/lumi/lumi-new/issues/103",
        sourceService: "github",
        sourceId: "103",
        createdAt: now - 3600000 * 48,
        updatedAt: now - 3600000 * 10,
      },
    ];

    const customers: UnifiedCustomer[] = [
      {
        customerId: "cust_str_9001",
        name: "Acme Cloud Corp",
        email: "billing@acme.corp",
        paymentStatus: "ACTIVE",
        totalSpendUsd: 14500.0,
        currency: "usd",
        sourceService: "stripe",
        sourceId: "cus_N982hfk3j9",
        createdAt: now - 3600000 * 24 * 30,
      },
      {
        customerId: "cust_sup_9002",
        name: "Zenith Labs Inc",
        email: "admin@zenithlabs.ai",
        paymentStatus: "ACTIVE",
        totalSpendUsd: 8250.0,
        currency: "usd",
        sourceService: "supabase",
        sourceId: "usr_sup_8819",
        createdAt: now - 3600000 * 24 * 15,
      },
    ];

    const alerts: UnifiedAlert[] = [
      {
        alertId: "alt_sen_501",
        title: "UnhandledPromiseRejection: Upstream edge connection reset",
        level: "ERROR",
        errorType: "FetchConnectionError",
        stackSummary: "at fetchWithRetry (/src/agents/extensions/resolution/model-resolver.ts:142:18)",
        service: "sentry",
        occurrenceCount: 14,
        firstSeenAt: now - 3600000 * 4,
        lastSeenAt: now - 60000,
        url: "https://sentry.io/organizations/lumi/issues/501",
      },
      {
        alertId: "alt_ver_502",
        title: "Vercel Build Failed: Bundle size exceeded budget",
        level: "WARNING",
        errorType: "BundleBudgetWarning",
        stackSummary: "Module chunk size 1.2MB exceeds warning threshold 1.0MB",
        service: "vercel",
        occurrenceCount: 1,
        firstSeenAt: now - 3600000 * 8,
        lastSeenAt: now - 3600000 * 8,
        url: "https://vercel.com/lumi/deployments/dpl_9892kfk",
      },
    ];

    const documents: UnifiedDocument[] = [
      {
        docId: "doc_not_301",
        title: "LUMI Architecture Master Specification (ADR Registry)",
        excerpt: "Comprehensive specifications covering 16MB contiguous slab memory, zero-GC Broccolidb...",
        wordCount: 14200,
        lastModifiedAt: now - 3600000 * 6,
        url: "https://notion.so/lumi/spec-301",
        service: "notion",
      },
      {
        docId: "doc_not_302",
        title: "Product Roadmap Q3-Q4: Autonomous Swarms & Integrations",
        excerpt: "Enterprise integration roadmap covering GitHub, Linear, Notion, Stripe, Supabase...",
        wordCount: 3850,
        lastModifiedAt: now - 3600000 * 18,
        url: "https://notion.so/lumi/roadmap-302",
        service: "notion",
      },
    ];

    return { issues, customers, alerts, documents };
  }

  /**
   * Executes a multi-step workflow recipe sequentially.
   */
  public executeRecipe(
    recipe: IntegrationRecipe,
    customInputs: Record<string, unknown> = {}
  ): WorkflowExecutionResult {
    const start = performance.now();
    const executionId = `exec_${recipe.recipeId}_${Date.now()}`;
    const stepResults: Record<string, unknown>[] = [];

    for (let i = 0; i < recipe.steps.length; i++) {
      const step = recipe.steps[i];
      const stepRes: Record<string, unknown> = {
        stepId: step.stepId,
        service: step.service,
        actionType: step.actionType,
        status: "COMPLETED",
        output: {
          success: true,
          action: step.actionType,
          service: step.service,
          params: { ...step.parameters, ...customInputs },
          timestamp: Date.now(),
        },
      };
      stepResults.push(stepRes);
    }

    const durationMs = performance.now() - start;

    return {
      executionId,
      recipeId: recipe.recipeId,
      success: true,
      stepsExecuted: recipe.steps.length,
      totalDurationMs: durationMs,
      stepResults,
      executedAt: Date.now(),
    };
  }

  /**
   * Token bucket rate limiter.
   */
  public checkRateLimit(
    key: string,
    limitPerMinute = 120
  ): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    const now = Date.now();
    let bucket = this.rateLimitBuckets.get(key);

    if (!bucket) {
      bucket = { tokens: limitPerMinute, lastRefillMs: now };
      this.rateLimitBuckets.set(key, bucket);
    }

    const elapsedSec = (now - bucket.lastRefillMs) / 1000;
    const refillTokens = elapsedSec * (limitPerMinute / 60);
    bucket.tokens = Math.min(limitPerMinute, bucket.tokens + refillTokens);
    bucket.lastRefillMs = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / (limitPerMinute / 60)) * 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }
}
