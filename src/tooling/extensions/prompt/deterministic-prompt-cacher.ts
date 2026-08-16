/**
 * deterministic-prompt-cacher.ts
 *
 * In-memory zero-GC prompt cache boundary calculator & <think> scrubber (Phase 93 / ADR-045).
 */

import * as crypto from "node:crypto";
import type {
  ByteStablePromptEnvelope,
  PromptCacheBreakpoint,
  ReasoningSanitizationResult,
} from "../../../core/contracts/prompt-cache.contracts.js";

export class DeterministicPromptCacher {
  /**
   * Computes a deterministic SHA-256 hash of the system prompt.
   */
  computeSystemPromptHash(prompt: string): string {
    return crypto.createHash("sha256").update(prompt, "utf8").digest("hex");
  }

  /**
   * Scrubs raw <think> tags and chain-of-thought blocks from assistant responses.
   */
  scrubReasoning(rawContent: string): ReasoningSanitizationResult {
    const thinkTagRegex = /<think>([\s\S]*?)<\/think>/gi;
    let hasThinkTags = false;
    let reasoningContent: string | undefined = undefined;
    let strippedTokensCount = 0;

    const matches = Array.from(rawContent.matchAll(thinkTagRegex));
    if (matches.length > 0) {
      hasThinkTags = true;
      const reasoningParts: string[] = [];

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const inner = match[1].trim();
        if (inner.length > 0) {
          reasoningParts.push(inner);
          // Estimate tokens roughly as 4 chars/token
          strippedTokensCount += Math.ceil(inner.length / 4);
        }
      }

      if (reasoningParts.length > 0) {
        reasoningContent = reasoningParts.join("\n\n");
      }
    }

    const sanitizedContent = rawContent.replace(thinkTagRegex, "").trim();

    return {
      sanitizedContent,
      reasoningContent,
      hasThinkTags,
      strippedTokensCount,
    };
  }

  /**
   * Calculates the byte-stable 4-breakpoint prompt cache envelope.
   */
  buildCachePlan(
    systemPrompt: string,
    messages: readonly { role: string; content?: string }[] = [],
    tools: readonly unknown[] = []
  ): ByteStablePromptEnvelope {
    const systemBytes = Buffer.byteLength(systemPrompt, "utf8");
    const systemHash = this.computeSystemPromptHash(systemPrompt);

    const breakpoints: PromptCacheBreakpoint[] = [];

    // Breakpoint 0: Static Prefix (core identity)
    const staticPrefixCutoff = Math.min(systemBytes, Math.floor(systemBytes * 0.4));
    breakpoints.push({
      breakpointIndex: 0,
      target: "system",
      breakpointType: "static_prefix",
      byteOffset: staticPrefixCutoff,
      tokenEstimate: Math.ceil(staticPrefixCutoff / 4),
    });

    // Breakpoint 1: System Tail (end of system instructions + skills index)
    breakpoints.push({
      breakpointIndex: 1,
      target: "system",
      breakpointType: "system_tail",
      byteOffset: systemBytes,
      tokenEstimate: Math.ceil(systemBytes / 4),
    });

    // Breakpoint 2: History Midpoint (if >= 4 messages)
    if (messages.length >= 4) {
      const midIndex = Math.floor(messages.length / 2);
      let midBytes = 0;
      for (let i = 0; i <= midIndex; i++) {
        const msg = messages[i];
        if (msg && typeof msg.content === "string") {
          midBytes += Buffer.byteLength(msg.content, "utf8");
        }
      }
      breakpoints.push({
        breakpointIndex: 2,
        target: "message",
        breakpointType: "history_mid",
        byteOffset: midBytes,
        tokenEstimate: Math.ceil(midBytes / 4),
      });
    }

    // Breakpoint 3: Turn Tail (penultimate non-empty message)
    if (messages.length >= 2) {
      const penultIndex = messages.length - 2;
      let totalMsgBytes = 0;
      for (let i = 0; i <= penultIndex; i++) {
        const msg = messages[i];
        if (msg && typeof msg.content === "string") {
          totalMsgBytes += Buffer.byteLength(msg.content, "utf8");
        }
      }
      breakpoints.push({
        breakpointIndex: 3,
        target: "message",
        breakpointType: "turn_tail",
        byteOffset: totalMsgBytes,
        tokenEstimate: Math.ceil(totalMsgBytes / 4),
      });
    }

    let dynamicSuffixBytes = 0;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg && typeof msg.content === "string") {
        dynamicSuffixBytes += Buffer.byteLength(msg.content, "utf8");
      }
    }

    // Include tool definitions in total prompt bytes
    const toolsJson = JSON.stringify(tools);
    const toolsBytes = Buffer.byteLength(toolsJson, "utf8");

    const totalPromptBytes = systemBytes + dynamicSuffixBytes + toolsBytes;

    return {
      staticPrefixBytes: staticPrefixCutoff,
      systemPromptHash: systemHash,
      dynamicSuffixBytes,
      totalPromptBytes,
      breakpoints,
    };
  }
}
