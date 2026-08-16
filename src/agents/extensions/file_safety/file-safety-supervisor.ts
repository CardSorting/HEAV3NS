/**
 * file-safety-supervisor.ts
 *
 * Master supervisor coordinating path normalization, write mutation evaluation,
 * safe root policy enforcement, and audit metrics (Phase 126 / ADR-102 / Target #59).
 */

import type { BroccoliFileSafetySubstrate } from "../../../sessions/extensions/file_safety/broccoli-file-safety-substrate.js";
import type { DeterministicFileSafetyGuard } from "./deterministic-file-safety-guard.js";
import type {
  FileSafetyEvaluation,
  FileSafetyMetrics,
  FileSafetyPolicyConfig,
} from "../../../core/contracts/file-safety.contracts.js";

export class FileSafetySupervisor {
  private readonly substrate: BroccoliFileSafetySubstrate;
  private readonly guard: DeterministicFileSafetyGuard;

  constructor(
    substrate: BroccoliFileSafetySubstrate,
    guard: DeterministicFileSafetyGuard
  ) {
    this.substrate = substrate;
    this.guard = guard;
  }

  public configure(config: Partial<FileSafetyPolicyConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): FileSafetyPolicyConfig {
    return this.substrate.getConfig();
  }

  public addSafeRoot(rootPath: string): void {
    this.substrate.addSafeRoot(rootPath);
  }

  public addCustomDeniedPath(path: string): void {
    this.substrate.addCustomDeniedPath(path);
  }

  public addCustomDeniedPrefix(prefix: string): void {
    this.substrate.addCustomDeniedPrefix(prefix);
  }

  /**
   * Pre-flight evaluates if a target write path is safe, denied, or requires approval.
   */
  public checkWrite(targetPath: string, cwd = process.cwd()): FileSafetyEvaluation {
    const config = this.substrate.getConfig();
    const evaluation = this.guard.evaluateWrite(targetPath, config, cwd);

    const requiresApproval = evaluation.verdict === "approval_required";
    this.substrate.recordEvaluation(true, evaluation.allowed, requiresApproval);

    return evaluation;
  }

  /**
   * Evaluates if a target read path accesses a sensitive secret store.
   */
  public checkRead(targetPath: string, cwd = process.cwd()): FileSafetyEvaluation {
    const evaluation = this.guard.evaluateRead(targetPath, cwd);
    this.substrate.recordEvaluation(false, true, false);

    return evaluation;
  }

  public getMetrics(): FileSafetyMetrics {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
