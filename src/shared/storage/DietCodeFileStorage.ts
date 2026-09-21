import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import deepEqual from "fast-deep-equal"
import { writeCoalescer } from "../../core/storage/WriteCoalescer"
import { Logger } from "../services/Logger"
import { DietCodeSyncStorage } from "./DietCodeStorage"

export interface DietCodeFileStorageOptions {
	/**
	 * File permissions mode (e.g., 0o600 for owner read/write only).
	 * If not set, uses the system default.
	 */
	fileMode?: number
}

/**
 * Synchronous file-backed JSON storage.
 * Stores any JSON-serializable values with sync read and write.
 * Used for VSCode Memento compatibility and CLI environments.
 */
export class DietCodeFileStorage<T = unknown> extends DietCodeSyncStorage<T> {
	protected name: string
	private data: Record<string, T>
	private readonly fsPath: string
	private readonly fileMode?: number
	private changeVersion = 0
	private persistedVersion = 0

	constructor(filePath: string, name = "DietCodeFileStorage", options?: DietCodeFileStorageOptions) {
		super()
		this.fsPath = filePath
		this.name = name
		this.fileMode = options?.fileMode
		this.data = this.readFromDisk()
	}

	protected _get(key: string): T | undefined {
		return this.data[key]
	}

	public override set(key: string, value: T | undefined): void {
		try {
			this.setBatch({ [key]: value })
		} catch (error) {
			Logger.error(`[${this.name}] failed to set '${key}':`, error)
		}
	}

	protected _set(key: string, value: T | undefined): void {
		// Use setBatch for consistency - all writes go through one path
		this.setBatch({ [key]: value })
	}

	protected _delete(key: string): void {
		this.setBatch({ [key]: undefined })
	}

	/**
	 * Set multiple keys in a single write operation.
	 * More efficient than calling set() for each key individually,
	 * since it only writes to disk once.
	 */
	public setBatch(entries: Record<string, T | undefined>): Thenable<void> {
		const changedKeys: string[] = []
		for (const [key, value] of Object.entries(entries)) {
			if (value === undefined) {
				if (key in this.data) {
					delete this.data[key]
					changedKeys.push(key)
				}
			} else {
				if (!deepEqual(this.data[key], value)) {
					this.data[key] = value
					changedKeys.push(key)
				}
			}
		}
		if (changedKeys.length > 0) {
			this.changeVersion++
			this.writeToDisk()
			for (const key of changedKeys) {
				this.fireChange(key)
			}
		}
		return Promise.resolve()
	}

	/**
	 * Wait for this file's queued or in-flight write to reach disk.
	 * StateManager uses this for lifecycle boundaries such as reloads and worktree
	 * switches where returning before the write-behind queue drains can lose state.
	 */
	public async flush(): Promise<void> {
		// An earlier write may have failed after the in-memory value was updated.
		// Requeue that latest snapshot so a later lifecycle barrier can recover.
		if (this.changeVersion > this.persistedVersion && !writeCoalescer.hasPendingOrInFlight(this.fsPath)) {
			this.writeToDisk()
		}
		await writeCoalescer.flush(this.fsPath, { throwOnError: true })
		if (!writeCoalescer.hasPendingOrInFlight(this.fsPath)) {
			this.persistedVersion = this.changeVersion
		}
	}

	/**
	 * Reset the in-memory adapter after its backing file was deleted by an
	 * external lifecycle operation. Callers must drain queued writes first.
	 */
	public clearAfterExternalDeletion(): void {
		if (writeCoalescer.hasPendingOrInFlight(this.fsPath)) {
			throw new Error(`[${this.name}] cannot clear storage while a write is still queued or in flight`)
		}
		this.data = {}
		this.changeVersion++
		this.persistedVersion = this.changeVersion
		writeCoalescer.invalidateHash(this.fsPath)
	}

	protected _keys(): readonly string[] {
		return Object.keys(this.data)
	}

	private readFromDisk(): Record<string, T> {
		try {
			if (fs.existsSync(this.fsPath)) {
				const content = fs.readFileSync(this.fsPath, "utf-8")
				try {
					return JSON.parse(content)
				} catch (parseError) {
					Logger.error(`[${this.name}] failed to parse ${this.fsPath}, attempting restore from backup:`, parseError)
					const bakPath = `${this.fsPath}.bak`
					if (fs.existsSync(bakPath)) {
						const bakContent = fs.readFileSync(bakPath, "utf-8")
						return JSON.parse(bakContent)
					}
				}
			}
		} catch (error) {
			Logger.error(`[${this.name}] failed to read from ${this.fsPath}:`, error)
		}
		return {}
	}

	private writeToDisk(): void {
		const versionAtSchedule = this.changeVersion
		writeCoalescer.coalesceWriteWithPayload(
			this.fsPath,
			() => JSON.stringify(this.data),
			async (content) => {
				let tmpPath: string | undefined
				try {
					const dir = path.dirname(this.fsPath)
					await fs.promises.mkdir(dir, { recursive: true })
					tmpPath = `${this.fsPath}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`
					await fs.promises.writeFile(tmpPath, content, { encoding: "utf-8", mode: this.fileMode })
					await fs.promises.rename(tmpPath, this.fsPath)
					if (versionAtSchedule === this.changeVersion) {
						this.persistedVersion = versionAtSchedule
					}
				} catch (error) {
					Logger.error(`[${this.name}] failed to write to ${this.fsPath}:`, error)
					if (tmpPath) {
						try {
							await fs.promises.unlink(tmpPath)
						} catch (cleanupError) {
							Logger.warn(`[${this.name}] failed to clean up temporary write ${tmpPath}:`, cleanupError)
						}
					}
					throw error
				}
			},
			500,
		)
	}
}
