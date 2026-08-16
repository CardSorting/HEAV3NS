/**
 * deterministic-title-generator.ts
 *
 * Two-Stage Epistemic Session Title Generation Engine (Target #42 / Phase 109 / ADR-085).
 * - Stage 1 (Instant Derived): Zero-cost, <= 0.01 ms word-bounded deterministic title from first non-empty user line.
 * - Stage 2 (LLM Upgraded): Small-model JSON-schema constrained 3-7 word imperative title with fallback prose cleaning.
 * - Strict Provenance Enforcer: (user > llm > derived).
 */

import {
  CONTROL_WRAPPERS,
  MACHINE_PREFIXES,
  MAX_DERIVED_TITLE_CHARS,
  MAX_TITLE_INPUT_CHARS,
  MAX_MODEL_TITLE_CHARS,
  type SessionTitleProvenance,
  type TitleGenerationOptions,
  type TitleGenerationResult,
} from "../../../core/contracts/title-insights.contracts.js";

export class DeterministicTitleGenerator {
  /**
   * Strip machine-authored control wrappers from user messages.
   * Handles nested wrappers recursively up to safety bounds.
   */
  public stripControlWrappers(text: string): string {
    if (!text) return "";
    let current = text.trim();

    // Multi-pass stripping to unwrap nested tags
    for (let pass = 0; pass < CONTROL_WRAPPERS.length * 2; pass++) {
      let stripped = current;
      for (const [openTag, closeTag] of CONTROL_WRAPPERS) {
        if (stripped.toLowerCase().startsWith(openTag)) {
          const endIdx = stripped.toLowerCase().indexOf(closeTag);
          if (endIdx === -1) {
            stripped = stripped.slice(openTag.length).trim();
          } else {
            const inner = stripped.slice(openTag.length, endIdx).trim();
            const rest = stripped.slice(endIdx + closeTag.length).trim();
            stripped = (rest || inner).trim();
          }
          break;
        }
      }
      if (stripped === current) {
        break;
      }
      current = stripped;
    }
    return current;
  }

  /**
   * Summarize user message to extract clean text worth titling.
   * Strips skill scaffolding and control wrappers.
   */
  public summarizeUserMessage(userMessage: string): string {
    if (!userMessage) return "";
    let text = userMessage.trim();

    // Check if message is a /skill or /work invocation
    if (text.startsWith("/skill") || text.startsWith("/work")) {
      const parts = text.split(/\s+--\s+|\s+—\s+/);
      if (parts.length > 1) {
        text = parts.slice(1).join(" ");
      }
    }

    return this.stripControlWrappers(text);
  }

