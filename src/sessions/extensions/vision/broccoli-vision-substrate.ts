/**
 * broccoli-vision-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for multimodal media blobs,
 * inspection history, and generated image artifacts.
 */

import * as crypto from "node:crypto";
import type {
  ImageGenerationResult,
  VisionSessionState,
  VisionWorkspaceSnapshot,
  VisualInspectionResult,
} from "../../../core/contracts/vision.contracts.js";

export class BroccoliVisionSubstrate {
  private readonly sessions = new Map<string, VisionSessionState>();
  private readonly mediaBlobStore = new Map<string, Uint8Array>();
  private readonly maxInspectionsPerSession: number;

  constructor(maxInspectionsPerSession = 128) {
    this.maxInspectionsPerSession = maxInspectionsPerSession;
  }

  public getOrCreateSession(sessionId: string): VisionSessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        inspectedImages: [],
        generatedImages: [],
        lastUpdated: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  public recordInspection(sessionId: string, result: VisualInspectionResult): void {
    const session = this.getOrCreateSession(sessionId);
    const updated = [...session.inspectedImages, result];
    if (updated.length > this.maxInspectionsPerSession) {
      updated.shift();
    }

    this.sessions.set(sessionId, {
      ...session,
      inspectedImages: updated,
      lastUpdated: Date.now(),
    });
  }

  public recordGeneration(sessionId: string, result: ImageGenerationResult): void {
    const session = this.getOrCreateSession(sessionId);
    const updated = [...session.generatedImages, result];
    if (updated.length > this.maxInspectionsPerSession) {
      updated.shift();
    }

    this.sessions.set(sessionId, {
      ...session,
      generatedImages: updated,
      lastUpdated: Date.now(),
    });
  }

  public storeMediaBlob(data: Uint8Array): string {
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    if (!this.mediaBlobStore.has(hash)) {
      this.mediaBlobStore.set(hash, data);
    }
    return hash;
  }

  public getMediaBlob(hash: string): Uint8Array | undefined {
    return this.mediaBlobStore.get(hash);
  }

  public listInspections(sessionId: string): readonly VisualInspectionResult[] {
    const session = this.sessions.get(sessionId);
    return session ? session.inspectedImages : [];
  }

  public listGenerations(sessionId: string): readonly ImageGenerationResult[] {
    const session = this.sessions.get(sessionId);
    return session ? session.generatedImages : [];
  }

  public captureSnapshot(): VisionWorkspaceSnapshot {
    return {
      activeSessions: Array.from(this.sessions.values()).map((s) => ({
        ...s,
        inspectedImages: [...s.inspectedImages],
        generatedImages: [...s.generatedImages],
      })),
      totalInspections: Array.from(this.sessions.values()).reduce(
        (acc, s) => acc + s.inspectedImages.length,
        0
      ),
      totalGenerations: Array.from(this.sessions.values()).reduce(
        (acc, s) => acc + s.generatedImages.length,
        0
      ),
      timestamp: Date.now(),
    };
  }

  public restoreSnapshot(snapshot: VisionWorkspaceSnapshot): void {
    this.sessions.clear();
    for (const s of snapshot.activeSessions) {
      this.sessions.set(s.sessionId, {
        ...s,
        inspectedImages: [...s.inspectedImages],
        generatedImages: [...s.generatedImages],
      });
    }
  }

  public clear(): void {
    this.sessions.clear();
    this.mediaBlobStore.clear();
  }
}
