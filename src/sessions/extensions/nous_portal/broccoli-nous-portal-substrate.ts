/**
 * In-Memory Broccolidb Substrate for Native Nous Portal Provider State & Account Ledgers
 * Reference: hermes-agent-main/agent/portal_tags.py, hermes_cli/nous_account.py
 * Subsystem: Target #73 / ADR-116
 */

import {
  DEFAULT_NOUS_INFERENCE_URL,
  DEFAULT_NOUS_PORTAL_URL,
} from "../../../core/contracts/nous-portal.contracts.js";
import type {
  NousPortalAccountInfo,
  NousPortalDeviceCodeSession,
  NousPortalModelSpec,
  NousPortalStateSnapshot,
} from "../../../core/contracts/nous-portal.contracts.js";

export class BroccoliNousPortalSubstrate {
  private accountInfo: NousPortalAccountInfo | null = null;
  private activeDeviceSession: NousPortalDeviceCodeSession | null = null;
  private readonly cachedModels: Map<string, NousPortalModelSpec> = new Map();
  private totalInvocations: number = 0;
  private totalTokensConsumed: number = 0;
  private totalEstimatedSpendUsd: number = 0;
  private lastFetchedAtMs: number = 0;
  private lastUpdatedMs: number = Date.now();

  constructor() {
    this.registerDefaultModels();
  }

  private registerDefaultModels(): void {
    const defaults: NousPortalModelSpec[] = [
      {
        id: "nous/hermes-3-llama-3.1-405b",
        name: "Hermes 3 Llama-3.1 405B (Flagship)",
        contextLength: 131_072,
        maxOutputTokens: 8_192,
        pricing: { promptPerMillion: 3.5, completionPerMillion: 7.0 },
        supportsVision: false,
        supportsReasoning: true,
        description: "Nous Research Flagship 405B Open Weights Model with Frontier Function Calling & Synthesis",
      },
      {
        id: "nous/hermes-3-llama-3.1-70b",
        name: "Hermes 3 Llama-3.1 70B",
        contextLength: 131_072,
        maxOutputTokens: 8_192,
        pricing: { promptPerMillion: 0.7, completionPerMillion: 1.4 },
        supportsVision: false,
        supportsReasoning: true,
        description: "High-Efficiency 70B General-Purpose Reasoning and Agentic Coding Engine",
      },
      {
        id: "nous/hermes-3-llama-3.1-8b",
        name: "Hermes 3 Llama-3.1 8B",
        contextLength: 131_072,
        maxOutputTokens: 4_096,
        pricing: { promptPerMillion: 0.15, completionPerMillion: 0.3 },
        supportsVision: false,
        supportsReasoning: true,
        description: "High-Velocity 8B Real-Time Autonomous Frame Tick Model",
      },
      {
        id: "nous/deephermes-3-llama-3-8b-preview",
        name: "DeepHermes 3 Llama-3 8B Preview",
        contextLength: 65_536,
        maxOutputTokens: 8_192,
        pricing: { promptPerMillion: 0.2, completionPerMillion: 0.5 },
        supportsVision: false,
        supportsReasoning: true,
        description: "Nous Research Deep Reasoning & Explicit Chain-of-Thought Scratchpad Engine",
      },
      {
        id: "nous/hermes-2-pro-llama-3-8b",
        name: "Hermes 2 Pro Llama-3 8B",
        contextLength: 32_768,
        maxOutputTokens: 4_096,
        pricing: { promptPerMillion: 0.1, completionPerMillion: 0.2 },
        supportsVision: false,
        supportsReasoning: false,
        description: "Specialized Structured JSON Schema & Tool Calling Model",
      },
    ];

    for (const model of defaults) {
      this.cachedModels.set(model.id, model);
    }
  }

  setAccountInfo(account: NousPortalAccountInfo | null): void {
    this.accountInfo = account ? { ...account } : null;
    this.lastUpdatedMs = Date.now();
  }

