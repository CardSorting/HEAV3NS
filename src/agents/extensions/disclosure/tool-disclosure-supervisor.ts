/**
 * tool-disclosure-supervisor.ts
 *
 * Master Tool Disclosure Supervisor coordinating progressive tool disclosure,
 * dynamic tier evaluation, and deferred tool dispatching (Phase 91 / ADR-043).
 */

import type {
  DeferredToolDefinition,
  DisclosureManifest,
  ToolDisclosureWorkspaceSnapshot,
  ToolSearchResult,
} from "../../../core/contracts/tool-disclosure.contracts.js";
import { DeterministicToolDiscloser } from "../../../tooling/extensions/disclosure/deterministic-tool-discloser.js";
import { BroccoliDisclosureSubstrate } from "../../../sessions/extensions/disclosure/broccoli-disclosure-substrate.js";

export class ToolDisclosureSupervisor {
  private discloser: DeterministicToolDiscloser;
  private substrate: BroccoliDisclosureSubstrate;

  constructor(
    discloser: DeterministicToolDiscloser,
    substrate: BroccoliDisclosureSubstrate
  ) {
    this.discloser = discloser;
    this.substrate = substrate;
  }

  /**
   * Searches the deferred tool catalog.
   */
  searchTools(query: string, tag?: string, namespace?: string): ToolSearchResult {
    return this.discloser.search(query, tag, namespace);
  }

  /**
   * Describes a deferred tool in detail.
   */
  describeTool(name: string): DeferredToolDefinition | undefined {
    return this.discloser.getTool(name);
  }

  /**
   * Marks a deferred tool as activated in the session.
   */
  activateTool(name: string): boolean {
    const tool = this.discloser.getTool(name);
    if (!tool) {
      return false;
    }

    this.substrate.recordActivation(name);
    return true;
  }

  /**
   * Returns disclosure tier and active catalog manifest.
   */
  getManifest(tokenBudget: number = 2000): DisclosureManifest {
    const manifest = this.discloser.determineDisclosureTier(tokenBudget);
    this.substrate.setActiveTier(manifest.activeTier);
    return manifest;
  }

  /**
   * Returns current workspace snapshot.
   */
  getStats(): ToolDisclosureWorkspaceSnapshot {
    const all = this.discloser.listAll();
    let deferred = 0;
    for (let i = 0; i < all.length; i++) {
      if (!all[i].isCore) {
        deferred++;
      }
    }
    return this.substrate.exportSnapshot(all.length, deferred);
  }

  /**
   * Lists all activated tools in the session.
   */
  getActivatedTools(): readonly string[] {
    return this.substrate.getActivatedTools();
  }
}
