/**
 * integrations-supervisor.ts
 *
 * Supervisor orchestrator for the Enterprise Integrations Hub Subsystem (Phase 96 / ADR-126).
 * Governs service connection lifecycles, unified cross-service queries, recipe automations,
 * sandbox dataset seeding, and health matrix telemetry.
 */

import type {
  IntegrationAuthType,
  IntegrationCategory,
  IntegrationConnection,
  IntegrationProviderType,
  IntegrationRecipe,
  IntegrationsHealthMatrix,
  IntegrationsSkillConfig,
  PlatformIntegrationHealth,
  ServiceCatalogEntry,
  UnifiedAlert,
  UnifiedCustomer,
  UnifiedDocument,
  UnifiedIssue,
  WorkflowExecutionResult,
  IssuePriority,
  IssueStatus,
} from "../../../core/contracts/integrations.contracts.js";
import { BroccoliIntegrationsSubstrate } from "../../../sessions/extensions/integrations/broccoli-integrations-substrate.js";
import { DeterministicIntegrationsEngine } from "../../../tooling/extensions/integrations/deterministic-integrations-engine.js";

export class IntegrationsSupervisor {
  private readonly substrate: BroccoliIntegrationsSubstrate;
  private readonly engine: DeterministicIntegrationsEngine;

  constructor(substrate: BroccoliIntegrationsSubstrate, engine: DeterministicIntegrationsEngine) {
    this.substrate = substrate;
    this.engine = engine;
    this.seedDefaults();
  }

  private seedDefaults(): void {
    // Seed default recipes
    for (const r of this.engine.getDefaultRecipes()) {
      this.substrate.upsertRecipe(r);
    }
    // Seed sandbox dataset
    this.seedSandboxData();
  }

  public seedSandboxData(): void {
    const data = this.engine.generateSandboxDataset();
    for (const i of data.issues) this.substrate.upsertIssue(i);
    for (const c of data.customers) this.substrate.upsertCustomer(c);
    for (const a of data.alerts) this.substrate.upsertAlert(a);
    for (const d of data.documents) this.substrate.upsertDocument(d);
  }

  public isSkillEnabled(): boolean {
    return this.substrate.getConfig().enabled;
  }

  public getConfig(): IntegrationsSkillConfig {
    return this.substrate.getConfig();
  }

  public updateConfig(updates: Partial<IntegrationsSkillConfig>): IntegrationsSkillConfig {
    return this.substrate.updateConfig(updates);
  }

  public listCatalog(): readonly ServiceCatalogEntry[] {
    return this.engine.getCatalog();
  }

  // --- Connection Management ---
  public connectService(
    provider: IntegrationProviderType,
    name?: string,
    _credentials?: Record<string, unknown>,
    isMock = true
  ): { success: boolean; connection?: IntegrationConnection; error?: string } {
    const cfg = this.substrate.getConfig();
    if (!cfg.enabled) {
      return { success: false, error: "Enterprise Integrations Hub is currently DISABLED by user policy (Fail-Closed)." };
    }

    if (!cfg.allowedProviders.includes(provider)) {
      return { success: false, error: `Provider '${provider}' is not in the allowed providers whitelist.` };
    }

    const catEntry = this.engine.getCatalogEntry(provider);
    const category: IntegrationCategory = catEntry?.category || "developer_tools";
    const displayName = name || catEntry?.displayName || provider;

    const connectionId = `conn_${provider}_${Date.now()}`;
    const conn: IntegrationConnection = {
      connectionId,
      provider,
      name: displayName,
      category,
      authType: "api_key" as IntegrationAuthType,
      isConnected: true,
      isMock,
      rateLimitPerMinute: cfg.rateLimitPerMinute,
      totalRequests: 1,
      lastSyncAt: Date.now(),
      errorCount: 0,
      createdAt: Date.now(),
    };

    this.substrate.upsertConnection(conn);

    this.substrate.recordAuditLog({
      logId: `log_${Date.now()}`,
      connectionId,
      provider,
      endpoint: "/auth/connect",
      method: "POST",
      statusCode: 200,
      latencyMs: 1.8,
      timestamp: Date.now(),
    });

    return { success: true, connection: conn };
  }

  public disconnectService(connectionId: string): boolean {
    return this.substrate.removeConnection(connectionId);
  }

  public listConnections(): readonly IntegrationConnection[] {
    return this.substrate.listConnections();
  }

  // --- Unified Cross-Service Queries ---
  public queryUnifiedIssues(service?: IntegrationProviderType, query?: string): readonly UnifiedIssue[] {
    let list = this.substrate.listIssues(service);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    return list;
  }

  public createUnifiedIssue(issueData: Partial<UnifiedIssue>): { success: boolean; issue?: UnifiedIssue; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Integrations Hub is disabled." };
    }

