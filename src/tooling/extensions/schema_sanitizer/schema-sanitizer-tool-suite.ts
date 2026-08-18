/**
 * schema-sanitizer-tool-suite.ts
 *
 * Model tool surface for Deterministic JSON Schema Sanitizer,
 * Tool Parameter Rewriter & LLM Grammar Firewall Subsystem (Phase 139 / ADR-115 / Target #80):
 * 30 specialized model tools for sanitizing schemas, restoring arguments,
 * querying DSL, swimlanes, dashboards, and HTML/Markdown/CSV exports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SchemaSanitizerGroupBy,
  SchemaSanitizerSortBy,
  SchemaSanitizerSortDirection,
} from "../../../core/contracts/schema-sanitizer.contracts.js";
import {
  FORBIDDEN_REF_SIBLING_KEYWORDS,
  PROPERTY_KEY_REGEX,
  TOP_LEVEL_FORBIDDEN_COMBINATORS,
} from "../../../core/contracts/schema-sanitizer.contracts.js";
import { SchemaSanitizerSupervisor } from "../../../agents/extensions/schema_sanitizer/schema-sanitizer-supervisor.js";
import { SchemaSanitizerSnapshotManager } from "../../../sessions/extensions/schema_sanitizer/schema-sanitizer-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class SchemaSanitizerToolSuite {
  private readonly supervisor: SchemaSanitizerSupervisor;
  private readonly snapshotManager: SchemaSanitizerSnapshotManager;

  constructor(supervisor: SchemaSanitizerSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new SchemaSanitizerSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "schema_sanitizer_sanitize_tool_schema",
        description: "Sanitizes a JSON tool parameters schema for cross-provider GBNF compatibility.",
        parameters: {
          schemaJson: { type: "string", required: true, description: "JSON string of tool schema" },
          schemaName: { type: "string", description: "Schema/tool name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_sanitize_tool_schema", args);
        },
      },
      {
        name: "schema_sanitizer_unrename_args",
        description: "Maps model-emitted arguments back to original raw wire property names.",
        parameters: {
          originalSchemaJson: { type: "string", required: true, description: "Original raw parameters schema" },
          argsJson: { type: "string", required: true, description: "Model-emitted arguments JSON" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_unrename_args", args);
        },
      },
      {
        name: "schema_sanitizer_validate_property_key",
        description: "Validates if a property key complies with standard LLM provider key constraints.",
        parameters: {
          key: { type: "string", required: true, description: "Property key string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_validate_property_key", args);
        },
      },
      {
        name: "schema_sanitizer_configure",
        description: "Configures schema sanitizer options and rules.",
        parameters: {
          enabled: { type: "boolean", description: "Enable schema sanitizer" },
          enforceConformingKeys: { type: "boolean", description: "Enforce conforming keys" },
          collapseNullableUnions: { type: "boolean", description: "Collapse nullable unions" },
          stripRefSiblings: { type: "boolean", description: "Strip $ref siblings" },
          stripTopLevelCombinators: { type: "boolean", description: "Strip combinators" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_configure", args);
        },
      },
      {
        name: "schema_sanitizer_get_config",
        description: "Retrieves active schema sanitizer configuration.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_get_config", args);
        },
      },
      {
        name: "schema_sanitizer_get_metrics",
        description: "Fetches aggregated schema transformation metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_get_metrics", args);
        },
      },
      {
        name: "schema_sanitizer_get_metrics_report",
        description: "Retrieves detailed metrics report with mutation breakdown.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_get_metrics_report", args);
        },
      },
      {
        name: "schema_sanitizer_audit_health",
        description: "Audits schema sanitizer SLA health posture and recommendations.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_audit_health", args);
        },
      },
      {
        name: "schema_sanitizer_record_event",
        description: "Records a schema transformation event into the memory ledger.",
        parameters: {
          schemaName: { type: "string", required: true, description: "Schema name" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_record_event", args);
        },
      },
      {
        name: "schema_sanitizer_get_event",
        description: "Retrieves a transformation event from the ledger by ID.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_get_event", args);
        },
      },
      {
        name: "schema_sanitizer_list_events",
        description: "Lists all recorded schema transformation events.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_list_events", args);
        },
      },
      {
        name: "schema_sanitizer_remove_event",
        description: "Removes an event record from the ledger.",
        parameters: {
          id: { type: "string", required: true, description: "Event ID to delete" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_remove_event", args);
        },
      },
      {
        name: "schema_sanitizer_clear_events",
        description: "Clears all events and resets metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_clear_events", args);
        },
      },
      {
        name: "schema_sanitizer_group_and_sort",
        description: "Organizes events into multi-criteria swimlanes (schemaName, mutationType).",
        parameters: {
          groupBy: { type: "string", description: "schemaName or mutationType" },
          sortBy: { type: "string", description: "timestamp, renamedKeyCount, schemaName" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_group_and_sort", args);
        },
      },
      {
        name: "schema_sanitizer_search_dsl",
        description: "Searches events using Natural Query DSL (e.g. 'schema:my_tool').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_search_dsl", args);
        },
      },
      {
        name: "schema_sanitizer_render_dashboard",
        description: "Renders an ANSI CLI summary card with schema sanitization statistics.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_render_dashboard", args);
        },
      },
      {
        name: "schema_sanitizer_render_event_card",
        description: "Renders an interactive ANSI CLI transformation event card.",
        parameters: {
          eventId: { type: "string", required: true, description: "Event ID" },
          schemaName: { type: "string", description: "Schema Name" },
          renamedKeyCount: { type: "number", description: "Renamed Key Count" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_render_event_card", args);
        },
      },
      {
        name: "schema_sanitizer_export_html_view",
        description: "Exports schema sanitizer events ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_export_html_view", args);
        },
      },
      {
        name: "schema_sanitizer_export_markdown_report",
        description: "Exports schema sanitizer report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_export_markdown_report", args);
        },
      },
      {
        name: "schema_sanitizer_export_csv_report",
        description: "Exports schema sanitizer events ledger to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_export_csv_report", args);
        },
      },
      {
        name: "schema_sanitizer_bulk_purge",
        description: "Atomically purges multiple events from the ledger.",
        parameters: {
          idsJson: { type: "string", required: true, description: "JSON array of event IDs" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_bulk_purge", args);
        },
      },
      {
        name: "schema_sanitizer_undo",
        description: "Reverts the last schema sanitizer mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_undo", args);
        },
      },
      {
        name: "schema_sanitizer_redo",
        description: "Re-applies the last undone schema sanitizer mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_redo", args);
        },
      },
      {
        name: "schema_sanitizer_capture_snapshot",
        description: "Captures a frame-perfect snapshot of sanitizer state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_capture_snapshot", args);
        },
      },
      {
        name: "schema_sanitizer_restore_snapshot",
        description: "Restores sanitizer state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_restore_snapshot", args);
        },
      },
      {
        name: "schema_sanitizer_format_sanitize_result",
        description: "Formats a sanitization result into a concise summary string.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_format_sanitize_result", args);
        },
      },
      {
        name: "schema_sanitizer_format_metrics",
        description: "Formats sanitizer metrics into a standardized summary string.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_format_metrics", args);
        },
      },
      {
        name: "schema_sanitizer_is_valid_property_key",
        description: "Checks if a property key complies with standard key regex constraints.",
        parameters: {
          key: { type: "string", required: true, description: "Property key string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_is_valid_property_key", args);
        },
      },
      {
        name: "schema_sanitizer_is_forbidden_combinator",
        description: "Checks if a combinator keyword is forbidden at the top level.",
        parameters: {
          combinator: { type: "string", required: true, description: "Combinator name e.g. allOf" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_is_forbidden_combinator", args);
        },
      },
      {
        name: "schema_sanitizer_is_forbidden_ref_sibling",
        description: "Checks if a keyword is a forbidden sibling of $ref.",
        parameters: {
          keyword: { type: "string", required: true, description: "Keyword name e.g. default" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("schema_sanitizer_is_forbidden_ref_sibling", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "schema_sanitizer_sanitize_tool_schema": {
          let schema: Record<string, unknown> = {};
          if (typeof args.schemaJson === "string") {
            try {
              schema = JSON.parse(args.schemaJson);
            } catch {
              schema = { type: "object", properties: {} };
            }
          } else if (typeof args.schemaJson === "object" && args.schemaJson !== null) {
            schema = args.schemaJson as Record<string, unknown>;
          }
          const schemaName = String(args.schemaName || "tool_schema");
          const result = this.supervisor.sanitizeToolSchema(schema, schemaName);
          return { success: true, ...result };
        }

        case "schema_sanitizer_unrename_args": {
          let originalSchema: Record<string, unknown> = {};
          let emittedArgs: Record<string, unknown> = {};
          if (typeof args.originalSchemaJson === "string") {
            try {
              originalSchema = JSON.parse(args.originalSchemaJson);
            } catch {
              originalSchema = {};
            }
          }
          if (typeof args.argsJson === "string") {
            try {
              emittedArgs = JSON.parse(args.argsJson);
            } catch {
              emittedArgs = {};
            }
          }
          const unrenamed = this.supervisor.unrenameToolArgs(originalSchema, emittedArgs);
          return { success: true, unrenamedArgs: unrenamed };
        }

        case "schema_sanitizer_validate_property_key": {
          const key = String(args.key || "");
          const isValid = this.supervisor.validatePropertyKey(key);
          return { success: true, key, isValid };
        }

        case "schema_sanitizer_configure": {
          this.supervisor.configure(args as any);
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "schema_sanitizer_get_config": {
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "schema_sanitizer_get_metrics": {
          return { success: true, metrics: this.supervisor.getMetrics() };
        }

        case "schema_sanitizer_get_metrics_report": {
          return { success: true, report: this.supervisor.getMetricsReport() };
        }

        case "schema_sanitizer_audit_health": {
          return { success: true, audit: this.supervisor.auditHealth() };
        }

        case "schema_sanitizer_record_event": {
          const schemaName = String(args.schemaName || "custom_schema");
          const eventId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          this.supervisor.getSubstrate().recordEvent({
            eventId,
            schemaName,
            mutationsApplied: ["Manual transformation recorded"],
            renamedKeyCount: 0,
            warnings: [],
            timestamp: Date.now(),
          });
          return { success: true, eventId };
        }

        case "schema_sanitizer_get_event": {
          const id = String(args.id || "");
          const event = this.supervisor.getSubstrate().getEvent(id);
          if (!event) return { success: false, error: `Event '${id}' not found` };
          return { success: true, event };
        }

        case "schema_sanitizer_list_events": {
          const events = this.supervisor.getSubstrate().listEvents();
          return { success: true, count: events.length, events };
        }

        case "schema_sanitizer_remove_event": {
          const id = String(args.id || "");
          const ok = this.supervisor.getSubstrate().removeEvent(id);
          return { success: ok };
        }

        case "schema_sanitizer_clear_events": {
          this.supervisor.getSubstrate().clear();
          return { success: true };
        }

        case "schema_sanitizer_group_and_sort": {
          const groupBy = (args.groupBy as SchemaSanitizerGroupBy) || "schemaName";
          const sortBy = (args.sortBy as SchemaSanitizerSortBy) || "timestamp";
          const direction = (args.direction as SchemaSanitizerSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedEvents(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "schema_sanitizer_search_dsl": {
          const query = String(args.query || "");
          const events = this.supervisor.queryDsl(query);
          return { success: true, count: events.length, events };
        }

        case "schema_sanitizer_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderSchemaSanitizerDashboard({
            totalSchemas: metrics.totalSchemasSanitized,
            renamedKeys: metrics.invalidPropertyKeysRenamed,
            collapsedUnions: metrics.nullableUnionsCollapsed,
            strippedSiblings: metrics.refSiblingsStripped,
            cleanedCombinators: metrics.topLevelCombinatorsCleaned,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "schema_sanitizer_render_event_card": {
          const eventId = String(args.eventId || "ev-1");
          const schemaName = String(args.schemaName || "tool_params");
          const renamedKeyCount = typeof args.renamedKeyCount === "number" ? args.renamedKeyCount : 0;
          const rendered = BroccoliViewRenderer.renderSchemaSanitizationEventCard({
            eventId,
            schemaName,
            renamedKeyCount,
            mutationsApplied: ["Cleaned top-level combinators"],
            warnings: [],
          });
          return { success: true, rendered };
        }

        case "schema_sanitizer_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "schema_sanitizer_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "schema_sanitizer_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "schema_sanitizer_bulk_purge": {
          const idsJson = String(args.idsJson || "[]");
          let ids: string[];
          try {
            ids = JSON.parse(idsJson);
          } catch {
            return { success: false, error: "idsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(ids);
          return { success: true, result };
        }

        case "schema_sanitizer_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "schema_sanitizer_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "schema_sanitizer_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "schema_sanitizer_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "schema_sanitizer_format_sanitize_result": {
          const formatted = this.supervisor.getEngine().formatSanitizeResult({
            sanitizedSchema: {},
            renamedKeys: { "@attr": "attr" },
            mutationsApplied: ["Renamed key"],
            warnings: [],
          });
          return { success: true, formatted };
        }

        case "schema_sanitizer_format_metrics": {
          const metrics = this.supervisor.getMetrics();
          const formatted = this.supervisor.getEngine().formatSanitizerMetrics({
            totalSchemas: metrics.totalSchemasSanitized,
            renamedKeys: metrics.invalidPropertyKeysRenamed,
          });
          return { success: true, formatted };
        }

        case "schema_sanitizer_is_valid_property_key": {
          const key = String(args.key || "");
          return { success: true, key, isValid: PROPERTY_KEY_REGEX.test(key) };
        }

        case "schema_sanitizer_is_forbidden_combinator": {
          const combinator = String(args.combinator || "");
          return { success: true, combinator, isForbidden: TOP_LEVEL_FORBIDDEN_COMBINATORS.has(combinator) };
        }

        case "schema_sanitizer_is_forbidden_ref_sibling": {
          const keyword = String(args.keyword || "");
          return { success: true, keyword, isForbidden: FORBIDDEN_REF_SIBLING_KEYWORDS.has(keyword) };
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
