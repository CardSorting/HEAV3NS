export interface ModelTokenPricing {
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export interface AttributionRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: number;
}

export interface AttributionSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  recordsCount: number;
}

/**
 * Pass 91: Provider Attribution Composer
 * Ingests model provider token attribution & cost estimation concepts from `packages/coding-agent/src/core/provider-attribution.ts`.
 * Tracks token consumption per provider/model and calculates session execution cost summaries.
 */
export class ProviderAttributionComposer {
  private records: AttributionRecord[];
  private pricingTable: Map<string, ModelTokenPricing>;

  constructor() {
    this.records = [];
    this.pricingTable = new Map([
      ["claude-3-7-sonnet", { inputCostPer1k: 0.003, outputCostPer1k: 0.015 }],
      ["anthropic/claude-3.7-sonnet", { inputCostPer1k: 0.003, outputCostPer1k: 0.015 }],
      ["anthropic/claude-3.5-sonnet", { inputCostPer1k: 0.003, outputCostPer1k: 0.015 }],
      ["google/gemini-2.0-flash-001", { inputCostPer1k: 0.0001, outputCostPer1k: 0.0004 }],
      ["deepseek/deepseek-r1", { inputCostPer1k: 0.00055, outputCostPer1k: 0.00219 }],
      ["qwen/qwen-2.5-coder-32b-instruct", { inputCostPer1k: 0.00018, outputCostPer1k: 0.00036 }],
      ["moonshotai/kimi-k2", { inputCostPer1k: 0.001, outputCostPer1k: 0.003 }],
      ["gpt-4o", { inputCostPer1k: 0.0025, outputCostPer1k: 0.01 }],
      ["gemini-1.5-pro", { inputCostPer1k: 0.00125, outputCostPer1k: 0.005 }],
      ["default", { inputCostPer1k: 0.002, outputCostPer1k: 0.008 }],
    ]);
  }

  setPricing(model: string, pricing: ModelTokenPricing): void {
    this.pricingTable.set(model, pricing);
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.pricingTable.get(model) ?? this.pricingTable.get("default")!;
    const inputCost = (inputTokens / 1000) * pricing.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputCostPer1k;
    return Number((inputCost + outputCost).toFixed(6));
  }

  recordUsage(model: string, inputTokens: number, outputTokens: number): AttributionRecord {
    const estimatedCostUsd = this.calculateCost(model, inputTokens, outputTokens);
    const record: AttributionRecord = {
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      timestamp: Date.now(),
    };
    this.records.push(record);
    return record;
  }

  getAttributionSummary(): AttributionSummary {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;

    for (const rec of this.records) {
      totalInputTokens += rec.inputTokens;
      totalOutputTokens += rec.outputTokens;
      totalCostUsd += rec.estimatedCostUsd;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      recordsCount: this.records.length,
    };
  }
}
