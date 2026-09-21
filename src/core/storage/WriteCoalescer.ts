import { Logger } from "@/shared/services/Logger"

type PendingWrite = {
	dataSupplier?: () => string
	writeFn: (data?: string) => Promise<void>
	timer: NodeJS.Timeout
	debounceMs: number
	lastEnqueued: number
}

export interface WriteFlushOptions {
	/**
	 * Reject when the underlying write fails. Background flushes keep the
	 * historical best-effort behavior; lifecycle barriers should opt in so a
	 * caller never mistakes a failed write for durable state.
	 */
	throwOnError?: boolean
	/**
	 * Maximum number of quiescence passes for flushAll. A producer that keeps
	 * enqueueing writes must not hold extension shutdown indefinitely.
	 */
	maxDrainPasses?: number
}

function calculateFastHash(content: string): string {
	let hash = 0x811c9dc5
	for (let i = 0; i < content.length; i++) {
		hash ^= content.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return (hash >>> 0).toString(16)
}

/**
 * WriteCoalescer provides a high-performance, in-memory write-behind buffer.
 * Rapid consecutive write requests targeting the same file path (e.g. ui_messages.json,
 * api_conversation_history.json, task_metadata.json during streaming token output) are
 * merged in memory, hyper-compressed, content-deduplicated, and debounced to prevent SSD erosion.
 */
export class WriteCoalescer {
	private static instance: WriteCoalescer | null = null
	private static readonly DEFAULT_MAX_DRAIN_PASSES = 100
	private pendingWrites = new Map<string, PendingWrite>()
	private inFlightWrites = new Map<string, Promise<void>>()
	private lastWrittenHashes = new Map<string, string>()

	public static getInstance(): WriteCoalescer {
		if (!WriteCoalescer.instance) {
			WriteCoalescer.instance = new WriteCoalescer()
		}
		return WriteCoalescer.instance
	}

	/**
	 * Schedule a debounced write with payload content-hash deduplication.
	 * If the generated payload is identical to what was last written to disk, the write is cleanly skipped.
	 *
	 * @param filePath The absolute target file path
	 * @param dataSupplier Function returning the latest serialized content payload
	 * @param writeFn Async write function executing the disk write
	 * @param debounceMs Debounce window in ms (default 500ms)
	 * @param maxDelayMs Maximum delay before forcing a write flush (default 3000ms)
	 */
	public coalesceWriteWithPayload(
		filePath: string,
		dataSupplier: () => string,
		writeFn: (data: string) => Promise<void>,
		debounceMs = 500,
		maxDelayMs = 3000,
	): void {
		const existing = this.pendingWrites.get(filePath)
		const now = Date.now()

		// Pre-compute payload and hash upfront to release source object graphs immediately
		const payload = dataSupplier()
		const hash = calculateFastHash(payload)

		// If no pending write exists and content hash matches disk state, skip timer setup completely
		if (!existing && this.lastWrittenHashes.get(filePath) === hash) {
			return
		}

		if (existing) {
			clearTimeout(existing.timer)
			if (now - existing.lastEnqueued >= maxDelayMs) {
				this.pendingWrites.delete(filePath)
				this.enqueueWrite(filePath, () =>
					this.executeWriteWithPrecomputedPayload(filePath, payload, hash, writeFn),
				).catch((err) => {
					Logger.error(`[WriteCoalescer] Forced flush failed for ${filePath}:`, err)
				})
				return
			}
		}

		const lastEnqueued = existing ? existing.lastEnqueued : now
		const timer = setTimeout(() => {
			this.pendingWrites.delete(filePath)
			this.enqueueWrite(filePath, () => this.executeWriteWithPrecomputedPayload(filePath, payload, hash, writeFn)).catch(
				(err) => {
					Logger.error(`[WriteCoalescer] Debounced write failed for ${filePath}:`, err)
				},
			)
		}, debounceMs)

		this.pendingWrites.set(filePath, {
			dataSupplier: () => payload,
			writeFn: () => writeFn(payload),
			timer,
			debounceMs,
			lastEnqueued,
		})
	}

	/**
	 * Schedule a debounced write for a specific file path (legacy function wrapper).
	 */
	public coalesceWrite(filePath: string, writeFn: () => Promise<void>, debounceMs = 500, maxDelayMs = 3000): void {
		const existing = this.pendingWrites.get(filePath)
		const now = Date.now()

		if (existing) {
			clearTimeout(existing.timer)
			if (now - existing.lastEnqueued >= maxDelayMs) {
				this.pendingWrites.delete(filePath)
				void this.enqueueWrite(filePath, writeFn).catch((err) => {
					Logger.error(`[WriteCoalescer] Forced flush failed for ${filePath}:`, err)
				})
				return
			}
		}

		const lastEnqueued = existing ? existing.lastEnqueued : now
		const timer = setTimeout(() => {
			this.pendingWrites.delete(filePath)
			void this.enqueueWrite(filePath, writeFn).catch((err) => {
				Logger.error(`[WriteCoalescer] Debounced write failed for ${filePath}:`, err)
			})
		}, debounceMs)

		this.pendingWrites.set(filePath, {
			writeFn: () => writeFn(),
			timer,
			debounceMs,
			lastEnqueued,
		})
	}

	private readonly MAX_HASH_CACHE_SIZE = 500

	private recordWrittenHash(filePath: string, hash: string): void {
		this.lastWrittenHashes.delete(filePath)
		if (this.lastWrittenHashes.size >= this.MAX_HASH_CACHE_SIZE) {
			const oldestKey = this.lastWrittenHashes.keys().next().value
			if (oldestKey !== undefined) {
				this.lastWrittenHashes.delete(oldestKey)
			}
		}
		this.lastWrittenHashes.set(filePath, hash)
	}

	private async executeWriteWithPrecomputedPayload(
		filePath: string,
		payload: string,
		hash: string,
		writeFn: (data: string) => Promise<void>,
	): Promise<void> {
		if (this.lastWrittenHashes.get(filePath) === hash) {
			Logger.debug(`[WriteCoalescer] Content hash unchanged for ${filePath}; skipping redundant disk write.`)
			return
		}

		await writeFn(payload)
		this.recordWrittenHash(filePath, hash)
	}

	/**
	 * Serialize writes for each target file. A new payload can be queued while an
	 * older atomic write is still running; without this queue, the older write can
	 * finish last and overwrite the newer payload.
	 */
	private enqueueWrite(filePath: string, operation: () => Promise<void>): Promise<void> {
		const previous = this.inFlightWrites.get(filePath) ?? Promise.resolve()
		const current = previous.catch(() => undefined).then(operation)
		this.inFlightWrites.set(filePath, current)
		void current.then(
			() => {
				if (this.inFlightWrites.get(filePath) === current) {
					this.inFlightWrites.delete(filePath)
				}
			},
			() => {
				if (this.inFlightWrites.get(filePath) === current) {
					this.inFlightWrites.delete(filePath)
				}
			},
		)
		return current
	}

	/**
	 * Immediately flush any pending write for a specific file path.
	 */
	public async flush(filePath: string, options: WriteFlushOptions = {}): Promise<void> {
		const pending = this.pendingWrites.get(filePath)
		if (pending) {
			clearTimeout(pending.timer)
			this.pendingWrites.delete(filePath)
			try {
				if (pending.dataSupplier) {
					const payload = pending.dataSupplier()
					const hash = calculateFastHash(payload)
					await this.enqueueWrite(filePath, () =>
						this.executeWriteWithPrecomputedPayload(filePath, payload, hash, (data) => pending.writeFn(data)),
					)
				} else {
					await this.enqueueWrite(filePath, () => pending.writeFn())
				}
			} catch (err) {
				Logger.error(`[WriteCoalescer] Immediate flush failed for ${filePath}:`, err)
				if (options.throwOnError) {
					throw err
				}
			}
		} else {
			try {
				await this.inFlightWrites.get(filePath)
			} catch (err) {
				Logger.error(`[WriteCoalescer] Immediate flush failed for ${filePath}:`, err)
				if (options.throwOnError) {
					throw err
				}
			}
		}
	}

	/**
	 * Immediately flush all pending writes across all target files.
	 */
	public async flushAll(options: WriteFlushOptions = {}): Promise<void> {
		let firstFailure: { reason: unknown } | undefined
		const configuredMaxDrainPasses = options.maxDrainPasses ?? WriteCoalescer.DEFAULT_MAX_DRAIN_PASSES
		const maxDrainPasses = Number.isFinite(configuredMaxDrainPasses)
			? Math.max(1, Math.floor(configuredMaxDrainPasses))
			: WriteCoalescer.DEFAULT_MAX_DRAIN_PASSES
		let drainPasses = 0
		do {
			if (drainPasses >= maxDrainPasses) {
				const quiescenceError = new Error(
					`[WriteCoalescer] flushAll did not quiesce after ${maxDrainPasses} drain passes.`,
				)
				Logger.warn(quiescenceError.message)
				if (options.throwOnError && !firstFailure) {
					firstFailure = { reason: quiescenceError }
				}
				break
			}
			drainPasses++
			const filePaths = new Set([...this.pendingWrites.keys(), ...this.inFlightWrites.keys()])
			if (filePaths.size === 0) break

			const results = await Promise.allSettled(Array.from(filePaths, (filePath) => this.flush(filePath, options)))
			if (options.throwOnError && !firstFailure) {
				const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
				if (failure) firstFailure = { reason: failure.reason }
			}
		} while (this.pendingWrites.size > 0 || this.inFlightWrites.size > 0)

		if (firstFailure) {
			throw firstFailure.reason
		}
	}

	/**
	 * Check if a file path currently has a pending write queued.
	 */
	public hasPending(filePath: string): boolean {
		return this.pendingWrites.has(filePath)
	}

	/**
	 * Report whether a file still has work queued or executing. Storage adapters
	 * use this to requeue a failed write without racing an already-running
	 * atomic rename.
	 */
	public hasPendingOrInFlight(filePath: string): boolean {
		return this.pendingWrites.has(filePath) || this.inFlightWrites.has(filePath)
	}

	/**
	 * Forget the dedupe state for a file removed outside the coalescer. The next
	 * write must not be skipped merely because the deleted file had the same
	 * payload before it was removed.
	 */
	public invalidateHash(filePath: string): void {
		this.lastWrittenHashes.delete(filePath)
	}

	/**
	 * Explicitly purge cached content hashes to free internal memory.
	 */
	public purgeStaleHashes(): void {
		this.lastWrittenHashes.clear()
	}

	/**
	 * Dispose of all timers and clear maps for clean shutdown.
	 */
	public dispose(): void {
		for (const pending of this.pendingWrites.values()) {
			clearTimeout(pending.timer)
		}
		this.pendingWrites.clear()
		this.lastWrittenHashes.clear()
	}
}

export const writeCoalescer = WriteCoalescer.getInstance()
