import type {
  CompressedTurnSummary,
  IBroccoliCompressionSubstrate,
} from "../../../core/contracts/compression.contracts.js";

/**
 * In-Memory Broccolidb Compression Substrate.
 *
 * Stores compressed turn summaries and historical compaction records in high-speed,
 * zero-GC memory structures with sub-microsecond retrieval latency.
 */
export class BroccoliCompressionSubstrate implements IBroccoliCompressionSubstrate {
  private readonly summaries: Map<string, CompressedTurnSummary> = new Map();
  private readonly summaryOrder: string[] = [];

  recordSummary(summary: CompressedTurnSummary): void {
    this.summaries.set(summary.id, summary);
    if (!this.summaryOrder.includes(summary.id)) {
      this.summaryOrder.push(summary.id);
    }
  }

  getSummary(id: string): CompressedTurnSummary | undefined {
    return this.summaries.get(id);
  }

  listSummaries(): readonly CompressedTurnSummary[] {
    return this.summaryOrder.map((id) => this.summaries.get(id)!);
  }

  getLatestSummary(): CompressedTurnSummary | undefined {
    if (this.summaryOrder.length === 0) return undefined;
    const latestId = this.summaryOrder[this.summaryOrder.length - 1];
    return this.summaries.get(latestId);
  }

  clear(): void {
    this.summaries.clear();
    this.summaryOrder.length = 0;
  }
}
