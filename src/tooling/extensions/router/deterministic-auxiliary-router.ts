/**
 * deterministic-auxiliary-router.ts
 *
 * Deterministic auxiliary client router with 100% dynamic user model selection,
 * user-configured fallback chains, and credit auto-failover (Phase 101 / ADR-055).
 *
 * All auxiliary models, providers, endpoints, and fallback chains are dynamically
 * chosen and registered by the user or active session. No static fallback models exist.
 */

import type {
  AuxiliaryDispatchAttempt,
  AuxiliaryProviderConfig,
  AuxiliaryRoutingRequest,
  AuxiliaryRoutingResult,
  AuxiliaryTaskType,
} from "../../../core/contracts/auxiliary-router.contracts.js";

export interface DynamicRouterOptions {
  readonly initialProviders?: readonly AuxiliaryProviderConfig[];
  readonly freeOnly?: boolean;
  readonly dynamicModelResolver?: (taskType: AuxiliaryTaskType, requiresVision?: boolean) => AuxiliaryProviderConfig | undefined;
}

export class DeterministicAuxiliaryRouter {
  private providers: Map<string, AuxiliaryProviderConfig>;
  private taskOverrides: Map<AuxiliaryTaskType, AuxiliaryProviderConfig>;
  private freeOnly: boolean;
  private dynamicModelResolver?: (taskType: AuxiliaryTaskType, requiresVision?: boolean) => AuxiliaryProviderConfig | undefined;

  constructor(options: DynamicRouterOptions = {}) {
    this.providers = new Map<string, AuxiliaryProviderConfig>();
    this.taskOverrides = new Map<AuxiliaryTaskType, AuxiliaryProviderConfig>();
    this.freeOnly = Boolean(options.freeOnly);
    this.dynamicModelResolver = options.dynamicModelResolver;

    if (options.initialProviders) {
      for (let i = 0; i < options.initialProviders.length; i++) {
        this.registerProvider(options.initialProviders[i]);
      }
    }
  }

  /**
   * Sets the active user session main provider and model dynamically.
   */
  setUserSessionModel(provider: string, model: string, supportsVision: boolean = true): void {
    this.registerProvider({
      provider,
      model,
      priority: 0,
      supportsVision,
    });
  }

  /**
   * Sets a dynamic custom model resolver function.
   */
  setDynamicModelResolver(
    resolver: (taskType: AuxiliaryTaskType, requiresVision?: boolean) => AuxiliaryProviderConfig | undefined
  ): void {
    this.dynamicModelResolver = resolver;
  }

  /**
   * Registers a user-specified auxiliary provider with arbitrary model and endpoint.
   */
  registerProvider(config: AuxiliaryProviderConfig): void {
    this.providers.set(config.provider, config);
  }

  /**
   * Removes a registered auxiliary provider.
   */
  removeProvider(provider: string): boolean {
    return this.providers.delete(provider);
  }

  /**
   * Sets a dynamic per-task provider and model override chosen by the user.
   */
  setTaskOverride(taskType: AuxiliaryTaskType, config: AuxiliaryProviderConfig): void {
    this.taskOverrides.set(taskType, config);
  }

  /**
   * Removes a task-level override.
   */
  removeTaskOverride(taskType: AuxiliaryTaskType): void {
    this.taskOverrides.delete(taskType);
  }

  setFreeOnly(enabled: boolean): void {
    this.freeOnly = enabled;
  }

  isFreeOnly(): boolean {
    return this.freeOnly;
  }

  getProviders(): readonly AuxiliaryProviderConfig[] {
    return Array.from(this.providers.values());
  }

