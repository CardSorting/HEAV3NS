/**
 * spill-vault-supervisor.ts
 *
 * Master supervisor coordinating symlink-safe tool result spilling,
 * multi-tier turn budget enforcement, and session-isolated persistence tracking
 * (Phase 117 / ADR-093 / Target #50).
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BroccoliSpillVaultSubstrate } from "../../../sessions/extensions/spill_vault/broccoli-spill-vault-substrate.js";
import type { DeterministicSpillVault } from "./deterministic-spill-vault.js";
import type {
  PersistedResultDescriptor,
  SpillVaultMetrics,
  TurnBudgetConfig,
  TurnBudgetEnforcementResult,
} from "../../../core/contracts/spill-vault.contracts.js";

export class SpillVaultSupervisor {
  private readonly substrate: BroccoliSpillVaultSubstrate;
  private readonly vault: DeterministicSpillVault;
  private readonly defaultSpillDir: string;
  private config: TurnBudgetConfig;

  constructor(
    substrate: BroccoliSpillVaultSubstrate,
    vault: DeterministicSpillVault,
    spillDir?: string,
    config?: Partial<TurnBudgetConfig>
  ) {
    this.substrate = substrate;
    this.vault = vault;
    this.defaultSpillDir = spillDir ?? join(tmpdir(), "lumi_spill_vault");
    this.config = {
      maxResultChars: config?.maxResultChars ?? 10_000,
      maxTurnBudgetChars: config?.maxTurnBudgetChars ?? 100_000,
      previewHeadChars: config?.previewHeadChars ?? 500,
      previewTailChars: config?.previewTailChars ?? 500,
      enabled: config?.enabled ?? true,
    };
  }

  /**
   * Persist a tool result if oversized and record in substrate.
   */
  public persistResult(
    toolUseId: string,
    toolName: string,
    content: string,
    sessionId: string = "default_session"
  ): { inContextText: string; persisted?: PersistedResultDescriptor } {
    const outcome = this.vault.maybePersistResult(
      toolUseId,
      toolName,
      content,
      sessionId,
      this.defaultSpillDir,
      this.config
    );

    if (outcome.persisted) {
      this.substrate.registerPersistedResult(outcome.persisted);
    }

    return outcome;
  }

  /**
   * Enforce aggregate character budget across multiple tool results.
   */
  public enforceTurnBudget(
    results: readonly { id: string; toolName: string; text: string }[],
    sessionId: string = "default_session"
  ): {
    updatedResults: { id: string; toolName: string; text: string }[];
    outcome: TurnBudgetEnforcementResult;
  } {
    const res = this.vault.enforceTurnBudget(
      results,
      sessionId,
      this.defaultSpillDir,
      this.config
    );

    if (res.outcome.spilledCount > 0) {
      this.substrate.recordBudgetEnforcement();
      for (const p of res.outcome.persistedResults) {
        this.substrate.registerPersistedResult(p);
      }
    }

    return res;
  }

  /**
   * Spill oversized hook-injected context to disk.
   */
  public spillHook(
    contextText: string,
    sessionId: string = "default_session"
  ): { inPromptContext: string; isSpilled: boolean; filePath?: string } {
    return this.vault.spillHookContext(
      contextText,
      sessionId,
      this.defaultSpillDir,
      this.config
    );
  }

  /**
   * Read raw content from persisted result or file path.
   */
  public readPersistedContent(resultIdOrPath: string): string {
    const descriptor = this.substrate.getPersistedResult(resultIdOrPath);
    const targetPath = descriptor ? descriptor.filePath : resultIdOrPath;
    return this.vault.readPersistedFile(targetPath);
  }

  public listSessionResults(sessionId: string): readonly PersistedResultDescriptor[] {
    return this.substrate.listSessionResults(sessionId);
  }

  public listAllResults(): readonly PersistedResultDescriptor[] {
    return this.substrate.listAllResults();
  }

  public getMetrics(): SpillVaultMetrics {
    return this.substrate.getMetrics();
  }

  public setConfig(config: Partial<TurnBudgetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public clear(): void {
    this.substrate.clear();
  }
}
