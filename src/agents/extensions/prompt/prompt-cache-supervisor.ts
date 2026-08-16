/**
 * prompt-cache-supervisor.ts
 *
 * Master Prompt Cache Supervisor coordinating byte-stable system envelopes,
 * 4-breakpoint cache control planning, and <think> reasoning scrubbing (Phase 93 / ADR-045).
 */

import type {
  ByteStablePromptEnvelope,
  ReasoningSanitizationResult,
} from "../../../core/contracts/prompt-cache.contracts.js";
import { DeterministicPromptCacher } from "../../../tooling/extensions/prompt/deterministic-prompt-cacher.js";
import { BroccoliPromptCacheSubstrate } from "../../../sessions/extensions/prompt/broccoli-prompt-cache-substrate.js";

export class PromptCacheSupervisor {
  private cacher: DeterministicPromptCacher;
  private substrate: BroccoliPromptCacheSubstrate;

  constructor(
    cacher: DeterministicPromptCacher,
    substrate: BroccoliPromptCacheSubstrate
  ) {
    this.cacher = cacher;
    this.substrate = substrate;
  }

  /**
   * Generates and stores a byte-stable prompt cache plan.
   */
  generatePlan(
    systemPrompt: string,
    messages: readonly { role: string; content?: string }[] = [],
    tools: readonly unknown[] = []
  ): ByteStablePromptEnvelope {
    const envelope = this.cacher.buildCachePlan(systemPrompt, messages, tools);
    this.substrate.setLatestEnvelope(envelope);
    return envelope;
  }

  /**
   * Scrubs raw <think> tags and chain-of-thought tokens from assistant outputs.
   */
  sanitizeAssistantResponse(rawContent: string): ReasoningSanitizationResult {
    const result = this.cacher.scrubReasoning(rawContent);
    this.substrate.recordSanitization(result);
    return result;
  }

  /**
   * Retrieves the latest active prompt cache envelope.
   */
  getLatestEnvelope(): ByteStablePromptEnvelope | undefined {
    return this.substrate.getLatestEnvelope();
  }

  /**
   * Retrieves the sanitization history.
   */
  getSanitizationStats(): readonly ReasoningSanitizationResult[] {
    return this.substrate.getSanitizationHistory();
  }
}
