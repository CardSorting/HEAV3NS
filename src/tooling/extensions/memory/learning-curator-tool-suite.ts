/**
 * learning-curator-tool-suite.ts
 *
 * Model tool suite exposing continuous memory learning & knowledge graph operations:
 * 30 specialized tools for remembering, recalling, graph traversal, consolidation, decay,
 * audit diagnostics, swimlanes, DSL query, snapshots, and interactive exports (Phase 76 / ADR-028).
 */

import { ContinuousLearningCurator } from "../../../agents/extensions/memory/continuous-learning-curator.js";
import { BroccoliLearningSubstrate } from "../../../sessions/extensions/memory/broccoli-learning-substrate.js";
import { LearningSnapshotManager } from "../../../sessions/extensions/memory/learning-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  KnowledgeNode,
  KnowledgeNodeType,
  MemoryGroupBy,
  MemorySortBy,
  MemorySortDirection,
} from "../../../core/contracts/memory-curator.contracts.js";

export class LearningCuratorToolSuite {
  private readonly curator: ContinuousLearningCurator;
  private readonly substrate: BroccoliLearningSubstrate;
  private readonly snapshotManager: LearningSnapshotManager;

  constructor(
    curator?: ContinuousLearningCurator,
    substrate?: BroccoliLearningSubstrate
  ) {
    this.substrate = substrate ?? new BroccoliLearningSubstrate();
    this.curator = curator ?? new ContinuousLearningCurator(this.substrate);
    this.snapshotManager = new LearningSnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "memory_remember",
        description: "Stores a structured fact, user preference, entity attribute, or learned insight into the persistent knowledge graph.",
        parameters: {
          label: { type: "string", required: true, description: "Short descriptive label for the knowledge item." },
          content: { type: "string", required: true, description: "The full fact text, preference description, or learned rule." },
          type: { type: "string", description: "Node type: 'fact', 'preference', 'entity', 'concept', 'skill' (default 'fact')." },
          confidence: { type: "number", description: "Confidence score between 0.0 and 1.0 (default 1.0)." },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_remember", args);
        },
      },
      {
        name: "memory_recall",
        description: "Semantically searches the persistent knowledge graph for relevant facts, preferences, and associated relational nodes.",
        parameters: {
          query: { type: "string", required: true, description: "Natural language query or keywords to recall." },
          limit: { type: "number", description: "Maximum recall results (default 5)." },
          minConfidence: { type: "number", description: "Minimum confidence threshold (0.0 - 1.0)." },
          includeRelations: { type: "boolean", description: "Whether to return connected neighbor nodes (default true)." },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_recall", args);
        },
      },
      {
        name: "memory_graph_inspect",
        description: "Inspects the active knowledge graph topology, returning node counts, relational edges, and memory metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_graph_inspect", args);
        },
      },
      {
        name: "memory_forget",
        description: "Explicitly deletes a knowledge node and cleans up connected relationship edges.",
        parameters: {
          nodeId: { type: "string", required: true, description: "The unique ID of the node to prune." },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_forget", args);
        },
      },
      {
        name: "curator_consolidate",
        description: "Scans for semantically overlapping knowledge nodes and merges them into unified concepts.",
        parameters: {
          similarityThreshold: { type: "number", description: "Similarity threshold (default 0.75)." },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("curator_consolidate", args);
        },
      },
      {
        name: "curator_apply_decay",
        description: "Applies mathematical exponential decay curve across all unpinned knowledge nodes based on age.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("curator_apply_decay", args);
        },
      },
      {
        name: "curator_prune_stale",
        description: "Prunes low-confidence and decayed facts whose effective score fell below the retention threshold.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("curator_prune_stale", args);
        },
      },
      {
        name: "memory_get_node",
        description: "Retrieves complete information, metadata, and relations for a specific knowledge node ID.",
        parameters: {
          nodeId: { type: "string", required: true, description: "Node ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_get_node", args);
        },
      },
      {
        name: "memory_list_nodes",
        description: "Lists all knowledge nodes with optional type filtering.",
        parameters: {
          type: { type: "string", description: "Filter by type: fact, preference, entity, concept, skill" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_list_nodes", args);
        },
      },
      {
        name: "memory_find_path",
        description: "Finds the shortest topological associative path between two knowledge nodes via BFS.",
        parameters: {
          startId: { type: "string", required: true, description: "Start node ID" },
          targetId: { type: "string", required: true, description: "Target node ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_find_path", args);
        },
      },
      {
        name: "memory_build_prompt_context",
        description: "Compiles a <LUMI-MEMORY/1> prompt injection envelope summarizing active user preferences and skills.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_build_prompt_context", args);
        },
      },
      {
        name: "memory_audit_health",
        description: "Audits SLA memory health, fragmentation, stale ratios, and generates consolidation recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_audit_health", args);
        },
      },
      {
        name: "memory_get_metrics",
        description: "Fetches aggregate telemetry on knowledge nodes, relations, recalls, and latency percentiles.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_get_metrics", args);
        },
      },
      {
        name: "memory_group_and_sort",
        description: "Organizes knowledge nodes into multi-criteria swimlanes (type, confidence, decay, staleness).",
        parameters: {
          groupBy: { type: "string", description: "Group by: type, confidence, decay, staleness, cluster" },
          sortBy: { type: "string", description: "Sort by: confidence, accessCount, lastAccessedAt, createdAt" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_group_and_sort", args);
        },
      },
      {
        name: "memory_search_dsl",
        description: "Searches knowledge graph using natural query DSL (e.g. 'type:preference conf>0.8 is:fresh term').",
        parameters: {
          query: { type: "string", required: true, description: "DSL search query" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_search_dsl", args);
        },
      },
      {
        name: "memory_render_dashboard",
        description: "Renders an ANSI CLI summary card for knowledge graph and memory metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_render_dashboard", args);
        },
      },
      {
        name: "memory_render_graph",
        description: "Renders an ANSI CLI visual knowledge graph topology view.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_render_graph", args);
        },
      },
      {
        name: "memory_export_html",
        description: "Exports the entire knowledge graph into an interactive single-page HTML application.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_export_html", args);
        },
      },
      {
        name: "memory_export_markdown",
        description: "Exports memory graph summary and node ledgers as Markdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_export_markdown", args);
        },
      },
      {
        name: "memory_export_csv",
        description: "Exports knowledge nodes as a CSV spreadsheet.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_export_csv", args);
        },
      },
      {
        name: "memory_bulk_consolidate",
        description: "Consolidates multiple specified node IDs into a single unified concept node.",
        parameters: {
          nodeIds: { type: "string", required: true, description: "Comma-separated node IDs" },
          primaryLabel: { type: "string", description: "Optional primary label for consolidated concept" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_bulk_consolidate", args);
        },
      },
      {
        name: "memory_undo",
        description: "Undo the last memory graph mutation or consolidation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_undo", args);
        },
      },
      {
        name: "memory_redo",
        description: "Redo the previously undone mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_redo", args);
        },
      },
      {
        name: "memory_snapshot_create",
        description: "Captures an O(1) state snapshot of the knowledge graph substrate.",
        parameters: {
          frameId: { type: "number", description: "Snapshot frame number" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_snapshot_create", args);
        },
      },
      {
        name: "memory_snapshot_restore",
        description: "Restores knowledge graph substrate state from a previously captured frame snapshot.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_snapshot_restore", args);
        },
      },
      {
        name: "memory_add_edge",
        description: "Adds an associative relational edge between two existing knowledge nodes.",
        parameters: {
          source: { type: "string", required: true, description: "Source node ID" },
          target: { type: "string", required: true, description: "Target node ID" },
          relation: { type: "string", required: true, description: "Relation label (e.g. 'prefers', 'triggers', 'uses')" },
          weight: { type: "number", description: "Edge weight between 0.0 and 1.0 (default 1.0)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_add_edge", args);
        },
      },
      {
        name: "memory_remove_edge",
        description: "Removes an associative relational edge between two nodes.",
        parameters: {
          source: { type: "string", required: true, description: "Source node ID" },
          target: { type: "string", required: true, description: "Target node ID" },
          relation: { type: "string", description: "Optional relation label" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_remove_edge", args);
        },
      },
      {
        name: "memory_pin_node",
        description: "Pins a knowledge node to make it permanent and immune to decay or pruning.",
        parameters: {
          nodeId: { type: "string", required: true, description: "Node ID to pin" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_pin_node", args);
        },
      },
      {
        name: "memory_boost_node",
        description: "Boosts confidence and resets decay for a frequently referenced node.",
        parameters: {
          nodeId: { type: "string", required: true, description: "Node ID to boost" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_boost_node", args);
        },
      },
      {
        name: "memory_clear_all",
        description: "Clears all knowledge nodes, relational edges, and resets memory metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("memory_clear_all", args);
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
        case "memory_remember": {
          const label = String(args.label || "").trim();
          const content = String(args.content || "").trim();
          const type = (String(args.type || "fact")) as KnowledgeNodeType;
          const confidence = typeof args.confidence === "number" ? Math.max(0, Math.min(1, args.confidence)) : 1.0;

          if (!label || !content) {
            return { success: false, error: "Both 'label' and 'content' are required" };
          }

          const nodeId = `kn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const node: KnowledgeNode = {
            id: nodeId,
            type,
            label,
            content,
            confidence,
            accessCount: 1,
            lastAccessedAt: Date.now(),
            createdAt: Date.now(),
            decayFactor: 1.0,
          };

          this.substrate.rememberNode(node);
          return { success: true, nodeId, node };
        }

        case "memory_recall": {
          const query = String(args.query || "").trim();
          const limit = typeof args.limit === "number" ? args.limit : 5;
          const minConfidence = typeof args.minConfidence === "number" ? args.minConfidence : 0.0;
          const includeRelations = args.includeRelations !== false;

          const results = this.substrate.queryMemory({
            query,
            limit,
            minConfidence,
            includeRelations,
          });

          return {
            success: true,
            count: results.length,
            results: results.map((r) => ({
              id: r.node.id,
              type: r.node.type,
              label: r.node.label,
              content: r.node.content,
              confidence: r.node.confidence,
              score: r.score,
              relatedCount: r.relatedNodes.length,
            })),
          };
        }

        case "memory_graph_inspect": {
          const metrics = this.substrate.getMemoryMetrics();
          const graph = this.substrate.getGraph();
          return {
            success: true,
            metrics,
            nodes: graph.getAllNodes().map((n) => ({
              id: n.id,
              type: n.type,
              label: n.label,
              confidence: n.confidence,
              decay: n.decayFactor,
            })),
            edges: graph.getAllEdges(),
          };
        }

        case "memory_forget": {
          const nodeId = String(args.nodeId || "").trim();
          const success = this.substrate.forgetNode(nodeId);
          return { success, forgotten: success };
        }

        case "curator_consolidate": {
          const threshold = typeof args.similarityThreshold === "number" ? args.similarityThreshold : 0.75;
          const candidates = this.curator.findConsolidationCandidates(threshold);
          const consolidatedIds: string[] = [];

          for (const cand of candidates) {
            const merged = this.curator.consolidateNodes(cand[0].id, cand[1].id);
            if (merged) consolidatedIds.push(merged.id);
          }

          return {
            success: true,
            candidatePairsFound: candidates.length,
            consolidatedNodes: consolidatedIds,
          };
        }

        case "curator_apply_decay": {
          const decayedCount = this.curator.applyDecay();
          return { success: true, decayedCount };
        }

        case "curator_prune_stale": {
          const prunedIds = this.curator.pruneStaleFacts();
          return { success: true, prunedCount: prunedIds.length, prunedIds };
        }

        case "memory_get_node": {
          const nodeId = String(args.nodeId || "");
          const node = this.substrate.getNode(nodeId);
          return { success: node !== undefined, node };
        }

        case "memory_list_nodes": {
          const type = (args.type as KnowledgeNodeType) || undefined;
          let nodes = this.substrate.getGraph().getAllNodes();
          if (type) nodes = nodes.filter((n) => n.type === type);
          return { success: true, count: nodes.length, nodes };
        }

        case "memory_find_path": {
          const startId = String(args.startId || "");
          const targetId = String(args.targetId || "");
          const path = this.substrate.getGraph().findShortestPath(startId, targetId);
          return { success: path !== undefined, path, length: path?.length || 0 };
        }

        case "memory_build_prompt_context": {
          const prompt = this.curator.buildMemoryPromptContext();
          return { success: true, promptContext: prompt };
        }

        case "memory_audit_health": {
          const audit = this.substrate.auditMemoryHealth();
          return { success: true, audit };
        }

        case "memory_get_metrics": {
          const metrics = this.substrate.getMemoryMetrics();
          return { success: true, metrics };
        }

        case "memory_group_and_sort": {
          const groupBy = (args.groupBy as MemoryGroupBy) || "type";
          const sortBy = (args.sortBy as MemorySortBy) || "confidence";
          const direction = (args.direction as MemorySortDirection) || "desc";
          const lanes = this.substrate.getGroupedMemories(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "memory_search_dsl": {
          const query = String(args.query || "");
          const nodes = this.substrate.queryMemoryDsl(query);
          return { success: true, count: nodes.length, nodes };
        }

        case "memory_render_dashboard": {
          const metrics = this.substrate.getMemoryMetrics();
          const rendered = BroccoliViewRenderer.renderMemoryDashboard(metrics);
          return { success: true, rendered };
        }

        case "memory_render_graph": {
          const nodes = this.substrate.getGraph().getAllNodes();
          const edges = this.substrate.getGraph().getAllEdges();
          const rendered = BroccoliViewRenderer.renderKnowledgeGraph(nodes, edges);
          return { success: true, rendered };
        }

        case "memory_export_html": {
          const html = this.substrate.exportInteractiveHtmlView();
          return { success: true, html };
        }

        case "memory_export_markdown": {
          const markdown = this.substrate.exportMarkdownReport();
          return { success: true, markdown };
        }

        case "memory_export_csv": {
          const csv = this.substrate.exportCsvReport();
          return { success: true, csv };
        }

        case "memory_bulk_consolidate": {
          const nodeIds = String(args.nodeIds || "").split(",").map((s) => s.trim()).filter(Boolean);
          const primaryLabel = args.primaryLabel ? String(args.primaryLabel) : undefined;
          const result = this.substrate.bulkConsolidate(nodeIds, primaryLabel);
          return { success: result.modifiedCount > 0, result };
        }

        case "memory_undo": {
          const success = this.substrate.undo();
          return { success };
        }

        case "memory_redo": {
          const success = this.substrate.redo();
          return { success };
        }

        case "memory_snapshot_create": {
          const frameId = typeof args.frameId === "number" ? args.frameId : Date.now();
          const frame = this.snapshotManager.createSnapshot(frameId);
          return { success: true, frame };
        }

        case "memory_snapshot_restore": {
          const frameId = Number(args.frameId) || 0;
          const restored = this.snapshotManager.restoreSnapshot(frameId);
          return { success: restored, restored };
        }

        case "memory_add_edge": {
          const source = String(args.source || "");
          const target = String(args.target || "");
          const relation = String(args.relation || "related_to");
          const weight = typeof args.weight === "number" ? args.weight : 1.0;
          this.substrate.linkNodes(source, target, relation, weight);
          return { success: true, source, target, relation, weight };
        }

        case "memory_remove_edge": {
          const source = String(args.source || "");
          const target = String(args.target || "");
          const removed = this.substrate.getGraph().removeEdge(source, target);
          return { success: removed, removed };
        }

        case "memory_pin_node": {
          const nodeId = String(args.nodeId || "");
          const node = this.substrate.getNode(nodeId);
          if (!node) return { success: false, error: `Node ${nodeId} not found` };
          const updated: KnowledgeNode = {
            ...node,
            metadata: { ...node.metadata, pinned: true },
          };
          this.substrate.rememberNode(updated);
          return { success: true, pinned: true, nodeId };
        }

        case "memory_boost_node": {
          const nodeId = String(args.nodeId || "");
          const node = this.substrate.getNode(nodeId);
          if (!node) return { success: false, error: `Node ${nodeId} not found` };
          const updated: KnowledgeNode = {
            ...node,
            confidence: Math.min(1.0, node.confidence + 0.1),
            decayFactor: 1.0,
            accessCount: node.accessCount + 1,
            lastAccessedAt: Date.now(),
          };
          this.substrate.rememberNode(updated);
          return { success: true, boosted: true, node: updated };
        }

        case "memory_clear_all": {
          this.substrate.clear();
          return { success: true, message: "All knowledge nodes and memory metrics cleared." };
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
