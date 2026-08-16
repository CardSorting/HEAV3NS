/**
 * clarify-inquiry-supervisor.ts
 *
 * Master Clarification Supervisor managing interactive multi-choice inquiries,
 * user disambiguation bridges, and resolution telemetry (Phase 85 / ADR-037).
 */

import type {
  ClarifyInquiry,
  ClarifyInputMode,
  ClarifyResolution,
  ClarifyWorkspaceSnapshot,
} from "../../../core/contracts/clarify.contracts.js";
import { DeterministicClarifyEngine } from "../../../tooling/extensions/clarify/deterministic-clarify-engine.js";
import { BroccoliClarifySubstrate } from "../../../sessions/extensions/clarify/broccoli-clarify-substrate.js";

export class ClarifyInquirySupervisor {
  private engine: DeterministicClarifyEngine;
  private substrate: BroccoliClarifySubstrate;
  private currentFrame: number;

  constructor(engine: DeterministicClarifyEngine, substrate: BroccoliClarifySubstrate) {
    this.engine = engine;
    this.substrate = substrate;
    this.currentFrame = 1;
  }

  /**
   * Sets current frame index for telemetry records.
   */
  setFrameIndex(frame: number): void {
    this.currentFrame = frame;
  }

  /**
   * Prompts the user with a structured clarifying question and resolves the selection.
   */
  async askQuestion(
    question: string,
    choices: readonly (string | Record<string, unknown>)[],
    mode: ClarifyInputMode = "single_select",
    timeoutMs?: number
  ): Promise<ClarifyResolution> {
    const inquiryId = `clarify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inquiry = this.engine.createInquiry(
      inquiryId,
      question,
      choices,
      mode,
      timeoutMs,
      this.currentFrame
    );

    this.substrate.recordInquiry(inquiry);
    const resolution = await this.engine.resolveInquiry(inquiry);
    this.substrate.recordResolution(resolution);

    return resolution;
  }

  /**
   * Retrieves an inquiry by ID.
   */
  getInquiry(id: string): ClarifyInquiry | undefined {
    return this.substrate.getInquiry(id);
  }

  /**
   * Retrieves a resolution by inquiry ID.
   */
  getResolution(inquiryId: string): ClarifyResolution | undefined {
    return this.substrate.getResolution(inquiryId);
  }

  /**
   * Returns workspace stats.
   */
  getStats(): ClarifyWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists historical inquiries.
   */
  listInquiries(limit: number = 20): readonly ClarifyInquiry[] {
    return this.substrate.listInquiries(limit);
  }
}
