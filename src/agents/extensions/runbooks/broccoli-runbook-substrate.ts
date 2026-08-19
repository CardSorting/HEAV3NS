/**
 * [LAYER: AGENTS EXTENSION]
 * broccoli-runbook-substrate.ts
 *
 * Persistence and Query Manager for Runbook FSM backed by the Hybrid BroccoliDB Kernel (Phase 193 / ADR-123).
 * Provides typed table indexing, dynamic check isolation, WAL-backed transition auditing,
 * and Git-for-Data speculative branching.
 */

import * as crypto from "node:crypto";
import type {
  IBroccoliDatabaseKernel,
  IDbTable,
} from "../../../core/contracts/broccolidb.contracts.js";
import type {
  RunbookDynamicCheckRow,
  RunbookEdgeRow,
  RunbookEvidenceReceiptRow,
  RunbookNodeRow,
  RunbookRunRow,
  RunbookSpecRow,
  RunbookTransitionRow,
} from "../../../core/contracts/broccolidb-runbook.contracts.js";
import type {
  DynamicEntryCheckManifest,
  RunbookRuntimeState,
  RunbookSpec,
} from "../../../core/contracts/runbook.contracts.js";

export class BroccoliRunbookSubstrate {
  private readonly kernel: IBroccoliDatabaseKernel;
  private isInitialized = false;

  constructor(kernel: IBroccoliDatabaseKernel) {
    this.kernel = kernel;
  }

  /**
   * Initializes tables and indices in BroccoliDB.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Ensure kernel is started
    await this.kernel.start();

    // 1. Specs Table
    const specsTable = this.kernel.getTable<RunbookSpecRow>("runbook_specs");
    specsTable.createIndex("name");

    // 2. Nodes Table
    const nodesTable = this.kernel.getTable<RunbookNodeRow>("runbook_nodes");
    nodesTable.createCompositeIndex(["specId", "nodeName"]);

    // 3. Edges Table
    const edgesTable = this.kernel.getTable<RunbookEdgeRow>("runbook_edges");
    edgesTable.createCompositeIndex(["specId", "fromNode"]);

    // 4. Runs Table
    const runsTable = this.kernel.getTable<RunbookRunRow>("runbook_runs");
    runsTable.createIndex("status");

    // 5. Dynamic Checks Table
    const dynamicTable = this.kernel.getTable<RunbookDynamicCheckRow>("runbook_dynamic_checks");
    dynamicTable.createCompositeIndex(["runId", "entryId"]);

    // 6. Transitions Table
    const transTable = this.kernel.getTable<RunbookTransitionRow>("runbook_transitions");
    transTable.createCompositeIndex(["runId", "sequence" as any]);

    // 7. Evidence Receipts Table
    const receiptsTable = this.kernel.getTable<RunbookEvidenceReceiptRow>("runbook_evidence_receipts");
    receiptsTable.createCompositeIndex(["runId", "entryId"]);

    this.isInitialized = true;
  }

  /**
   * Persists a parsed RunbookSpec into BroccoliDB.
   */
  async saveSpec(spec: RunbookSpec): Promise<string> {
    await this.initialize();
    const specHash = spec.specHash || crypto.createHash("sha256").update(spec.rawText || JSON.stringify(spec)).digest("hex").substring(0, 16);

    const specsTable = this.kernel.getTable<RunbookSpecRow>("runbook_specs");
    const nodesTable = this.kernel.getTable<RunbookNodeRow>("runbook_nodes");
    const edgesTable = this.kernel.getTable<RunbookEdgeRow>("runbook_edges");

    // 1. Save Spec Metadata
    specsTable.put(specHash, {
      id: specHash,
      name: spec.name,
      initialNode: spec.initial,
      rawYamlCasHash: spec.rawText ? crypto.createHash("sha256").update(spec.rawText).digest("hex") : specHash,
      createdAt: Date.now(),
    });

    // 2. Save Nodes
    for (const [nodeName, node] of Object.entries(spec.nodes)) {
      const nodeId = `${specHash}:${nodeName}`;
      nodesTable.put(nodeId, {
        id: nodeId,
        specId: specHash,
        nodeName,
        prompt: node.prompt,
        inHooksJson: JSON.stringify(node.inHook || []),
        beforeTransferJson: JSON.stringify(node.beforeTransfer || []),
        dynamicConfigJson: node.dynamicBeforeTransfer ? JSON.stringify(node.dynamicBeforeTransfer) : undefined,
        outHooksJson: JSON.stringify(node.outHook || []),
      });
    }

    // 3. Save Edges
    for (const edge of spec.edges) {
      const edgeId = `${specHash}:${edge.from}->${edge.to}`;
      edgesTable.put(edgeId, {
        id: edgeId,
        specId: specHash,
        fromNode: edge.from,
        toNode: edge.to,
        conditionJson: edge.condition ? JSON.stringify(edge.condition) : undefined,
        hookJson: edge.hook ? JSON.stringify(edge.hook) : undefined,
        maxAttempts: edge.maxAttempts,
      });
    }

    await this.kernel.flush();
    return specHash;
  }