  getAccountInfo(): NousPortalAccountInfo {
    if (!this.accountInfo) {
      return {
        loggedIn: false,
        source: "none",
        fresh: true,
        portalBaseUrl: DEFAULT_NOUS_PORTAL_URL,
        inferenceBaseUrl: DEFAULT_NOUS_INFERENCE_URL,
        inferenceCredentialPresent: false,
        toolAccess: { enabled: false, coverage: {} },
      };
    }
    return { ...this.accountInfo };
  }

  setDeviceSession(session: NousPortalDeviceCodeSession | null): void {
    this.activeDeviceSession = session ? { ...session } : null;
    this.lastUpdatedMs = Date.now();
  }

  getDeviceSession(): NousPortalDeviceCodeSession | null {
    return this.activeDeviceSession ? { ...this.activeDeviceSession } : null;
  }

  getModels(): NousPortalModelSpec[] {
    return Array.from(this.cachedModels.values());
  }

  getModel(id: string): NousPortalModelSpec | undefined {
    return this.cachedModels.get(id);
  }

  setModels(models: NousPortalModelSpec[]): void {
    this.cachedModels.clear();
    for (const m of models) {
      this.cachedModels.set(m.id, m);
    }
    this.lastFetchedAtMs = Date.now();
    this.lastUpdatedMs = Date.now();
  }

  isModelsCacheFresh(ttlMs: number = 300_000): boolean {
    return this.lastFetchedAtMs > 0 && Date.now() - this.lastFetchedAtMs < ttlMs;
  }

  upsertModel(spec: NousPortalModelSpec): void {
    this.cachedModels.set(spec.id, spec);
    this.lastUpdatedMs = Date.now();
  }

  recordInvocation(tokensConsumed: number, estimatedCostUsd: number): void {
    this.totalInvocations += 1;
    this.totalTokensConsumed += tokensConsumed;
    this.totalEstimatedSpendUsd += estimatedCostUsd;
    this.lastUpdatedMs = Date.now();
  }

  getMetrics(): {
    totalInvocations: number;
    totalTokensConsumed: number;
    totalEstimatedSpendUsd: number;
    lastFetchedAtMs: number;
    lastUpdatedMs: number;
  } {
    return {
      totalInvocations: this.totalInvocations,
      totalTokensConsumed: this.totalTokensConsumed,
      totalEstimatedSpendUsd: Number(this.totalEstimatedSpendUsd.toFixed(6)),
      lastFetchedAtMs: this.lastFetchedAtMs,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  createStateSnapshot(): NousPortalStateSnapshot {
    return {
      version: 1,
      account: this.accountInfo ? { ...this.accountInfo } : null,
      activeDeviceSession: this.activeDeviceSession ? { ...this.activeDeviceSession } : null,
      cachedModels: Array.from(this.cachedModels.values()),
      totalInvocations: this.totalInvocations,
      totalTokensConsumed: this.totalTokensConsumed,
      totalEstimatedSpendUsd: this.totalEstimatedSpendUsd,
      lastFetchedAtMs: this.lastFetchedAtMs,
      lastUpdatedMs: this.lastUpdatedMs,
    };
  }

  restoreStateSnapshot(snapshot: NousPortalStateSnapshot): void {
    this.accountInfo = snapshot.account ? { ...snapshot.account } : null;
    this.activeDeviceSession = snapshot.activeDeviceSession ? { ...snapshot.activeDeviceSession } : null;
    this.cachedModels.clear();
    for (const m of snapshot.cachedModels) {
      this.cachedModels.set(m.id, m);
    }
    this.totalInvocations = snapshot.totalInvocations;
    this.totalTokensConsumed = snapshot.totalTokensConsumed;
    this.totalEstimatedSpendUsd = snapshot.totalEstimatedSpendUsd;
    this.lastFetchedAtMs = snapshot.lastFetchedAtMs || 0;
    this.lastUpdatedMs = snapshot.lastUpdatedMs;
  }

  clear(): void {
    this.accountInfo = null;
    this.activeDeviceSession = null;
    this.cachedModels.clear();
    this.registerDefaultModels();
    this.totalInvocations = 0;
    this.totalTokensConsumed = 0;
    this.totalEstimatedSpendUsd = 0;
    this.lastUpdatedMs = Date.now();
  }
}
