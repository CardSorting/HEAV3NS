/**
 * deterministic-clarify-engine.ts
 *
 * In-memory zero-GC clarification & intent disambiguation engine (Phase 85 / ADR-037).
 */

import { performance } from "node:perf_hooks";
import type {
  ClarifyChoice,
  ClarifyInquiry,
  ClarifyInputMode,
  ClarifyResolution,
} from "../../../core/contracts/clarify.contracts.js";

export type ClarifyResolverFn = (inquiry: ClarifyInquiry) => Promise<{
  selectedChoiceIds: readonly string[];
  writeInResponse?: string;
}>;

export class DeterministicClarifyEngine {
  private defaultTimeoutMs: number;
  private autoResolver?: ClarifyResolverFn;

  constructor(defaultTimeoutMs: number = 30000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * Sets an automated resolver hook for headless/test operation.
   */
  setAutoResolver(resolver?: ClarifyResolverFn): void {
    this.autoResolver = resolver;
  }

  /**
   * Normalizes raw choices into structured ClarifyChoice objects.
   */
  normalizeChoices(rawChoices: readonly (string | Record<string, unknown>)[]): ClarifyChoice[] {
    const choices: ClarifyChoice[] = [];

    for (let i = 0; i < rawChoices.length; i++) {
      const raw = rawChoices[i];
      let label = "";
      let description: string | undefined;
      let isRecommended = false;

      if (typeof raw === "string") {
        label = raw.trim();
      } else if (typeof raw === "object" && raw !== null) {
        label = String(raw.label || raw.title || raw.text || raw.description || `Choice ${i + 1}`).trim();
        description = raw.description && raw.description !== label ? String(raw.description) : undefined;
        isRecommended = Boolean(raw.isRecommended || raw.recommended);
      }

      if (!label) label = `Option ${i + 1}`;

      // If first choice and no explicit recommendation, default first as recommended
      if (i === 0 && !isRecommended && !label.includes("(Recommended)")) {
        isRecommended = true;
      }

      choices.push({
        id: `choice-${i + 1}`,
        label,
        description,
        isRecommended,
      });
    }

    return choices;
  }

  /**
   * Creates a structured inquiry object.
   */
  createInquiry(
    id: string,
    question: string,
    rawChoices: readonly (string | Record<string, unknown>)[],
    mode: ClarifyInputMode = "single_select",
    timeoutMs?: number,
    currentFrame: number = 1
  ): ClarifyInquiry {
    const choices = this.normalizeChoices(rawChoices);
    const defaultChoice = choices.find((c) => c.isRecommended) || choices[0];

    return {
      id,
      question: question.trim(),
      mode,
      choices,
      timeoutMs: timeoutMs ?? this.defaultTimeoutMs,
      defaultChoiceId: defaultChoice?.id,
      createdFrame: currentFrame,
      timestamp: Date.now(),
    };
  }

  /**
   * Resolves an inquiry synchronously or asynchronously.
   */
  async resolveInquiry(inquiry: ClarifyInquiry): Promise<ClarifyResolution> {
    const startedAt = performance.now();

    if (this.autoResolver) {
      try {
        const resolution = await this.autoResolver(inquiry);
        const duration = Number((performance.now() - startedAt).toFixed(3));
        return {
          inquiryId: inquiry.id,
          selectedChoiceIds: resolution.selectedChoiceIds,
          writeInResponse: resolution.writeInResponse,
          resolvedBy: "auto_policy",
          resolutionDurationMs: duration,
          timestamp: Date.now(),
        };
      } catch {
        // Fallback to default
      }
    }

    // Default fast-path resolution to recommended/first choice
    const defaultChoiceId = inquiry.defaultChoiceId || inquiry.choices[0]?.id;
    const duration = Number((performance.now() - startedAt).toFixed(3));

    return {
      inquiryId: inquiry.id,
      selectedChoiceIds: defaultChoiceId ? [defaultChoiceId] : [],
      resolvedBy: "default",
      resolutionDurationMs: duration,
      timestamp: Date.now(),
    };
  }
}
