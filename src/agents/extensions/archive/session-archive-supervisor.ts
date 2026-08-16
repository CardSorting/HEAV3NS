/**
 * session-archive-supervisor.ts
 *
 * Master supervisor coordinating multi-format session export, encrypted backup packaging,
 * integrity verification, and storage lifecycle (Phase 99 / ADR-053).
 */

import type {
  ExportOptions,
  ExportedDocumentResult,
  ExportedTurnItem,
  SessionArchiveManifest,
  SessionExportFormat,
} from "../../../core/contracts/session-archive.contracts.js";
import { DeterministicSessionArchiver } from "../../../tooling/extensions/archive/deterministic-session-archiver.js";
import { BroccoliArchiveSubstrate } from "../../../sessions/extensions/archive/broccoli-archive-substrate.js";

export class SessionArchiveSupervisor {
  private archiver: DeterministicSessionArchiver;
  private substrate: BroccoliArchiveSubstrate;

  constructor(
    archiver: DeterministicSessionArchiver,
    substrate: BroccoliArchiveSubstrate
  ) {
    this.archiver = archiver;
    this.substrate = substrate;
  }

  /**
   * Exports session conversation turns in the requested format and records the resulting manifest.
   */
  exportSession(
    sessionId: string,
    turns: readonly ExportedTurnItem[],
    format: SessionExportFormat = "markdown",
    options: ExportOptions = {}
  ): ExportedDocumentResult {
    let result: ExportedDocumentResult;
    switch (format) {
      case "html":
        result = this.archiver.exportToHtml(sessionId, turns, options);
        break;
      case "jsonl":
        result = this.archiver.exportToJsonl(sessionId, turns);
        break;
      case "markdown":
      default:
        result = this.archiver.exportToMarkdown(sessionId, turns, options);
        break;
    }

    this.substrate.recordArchive(result, sessionId, turns.length);
    return result;
  }

  /**
   * Creates an in-memory binary backup archive packaging multiple virtual files.
   */
  createBackup(
    sessionId: string,
    files: ReadonlyMap<string, string | Uint8Array>
  ): ExportedDocumentResult {
    const result = this.archiver.exportToBinaryArchive(sessionId, files);
    this.substrate.recordArchive(result, sessionId, files.size);
    return result;
  }

  /**
   * Verifies the cryptographic SHA-256 integrity checksum of a stored archive.
   */
  verifyPackage(archiveId: string): boolean {
    const document = this.substrate.getArchive(archiveId);
    if (!document) {
      return false;
    }
    return this.archiver.verifyArchiveIntegrity(document);
  }

  /**
   * Retrieves all session archive manifests or manifests for a specific session.
   */
  getManifests(sessionId?: string): readonly SessionArchiveManifest[] {
    if (sessionId) {
      return this.substrate.getManifestsForSession(sessionId);
    }
    return this.substrate.getAllManifests();
  }

  /**
   * Retrieves an exported document by archive ID.
   */
  getArchiveDocument(archiveId: string): ExportedDocumentResult | undefined {
    return this.substrate.getArchive(archiveId);
  }
}
