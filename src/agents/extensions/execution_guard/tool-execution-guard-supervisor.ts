/**
 * tool-execution-guard-supervisor.ts
 *
 * Master supervisor coordinating tool batch segmentation, parallelism scheduling,
 * and loop guardrail policies (Phase 94 / ADR-046 / Target #85).
 */

import type {
  LoopGuardrailDecision,
  ToolCallItem,
  ToolExecutionBatchSegment,
  ToolExecutionGuardBulkMutationResult,
  ToolExecutionGuardConfig,
  ToolExecutionGuardDslQueryFilter,
  ToolExecutionGuardGroupBy,
  ToolExecutionGuardGroupedLane,
  ToolExecutionGuardHealthAuditReport,
  ToolExecutionGuardMetrics,
  ToolExecutionGuardMetricsReport,
  ToolExecutionGuardSortBy,
  ToolExecutionGuardSortDirection,
  ToolExecutionSegmentRow,
  ToolExecutionWorkspaceSnapshot,
  ToolLoopViolationRecord,
  ToolLoopViolationRow,
} from "../../../core/contracts/tool-execution-segment.contracts.js";
import { DeterministicToolSegmenter } from "../../../tooling/extensions/execution_guard/deterministic-tool-segmenter.js";
import { BroccoliExecutionGuardSubstrate } from "../../../sessions/extensions/execution_guard/broccoli-execution-guard-substrate.js";
import { ExecutionGuardSnapshotManager } from "../../../sessions/extensions/execution_guard/execution-guard-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class ToolExecutionGuardSupervisor {
  private segmenter: DeterministicToolSegmenter;
  private substrate: BroccoliExecutionGuardSubstrate;
  private snapshotManager: ExecutionGuardSnapshotManager;

  constructor(
    segmenter: DeterministicToolSegmenter,
    substrate: BroccoliExecutionGuardSubstrate,
    snapshotManager?: ExecutionGuardSnapshotManager
  ) {
    this.segmenter = segmenter;
    this.substrate = substrate;
    this.snapshotManager = snapshotManager ?? new ExecutionGuardSnapshotManager(substrate);
  }

  /**
   * Plans batch segments for a series of requested tool calls.
   */
  public planSegments(toolCalls: readonly ToolCallItem[]): readonly ToolExecutionBatchSegment[] {
    const segments = this.segmenter.planBatchSegments(toolCalls);
    this.substrate.setLatestSegments(segments);
    return segments;
  }

  /**
   * Evaluates if a tool invocation triggers a loop guardrail.
   */
  public checkLoopGuardrail(
    frameIndex: number,
    toolName: string,
    parameters: Record<string, unknown>
  ): LoopGuardrailDecision {
    const decision = this.segmenter.evaluateLoopGuardrail(toolName, parameters);

    if (decision.action !== "allow") {
      const record: ToolLoopViolationRecord = {
        frameIndex,
        toolName,
        argsHash: decision.duplicateCallHash ?? "",
        repetitionCount: decision.repetitionCount,
        actionTaken: decision.action,
        timestamp: Date.now(),
      };
      this.substrate.recordViolation(record);
    }

    return decision;
  }

  /**
   * Retrieves all loop violation records.
   */
  public getViolations(): readonly ToolLoopViolationRecord[] {
    return this.substrate.getViolations();
  }

  public getViolationRows(): readonly ToolLoopViolationRow[] {
    return this.substrate.getViolationRows();
  }

  public getViolation(id: string): ToolLoopViolationRow | undefined {
    return this.substrate.getViolation(id);
  }

  public removeViolation(id: string): boolean {
    return this.substrate.removeViolation(id);
  }

  /**
   * Retrieves the latest planned segments / plans.
   */
  public getLatestSegments(): readonly ToolExecutionBatchSegment[] {
    return this.substrate.getLatestSegments();
  }

  public getPlans(): readonly ToolExecutionBatchSegment[] {
    return this.substrate.getPlans();
  }

  public getPlanById(planId: string): ToolExecutionBatchSegment | ToolExecutionSegmentRow | undefined {
    return this.substrate.getPlanById(planId);
  }

  public getGroupedPlans(
    groupBy?: ToolExecutionGuardGroupBy | string,
    sortBy?: ToolExecutionGuardSortBy | string,
    direction?: ToolExecutionGuardSortDirection
  ): readonly ToolExecutionGuardGroupedLane[] {
    return this.substrate.getGroupedPlans(groupBy, sortBy, direction);
  }

  public queryPlansDsl(filter: ToolExecutionGuardDslQueryFilter | string): readonly ToolExecutionBatchSegment[] {
    return this.substrate.queryPlansDsl(filter);
  }

  public bulkPurgePlans(options?: { olderThanMs?: number } | readonly string[]): ToolExecutionGuardBulkMutationResult {
    return this.substrate.bulkPurgePlans(options);
  }

  /**
   * Taxonomy registration and dynamic classification
   */
  public registerIdempotentTool(toolName: string): void {
    this.segmenter.registerIdempotentTool(toolName);
  }

  public registerMutatingTool(toolName: string): void {
    this.segmenter.registerMutatingTool(toolName);
  }

  public isMutatingTool(toolName: string): boolean {
    return this.segmenter.isMutatingTool(toolName);
  }

  public isMutating(toolName: string): boolean {
    return this.isMutatingTool(toolName);
  }

  /**
   * Configuration management
   */
  public setConfig(config: Partial<ToolExecutionGuardConfig>): void {
    this.segmenter.setConfig(config);
    this.substrate.setConfig(config);
  }

  public updateConfig(config: Partial<ToolExecutionGuardConfig>): void {
    this.setConfig(config);
  }

  public getConfig(): ToolExecutionGuardConfig {
    return this.substrate.getConfig();
  }

  /**
   * SLA Health & Metrics Telemetry
   */
  public auditHealth(): ToolExecutionGuardHealthAuditReport {
    return this.substrate.auditHealth();
  }

  public getMetrics(): ToolExecutionGuardMetrics {
    return this.substrate.getMetrics();
  }

  public getMetricsReport(): ToolExecutionGuardMetricsReport {
    return this.substrate.getMetricsReport();
  }

  /**
   * Multi-Criteria Swimlanes
   */
  public getGroupedViolations(
    groupBy?: ToolExecutionGuardGroupBy,
    sortBy?: ToolExecutionGuardSortBy,
    direction?: ToolExecutionGuardSortDirection
  ): readonly ToolExecutionGuardGroupedLane[] {
    return this.substrate.getGroupedViolations(groupBy, sortBy, direction);
  }

  /**
   * Natural Query DSL Search
   */
  public queryViolationsDsl(query: ToolExecutionGuardDslQueryFilter | string): readonly ToolLoopViolationRow[] {
    return this.substrate.queryViolationsDsl(query);
  }

  /**
   * Atomic Bulk Mutations & Undo/Redo
   */
  public bulkPurgeViolations(target?: readonly string[] | { olderThanMs?: number }): ToolExecutionGuardBulkMutationResult {
    return this.substrate.bulkPurgeViolations(target);
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public getUndoStackDepth(): number {
    return this.substrate.getUndoStackDepth();
  }

  public getRedoStackDepth(): number {
    return this.substrate.getRedoStackDepth();
  }

  /**
   * Frame Snapshot Management
   */
  public createSnapshot(reason?: string): string {
    const frameIndex = Date.now();
    this.snapshotManager.captureFrame(frameIndex);
    return `snap-${frameIndex}`;
  }

  public restoreSnapshot(snapshotId: string | number): boolean {
    if (typeof snapshotId === "number") {
      return this.snapshotManager.rewindToFrame(snapshotId);
    }
    const match = snapshotId.match(/(\d+)/);
    const frame = match ? parseInt(match[1], 10) : 1;
    return this.snapshotManager.rewindToFrame(frame);
  }

  public listSnapshots(): Array<{ id: string; frameIndex: number; timestamp: number; violationsCount: number }> {
    return this.snapshotManager.listSnapshots();
  }

  /**
   * Terminal ANSI Dashboards and Cards
   */
  public renderDashboard(): string {
    return BroccoliViewRenderer.renderToolExecutionGuardDashboard(this.getMetrics());
  }

  public renderPlanCard(plan: unknown): string {
    if (plan && typeof plan === "object" && "segmentIndex" in plan) {
      const p = plan as { segmentIndex: number; mode: string; toolCalls: readonly { toolName: string }[]; isMutating: boolean };
      return BroccoliViewRenderer.renderToolExecutionSegmentCard({
        segmentIndex: p.segmentIndex,
        mode: p.mode,
        toolCalls: p.toolCalls,
        isMutating: p.isMutating,
      });
    }
    return BroccoliViewRenderer.renderToolExecutionSegmentCard({
      segmentIndex: 0,
      mode: "sequential",
      toolCalls: [],
      isMutating: false,
    });
  }

  public renderViolationCard(violation: unknown): string {
    if (violation && typeof violation === "object") {
      const v = violation as { toolName?: string; frameIndex?: number; repetitionCount?: number; actionTaken?: string };
      return BroccoliViewRenderer.renderToolExecutionViolationCard({
        toolName: v.toolName ?? "unknown",
        frameIndex: v.frameIndex ?? 0,
        repetitionCount: v.repetitionCount ?? 1,
        actionTaken: v.actionTaken ?? "warn",
      });
    }
    return BroccoliViewRenderer.renderToolExecutionViolationCard({
      toolName: "unknown",
      frameIndex: 0,
      repetitionCount: 1,
      actionTaken: "warn",
    });
  }

  /**
   * Multi-Format Exporters
   */
  public exportInteractiveHtmlView(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdownReport(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsvReport(): string {
    return this.substrate.exportCsvReport();
  }

  public exportPlansMarkdown(): string {
    return this.substrate.exportPlansMarkdown();
  }

  public exportPlansHtml(): string {
    return this.substrate.exportPlansHtml();
  }

  public exportPlansCsv(): string {
    return this.substrate.exportPlansCsv();
  }

  public exportViolationsMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportViolationsHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportViolationsCsv(): string {
    return this.substrate.exportCsvReport();
  }

  /**
   * Formatting Helpers
   */
  public formatSegment(segment: ToolExecutionBatchSegment): string {
    return this.segmenter.formatSegment(segment);
  }

  public formatLoopDecision(decision: LoopGuardrailDecision): string {
    return this.segmenter.formatLoopDecision(decision);
  }

  public formatViolationRecord(record: ToolLoopViolationRecord): string {
    return this.segmenter.formatViolationRecord(record);
  }

  public formatGuardMetrics(metrics: ToolExecutionGuardMetrics): string {
    return this.segmenter.formatGuardMetrics(metrics);
  }

  public getSubstrate(): BroccoliExecutionGuardSubstrate {
    return this.substrate;
  }

  public getSegmenter(): DeterministicToolSegmenter {
    return this.segmenter;
  }

  public getSnapshotManager(): ExecutionGuardSnapshotManager {
    return this.snapshotManager;
  }

  public clear(): void {
    this.segmenter.clear();
    this.substrate.clear();
    this.snapshotManager.clear();
  }
}
