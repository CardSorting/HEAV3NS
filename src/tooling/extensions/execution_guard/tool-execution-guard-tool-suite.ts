/**
 * tool-execution-guard-tool-suite.ts
 *
 * Model tool suite exposing tool batch segmentation and loop guardrail inspection (Phase 94 / ADR-046).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { ToolExecutionGuardSupervisor } from "../../../agents/extensions/execution_guard/tool-execution-guard-supervisor.js";
import type { ToolCallItem } from "../../../core/contracts/tool-execution-segment.contracts.js";

export class ToolExecutionGuardToolSuite {
  private supervisor: ToolExecutionGuardSupervisor;

  constructor(supervisor: ToolExecutionGuardSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "tool_plan_segments",
        description: "Plans safe sequential and parallel batch execution segments for requested tool calls.",
        parameters: {
          toolNames: {
            type: "string",
            description: "Comma-separated list of tool names to plan for batch execution",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const rawNames = typeof args.toolNames === "string" ? args.toolNames : "";
          const names = rawNames
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          const toolCalls: ToolCallItem[] = names.map((name, i) => ({
            callId: `call-${i}`,
            toolName: name,
            parameters: {},
          }));

          const segments = this.supervisor.planSegments(toolCalls);

          return {
            success: true,
            totalSegments: segments.length,
            segments,
          };
        },
      },
      {
        name: "tool_loop_check",
        description: "Evaluates if a proposed tool call violates loop guardrails or exhibits repetitive oscillation.",
        parameters: {
          toolName: {
            type: "string",
            description: "The name of the tool being called",
            required: true,
          },
          frameIndex: {
            type: "number",
            description: "The current frame tick index",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const toolName = typeof args.toolName === "string" ? args.toolName : "";
          const frameIndex = typeof args.frameIndex === "number" ? args.frameIndex : 1;

          const decision = this.supervisor.checkLoopGuardrail(frameIndex, toolName, {});

          return {
            success: true,
            action: decision.action,
            reason: decision.reason,
            repetitionCount: decision.repetitionCount,
          };
        },
      },
      {
        name: "tool_guard_status",
        description: "Queries current tool loop guardrail metrics and recorded violation logs.",
        parameters: {},
        execute: async () => {
          const violations = this.supervisor.getViolations();
          const latestSegments = this.supervisor.getLatestSegments();

          return {
            success: true,
            totalViolations: violations.length,
            violations,
            latestSegmentsCount: latestSegments.length,
          };
        },
      },
    ];
  }
}