  /**
   * Retrieves a RunbookSpec by hash or name.
   */
  async getSpec(specIdOrName: string): Promise<RunbookSpec | undefined> {
    await this.initialize();
    const specsTable = this.kernel.getTable<RunbookSpecRow>("runbook_specs");

    let specRow = specsTable.get(specIdOrName);
    if (!specRow) {
      const byName = specsTable.query({ where: { name: specIdOrName } });
      if (byName.length > 0) {
        specRow = byName[0];
      }
    }

    if (!specRow) return undefined;

    const specId = specRow.id;
    const nodesTable = this.kernel.getTable<RunbookNodeRow>("runbook_nodes");
    const edgesTable = this.kernel.getTable<RunbookEdgeRow>("runbook_edges");

    const nodeRows = nodesTable.query({ where: { specId } });
    const edgeRows = edgesTable.query({ where: { specId } });

    const nodes: Record<string, any> = {};
    for (const nr of nodeRows) {
      nodes[nr.nodeName] = {
        id: nr.nodeName,
        prompt: nr.prompt,
        inHook: nr.inHooksJson ? JSON.parse(nr.inHooksJson) : undefined,
        beforeTransfer: nr.beforeTransferJson ? JSON.parse(nr.beforeTransferJson) : undefined,
        dynamicBeforeTransfer: nr.dynamicConfigJson ? JSON.parse(nr.dynamicConfigJson) : undefined,
        outHook: nr.outHooksJson ? JSON.parse(nr.outHooksJson) : undefined,
      };
    }

    const edges = edgeRows.map((er) => ({
      from: er.fromNode,
      to: er.toNode,
      condition: er.conditionJson ? JSON.parse(er.conditionJson) : undefined,
      hook: er.hookJson ? JSON.parse(er.hookJson) : undefined,
      maxAttempts: er.maxAttempts,
    }));

    return {
      name: specRow.name,
      initial: specRow.initialNode,
      nodes,
      edges,
      specHash: specId,
    };
  }