    const id = `iss_${issueData.sourceService || "linear"}_${Date.now()}`;
    const issue: UnifiedIssue = {
      id,
      title: issueData.title || "Untitled Issue",
      description: issueData.description || "",
      status: issueData.status || "TODO",
      priority: issueData.priority || "MEDIUM",
      assignee: issueData.assignee || "unassigned",
      labels: issueData.labels || ["lumi-created"],
      url: issueData.url || `https://${issueData.sourceService || "linear"}.app/issue/${id}`,
      sourceService: issueData.sourceService || "linear",
      sourceId: issueData.sourceId || id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.substrate.upsertIssue(issue);
    return { success: true, issue };
  }

  public queryUnifiedCustomers(service?: IntegrationProviderType, query?: string): readonly UnifiedCustomer[] {
    let list = this.substrate.listCustomers(service);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }
    return list;
  }

  public queryUnifiedAlerts(service?: IntegrationProviderType): readonly UnifiedAlert[] {
    return this.substrate.listAlerts(service);
  }

  public queryUnifiedDocuments(service?: IntegrationProviderType, query?: string): readonly UnifiedDocument[] {
    let list = this.substrate.listDocuments(service);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(q) || d.excerpt.toLowerCase().includes(q));
    }
    return list;
  }

  // --- Recipes ---
  public listRecipes(): readonly IntegrationRecipe[] {
    return this.substrate.listRecipes();
  }

  public executeRecipe(
    recipeId: string,
    customInputs: Record<string, unknown> = {}
  ): { success: boolean; result?: WorkflowExecutionResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "Integrations Hub is disabled." };
    }

    const recipe = this.substrate.getRecipe(recipeId);
    if (!recipe) {
      return { success: false, error: `Recipe '${recipeId}' not found.` };
    }

    const result = this.engine.executeRecipe(recipe, customInputs);
    this.substrate.recordRecipeExecution(result);

    return { success: true, result };
  }

  // --- Provider Deep-Dive Queries ---
  public queryGithub(action = "list_prs", params: Record<string, unknown> = {}): Record<string, unknown> {
    const issues = this.substrate.listIssues("github");
    return {
      success: true,
      action,
      repository: params.repo || "lumi/lumi-new",
      totalIssues: issues.length,
      issues,
      pullRequests: [
        { number: 42, title: "feat: Omnichannel Messaging & Enterprise Integrations Hub", author: "bozoegg", status: "OPEN", draft: false, checksPassing: true },
        { number: 41, title: "perf: 16MB contiguous slab zero-GC memory optimization", author: "alex_dev", status: "MERGED", draft: false, checksPassing: true },
      ],
      defaultBranch: "main",
    };
  }

  public queryLinear(action = "list_issues", params: Record<string, unknown> = {}): Record<string, unknown> {
    const issues = this.substrate.listIssues("linear");
    return {
      success: true,
      action,
      team: params.team || "ENG",
      activeCycle: { number: 18, name: "Sprint 18 - Sovereign Solidification", progressPercent: 78 },
      totalIssues: issues.length,
      issues,
    };
  }

  public queryNotion(action = "search", params: Record<string, unknown> = {}): Record<string, unknown> {
    const docs = this.queryUnifiedDocuments("notion", params.query ? String(params.query) : undefined);
    return {
      success: true,
      action,
      totalDocuments: docs.length,
      documents: docs,
      databases: [
        { id: "db_specs_01", title: "Product & Architecture Specifications", rowCount: docs.length },
        { id: "db_roadmap_02", title: "Engineering Roadmap", rowCount: 12 },
      ],
    };
  }

  public manageStripe(action = "list_customers", params: Record<string, unknown> = {}): Record<string, unknown> {
    const customers = this.substrate.listCustomers("stripe");
    return {
      success: true,
      action,
      totalCustomers: customers.length,
      customers,
      balance: { availableUsd: 48920.5, pendingUsd: 3420.0, currency: "usd" },
      activeSubscriptionsCount: 42,
    };
  }

  public querySupabase(action = "list_tables", params: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      success: true,
      action,
      projectRef: params.projectRef || "lumi-prod-db",
      tables: [
        { name: "users", rowCount: 1420, columns: ["id", "email", "created_at", "role"] },
        { name: "organization_members", rowCount: 3890, columns: ["id", "org_id", "user_id", "access_level"] },
        { name: "audit_events", rowCount: 89400, columns: ["id", "event_type", "payload", "timestamp"] },
      ],
    };
  }

  public inspectSentry(action = "list_issues", params: Record<string, unknown> = {}): Record<string, unknown> {
    const alerts = this.substrate.listAlerts("sentry");
    return {
      success: true,
      action,
      project: params.project || "lumi-engine-node",
      totalIssues: alerts.length,
      issues: alerts,
      crashFreeSessionPercent: 99.94,
    };
  }

  public manageVercel(action = "list_deployments", params: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      success: true,
      action,
      projectName: params.project || "lumi-web-app",
      deployments: [
        { id: "dpl_live_99", url: "https://lumi.ai", state: "READY", target: "production", createdAt: Date.now() - 3600000 },
        { id: "dpl_preview_98", url: "https://pr-42.lumi.ai", state: "READY", target: "preview", createdAt: Date.now() - 7200000 },
      ],
      customDomains: ["lumi.ai", "app.lumi.ai"],
    };
  }

  // --- Platform Health Telemetry ---
  public inspectPlatformHealth(): IntegrationsHealthMatrix {
    const cfg = this.substrate.getConfig();
    const connections = this.substrate.listConnections();
    const auditLogs = this.substrate.listAuditLogs();

    const providers: PlatformIntegrationHealth[] = cfg.allowedProviders.map((p) => {
      const conn = connections.find((c) => c.provider === p);
      const isConn = !!(conn && conn.isConnected && cfg.enabled);
      const isMock = conn?.isMock ?? true;
      const logs = auditLogs.filter((l) => l.provider === p);
      const totalReq = conn?.totalRequests || (isConn ? 1 : 0);
      const errCount = conn?.errorCount || 0;
      const uptime = totalReq > 0 ? Math.max(0, 100 - (errCount / totalReq) * 100) : 100;

      return {
        provider: p,
        displayName: this.engine.getCatalogEntry(p)?.displayName || p,
        isConnected: isConn,
        isMock,
        latencyMs: isMock ? 0.4 : 12.5,
        uptimePercent: uptime,
        totalRequests: totalReq,
        errorCount: errCount,
        lastSyncAt: conn?.lastSyncAt || (isConn ? Date.now() : undefined),
      };
    });

    const activeCount = providers.filter((p) => p.isConnected).length;
    const totalRequests = providers.reduce((acc, p) => acc + p.totalRequests, 0);
    const totalErrors = providers.reduce((acc, p) => acc + p.errorCount, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      totalConnected: activeCount,
      overallStatus: !cfg.enabled ? "DEGRADED" : errorRate > 5 ? "CRITICAL" : "HEALTHY",
      providers,
      totalRequests,
      errorRatePercent: errorRate,
      timestamp: Date.now(),
    };
  }

  public getStats(): {
    totalConnections: number;
    totalIssues: number;
    totalCustomers: number;
    totalAlerts: number;
    totalDocuments: number;
    totalRecipes: number;
  } {
    const snap = this.substrate.exportSnapshot();
    return {
      totalConnections: snap.totalConnections,
      totalIssues: snap.totalIssues,
      totalCustomers: snap.totalCustomers,
      totalAlerts: snap.totalAlerts,
      totalDocuments: snap.totalDocuments,
      totalRecipes: snap.totalRecipes,
    };
  }

  public getConnection(connectionId: string): IntegrationConnection | undefined {
    return this.substrate.getConnection(connectionId);
  }

  public getServiceCatalog(): readonly ServiceCatalogEntry[] {
    return this.engine.getCatalog();
  }

  public queryIssues(filter?: { provider?: IntegrationProviderType; status?: IssueStatus; priority?: IssuePriority }): readonly UnifiedIssue[] {
    let list = this.substrate.listIssues(filter?.provider);
    if (filter?.status) list = list.filter((i) => i.status === filter.status);
    if (filter?.priority) list = list.filter((i) => i.priority === filter.priority);
    return list;
  }

  public createIssue(provider: IntegrationProviderType, title: string, description = "", priority: IssuePriority = "MEDIUM") {
    return this.createUnifiedIssue({ sourceService: provider, title, description, priority });
  }

  public updateIssue(issueId: string, updates: { status?: IssueStatus; priority?: IssuePriority }) {
    const issue = this.substrate.getIssue(issueId);
    if (!issue) return { success: false, error: `Issue '${issueId}' not found` };
    const updated: UnifiedIssue = {
      ...issue,
      status: updates.status || issue.status,
      priority: updates.priority || issue.priority,
      updatedAt: Date.now(),
    };
    this.substrate.upsertIssue(updated);
    return { success: true, issue: updated };
  }

  public queryCustomers(service?: IntegrationProviderType, query?: string) {
    return this.queryUnifiedCustomers(service, query);
  }

  public queryAlerts(level?: string, service?: IntegrationProviderType) {
    let list = this.queryUnifiedAlerts(service);
    if (level) list = list.filter((a) => a.level === level);
    return list;
  }

  public queryDocuments(query?: string, service?: IntegrationProviderType) {
    return this.queryUnifiedDocuments(service, query);
  }

  public installRecipe(recipeId: string) {
    const recipe = this.substrate.getRecipe(recipeId);
    if (!recipe) return { success: false, error: `Recipe '${recipeId}' not found` };
    const updated: IntegrationRecipe = { ...recipe, isInstalled: true };
    this.substrate.upsertRecipe(updated);
    return { success: true, recipe: updated };
  }

  public listRecipeExecutions(recipeId?: string) {
    return this.substrate.listRecipeExecutions(recipeId);
  }

  public auditHealth() {
    return this.substrate.auditHealth();
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getGroupedConnections(groupBy?: any, sortBy?: any, direction?: any) {
    return this.substrate.getGroupedConnections(groupBy, sortBy, direction);
  }

  public queryDsl(query: any) {
    return this.substrate.queryIntegrationsDsl(query);
  }

  public bulkPurge(connectionIds: readonly string[]) {
    return this.substrate.bulkPurgeConnections(connectionIds);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getSubstrate(): BroccoliIntegrationsSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicIntegrationsEngine {
    return this.engine;
  }
}