  getTaskOverrides(): Record<string, AuxiliaryProviderConfig> {
    const obj: Record<string, AuxiliaryProviderConfig> = {};
    for (const [key, value] of this.taskOverrides.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Dynamically resolves the candidate providers based on user configurations and active task constraints.
   */
  resolveCandidates(
    taskType: AuxiliaryTaskType,
    requiresVision: boolean = false,
    customModelOverride?: string
  ): AuxiliaryProviderConfig[] {
    // 1. Check direct task override dynamically configured by user
    const override = this.taskOverrides.get(taskType);
    if (override) {
      if (customModelOverride) {
        return [{ ...override, model: customModelOverride }];
      }
      return [override];
    }

    // 2. Filter user-registered providers according to task constraints
    let candidates = Array.from(this.providers.values());

    if (requiresVision) {
      candidates = candidates.filter((c) => c.supportsVision);
    }

    if (this.freeOnly) {
      candidates = candidates.filter((c) => c.isFreeOnly || c.model.endsWith(":free"));
    }

    // Sort by priority ascending (lower number = higher priority)
    candidates.sort((a, b) => a.priority - b.priority);

    // 3. If no user providers registered, invoke dynamic model resolver if provided
    if (candidates.length === 0 && this.dynamicModelResolver) {
      const resolved = this.dynamicModelResolver(taskType, requiresVision);
      if (resolved) {
        candidates.push(resolved);
      }
    }

    // 4. Apply custom model override if provided by user in the request
    if (customModelOverride && candidates.length > 0) {
      candidates = candidates.map((c, idx) => (idx === 0 ? { ...c, model: customModelOverride } : c));
    }

    return candidates;
  }

  /**
   * Executes the routing and failover across the user-selected candidates.
   */
  async routeAndExecute(request: AuxiliaryRoutingRequest): Promise<AuxiliaryRoutingResult> {
    const candidates = this.resolveCandidates(
      request.taskType,
      request.requiresVision,
      request.customModelOverride
    );

    const attempts: AuxiliaryDispatchAttempt[] = [];

    if (candidates.length === 0) {
      return {
        success: false,
        taskType: request.taskType,
        selectedProvider: "none",
        selectedModel: "none",
        attempts,
        outputText: `Error: No auxiliary model configured for task '${request.taskType}'. Please select an auxiliary model dynamically using auxiliary_set_task_override or register a provider via auxiliary_configure_provider.`,
        tokensUsed: 0,
      };
    }

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const start = performance.now();

      // Check simulated quota or credit exhaustion (e.g. HTTP 402)
      if (candidate.simulatedQuotaRemaining !== undefined && candidate.simulatedQuotaRemaining <= 0) {
        const latency = performance.now() - start;
        attempts.push({
          provider: candidate.provider,
          model: candidate.model,
          status: "failed",
          error: "HTTP 402 Payment Required: Credit balance exhausted. Triggering automatic failover.",
          latencyMs: latency,
        });
        continue;
      }

      // Successful dispatch using dynamically selected user provider & model
      const latency = performance.now() - start;
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        status: "success",
        latencyMs: latency,
      });

      const simulatedTokens = Math.min(request.maxTokens || 256, Math.max(16, request.prompt.length / 4));
      if (candidate.simulatedQuotaRemaining !== undefined) {
        this.providers.set(candidate.provider, {
          ...candidate,
          simulatedQuotaRemaining: candidate.simulatedQuotaRemaining - simulatedTokens,
        });
      }

      return {
        success: true,
        taskType: request.taskType,
        selectedProvider: candidate.provider,
        selectedModel: candidate.model,
        attempts,
        outputText: `[Auxiliary ${request.taskType} via user-selected ${candidate.provider} (${candidate.model})]: Processed successfully.`,
        tokensUsed: Math.ceil(simulatedTokens),
      };
    }

    return {
      success: false,
      taskType: request.taskType,
      selectedProvider: candidates[0]?.provider || "none",
      selectedModel: candidates[0]?.model || "none",
      attempts,
      outputText: `Error: All ${attempts.length} user auxiliary fallback candidates failed during execution.`,
      tokensUsed: 0,
    };
  }
}
