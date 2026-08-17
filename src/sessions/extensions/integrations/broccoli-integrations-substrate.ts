/**
 * broccoli-integrations-substrate.ts
 *
 * In-memory Broccolidb repository for active integrations, unified issues,
 * customers, alerts, documents, recipes, and audit logs (Phase 96 / ADR-126).
 */

import type {
  IntegrationAuditLog,
  IntegrationConnection,
  IntegrationProviderType,
  IntegrationRecipe,
  IntegrationsSkillConfig,
  IntegrationsSubstrateSnapshot,
  UnifiedAlert,
  UnifiedCustomer,
  UnifiedDocument,
  UnifiedIssue,
  WorkflowExecutionResult,
} from "../../../core/contracts/integrations.contracts.js";

export class BroccoliIntegrationsSubstrate {
  private connections: Map<string, IntegrationConnection>;
  private issues: Map<string, UnifiedIssue>;
  private customers: Map<string, UnifiedCustomer>;
  private alerts: Map<string, UnifiedAlert>;
  private documents: Map<string, UnifiedDocument>;
  private recipes: Map<string, IntegrationRecipe>;
  private auditLogs: IntegrationAuditLog[];
  private recipeExecutions: WorkflowExecutionResult[];
  private config: IntegrationsSkillConfig;
  private readonly maxLedgerCapacity = 500;

  constructor(initialConfig?: Partial<IntegrationsSkillConfig>) {
    this.connections = new Map();
    this.issues = new Map();
    this.customers = new Map();
    this.alerts = new Map();
    this.documents = new Map();
    this.recipes = new Map();
    this.auditLogs = [];
    this.recipeExecutions = [];
    this.config = {
      enabled: false,
      allowedProviders: [
        "github",
        "linear",
        "notion",
        "stripe",
        "supabase",
        "sentry",
        "vercel",
        "google_workspace",
      ],
      defaultTimeoutMs: 5000,
      sandboxModeEnabled: true,
      rateLimitPerMinute: 120,
      ...initialConfig,
    };
  }

