/**
 * tool-transaction-journal.ts
 *
 * Atomic Mutation Transaction Journal & One-Shot Inverse Rollback Engine.
 * Records file mutations (write, edit, delete, create, move) with exact inverse diffs/backups.
 * Enables instant one-shot turn rollbacks (/undo and model-facing rollback_last_mutation tool).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export type MutationType = "write" | "replace" | "delete" | "create_dir" | "move";

export interface MutationTransaction {
  readonly id: string;
  readonly turnId: string;
  readonly toolName: string;
  readonly mutationType: MutationType;
  readonly targetPath: string;
  readonly previousContent?: string;
  readonly newContent?: string;
  readonly createdNewFile?: boolean;
  readonly previousPath?: string;
  readonly timestamp: number;
}

export interface RollbackResult {
  readonly rolledBackCount: number;
  readonly restoredPaths: readonly string[];
  readonly errors: readonly string[];
}

export class ToolTransactionJournal {
  private transactions: MutationTransaction[] = [];
  private currentTurnId = "turn_0";

  /**
   * Sets the active turn identifier to group transactions by turn.
   */
  public setTurnId(turnId: string): void {
    this.currentTurnId = turnId;
  }

  /**
   * Gets the active turn identifier.
   */
  public getCurrentTurnId(): string {
    return this.currentTurnId;
  }

  /**
   * Records a file write or edit mutation before it is applied.
   */
  public async recordFileMutation(
    toolName: string,
    targetPath: string,
    newContent?: string
  ): Promise<string> {
    const id = `tx_${Math.random().toString(36).slice(2, 9)}`;
    const normalized = path.normalize(targetPath);

    let previousContent: string | undefined;
    let createdNewFile = true;

    try {
      previousContent = await fs.readFile(normalized, "utf-8");
      createdNewFile = false;
    } catch {
      // File didn't exist prior to mutation
      createdNewFile = true;
    }

    this.transactions.push({
      id,
      turnId: this.currentTurnId,
      toolName,
      mutationType: "write",
      targetPath: normalized,
      previousContent,
      newContent,
      createdNewFile,
      timestamp: Date.now(),
    });

    return id;
  }

  /**
   * Records a file deletion mutation before deleting.
   */
  public async recordFileDeletion(toolName: string, targetPath: string): Promise<string> {
    const id = `tx_${Math.random().toString(36).slice(2, 9)}`;
    const normalized = path.normalize(targetPath);

    let previousContent: string | undefined;
    try {
      previousContent = await fs.readFile(normalized, "utf-8");
    } catch {
      // ignore
    }

    this.transactions.push({
      id,
      turnId: this.currentTurnId,
      toolName,
      mutationType: "delete",
      targetPath: normalized,
      previousContent,
      createdNewFile: false,
      timestamp: Date.now(),
    });

    return id;
  }

  /**
   * Rolls back the most recent mutation transaction.
   */
  public async rollbackLast(): Promise<RollbackResult> {
    if (this.transactions.length === 0) {
      return { rolledBackCount: 0, restoredPaths: [], errors: ["No transactions in journal to rollback"] };
    }

    const lastTx = this.transactions.pop()!;
    const errors: string[] = [];
    const restoredPaths: string[] = [];

    try {
      if (lastTx.createdNewFile) {
        // If file was created, delete it
        await fs.rm(lastTx.targetPath, { force: true });
        restoredPaths.push(`[Deleted] ${lastTx.targetPath}`);
      } else if (lastTx.previousContent !== undefined) {
        // Restore prior content
        await fs.mkdir(path.dirname(lastTx.targetPath), { recursive: true });
        await fs.writeFile(lastTx.targetPath, lastTx.previousContent, "utf-8");
        restoredPaths.push(`[Restored] ${lastTx.targetPath}`);
      }
    } catch (err: unknown) {
      errors.push(`Failed to revert ${lastTx.targetPath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      rolledBackCount: 1,
      restoredPaths,
      errors,
    };
  }

  /**
   * Rolls back all mutations recorded in a specific turn or the current turn.
   */
  public async rollbackTurn(targetTurnId = this.currentTurnId): Promise<RollbackResult> {
    const turnTransactions = this.transactions.filter((tx) => tx.turnId === targetTurnId);
    if (turnTransactions.length === 0) {
      return { rolledBackCount: 0, restoredPaths: [], errors: [`No transactions found for turn '${targetTurnId}'`] };
    }

    const errors: string[] = [];
    const restoredPaths: string[] = [];

    // Revert in reverse chronological order
    for (let i = turnTransactions.length - 1; i >= 0; i--) {
      const tx = turnTransactions[i];
      try {
        if (tx.createdNewFile) {
          await fs.rm(tx.targetPath, { force: true });
          restoredPaths.push(`[Deleted newly created] ${tx.targetPath}`);
        } else if (tx.previousContent !== undefined) {
          await fs.mkdir(path.dirname(tx.targetPath), { recursive: true });
          await fs.writeFile(tx.targetPath, tx.previousContent, "utf-8");
          restoredPaths.push(`[Restored content] ${tx.targetPath}`);
        }
      } catch (err: unknown) {
        errors.push(`Failed to revert ${tx.targetPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Remove reverted transactions from journal
    this.transactions = this.transactions.filter((tx) => tx.turnId !== targetTurnId);

    return {
      rolledBackCount: turnTransactions.length,
      restoredPaths,
      errors,
    };
  }

  private checkpoints: Map<string, { label?: string; transactionCount: number; timestamp: number }> = new Map();

  /**
   * Creates a named checkpoint representing the current mutation state.
   */
  public createCheckpoint(label?: string): string {
    const id = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.checkpoints.set(id, {
      label,
      transactionCount: this.transactions.length,
      timestamp: Date.now(),
    });
    return id;
  }

  /**
   * Restores mutations back to the state at the given checkpoint ID.
   */
  public async restoreCheckpoint(checkpointId: string): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { rolledBackCount: 0, restoredPaths: [], errors: [`Checkpoint '${checkpointId}' does not exist.`] };
    }

    if (this.transactions.length <= checkpoint.transactionCount) {
      return { rolledBackCount: 0, restoredPaths: [], errors: [] };
    }

    const txToRevert = this.transactions.slice(checkpoint.transactionCount);
    const errors: string[] = [];
    const restoredPaths: string[] = [];

    // Revert in reverse order
    for (let i = txToRevert.length - 1; i >= 0; i--) {
      const tx = txToRevert[i];
      try {
        if (tx.createdNewFile) {
          await fs.rm(tx.targetPath, { force: true });
          restoredPaths.push(`[Deleted newly created] ${tx.targetPath}`);
        } else if (tx.previousContent !== undefined) {
          await fs.mkdir(path.dirname(tx.targetPath), { recursive: true });
          await fs.writeFile(tx.targetPath, tx.previousContent, "utf-8");
          restoredPaths.push(`[Restored content] ${tx.targetPath}`);
        }
      } catch (err: unknown) {
        errors.push(`Failed to revert ${tx.targetPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.transactions = this.transactions.slice(0, checkpoint.transactionCount);

    return {
      rolledBackCount: txToRevert.length,
      restoredPaths,
      errors,
    };
  }

  /**
   * Returns list of recorded transactions.
   */
  public getHistory(): readonly MutationTransaction[] {
    return [...this.transactions];
  }

  /**
   * Clears the transaction history.
   */
  public clear(): void {
    this.transactions = [];
    this.checkpoints.clear();
  }
}
