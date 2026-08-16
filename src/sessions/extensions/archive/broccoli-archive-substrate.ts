/**
 * broccoli-archive-substrate.ts
 *
 * In-memory Broccolidb repository for session export documents and archive manifests (Phase 99 / ADR-053).
 */

import type {
  ArchiveWorkspaceSnapshot,
  ExportedDocumentResult,
  SessionArchiveManifest,
} from "../../../core/contracts/session-archive.contracts.js";

export class BroccoliArchiveSubstrate {
  private documents: Map<string, ExportedDocumentResult>;
  private manifests: Map<string, SessionArchiveManifest>;

  constructor() {
    this.documents = new Map<string, ExportedDocumentResult>();
    this.manifests = new Map<string, SessionArchiveManifest>();
  }

  recordArchive(
    document: ExportedDocumentResult,
    sessionId: string,
    turnCount: number
  ): SessionArchiveManifest {
    const manifest: SessionArchiveManifest = {
      archiveId: document.archiveId,
      sessionId,
      format: document.format,
      turnCount,
      totalSizeBytes: document.sizeBytes,
      sha256Checksum: document.sha256Checksum,
      createdAt: Date.now(),
    };

    this.documents.set(document.archiveId, document);
    this.manifests.set(document.archiveId, manifest);
    return manifest;
  }

  getArchive(archiveId: string): ExportedDocumentResult | undefined {
    return this.documents.get(archiveId);
  }

  getManifest(archiveId: string): SessionArchiveManifest | undefined {
    return this.manifests.get(archiveId);
  }

  getManifestsForSession(sessionId: string): readonly SessionArchiveManifest[] {
    const res: SessionArchiveManifest[] = [];
    for (const manifest of this.manifests.values()) {
      if (manifest.sessionId === sessionId) {
        res.push(manifest);
      }
    }
    return res;
  }

  deleteArchive(archiveId: string): boolean {
    this.documents.delete(archiveId);
    return this.manifests.delete(archiveId);
  }

  getAllManifests(): readonly SessionArchiveManifest[] {
    return Array.from(this.manifests.values());
  }

  exportSnapshot(): ArchiveWorkspaceSnapshot {
    return {
      totalArchives: this.manifests.size,
      activeManifests: Array.from(this.manifests.values()),
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: ArchiveWorkspaceSnapshot): void {
    this.manifests.clear();
    for (let i = 0; i < snapshot.activeManifests.length; i++) {
      const manifest = snapshot.activeManifests[i];
      this.manifests.set(manifest.archiveId, manifest);
    }
  }

  clear(): void {
    this.documents.clear();
    this.manifests.clear();
  }
}