  /**
   * Saves active run state into BroccoliDB.
   */
  async saveRun(state: RunbookRuntimeState): Promise<void> {
    await this.initialize();
    const runsTable = this.kernel.getTable<RunbookRunRow>("runbook_runs");

    runsTable.put(state.runId, {
      id: state.runId,
      specId: state.specHash,
      specName: state.specName,
      currentNode: state.current,
      currentEntryId: state.currentEntryId,
      activeAgentId: state.activeAgentId || "default-agent",
      activeAgentRole: state.activeAgentRole || "executor",
      status: state.status,
      edgeAttemptsJson: JSON.stringify(state.edgeAttempts || {}),
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await this.kernel.flush();
  }

  /**
   * Retrieves active run state from BroccoliDB.
   */
  async getRun(runId: string): Promise<RunbookRuntimeState | undefined> {
    await this.initialize();
    const runsTable = this.kernel.getTable<RunbookRunRow>("runbook_runs");
    const row = runsTable.get(runId);
    if (!row) return undefined;

    const transitions = await this.getTransitions(runId);

    return {
      runId: row.id,
      specHash: row.specId,
      specName: row.specName,
      current: row.currentNode,
      currentEntryId: row.currentEntryId,
      activeAgentId: row.activeAgentId,
      activeAgentRole: row.activeAgentRole,
      status: row.status,
      edgeAttempts: row.edgeAttemptsJson ? JSON.parse(row.edgeAttemptsJson) : {},
      history: transitions.map((t) => ({
        timestamp: new Date(t.timestamp).toISOString(),
        event: t.event,
        runId: t.runId,
        from: t.fromNode,
        to: t.toNode,
        currentEntryId: t.entryId,
        stage: t.stage,
        results: t.resultsJson ? JSON.parse(t.resultsJson) : [],
      })),
    };
  }

  /**
   * Appends an immutable transition record to the WAL-backed transitions table.
   */
  async recordTransition(
    runId: string,
    event: "start" | "goto" | "goto_blocked" | "save" | "save_blocked" | "dynamic_check",
    data: {
      fromNode?: string;
      toNode?: string;
      entryId: string;
      stage?: string;
      success: boolean;
      results?: readonly unknown[];
      durationMs?: number;
    }
  ): Promise<void> {
    await this.initialize();
    const transTable = this.kernel.getTable<RunbookTransitionRow>("runbook_transitions");
    const existing = transTable.query({ where: { runId } });
    const sequence = existing.length + 1;
    const transitionId = `${runId}:${sequence}`;

    transTable.put(transitionId, {
      id: transitionId,
      sequence,
      runId,
      event,
      fromNode: data.fromNode,
      toNode: data.toNode,
      entryId: data.entryId,
      stage: data.stage,
      success: data.success,
      resultsJson: JSON.stringify(data.results || []),
      durationMs: data.durationMs || 0,
      timestamp: Date.now(),
    });

    await this.kernel.flush();
  }

  /**
   * Retrieves transitions history for a run.
   */
  async getTransitions(runId: string, limit?: number): Promise<readonly RunbookTransitionRow[]> {
    await this.initialize();
    const transTable = this.kernel.getTable<RunbookTransitionRow>("runbook_transitions");
    let rows = transTable.query({
      where: { runId },
      sortBy: "sequence",
      sortOrder: "asc",
    });

    if (limit && limit > 0 && rows.length > limit) {
      rows = rows.slice(rows.length - limit);
    }
    return rows;
  }

  /**
   * Saves entry-scoped dynamic checks.
   */
  async saveDynamicChecks(manifest: DynamicEntryCheckManifest, ttlMs: number = 3_600_000): Promise<void> {
    await this.initialize();
    const dynamicTable = this.kernel.getTable<RunbookDynamicCheckRow>("runbook_dynamic_checks");
    const checkId = `${manifest.runId}:${manifest.entryId}:${manifest.producer.agentId}`;

    dynamicTable.put(
      checkId,
      {
        id: checkId,
        runId: manifest.runId,
        nodeName: manifest.nodeName,
        entryId: manifest.entryId,
        agentId: manifest.producer.agentId,
        agentRole: manifest.producer.role || "unknown",
        basisJson: JSON.stringify(manifest.basis || {}),
        checksJson: JSON.stringify(manifest.checks || []),
        checksCount: manifest.checks.length,
        registeredAt: manifest.registeredAt || Date.now(),
        ttlMs,
      },
      { ttlMs }
    );

    await this.kernel.flush();
  }

  /**
   * Retrieves all dynamic check manifests for a specific run and entryId.
   */
  async getDynamicChecks(runId: string, entryId: string): Promise<readonly DynamicEntryCheckManifest[]> {
    await this.initialize();
    const dynamicTable = this.kernel.getTable<RunbookDynamicCheckRow>("runbook_dynamic_checks");
    const rows = dynamicTable.query({
      where: { runId, entryId },
    });

    return rows.map((r) => ({
      entryId: r.entryId,
      nodeName: r.nodeName,
      runId: r.runId,
      producer: {
        agentId: r.agentId,
        role: r.agentRole,
        updatedAt: new Date(r.registeredAt).toISOString(),
      },
      basis: r.basisJson ? JSON.parse(r.basisJson) : undefined,
      checks: r.checksJson ? JSON.parse(r.checksJson) : [],
      registeredAt: r.registeredAt,
    }));
  }

  /**
   * Branches a runbook state for speculative repair loops (Git-for-Data).
   */
  branchRun(branchName: string): void {
    const runsTable = this.kernel.getTable<RunbookRunRow>("runbook_runs") as any;
    if (typeof runsTable.branch === "function") {
      runsTable.branch(branchName);
    }
  }

  /**
   * Merges speculative branch back to main runbook state.
   */
  mergeRunBranch(branchName: string): void {
    const runsTable = this.kernel.getTable<RunbookRunRow>("runbook_runs") as any;
    if (typeof runsTable.mergeBranch === "function") {
      runsTable.mergeBranch(branchName, { strategy: "TAKE_BRANCH" });
    }
  }
}
