/**
 * clarify-inquiry-supervisor.ts
 *
 * Master Clarification Supervisor managing interactive multi-choice inquiries,
 * user disambiguation bridges, grill-me interviews, decision-tree traversals,
 * auto-resolution fallbacks, and SLA health audits (Phase 85 / ADR-037).
 */

import type {
  ClarifyAutoPolicy,
  ClarifyBulkMutationResult,
  ClarifyCategory,
  ClarifyChoice,
  ClarifyDecisionTree,
  ClarifyDslQueryFilter,
  ClarifyGroupBy,
  ClarifyGroupedLane,
  ClarifyHealthAuditReport,
  ClarifyInputMode,
  ClarifyInquiry,
  ClarifyMetricsReport,
  ClarifyPriority,
  ClarifyResolution,
  ClarifySortBy,
  ClarifySortDirection,
  ClarifyStatus,
  ClarifyWorkspaceSnapshot,
} from "../../../core/contracts/clarify.contracts.js";
import { DeterministicClarifyEngine } from "../../../tooling/extensions/clarify/deterministic-clarify-engine.js";
import { BroccoliClarifySubstrate } from "../../../sessions/extensions/clarify/broccoli-clarify-substrate.js";

export class ClarifyInquirySupervisor {
  private readonly engine: DeterministicClarifyEngine;
  private readonly substrate: BroccoliClarifySubstrate;
  private currentFrame: number;

  constructor(engine: DeterministicClarifyEngine, substrate: BroccoliClarifySubstrate) {
    this.engine = engine;
    this.substrate = substrate;
    this.currentFrame = 1;
  }

  public setFrameIndex(frame: number): void {
    this.currentFrame = frame;
  }

  /**
   * Prompts the user with a structured clarifying question and records it.
   */
  public askQuestion(
    question: string,
    choicesRaw?: readonly (string | Partial<ClarifyChoice>)[],
    mode: ClarifyInputMode = "single_select",
    timeoutMs?: number,
    options: {
      category?: ClarifyCategory;
      priority?: ClarifyPriority;
      autoPolicy?: ClarifyAutoPolicy;
      defaultChoiceId?: string;
      tags?: readonly string[];
      dependencies?: readonly string[];
      description?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): ClarifyInquiry {
    const inquiry = this.engine.createInquiry(
      question,
      undefined,
      choicesRaw,
      mode,
      timeoutMs,
      this.currentFrame,
      options
    );
    this.substrate.recordInquiry(inquiry);
    return inquiry;
  }

  /**
   * Resolves an inquiry with choice selections.
   */
  public resolveInquiry(
    inquiryId: string,
    selectedChoiceIds?: readonly string[],
    writeInResponse?: string,
    resolvedBy: "user" | "timeout" | "default" | "auto_policy" | "system" = "user",
    explanation?: string
  ): ClarifyResolution {
    const resolution = this.engine.resolveInquiry(
      inquiryId,
      selectedChoiceIds,
      writeInResponse,
      resolvedBy,
      explanation
    );
    this.substrate.recordResolution(resolution);
    return resolution;
  }

  /**
   * Evaluates and applies auto-resolution policy.
   */
  public autoResolve(inquiryId: string): ClarifyResolution | undefined {
    const resolution = this.engine.evaluateAutoPolicy(inquiryId);
    if (resolution) {
      this.substrate.recordResolution(resolution);
    }
    return resolution;
  }

  /**
   * Grill-Me interview session starter: creates an interactive multi-step decision tree.
   */
  public startGrillMeInterview(title: string, rootQuestion: string, rootChoices: readonly string[]): ClarifyDecisionTree {
    const rootInq = this.askQuestion(rootQuestion, rootChoices, "single_select", undefined, {
      category: "requirements",
      priority: "high",
      tags: ["grill-me", "interview"],
    });
    return this.substrate.createDecisionTree(title, rootInq.id);
  }

  public stepDecisionTree(treeId: string, inquiryId: string, selectedChoiceId: string): boolean {
    const ok = this.substrate.stepDecisionTree(treeId, inquiryId, selectedChoiceId);
    if (ok) {
      this.engine.stepDecisionTree(treeId, inquiryId, selectedChoiceId);
    }
    return ok;
  }

  public getDecisionTree(treeId: string): ClarifyDecisionTree | undefined {
    return this.substrate.getDecisionTree(treeId);
  }

  public listDecisionTrees(): readonly ClarifyDecisionTree[] {
    return this.substrate.listDecisionTrees();
  }

  // ---------------------------------------------------------------------------
  // Queries & Diagnostics
  // ---------------------------------------------------------------------------

  public getInquiry(id: string): ClarifyInquiry | undefined {
    return this.substrate.getInquiry(id);
  }

  public getResolution(inquiryId: string): ClarifyResolution | undefined {
    return this.substrate.getResolution(inquiryId);
  }

  public listInquiries(limit: number = 20): readonly ClarifyInquiry[] {
    return this.substrate.listInquiries(limit);
  }

  public listResolutions(limit: number = 20): readonly ClarifyResolution[] {
    return this.substrate.listResolutions(limit);
  }

  public updateInquiryStatus(id: string, status: ClarifyStatus): boolean {
    return this.substrate.updateInquiryStatus(id, status);
  }

  public auditHealth(): ClarifyHealthAuditReport {
    return this.substrate.auditClarifyHealth();
  }

  public getMetrics(): ClarifyMetricsReport {
    return this.substrate.getClarifyMetrics();
  }

  public getGroupedInquiries(groupBy?: ClarifyGroupBy, sortBy?: ClarifySortBy, direction?: ClarifySortDirection): readonly ClarifyGroupedLane[] {
    return this.substrate.getGroupedInquiries(groupBy, sortBy, direction);
  }

  public queryDsl(query: ClarifyDslQueryFilter | string): readonly ClarifyInquiry[] {
    return this.substrate.queryInquiriesDsl(query);
  }

  public bulkResolve(inquiryIds: readonly string[], defaultChoiceId?: string): ClarifyBulkMutationResult {
    return this.substrate.bulkResolveInquiries(inquiryIds, defaultChoiceId);
  }

  public bulkCancel(inquiryIds: readonly string[]): ClarifyBulkMutationResult {
    return this.substrate.bulkCancelInquiries(inquiryIds);
  }

  public getStats(): ClarifyWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getEngine(): DeterministicClarifyEngine {
    return this.engine;
  }

  public getSubstrate(): BroccoliClarifySubstrate {
    return this.substrate;
  }
}
