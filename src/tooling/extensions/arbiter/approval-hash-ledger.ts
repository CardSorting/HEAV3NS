/**
 * approval-hash-ledger.ts
 *
 * SHA-256 cryptographic command canonicalizer and fast-lookup approval ledger.
 * Manages session-scoped and persistent allowlist grants with O(1) hash verification.
 */

import { createHash } from "node:crypto";

export class ApprovalHashLedger {
  private readonly sessionGrants = new Set<string>();
  private readonly persistentGrants = new Set<string>();

  /**
   * Computes a canonical SHA-256 hash of the normalized command or action target.
   */
  public computeHash(target: string): string {
    const normalized = target.trim().replace(/\s+/g, " ");
    return createHash("sha256").update(normalized, "utf-8").digest("hex");
  }

  /**
   * Grants session-level authorization for the given command hash.
   */
  public grantSessionAllow(hash: string): void {
    this.sessionGrants.add(hash);
  }

  /**
   * Grants persistent authorization for the given command hash across sessions.
   */
  public grantPersistentAllow(hash: string): void {
    this.persistentGrants.add(hash);
  }

  /**
   * Checks if a command hash has been authorized (session or persistent).
   */
  public isGranted(hash: string): boolean {
    return this.sessionGrants.has(hash) || this.persistentGrants.has(hash);
  }

  /**
   * Revokes authorization for a command hash.
   */
  public revokeGrant(hash: string): boolean {
    const s = this.sessionGrants.delete(hash);
    const p = this.persistentGrants.delete(hash);
    return s || p;
  }

  public getSessionGrants(): readonly string[] {
    return Array.from(this.sessionGrants);
  }

  public getPersistentGrants(): readonly string[] {
    return Array.from(this.persistentGrants);
  }

  public clearSessionGrants(): void {
    this.sessionGrants.clear();
  }

  public clearAll(): void {
    this.sessionGrants.clear();
    this.persistentGrants.clear();
  }
}
