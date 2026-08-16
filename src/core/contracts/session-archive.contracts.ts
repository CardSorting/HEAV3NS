/**
 * session-archive.contracts.ts
 *
 * Core contracts for Multi-Format Session Export, Archive Packaging,
 * and Backup Storage (Phase 99 / ADR-053).
 */

export type SessionExportFormat = "markdown" | "html" | "jsonl" | "binary_archive";

export interface ExportedTurnItem {
  readonly role: string;
  readonly content: string;
  readonly toolCalls?: readonly Record<string, unknown>[];
  readonly reasoning?: string;
  readonly timestamp?: number;
}

export interface SessionArchiveManifest {
  readonly archiveId: string;
  readonly sessionId: string;
  readonly format: SessionExportFormat;
  readonly turnCount: number;
  readonly totalSizeBytes: number;
  readonly sha256Checksum: string;
  readonly createdAt: number;
}

export interface ExportOptions {
  readonly sanitizeHtml?: boolean;
  readonly includeReasoning?: boolean;
  readonly includeToolCalls?: boolean;
  readonly title?: string;
}

export interface ExportedDocumentResult {
  readonly archiveId: string;
  readonly format: SessionExportFormat;
  readonly content: string | Uint8Array;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly mimeType: string;
}

export interface ArchiveWorkspaceSnapshot {
  readonly totalArchives: number;
  readonly activeManifests: readonly SessionArchiveManifest[];
  readonly timestamp: number;
}
