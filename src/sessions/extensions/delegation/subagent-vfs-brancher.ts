import type { ISubagentVfsBrancher } from "../../../core/contracts/delegation.contracts.js"
import { SessionVfs, type VfsFileOverlay } from "../vfs/session-vfs.js"

/**
 * SubagentVfsBrancher.
 * Absorbed under ADR-015 (AKD-DSO Osmosis Paradigm).
 *
 * Coordinates in-memory copy-on-write virtual file overlays for subagents,
 * allowing isolated mutations without mutating the parent session's VFS until committed.
 */
export class SubagentVfsBrancher implements ISubagentVfsBrancher {
	private readonly overlays = new Map<
		string,
		{ parentSessionId: string; vfs: SessionVfs; baseline: Map<string, VfsFileOverlay> }
	>()
	private readonly parentVfsStore = new Map<string, SessionVfs>()

	registerParentVfs(sessionId: string, vfs: SessionVfs): void {
		this.parentVfsStore.set(sessionId, vfs)
	}

	createBranchOverlay(parentSessionId: string, subagentSessionId: string): void {
		const parentVfs = this.parentVfsStore.get(parentSessionId)
		const branchVfs = new SessionVfs()
		const baseline = new Map<string, VfsFileOverlay>()

		if (parentVfs) {
			// Clone staged files to subagent overlay
			for (const overlay of parentVfs.exportStaged()) {
				baseline.set(overlay.path, { ...overlay })
				if (!overlay.isDeleted) {
					branchVfs.stageWrite(overlay.path, overlay.content, overlay.diskBaseline)
				} else {
					branchVfs.stageDelete(overlay.path, overlay.diskBaseline)
				}
			}
		}

		this.overlays.set(subagentSessionId, {
			parentSessionId,
			vfs: branchVfs,
			baseline,
		})
	}

	getSubagentVfs(subagentSessionId: string): SessionVfs | undefined {
		return this.overlays.get(subagentSessionId)?.vfs
	}

	commitBranchOverlay(subagentSessionId: string): readonly string[] {
		const result = this.commitBranchOverlaySafely(subagentSessionId)
		return result.success ? result.committedFiles : Object.freeze([])
	}

	/** Merge only child changes and reject paths changed in the parent since branch creation. */
	commitBranchOverlaySafely(subagentSessionId: string): {
		success: boolean
		committedFiles: readonly string[]
		conflicts: readonly string[]
	} {
		const overlay = this.overlays.get(subagentSessionId)
		if (!overlay) {
			return { success: false, committedFiles: Object.freeze([]), conflicts: Object.freeze([]) }
		}

		const parentVfs = this.parentVfsStore.get(overlay.parentSessionId)
		if (!parentVfs) {
			return { success: false, committedFiles: Object.freeze([]), conflicts: Object.freeze([]) }
		}

		const currentParent = new Map(parentVfs.exportStaged().map((file) => [file.path, file]))
		const branchFiles = new Map(overlay.vfs.exportStaged().map((file) => [file.path, file]))
		const paths = new Set([...overlay.baseline.keys(), ...branchFiles.keys()])
		const changedFiles: VfsFileOverlay[] = []
		const conflicts: string[] = []
		for (const filePath of paths) {
			const before = overlay.baseline.get(filePath)
			const child = branchFiles.get(filePath)
			if (this.sameContent(before, child)) continue

			const parentNow = currentParent.get(filePath)
			if (!this.sameContent(before, parentNow) && !this.sameContent(child, parentNow)) {
				conflicts.push(filePath)
				continue
			}
			if (child) changedFiles.push(child)
		}

		if (conflicts.length > 0) {
			return {
				success: false,
				committedFiles: Object.freeze([]),
				conflicts: Object.freeze(conflicts.sort()),
			}
		}

		const committedFiles: string[] = []
		for (const fileOverlay of changedFiles) {
			if (fileOverlay.isDeleted) parentVfs.stageDelete(fileOverlay.path, fileOverlay.diskBaseline)
			else parentVfs.stageWrite(fileOverlay.path, fileOverlay.content, fileOverlay.diskBaseline)
			committedFiles.push(fileOverlay.path)
		}

		this.overlays.delete(subagentSessionId)
		return { success: true, committedFiles: Object.freeze(committedFiles), conflicts: Object.freeze([]) }
	}

	private sameContent(a?: VfsFileOverlay, b?: VfsFileOverlay): boolean {
		if (!a || !b) return a === b
		return a.path === b.path && a.content === b.content && a.isDeleted === b.isDeleted
	}

	discardBranchOverlay(subagentSessionId: string): void {
		this.overlays.delete(subagentSessionId)
	}

	getActiveOverlayCount(): number {
		return this.overlays.size
	}
}
