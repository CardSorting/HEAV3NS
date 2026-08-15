/**
 * learning-curator-tool-suite.ts
 *
 * Model tool suite exposing continuous memory learning & knowledge graph operations:
 * - `memory_remember`: Stores a new fact or preference.
 * - `memory_recall`: Searches facts and entity relations.
 * - `memory_forget`: Explicitly prunes a fact.
 * - `memory_graph_inspect`: Inspects graph topology and node connections.
 * - `curator_consolidate`: Triggers memory consolidation and decay cleanup.
 */

import { ContinuousLearningCurator } from "../../../agents/extensions/memory/continuous-learning-curator.js";
import { BroccoliLearningSubstrate } from "../../../sessions/extensions/memory/broccoli-learning-substrate.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  KnowledgeNodeType,
  KnowledgeNode,
} from "../../../core/contracts/memory-curator.contracts.js";

export class LearningCuratorToolSuite {
  private readonly curator: ContinuousLearningCurator;
  private readonly substrate: BroccoliLearningSubstrate;

  constructor(
    curator: ContinuousLearningCurator,
    substrate: BroccoliLearningSubstrate
  ) {
    this.curator = curator;
    this.substrate = substrate;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "memory_remember",
        description: "Stores a structured fact, user preference, entity attribute, or learned insight into the persistent knowledge graph.",
        parameters: {
          label: {
            type: "string",
            required: true,
            description: "Short descriptive label for the knowledge item.",
          },
          content: {
            type: "string",
            required: true,
            description: "The full fact text, preference description, or learned rule.",
          },
          type: {
            type: "string",
            required: false,
            description: "Node type: 'fact', 'preference', 'entity', 'concept', 'skill' (default 'fact').",
          },
          confidence: {
            type: "number",
            required: false,
            description: "Confidence score between 0.0 and 1.0 (default 1.0).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const label = String(args.label || "").trim();
          const content = String(args.content || "").trim();
          const type = (args.type ? String(args.type) : "fact") as KnowledgeNodeType;
          const confidence = typeof args.confidence === "number" ? Math.max(0, Math.min(1, args.confidence)) : 1.0;

          if (!label || !content) {
            return { success: false, error: "Both label and content are required" };
          }

          const id = `kn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const node: KnowledgeNode = {
            id,
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

          return {
            success: true,
            nodeId: id,
            label,
            type,
            confidence,
          };
        },
      },
      {
        name: "memory_recall",
        description: "Recalls facts, user preferences, and associative knowledge from the persistent graph by semantic relevance.",
        parameters: {
          query: {
            type: "string",
            required: true,
            description: "The search query or concept to recall.",
          },
          limit: {
            type: "number",
            required: false,
            description: "Maximum number of memories to return (default 5).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const query = String(args.query || "").trim();
          const limit = typeof args.limit === "number" ? args.limit : 5;

          const results = this.substrate.queryMemory({
            query,
            limit,
            includeRelations: true,
          });

          return {
            success: true,
            query,
            count: results.length,
            memories: results.map((r) => ({
              id: r.node.id,
              type: r.node.type,
              label: r.node.label,
              content: r.node.content,
              score: Number(r.score.toFixed(4)),
              related: r.relatedNodes.map((n) => n.label),
            })),
          };
        },
      },
      {
        name: "memory_forget",
        description: "Explicitly forgets or prunes a knowledge node from the graph by its ID.",
        parameters: {
          nodeId: {
            type: "string",
            required: true,
            description: "The knowledge node ID to delete.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const nodeId = String(args.nodeId || "").trim();
          const deleted = this.substrate.forgetNode(nodeId);

          return {
            success: deleted,
            nodeId,
          };
        },
      },
      {
        name: "memory_graph_inspect",
        description: "Inspects the topology and metrics of the active knowledge graph.",
        parameters: {},
        execute: async () => {
          const metrics = this.substrate.getMetrics();
          const nodes = this.substrate.getGraph().getAllNodes().slice(-20);
          return {
            metrics,
            recentNodes: nodes.map((n) => ({
              id: n.id,
              type: n.type,
              label: n.label,
              accessCount: n.accessCount,
              decayFactor: Number(n.decayFactor.toFixed(3)),
            })),
          };
        },
      },
      {
        name: "curator_consolidate",
        description: "Triggers mathematical decay evaluation, stale fact pruning, and semantic consolidation.",
        parameters: {},
        execute: async () => {
          const decayedCount = this.curator.applyDecay();
          const pruned = this.curator.pruneStaleFacts();
          const candidates = this.curator.findConsolidationCandidates();

          let consolidatedCount = 0;
          for (const [a, b] of candidates) {
            this.curator.consolidateNodes(a.id, b.id);
            consolidatedCount++;
          }

          return {
            success: true,
            decayedCount,
            prunedCount: pruned.length,
            prunedIds: pruned,
            consolidatedCount,
          };
        },
      },
    ];
  }
}
