import type { ISubagentVfsBrancher } from "../../../core/contracts/delegation.contracts.js";
import { SessionVfs } from "../vfs/session-vfs.js";

/**
 * SubagentVfsBrancher.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates in-memory copy-on-write virtual file overlays for subagents,
 * allowing isolated mutations without mutating the parent session's VFS until committed.
 */
export class SubagentVfsBrancher implements ISubagentVfsBrancher {
  private readonly overlays = new Map<string, { parentSessionId: string; vfs: SessionVfs }>();
  private readonly parentVfsStore = new Map<string, SessionVfs>();

  registerParentVfs(sessionId: string, vfs: SessionVfs): void {
    this.parentVfsStore.set(sessionId, vfs);
  }

  createBranchOverlay(parentSessionId: string, subagentSessionId: string): void {
    const parentVfs = this.parentVfsStore.get(parentSessionId);
    const branchVfs = new SessionVfs();

    if (parentVfs) {
      // Clone staged files to subagent overlay
      for (const overlay of parentVfs.exportStaged()) {
        if (!overlay.isDeleted) {
          branchVfs.stageWrite(overlay.path, overlay.content);
        } else {
          branchVfs.stageDelete(overlay.path);
        }
      }
    }

    this.overlays.set(subagentSessionId, {
      parentSessionId,
      vfs: branchVfs,
    });
  }

  getSubagentVfs(subagentSessionId: string): SessionVfs | undefined {
    return this.overlays.get(subagentSessionId)?.vfs;
  }

  commitBranchOverlay(subagentSessionId: string): readonly string[] {
    const overlay = this.overlays.get(subagentSessionId);
    if (!overlay) {
      return [];
    }

    const parentVfs = this.parentVfsStore.get(overlay.parentSessionId);
    const committedFiles: string[] = [];

    if (parentVfs) {
      for (const fileOverlay of overlay.vfs.exportStaged()) {
        if (!fileOverlay.isDeleted) {
          parentVfs.stageWrite(fileOverlay.path, fileOverlay.content);
        } else {
          parentVfs.stageDelete(fileOverlay.path);
        }
        committedFiles.push(fileOverlay.path);
      }
    }

    this.overlays.delete(subagentSessionId);
    return Object.freeze(committedFiles);
  }

  discardBranchOverlay(subagentSessionId: string): void {
    this.overlays.delete(subagentSessionId);
  }

  getActiveOverlayCount(): number {
    return this.overlays.size;
  }
}