  public getConfig(): IntegrationsSkillConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<IntegrationsSkillConfig>): IntegrationsSkillConfig {
    this.config = {
      ...this.config,
      ...updates,
    };
    return this.getConfig();
  }

  // --- Connections ---
  public upsertConnection(conn: IntegrationConnection): IntegrationConnection {
    this.connections.set(conn.connectionId, conn);
    return conn;
  }

  public getConnection(connectionId: string): IntegrationConnection | undefined {
    return this.connections.get(connectionId);
  }

  public getConnectionByProvider(provider: IntegrationProviderType): IntegrationConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.provider === provider && conn.isConnected) {
        return conn;
      }
    }
    return undefined;
  }

  public listConnections(): readonly IntegrationConnection[] {
    return Array.from(this.connections.values());
  }

  public removeConnection(connectionId: string): boolean {
    return this.connections.delete(connectionId);
  }

  // --- Unified Issues ---
  public upsertIssue(issue: UnifiedIssue): UnifiedIssue {
    this.issues.set(issue.id, issue);
    return issue;
  }

  public getIssue(id: string): UnifiedIssue | undefined {
    return this.issues.get(id);
  }

  public listIssues(service?: IntegrationProviderType): readonly UnifiedIssue[] {
    const list = Array.from(this.issues.values());
    if (!service) return list;
    return list.filter((i) => i.sourceService === service);
  }

  // --- Unified Customers ---
  public upsertCustomer(customer: UnifiedCustomer): UnifiedCustomer {
    this.customers.set(customer.customerId, customer);
    return customer;
  }

  public getCustomer(id: string): UnifiedCustomer | undefined {
    return this.customers.get(id);
  }

  public listCustomers(service?: IntegrationProviderType): readonly UnifiedCustomer[] {
    const list = Array.from(this.customers.values());
    if (!service) return list;
    return list.filter((c) => c.sourceService === service);
  }

  // --- Unified Alerts ---
  public upsertAlert(alert: UnifiedAlert): UnifiedAlert {
    this.alerts.set(alert.alertId, alert);
    return alert;
  }

  public getAlert(id: string): UnifiedAlert | undefined {
    return this.alerts.get(id);
  }

  public listAlerts(service?: IntegrationProviderType): readonly UnifiedAlert[] {
    const list = Array.from(this.alerts.values());
    if (!service) return list;
    return list.filter((a) => a.service === service);
  }

  // --- Unified Documents ---
  public upsertDocument(doc: UnifiedDocument): UnifiedDocument {
    this.documents.set(doc.docId, doc);
    return doc;
  }

  public getDocument(id: string): UnifiedDocument | undefined {
    return this.documents.get(id);
  }

  public listDocuments(service?: IntegrationProviderType): readonly UnifiedDocument[] {
    const list = Array.from(this.documents.values());
    if (!service) return list;
    return list.filter((d) => d.service === service);
  }

  // --- Recipes ---
  public upsertRecipe(recipe: IntegrationRecipe): IntegrationRecipe {
    this.recipes.set(recipe.recipeId, recipe);
    return recipe;
  }

  public getRecipe(recipeId: string): IntegrationRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  public listRecipes(): readonly IntegrationRecipe[] {
    return Array.from(this.recipes.values());
  }

  public recordRecipeExecution(result: WorkflowExecutionResult): void {
    if (this.recipeExecutions.length >= this.maxLedgerCapacity) {
      this.recipeExecutions.shift();
    }
    this.recipeExecutions.push(result);

    const recipe = this.recipes.get(result.recipeId);
    if (recipe) {
      this.recipes.set(result.recipeId, {
        ...recipe,
        executionCount: recipe.executionCount + 1,
      });
    }
  }

  public listRecipeExecutions(): readonly WorkflowExecutionResult[] {
    return [...this.recipeExecutions];
  }

  // --- Audit Logs ---
  public recordAuditLog(log: IntegrationAuditLog): void {
    if (this.auditLogs.length >= this.maxLedgerCapacity) {
      this.auditLogs.shift();
    }
    this.auditLogs.push(log);
  }

  public listAuditLogs(): readonly IntegrationAuditLog[] {
    return [...this.auditLogs];
  }

  // --- Snapshotting & State Rollback ---
  public exportSnapshot(): IntegrationsSubstrateSnapshot {
    return {
      connections: Array.from(this.connections.values()),
      issues: Array.from(this.issues.values()),
      customers: Array.from(this.customers.values()),
      alerts: Array.from(this.alerts.values()),
      documents: Array.from(this.documents.values()),
      recipes: Array.from(this.recipes.values()),
      auditLogs: [...this.auditLogs],
      recipeExecutions: [...this.recipeExecutions],
      totalConnections: this.connections.size,
      totalIssues: this.issues.size,
      totalCustomers: this.customers.size,
      totalAlerts: this.alerts.size,
      totalDocuments: this.documents.size,
      totalRecipes: this.recipes.size,
      config: { ...this.config },
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: IntegrationsSubstrateSnapshot): void {
    this.config = { ...snapshot.config };
    this.connections = new Map();
    for (const c of snapshot.connections || []) {
      this.connections.set(c.connectionId, c);
    }
    this.issues = new Map();
    for (const i of snapshot.issues || []) {
      this.issues.set(i.id, i);
    }
    this.customers = new Map();
    for (const cust of snapshot.customers || []) {
      this.customers.set(cust.customerId, cust);
    }
    this.alerts = new Map();
    for (const a of snapshot.alerts || []) {
      this.alerts.set(a.alertId, a);
    }
    this.documents = new Map();
    for (const d of snapshot.documents || []) {
      this.documents.set(d.docId, d);
    }
    this.recipes = new Map();
    for (const r of snapshot.recipes || []) {
      this.recipes.set(r.recipeId, r);
    }
    this.auditLogs = snapshot.auditLogs ? [...snapshot.auditLogs] : [];
    this.recipeExecutions = snapshot.recipeExecutions ? [...snapshot.recipeExecutions] : [];
  }

  public clear(): void {
    this.connections.clear();
    this.issues.clear();
    this.customers.clear();
    this.alerts.clear();
    this.documents.clear();
    this.recipes.clear();
    this.auditLogs = [];
    this.recipeExecutions = [];
  }
}
