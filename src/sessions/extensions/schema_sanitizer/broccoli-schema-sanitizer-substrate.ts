/**
 * broccoli-schema-sanitizer-substrate.ts
 *
 * In-memory Broccolidb repository for caching tool parameter schema transformation rules,
 * key mapping dictionaries, and sanitization metrics (Phase 139 / ADR-115 / Target #72).
 */

import type {
  SchemaSanitizerConfig,
  SchemaSanitizerMetrics,
  SchemaSanitizerWorkspaceSnapshot,
} from "../../../core/contracts/schema-sanitizer.contracts.js";
import { DEFAULT_SCHEMA_SANITIZER_CONFIG } from "../../../core/contracts/schema-sanitizer.contracts.js";

export class BroccoliSchemaSanitizerSubstrate {
  private config: SchemaSanitizerConfig = { ...DEFAULT_SCHEMA_SANITIZER_CONFIG };
  private metrics: SchemaSanitizerMetrics = {
    totalSchemasSanitized: 0,
    invalidPropertyKeysRenamed: 0,
    nullableUnionsCollapsed: 0,
    refSiblingsStripped: 0,
    topLevelCombinatorsCleaned: 0,
    argumentsUnrenamed: 0,
  };

  public setConfig(config: Partial<SchemaSanitizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): SchemaSanitizerConfig {
    return { ...this.config };
  }

  public recordSchemaSanitized(
    invalidKeysCount: number,
    nullableUnionsCount: number,
    refSiblingsCount: number,
    topLevelCombinatorsCount: number
  ): void {
    this.metrics.totalSchemasSanitized++;
    this.metrics.invalidPropertyKeysRenamed += invalidKeysCount;
    this.metrics.nullableUnionsCollapsed += nullableUnionsCount;
    this.metrics.refSiblingsStripped += refSiblingsCount;
    this.metrics.topLevelCombinatorsCleaned += topLevelCombinatorsCount;
  }

  public recordArgumentUnrenamed(): void {
    this.metrics.argumentsUnrenamed++;
  }

  public getMetrics(): SchemaSanitizerMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SchemaSanitizerWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: SchemaSanitizerWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = { ...snapshot.metrics };
  }

  public clear(): void {
    this.config = { ...DEFAULT_SCHEMA_SANITIZER_CONFIG };
    this.metrics = {
      totalSchemasSanitized: 0,
      invalidPropertyKeysRenamed: 0,
      nullableUnionsCollapsed: 0,
      refSiblingsStripped: 0,
      topLevelCombinatorsCleaned: 0,
      argumentsUnrenamed: 0,
    };
  }
}
