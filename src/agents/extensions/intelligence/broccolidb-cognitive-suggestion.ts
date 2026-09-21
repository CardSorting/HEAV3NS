/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 133: Zero-Dependency Broccoli Cognitive Suggestion Engine
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/SuggestionService.ts).
 * Generates context-aware prompt suggestions based on active file paths, workspace diagnostics,
 * git status, and MD5 content hashes. Zero external npm dependencies.
 */

import * as crypto from "node:crypto";

export interface PromptSuggestion {
  id: string;
  label: string;
  prompt: string;
  type: "fix" | "refactor" | "test" | "explain" | "general";
  confidence: number;
}

export class BroccoliCognitiveSuggestionEngine {
  private lastSuggestions: PromptSuggestion[] = [];
  private lastFetchTime = 0;
  private readonly DEBOUNCE_INTERVAL_MS = 5000;
  private readonly suggestionCache = new Map<string, PromptSuggestion[]>();

  public calculateContentHash(filePath: string, content: string): string {
    return crypto.createHash("md5").update(`${filePath}:${content}`).digest("hex");
  }

  /**
   * Generates context-aware edit suggestions based on workspace context.
   */
  public generateSuggestions(params: {
    activeFilePath?: string;
    fileContent?: string;
    diagnostics?: string;
    gitStatus?: string;
  }): PromptSuggestion[] {
    const now = Date.now();
    if (now - this.lastFetchTime < this.DEBOUNCE_INTERVAL_MS && this.lastSuggestions.length > 0) {
      return this.lastSuggestions;
    }

    const { activeFilePath, fileContent, diagnostics, gitStatus } = params;

    if (activeFilePath && fileContent) {
      const hash = this.calculateContentHash(activeFilePath, fileContent);
      const cached = this.suggestionCache.get(hash);
      if (cached) {
        this.lastSuggestions = cached;
        this.lastFetchTime = now;
        return cached;
      }
    }

    const suggestions: PromptSuggestion[] = [];

    if (diagnostics && diagnostics.length > 0) {
      suggestions.push({
        id: `sug-fix-${Date.now()}`,
        label: "Fix Diagnostic Errors",
        prompt: `Analyze and resolve the following workspace diagnostics errors:\n${diagnostics.substring(0, 500)}`,
        type: "fix",
        confidence: 0.95,
      });
    }

    if (activeFilePath) {
      suggestions.push({
        id: `sug-refactor-${Date.now()}`,
        label: `Refactor ${activeFilePath}`,
        prompt: `Review and refactor '${activeFilePath}' for modular clarity, edge-case safety, and performance.`,
        type: "refactor",
        confidence: 0.85,
      });

      suggestions.push({
        id: `sug-test-${Date.now()}`,
        label: `Write Tests for ${activeFilePath}`,
        prompt: `Generate automated unit tests for '${activeFilePath}' verifying happy paths and error boundaries.`,
        type: "test",
        confidence: 0.8,
      });
    }

    if (gitStatus && gitStatus.includes("Modified")) {
      suggestions.push({
        id: `sug-commit-${Date.now()}`,
        label: "Generate Commit Message",
        prompt: `Summarize modified git changes and compose a conventional commit message.`,
        type: "general",
        confidence: 0.9,
      });
    }

    if (activeFilePath && fileContent) {
      const hash = this.calculateContentHash(activeFilePath, fileContent);
      this.suggestionCache.set(hash, suggestions);
    }

    this.lastSuggestions = suggestions;
    this.lastFetchTime = now;

    return suggestions;
  }
}