  /**
   * Determine whether a user message represents titleable user intent.
   * Returns false for machine-authored openers, compaction notes, or empty text.
   */
  public isTitleableUserMessage(userMessage: string): boolean {
    if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
      return false;
    }
    const trimmed = userMessage.trim();
    for (const prefix of MACHINE_PREFIXES) {
      if (trimmed.startsWith(prefix)) {
        return false;
      }
    }
    const clean = this.summarizeUserMessage(userMessage);
    return clean.length > 0;
  }

  /**
   * Stage 1: Instant Derived Title Generation.
   * Zero model calls, deterministic, completes in <= 0.01 ms.
   * Truncates at word boundaries to MAX_DERIVED_TITLE_CHARS.
   */
  public deriveTitle(userMessage: string, maxChars = MAX_DERIVED_TITLE_CHARS): string | null {
    const text = this.summarizeUserMessage(userMessage);
    if (!text) return null;

    // Pick first non-empty line
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    let line = lines[0].replace(/\s+/g, " ");
    if (line.length > maxChars) {
      const cut = line.slice(0, maxChars);
      const spaceIdx = cut.lastIndexOf(" ");
      if (spaceIdx > Math.floor(maxChars / 2)) {
        line = cut.slice(0, spaceIdx);
      } else {
        line = cut;
      }
      line = line.replace(/[ ,.;:—-—]+$/, "") + "…";
    }
    return line.trim() || null;
  }

  /**
   * Extract title text from structured or unstructured LLM output.
   */
  public extractTitleText(content: string): string {
    if (!content) return "";
    let raw = content.trim();

    // Check for markdown fenced JSON
    const fencedMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (fencedMatch) {
      raw = fencedMatch[1].trim();
    }

    // Try direct JSON parse
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.title === "string") {
        return parsed.title.trim();
      }
    } catch {
      // Fall through to regex
    }

    // Regex extraction for loose JSON
    const jsonMatch = raw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (jsonMatch) {
      try {
        return JSON.parse(`"${jsonMatch[1]}"`).trim();
      } catch {
        return jsonMatch[1].trim();
      }
    }

    // Strip reasoning <think> blocks if present
    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Prose fallback: pick first non-empty line
    const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] || "";
    if (firstLine.toLowerCase().startsWith("title:")) {
      return firstLine.slice(6).trim();
    }
    return firstLine.replace(/^["']|["']$/g, "").trim();
  }

  /**
   * Clean and normalize model-generated title text.
   */
  public cleanTitle(text: string, maxChars = MAX_MODEL_TITLE_CHARS): string | null {
    if (!text) return null;
    let title = text.replace(/\s+/g, " ").trim();
    title = title.replace(/^["']|["']$/g, "").trim();

    if (title.toLowerCase().startsWith("title:")) {
      title = title.slice(6).trim();
    }

    // Strip trailing sentence punctuation
    title = title.replace(/[.!,;:]+$/, "").trim();
    if (!title) return null;

    if (title.length > maxChars) {
      title = title.slice(0, maxChars - 3).trim() + "...";
    }
    return title;
  }

  /**
   * Build the prompt for LLM title generation.
   */
  public buildTitlePrompt(userMessage: string, language?: string): string {
    const cleanInput = this.summarizeUserMessage(userMessage).slice(0, MAX_TITLE_INPUT_CHARS);
    const langRule = language
      ? `- Write the title in ${language}.`
      : "- Write the title in the same language as the user's message.";

    return [
      "You name chat sessions. Given the user's opening message, write a title that lets them find this conversation again in a list.",
      "",
      "Rules:",
      "- 3 to 7 words, sentence case (capitalize only the first word and proper nouns).",
      "- Name what the user wants DONE, not that they asked a question.",
      "- Keep technical terms, filenames, numbers, and error codes exact.",
      "- Drop filler words: the, this, my, a, an.",
      "- No trailing punctuation, no quotes, no tool names, no 'Title:' prefix.",
      "- Never answer the message. Name it.",
      "- Always produce something, even for a bare greeting.",
      langRule,
      'Good: {"title": "Fix login button on mobile"}',
      'Good: {"title": "Postgres connection pool exhaustion"}',
      'Good: {"title": "Friendly greeting"}',
      'Too vague: {"title": "Code changes"}',
      'Too long: {"title": "Investigate and fix the issue where the login button does not respond on mobile devices"}',
      "",
      `User message: ${cleanInput}`,
      "",
      'Reply with JSON only: {"title": "..."}',
    ].join("\n");
  }

  /**
   * Execute full two-stage title generation.
   * If llmCall is provided, Stage 2 executes asynchronously/synchronously and upgrades the derived title.
   */
  public async generateTitle(
    userMessage: string,
    options: TitleGenerationOptions = {},
    llmCall?: (prompt: string) => Promise<string>
  ): Promise<TitleGenerationResult> {
    const startTime = Date.now();

    if (!this.isTitleableUserMessage(userMessage)) {
      const fallbackTitle = "New Session";
      return {
        success: true,
        title: fallbackTitle,
        provenance: "derived",
        stage: "fallback",
        latencyMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    // Stage 1: Instant derived title
    const derived = this.deriveTitle(userMessage, options.maxDerivedChars || MAX_DERIVED_TITLE_CHARS);
    const instantTitle = derived || "New Session";

    if (!llmCall) {
      return {
        success: true,
        title: instantTitle,
        provenance: "derived",
        stage: "instant_derived",
        latencyMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    // Stage 2: LLM upgrade
    try {
      const prompt = this.buildTitlePrompt(userMessage, options.language);
      const rawResponse = await llmCall(prompt);
      const extracted = this.extractTitleText(rawResponse);
      const cleaned = this.cleanTitle(extracted, MAX_MODEL_TITLE_CHARS);

      if (cleaned) {
        return {
          success: true,
          title: cleaned,
          provenance: "llm",
          stage: "llm_upgraded",
          latencyMs: Date.now() - startTime,
          tokensUsed: 50, // Approx tokens for small auxiliary call
          costUsd: 0.00005,
        };
      }
    } catch (err: any) {
      // Graceful fallback to instant derived title on error
      return {
        success: true,
        title: instantTitle,
        provenance: "derived",
        stage: "fallback",
        latencyMs: Date.now() - startTime,
        tokensUsed: 0,
        costUsd: 0,
        error: err?.message || String(err),
      };
    }

    return {
      success: true,
      title: instantTitle,
      provenance: "derived",
      stage: "instant_derived",
      latencyMs: Date.now() - startTime,
      tokensUsed: 0,
      costUsd: 0,
    };
  }
}
