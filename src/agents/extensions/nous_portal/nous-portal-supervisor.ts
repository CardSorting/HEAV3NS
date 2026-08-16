/**
 * Supervisor for Native Nous Portal Provider Subsystem
 * Subsystem: Target #73 / ADR-116
 */

import type {
  NousPortalAccountInfo,
  NousPortalCompletionResponse,
  NousPortalDeviceCodeSession,
  NousPortalModelSpec,
  NousPortalRequestPayload,
  NousPortalTokenResponse,
} from "../../../core/contracts/nous-portal.contracts.js";
import { BroccoliNousPortalSubstrate } from "../../../sessions/extensions/nous_portal/broccoli-nous-portal-substrate.js";
import { DeterministicNousPortalEngine } from "./deterministic-nous-portal-engine.js";

export class NousPortalSupervisor {
  private readonly substrate: BroccoliNousPortalSubstrate;
  private readonly engine: DeterministicNousPortalEngine;

  constructor(
    substrate: BroccoliNousPortalSubstrate,
    engine: DeterministicNousPortalEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  getAccount(): NousPortalAccountInfo {
    return this.substrate.getAccountInfo();
  }

  setAccount(account: NousPortalAccountInfo | null): void {
    this.substrate.setAccountInfo(account);
  }

  startDeviceLogin(portalUrl?: string): NousPortalDeviceCodeSession {
    return this.engine.initiateDeviceLogin({ portalUrl });
  }

  completeDeviceLogin(
    deviceCode: string,
    options?: {
      userId?: string;
      email?: string;
      orgId?: string;
      plan?: string;
      creditsRemaining?: number;
    }
  ): { success: boolean; tokens?: NousPortalTokenResponse; account?: NousPortalAccountInfo; error?: string } {
    return this.engine.exchangeDeviceToken(deviceCode, options);
  }

  async invokeModel(payload: NousPortalRequestPayload): Promise<NousPortalCompletionResponse> {
    return this.engine.executeChatCompletion(payload);
  }

  listModels(): NousPortalModelSpec[] {
    return this.engine.getAvailableModels();
  }

  async fetchRemoteModels(options?: {
    inferenceBaseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
    forceFresh?: boolean;
    fetchFn?: (input: string | URL | any, init?: any) => Promise<Response>;
  }) {
    return this.engine.fetchDynamicModels(options);
  }

  checkToolPool(category: string): { eligible: boolean; reason: string } {
    return this.engine.checkToolPoolEntitlement(category);
  }

  getMetrics() {
    return this.substrate.getMetrics();
  }
}
