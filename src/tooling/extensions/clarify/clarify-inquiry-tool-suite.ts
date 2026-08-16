/**
 * clarify-inquiry-tool-suite.ts
 *
 * Model tool surface for Clarification, Interactive Inquiry & Intent Disambiguation (Phase 85 / ADR-037).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ClarifyInputMode } from "../../../core/contracts/clarify.contracts.js";
import { ClarifyInquirySupervisor } from "../../../agents/extensions/clarify/clarify-inquiry-supervisor.js";

export class ClarifyInquiryToolSuite {
  private readonly supervisor: ClarifyInquirySupervisor;

  constructor(supervisor: ClarifyInquirySupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "ask_clarification",
        description: "Presents a structured multiple-choice or open-ended clarifying question to the user to disambiguate intent without making premature assumptions.",
        parameters: {
          question: { type: "string", required: true, description: "The clarifying question to ask the user" },
          choicesJson: { type: "string", required: true, description: "JSON array of choice options: ['Option 1', 'Option 2'] or [{label: 'Option 1'}]" },
          mode: { type: "string", description: "'single_select' | 'multi_select' | 'free_text' (default: 'single_select')" },
          timeoutMs: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const question = String(args.question || "").trim();
          if (!question) return { success: false, error: "question parameter is required" };

          const rawChoicesJson = String(args.choicesJson || "").trim();
          if (!rawChoicesJson) return { success: false, error: "choicesJson parameter is required" };

          let choices: (string | Record<string, unknown>)[];
          try {
            choices = JSON.parse(rawChoicesJson) as (string | Record<string, unknown>)[];
            if (!Array.isArray(choices)) {
              return { success: false, error: "choicesJson must be a JSON array" };
            }
          } catch (err: unknown) {
            return { success: false, error: `Invalid JSON choices: ${err instanceof Error ? err.message : String(err)}` };
          }

          const mode = (typeof args.mode === "string" ? args.mode : "single_select") as ClarifyInputMode;
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

          const resolution = await this.supervisor.askQuestion(question, choices, mode, timeoutMs);

          return {
            success: true,
            inquiryId: resolution.inquiryId,
            selectedChoiceIds: resolution.selectedChoiceIds,
            writeInResponse: resolution.writeInResponse,
            resolvedBy: resolution.resolvedBy,
            resolutionDurationMs: resolution.resolutionDurationMs,
          };
        },
      },
      {
        name: "clarify_inquiry_status",
        description: "Queries the status of clarification inquiries, active question queues, or details of a specific inquiry.",
        parameters: {
          inquiryId: { type: "string", description: "Optional specific inquiry ID to query" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const inquiryId = typeof args.inquiryId === "string" ? args.inquiryId : undefined;
          if (inquiryId) {
            const inquiry = this.supervisor.getInquiry(inquiryId);
            const resolution = this.supervisor.getResolution(inquiryId);
            if (!inquiry) {
              return { success: false, error: `Inquiry '${inquiryId}' not found` };
            }
            return {
              success: true,
              inquiry,
              resolution,
            };
          }

          const stats = this.supervisor.getStats();
          const history = this.supervisor.listInquiries(10);
          return {
            success: true,
            stats,
            history,
          };
        },
      },
    ];
  }
}
