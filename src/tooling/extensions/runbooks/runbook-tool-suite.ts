/**
 * [LAYER: TOOLING EXTENSION]
 * runbook-tool-suite.ts
 *
 * Model Tool Suite for Runbook FSM Execution, State Transitions, Dynamic Manifests,
 * and Compaction Directives (Phase 193 / ADR-123).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { RunbookSpec } from "../../../core/contracts/runbook.contracts.js";
import { MiniYamlParser } from "../../../agents/extensions/runbooks/mini-yaml-parser.js";
import { RunbookSupervisor } from "../../../agents/extensions/runbooks/runbook-supervisor.js";
import { StatefulCompactionSynthesizer } from "../compaction/stateful-compaction-synthesizer.js";

export class RunbookToolSuite {
  private readonly supervisor: RunbookSupervisor;
  private readonly compactionSynthesizer: StatefulCompactionSynthesizer;

  constructor(supervisor: RunbookSupervisor) {
    this.supervisor = supervisor;
    this.compactionSynthesizer = new StatefulCompactionSynthesizer();
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "runbook_start",
        description: "Initialize or resume a declarative Runbook FSM run from YAML text or a spec file path.",
        parameters: {
          spec: {
            type: "string",
            description: "Runbook spec YAML content or path to a .yaml spec file.",
            required: true,
          },
          runId: {
            type: "string",
            description: "Optional custom run ID to create or resume.",
            required: false,
          },
          fresh: {
            type: "boolean",
            description: "Force creation of a new run even if an active run exists.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const rawSpec = String(args.spec || "").trim();
          let specText = rawSpec;

          // If spec is a file path, load it
          const potentialPath = path.isAbsolute(rawSpec) ? rawSpec : path.resolve(cwd, rawSpec);
          if (fs.existsSync(potentialPath)) {
            specText = fs.readFileSync(potentialPath, "utf-8");
          }

          const parsed = MiniYamlParser.parse(specText) as Record<string, unknown>;
          const spec: RunbookSpec = {
            name: String(parsed.name || "unnamed-runbook"),
            initial: String(parsed.initial || "start"),
            nodes: (parsed.nodes || {}) as any,
            edges: Array.isArray(parsed.edges) ? (parsed.edges as any) : [],
            rawText: specText,
          };

          const runId = args.runId ? String(args.runId) : undefined;
          const fresh = Boolean(args.fresh);
          const state = await this.supervisor.start(spec, { runId, fresh });

          return {
            success: true,
            runId: state.runId,
            specName: state.specName,
            current: state.current,
            currentEntryId: state.currentEntryId,
            message: `Runbook "${state.specName}" started at state "${state.current}" (Run ID: ${state.runId})`,
          };
        },
      },
      {
        name: "runbook_cur",
        description: "Inspect current active state, entry ID, prompt instructions, and allowed next transitions.",
        parameters: {
          runId: {
            type: "string",
            description: "Optional run ID (defaults to active run).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const runId = args.runId ? String(args.runId) : undefined;
          const view = await this.supervisor.cur(runId);
          return {
            success: true,
            ...view,
          };
        },
      },
      {
        name: "runbook_state",
        description: "Inspect the full graph topology, including all nodes, prompts, hooks, and directed edges.",
        parameters: {
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const runId = args.runId ? String(args.runId) : undefined;
          const overview = await this.supervisor.getStateOverview(runId);
          return {
            success: true,
            ...overview,
          };
        },
      },
      {
        name: "runbook_goto",
        description: "Execute a 10-step atomic transition transaction to a target node. Evaluates all pre-transfer gates.",
        parameters: {
          target: {
            type: "string",
            description: "Target node ID to transition to.",
            required: true,
          },
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const target = String(args.target || "").trim();
          const runId = args.runId ? String(args.runId) : undefined;

          try {
            const result = await this.supervisor.goto(target, runId);
            return {
              success: true,
              ...result,
              message: `Successfully transitioned from "${result.from}" to "${result.to}" (Entry: ${result.currentEntryId})`,
            };
          } catch (err: any) {
            return {
              success: false,
              error: err.message,
              details: err.details,
            };
          }
        },
      },
      {
        name: "runbook_save",
        description: "Persist progress and execute current node out_hook without advancing state.",
        parameters: {
          skipHooks: {
            type: "boolean",
            description: "Skip executing out_hook before persisting.",
            required: false,
          },
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const skipHooks = Boolean(args.skipHooks);
          const runId = args.runId ? String(args.runId) : undefined;

          try {
            const result = await this.supervisor.save({ skipHooks, runId });
            return {
              success: true,
              ...result,
              message: `State persisted for node "${result.current}"`,
            };
          } catch (err: any) {
            return {
              success: false,
              error: err.message,
              details: err.details,
            };
          }
        },
      },
      {
        name: "runbook_history",
        description: "Inspect historical transition events, gate results, and attempts.",
        parameters: {
          limit: {
            type: "number",
            description: "Maximum number of recent events to return (default: 10).",
            required: false,
          },
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const limit = typeof args.limit === "number" ? args.limit : 10;
          const runId = args.runId ? String(args.runId) : undefined;
          const history = await this.supervisor.history(limit, runId);
          return {
            success: true,
            totalEvents: history.length,
            history,
          };
        },
      },
      {
        name: "runbook_dynamic_write",
        description: "Register task-generated dynamic verification checks scoped to the current entry ID.",
        parameters: {
          checks: {
            type: "string",
            description: "JSON string containing { basis: {...}, checks: [...] }",
            required: true,
          },
          agentId: {
            type: "string",
            description: "Producer agent ID (defaults to 'agent-implementer').",
            required: false,
          },
          role: {
            type: "string",
            description: "Producer agent role metadata.",
            required: false,
          },
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const rawChecks = String(args.checks || "");
          const runId = args.runId ? String(args.runId) : undefined;
          const cur = await this.supervisor.cur(runId);

          let parsed: any;
          try {
            parsed = JSON.parse(rawChecks);
          } catch (err) {
            return {
              success: false,
              error: `Invalid JSON in checks payload: ${(err as Error).message}`,
            };
          }

          const agentId = args.agentId ? String(args.agentId) : "agent-implementer";
          const role = args.role ? String(args.role) : "implementer";

          await this.supervisor.dynamicWrite({
            runId: cur.runId,
            nodeName: cur.current,
            entryId: cur.currentEntryId,
            producer: {
              agentId,
              role,
              updatedAt: new Date().toISOString(),
            },
            basis: parsed.basis,
            checks: parsed.checks || [],
            registeredAt: Date.now(),
          });

          return {
            success: true,
            runId: cur.runId,
            node: cur.current,
            entryId: cur.currentEntryId,
            checksCount: (parsed.checks || []).length,
            message: `Registered ${(parsed.checks || []).length} dynamic check(s) for entry ${cur.currentEntryId}`,
          };
        },
      },
      {
        name: "runbook_dynamic_list",
        description: "List all dynamic check manifests registered for the current entry ID.",
        parameters: {
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const runId = args.runId ? String(args.runId) : undefined;
          const manifests = await this.supervisor.dynamicList(runId);
          return {
            success: true,
            totalManifests: manifests.length,
            manifests,
          };
        },
      },
      {
        name: "runbook_compact_prompt",
        description: "Synthesize an amnesia-proof /compact instruction referencing durable BroccoliDB state.",
        parameters: {
          runId: {
            type: "string",
            description: "Optional run ID.",
            required: false,
          },
          durableNotesPath: {
            type: "string",
            description: "Durable notes filename (default: progress.md).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const runId = args.runId ? String(args.runId) : undefined;
          const cur = await this.supervisor.cur(runId);
          const history = await this.supervisor.history(1, runId);
          const notesPath = args.durableNotesPath ? String(args.durableNotesPath) : "progress.md";

          const mockState = {
            runId: cur.runId,
            specName: cur.specName,
            specHash: "active-spec",
            current: cur.current,
            currentEntryId: cur.currentEntryId,
            status: "active" as const,
            edgeAttempts: {},
            history,
          };

          const mockSpec: RunbookSpec = {
            name: cur.specName,
            initial: cur.current,
            nodes: {
              [cur.current]: {
                id: cur.current,
                prompt: cur.prompt,
              },
            },
            edges: cur.next.map((n) => ({
              from: cur.current,
              to: n.to,
              condition: n.condition,
            })),
          };

          const prompt = this.compactionSynthesizer.synthesizeCompactionPrompt(mockState, mockSpec, {
            durableNotesPath: notesPath,
          });

          return {
            success: true,
            prompt,
          };
        },
      },
    ];
  }
}
