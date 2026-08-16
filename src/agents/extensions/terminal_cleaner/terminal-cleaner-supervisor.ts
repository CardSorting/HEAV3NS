/**
 * terminal-cleaner-supervisor.ts
 *
 * Master supervisor coordinating text output sanitization, display safety,
 * opaque document protections, and operational metrics (Phase 136 / ADR-112 / Target #69).
 */

import type { BroccoliTerminalCleanerSubstrate } from "../../../sessions/extensions/terminal_cleaner/broccoli-terminal-cleaner-substrate.js";
import type { DeterministicTerminalCleanerEngine } from "./deterministic-terminal-cleaner-engine.js";
import type {
  BinaryAssetClassification,
  TerminalCleanerConfig,
  TerminalCleanerMetrics,
} from "../../../core/contracts/terminal-cleaner.contracts.js";

export class TerminalCleanerSupervisor {
  private readonly substrate: BroccoliTerminalCleanerSubstrate;
  private readonly engine: DeterministicTerminalCleanerEngine;

  constructor(substrate: BroccoliTerminalCleanerSubstrate, engine: DeterministicTerminalCleanerEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<TerminalCleanerConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): TerminalCleanerConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): TerminalCleanerMetrics {
    return this.substrate.getMetrics();
  }

  /**
   * Strips ANSI escape sequences from text (e.g. before returning tool output to LLM).
   */
  public stripAnsi(text: string): string {
    const config = this.substrate.getConfig();
    if (!config.enabled || !config.stripAnsiSequences) {
      return text;
    }

    const res = this.engine.stripAnsi(text);
    this.substrate.recordClean({
      ansiStrippedCount: res.wasModified ? 1 : 0,
      fastPath: res.fastPath,
    });
    return res.cleaned;
  }

  /**
   * Sanitizes untrusted text for safe terminal display, eliminating control bytes and \r spoofing.
   */
  public sanitizeDisplayText(text: string): string {
    const config = this.substrate.getConfig();
    if (!config.enabled) {
      return text;
    }

    const res = this.engine.sanitizeDisplayText(text);
    this.substrate.recordClean({
      controlFilteredCount: res.wasModified ? 1 : 0,
      fastPath: res.fastPath,
    });
    return res.cleaned;
  }

  /**
   * Classifies a path as text, binary, opaque_document, or pdf.
   */
  public classifyPath(filePath: string): BinaryAssetClassification {
    return this.engine.classifyPath(filePath);
  }

  /**
   * Checks whether a path can safely receive a plain-text write/patch.
   */
  public canWriteAsText(filePath: string): { allowed: boolean; reason?: string } {
    const config = this.substrate.getConfig();
    const result = this.engine.canWriteAsText(filePath, config);
    if (!result.allowed) {
      this.substrate.recordBlockedOpaqueWrite();
    }
    return result;
  }
}
