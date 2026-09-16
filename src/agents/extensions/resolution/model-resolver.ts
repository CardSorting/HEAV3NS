import { Logger } from "../../../shared/services/Logger.js";

export interface ModelResolutionMetrics {
  totalTurns: number;
  totalTokensEstimated: number;
  fallbackTriggeredCount: number;
}

export const KNOWN_CODEX_MODELS = [
  "gpt-5.6-terra",
] as const;

export class ModelResolver {
  private primaryModel: string;
  private readonly fallbackModels: readonly string[];
  private currentActiveModel: string;
  private fallbackCount = 0;
  private totalTurnsExecuted = 0;
  private estimatedTokensConsumed = 0;

  /**
   * Canonical model alias normalizer.
   * Maps common shorthand aliases (e.g. 'luna', 'terra', 'sol', '4o') to official model IDs.
   */
  static normalizeModelName(input: string): string {
    if (!input || typeof input !== "string") return "gpt-5.6-terra";
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();

    // Exact or partial alias mappings
    switch (lower) {
      case "galx":
      case "galx-sol":
      case "galx/gpt-5.6-sol":
      case "gpt-5.6-sol":
      case "galx-terra":
      case "galx/gpt-5.6-terra":
      case "gpt-5.6-terra":
      case "galx-luna":
      case "galx/gpt-5.6-luna":
      case "gpt-5.6-luna":
      case "terra":
      case "gpt-terra":
      case "5.6-terra":
      case "gpt5.6-terra":
      case "luna":
      case "gpt-luna":
      case "5.6-luna":
      case "gpt5.6-luna":
      case "sol":
      case "gpt-sol":
      case "5.6-sol":
      case "gpt5.6-sol":
      case "codex":
      case "openai-codex":
      case "codex-oauth":
      case "gpt":
      case "chatgpt":
      case "openai":
      case "5.6":
      case "flagship":
      case "reasoning":
        return "gpt-5.6-terra";
      case "4o":
      case "gpt4o":
      case "gpt-4":
        return "gpt-4o";
      case "claude":
      case "sonnet":
      case "claude-3.5":
      case "claude-3.5-sonnet":
        return "anthropic/claude-3.5-sonnet";
      case "haiku":
      case "claude-3.5-haiku":
        return "anthropic/claude-3.5-haiku";
      case "gemini":
      case "flash":
      case "gemini-2.0-flash-001":
        return "google/gemini-2.0-flash-001";
      case "deepseek":
      case "r1":
      case "deepseek-r1":
        return "deepseek/deepseek-r1";
      case "llama":
      case "llama3":
      case "llama3.2":
        return "llama3.2:latest";
      case "qwen":
      case "coder":
      case "qwen-coder":
        return "qwen2.5-coder:latest";
      default:
        return trimmed;
    }
  }

  constructor(
    primaryModel = "gpt-5.6-terra",
    fallbackModels: readonly string[] = ["gpt-5.6-terra"]
  ) {
    const normalizedPrimary = ModelResolver.normalizeModelName(primaryModel);
    this.primaryModel = normalizedPrimary;
    this.fallbackModels = fallbackModels.map((m) => ModelResolver.normalizeModelName(m));
    this.currentActiveModel = normalizedPrimary;
  }

  getActiveModel(): string {
    return this.currentActiveModel;
  }

  getPrimaryModel(): string {
    return this.primaryModel;
  }

  setActiveModel(modelName: string): string {
    const normalized = ModelResolver.normalizeModelName(modelName);
    this.currentActiveModel = normalized;
    return normalized;
  }

  switchToTerra(): string {
    return this.setActiveModel("gpt-5.6-terra");
  }

  switchToLuna(): string {
    return this.setActiveModel("gpt-5.6-terra");
  }

  switchToSol(): string {
    return this.setActiveModel("gpt-5.6-terra");
  }

  cycleCodexModel(): string {
    const codexList = [...KNOWN_CODEX_MODELS];
    const currentIndex = codexList.indexOf(this.currentActiveModel as any);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % codexList.length : 0;
    return this.setActiveModel(codexList[nextIndex]!);
  }

  getCodexModels(): readonly string[] {
    return KNOWN_CODEX_MODELS;
  }

  recordTurnExecution(promptLength: number, responseLength: number): void {
    this.totalTurnsExecuted += 1;
    this.estimatedTokensConsumed += Math.ceil((promptLength + responseLength) / 4);
  }

  triggerFallback(reason?: string): string {
    this.fallbackCount += 1;
    const nextIndex = (this.fallbackCount - 1) % this.fallbackModels.length;
    this.currentActiveModel = this.fallbackModels[nextIndex];
    if (reason) {
      Logger.warn(`[ModelResolver] Fallback triggered to '${this.currentActiveModel}': ${reason}`);
    }
    return this.currentActiveModel;
  }

  resetToPrimary(): void {
    this.currentActiveModel = this.primaryModel;
  }

  getMetrics(): ModelResolutionMetrics {
    return {
      totalTurns: this.totalTurnsExecuted,
      totalTokensEstimated: this.estimatedTokensConsumed,
      fallbackTriggeredCount: this.fallbackCount,
    };
  }
}

