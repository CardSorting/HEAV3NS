/**
 * acp-speculative-changeset-stager.ts
 *
 * Two-Phase Commit (2PC) Speculative Changeset Staging, Optimistic Concurrency Control (OCC),
 * and Atomic Rollback Substrate for the Agent Client Protocol (Phase 196 / ADR-134).
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  AcpRollbackToken,
  AcpSpeculativeTransaction,
  AcpStagedFile,
  IAcpPermissionGate,
  IAcpSpeculativeChangesetStager,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";
import { DeterministicAcpEngine } from "../../../tooling/extensions/acp/deterministic-acp-engine.js";

export class AcpSpeculativeChangesetStager implements IAcpSpeculativeChangesetStager {
  private readonly substrate?: IBroccoliAcpSubstrate;
  private readonly permissionGate?: IAcpPermissionGate;
  private readonly engine: DeterministicAcpEngine;
  private readonly transactions = new Map<string, AcpSpeculativeTransaction>();

  constructor(
    substrate?: IBroccoliAcpSubstrate,
    permissionGate?: IAcpPermissionGate,
    engine?: DeterministicAcpEngine
  ) {
    this.substrate = substrate;
    this.permissionGate = permissionGate;
    this.engine = engine || new DeterministicAcpEngine();
  }

  public static hashContent(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }

  public async prepareTransaction(
    sessionId: string,
    title: string,
    changes: readonly { filePath: string; modifiedContent: string; changeType?: "CREATE" | "MODIFY" | "DELETE" }[],
    description?: string
  ): Promise<{ success: boolean; transaction?: AcpSpeculativeTransaction; error?: string }> {
    if (!changes || changes.length === 0) {
      return { success: false, error: "Cannot prepare empty changeset transaction (-32602)" };
    }

    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stagedFiles: AcpStagedFile[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const change of changes) {
      const resolvedPath = path.isAbsolute(change.filePath) ? change.filePath : path.resolve(process.cwd(), change.filePath);
      let originalContent: string | undefined;
      let existedBefore = false;

      try {
        if (fs.existsSync(resolvedPath)) {
          originalContent = fs.readFileSync(resolvedPath, "utf8");
          existedBefore = true;
        }
      } catch {
        originalContent = undefined;
      }

      const inferredType = change.changeType || (!existedBefore ? "CREATE" : "MODIFY");
      const preImageHash = originalContent !== undefined ? AcpSpeculativeChangesetStager.hashContent(originalContent) : "0000000000000000000000000000000000000000000000000000000000000000";
      const postImageHash = AcpSpeculativeChangesetStager.hashContent(change.modifiedContent);

      const diff = this.engine.formatUnifiedDiff(originalContent || "", change.modifiedContent, change.filePath);
      totalAdditions += diff.additions;
      totalDeletions += diff.deletions;

      stagedFiles.push({
        filePath: change.filePath,
        changeType: inferredType,
        preImageHash,
        postImageHash,
        originalContent,
        stagedContent: change.modifiedContent,
        additionsCount: diff.additions,
        deletionsCount: diff.deletions,
      });
    }

    // Run Pre-Commit Adversarial Scrutiny
    let riskAssessment;
    if (this.permissionGate) {
      riskAssessment = await this.permissionGate.scrutinizeChangeset({
        changesetId: transactionId,
        sessionId,
        title,
        description,
        files: stagedFiles.map((f) => ({
          filePath: f.filePath,
          changeType: f.changeType,
          originalContent: f.originalContent,
          modifiedContent: f.stagedContent,
          additionsCount: f.additionsCount,
          deletionsCount: f.deletionsCount,
        })),
        totalAdditions,
        totalDeletions,
        status: "PENDING",
        createdAt: Date.now(),
      });
    }

    const tx: AcpSpeculativeTransaction = {
      transactionId,
      sessionId,
      title,
      description,
      status: "PREPARED",
      files: stagedFiles,
      totalAdditions,
      totalDeletions,
      riskAssessment,
      preparedAt: Date.now(),
    };

    this.transactions.set(transactionId, tx);
    return { success: true, transaction: tx };
  }

  public async commitTransaction(transactionId: string): Promise<{ success: boolean; rollbackToken?: AcpRollbackToken; error?: string }> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      return { success: false, error: `Transaction '${transactionId}' not found (-32602)` };
    }

    if (tx.status !== "PREPARED") {
      return { success: false, error: `Transaction '${transactionId}' is in state '${tx.status}', cannot commit` };
    }

    // Optimistic Concurrency Control (OCC) Pre-Check
    for (const file of tx.files) {
      const resolvedPath = path.isAbsolute(file.filePath) ? file.filePath : path.resolve(process.cwd(), file.filePath);
      if (file.originalContent !== undefined && fs.existsSync(resolvedPath)) {
        const currentDisk = fs.readFileSync(resolvedPath, "utf8");
        const currentHash = AcpSpeculativeChangesetStager.hashContent(currentDisk);
        if (currentHash !== file.preImageHash) {
          this.transactions.set(transactionId, { ...tx, status: "ABORTED" });
          return {
            success: false,
            error: `Optimistic concurrency conflict on '${file.filePath}': Disk content drifted since transaction preparation (-32000)`,
          };
        }
      }
    }

    // Two-Phase Commit Step 2: Apply writes atomically
    const rollbackEntries: { filePath: string; originalContent?: string; existedBefore: boolean }[] = [];

    for (const file of tx.files) {
      const resolvedPath = path.isAbsolute(file.filePath) ? file.filePath : path.resolve(process.cwd(), file.filePath);
      rollbackEntries.push({
        filePath: resolvedPath,
        originalContent: file.originalContent,
        existedBefore: file.originalContent !== undefined,
      });

      if (file.changeType === "DELETE") {
        if (fs.existsSync(resolvedPath)) {
          fs.unlinkSync(resolvedPath);
        }
      } else {
        const parentDir = path.dirname(resolvedPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedPath, file.stagedContent, "utf8");
      }
    }

    const rollbackToken: AcpRollbackToken = {
      transactionId,
      createdAt: Date.now(),
      touchedFiles: rollbackEntries,
    };

    const committedTx: AcpSpeculativeTransaction = {
      ...tx,
      status: "COMMITTED",
      rollbackToken,
      committedAt: Date.now(),
    };

    this.transactions.set(transactionId, committedTx);
    return { success: true, rollbackToken };
  }

  public async rollbackTransaction(rollbackToken: AcpRollbackToken): Promise<{ success: boolean; error?: string }> {
    if (!rollbackToken || !rollbackToken.touchedFiles) {
      return { success: false, error: "Invalid rollback token (-32602)" };
    }

    for (const entry of rollbackToken.touchedFiles) {
      if (entry.existedBefore && entry.originalContent !== undefined) {
        const parentDir = path.dirname(entry.filePath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(entry.filePath, entry.originalContent, "utf8");
      } else if (!entry.existedBefore && fs.existsSync(entry.filePath)) {
        fs.unlinkSync(entry.filePath);
      }
    }

    const tx = this.transactions.get(rollbackToken.transactionId);
    if (tx) {
      this.transactions.set(rollbackToken.transactionId, { ...tx, status: "ABORTED" });
    }

    return { success: true };
  }

  public abortTransaction(transactionId: string): boolean {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== "PREPARED") return false;
    this.transactions.set(transactionId, { ...tx, status: "ABORTED" });
    return true;
  }

  public getTransaction(transactionId: string): AcpSpeculativeTransaction | undefined {
    return this.transactions.get(transactionId);
  }

  public listTransactions(): readonly AcpSpeculativeTransaction[] {
    return Array.from(this.transactions.values());
  }
}
