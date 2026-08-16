/**
 * auxiliary-router-supervisor.ts
 *
 * Master supervisor coordinating dynamic auxiliary sub-task dispatching,
 * dynamic user model resolution, failover chains, and quota governance (Phase 101 / ADR-055).
 *
 * Zero hardcoded model names: completely governed by dynamic user configuration.
 */

import type {
  AuxiliaryProviderConfig,
  AuxiliaryRoutingRequest,
  AuxiliaryRoutingResult,
  AuxiliaryTaskType,
} from "../../../core/contracts/auxiliary-router.contracts.js";
import { DeterministicAuxiliaryRouter } from "../../../tooling/extensions/router/deterministic-auxiliary-router.js";
import { BroccoliAuxiliarySubstrate } from "../../../sessions/extensions/router/broccoli-auxiliary-substrate.js";

export class AuxiliaryRouterSupervisor {
  private router: DeterministicAuxiliaryRouter;
  private substrate: BroccoliAuxiliarySubstrate;

  constructor(
    router: DeterministicAuxiliaryRouter,
    substrate: BroccoliAuxiliarySubstrate
  ) {
    this.router = router;
    this.substrate = substrate;
  }

  /**
   * Sets the active user-chosen main session model and provider.
   */
  setUserSessionModel(provider: string, model: string, supportsVision: boolean = true): void {
    this.router.setUserSessionModel(provider, model, supportsVision);
    this.substrate.addProvider({
      provider,
      model,
      priority: 0,
      supportsVision,
    });
  }

  /**
   * Dynamically registers or updates a user-configured provider.
   */
  registerUserProvider(config: AuxiliaryProviderConfig): void {
    this.router.registerProvider(config);
    this.substrate.addProvider(config);
  }

  /**
   * Dynamically removes a registered provider.
   */
  removeUserProvider(provider: string): boolean {
    this.router.removeProvider(provider);
    return this.substrate.removeProvider(provider);
  }

  /**
   * Sets a dynamic per-task override for a specific auxiliary task type.
   */
  setTaskOverride(taskType: AuxiliaryTaskType, config: AuxiliaryProviderConfig): void {
    this.router.setTaskOverride(taskType, config);
    this.substrate.setOverride(taskType, config);
  }

  /**
   * Removes a dynamic task override.
   */
  removeTaskOverride(taskType: AuxiliaryTaskType): void {
    this.router.removeTaskOverride(taskType);
    this.substrate.removeOverride(taskType);
  }

  setFreeOnly(enabled: boolean): void {
    this.router.setFreeOnly(enabled);
    this.substrate.setFreeOnly(enabled);
  }

  isFreeOnly(): boolean {
    return this.router.isFreeOnly();
  }

  /**
   * Dispatches an auxiliary routing request using the dynamically selected candidate chain.
   */
  async dispatchAuxiliaryTask(request: AuxiliaryRoutingRequest): Promise<AuxiliaryRoutingResult> {
    return this.router.routeAndExecute(request);
  }

  /**
   * Retrieves the candidate provider chain for a given task type and constraints.
   */
  getRoutingCandidates(
    taskType: AuxiliaryTaskType,
    requiresVision: boolean = false,
    customModelOverride?: string
  ): AuxiliaryProviderConfig[] {
    return this.router.resolveCandidates(taskType, requiresVision, customModelOverride);
  }

  listRegisteredProviders(): readonly AuxiliaryProviderConfig[] {
    return this.router.getProviders();
  }

  listTaskOverrides(): Record<string, AuxiliaryProviderConfig> {
    return this.router.getTaskOverrides();
  }
}
