export interface ContextBudgetInfo {
  maxTokens: number;
  reservedOutputTokens: number;
  safetyMarginTokens: number;
  availableInputTokens: number;
  compactionTriggerTokens: number;
  targetInputTokens: number;
}

export interface ContextBudgetOptions {
  /** Authoritative model-catalog value. Falls back to name-based compatibility defaults. */
  contextWindowTokens?: number;
  safetyMarginTokens?: number;
  compactAtRatio?: number;
  targetRatio?: number;
}

/**
 * ContextBudgetCalculator.
 * Absorbed in Pass 58 (ADR-033 / ADR-012).
 *
 * Calculates available context window token budgets dynamically.
 */
export class ContextBudgetCalculator {
  private readonly defaultMaxTokens: number;

  constructor(defaultMaxTokens = 128000) {
    this.defaultMaxTokens = defaultMaxTokens;
  }

  calculateBudget(
    modelName: string,
    maxOutputTokens = 4096,
    options: ContextBudgetOptions = {}
  ): ContextBudgetInfo {
    const isLargeContext =
      modelName.includes("claude-3-5") ||
      modelName.includes("gpt-4o") ||
      modelName.includes("gpt-5") ||
      modelName.includes("terra") ||
      modelName.includes("codex");

    const fallbackMaxTokens = isLargeContext ? 900_000 : this.defaultMaxTokens;
    const requestedMaxTokens = options.contextWindowTokens ?? fallbackMaxTokens;
    const maxTokens = Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
      ? Math.max(1, Math.floor(requestedMaxTokens))
      : Math.max(1, Math.floor(fallbackMaxTokens));
    const reservedOutputTokens = Number.isFinite(maxOutputTokens)
      ? Math.min(maxTokens, Math.max(0, Math.floor(maxOutputTokens)))
      : Math.min(maxTokens, 4_096);
    const requestedSafetyMargin = options.safetyMarginTokens === undefined
      ? Math.max(512, Math.floor(maxTokens * 0.02))
      : Number.isFinite(options.safetyMarginTokens)
        ? Math.max(0, Math.floor(options.safetyMarginTokens))
        : Math.max(512, Math.floor(maxTokens * 0.02));
    const safetyMarginTokens = Math.min(
      Math.max(0, maxTokens - reservedOutputTokens),
      requestedSafetyMargin
    );
    const availableInputTokens = Math.max(0, maxTokens - reservedOutputTokens - safetyMarginTokens);
    const compactAtRatio = this.clampRatio(options.compactAtRatio ?? 0.85);
    const targetRatio = Math.min(compactAtRatio, this.clampRatio(options.targetRatio ?? 0.65));

    const compactionTriggerTokens = Math.floor(availableInputTokens * compactAtRatio);
    const targetInputTokens = Math.floor(availableInputTokens * targetRatio);

    return {
      maxTokens,
      reservedOutputTokens,
      safetyMarginTokens,
      availableInputTokens,
      compactionTriggerTokens,
      targetInputTokens,
    };
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) return 0.8;
    return Math.min(1, Math.max(0.1, value));
  }
}
