/**
 * Cancellation must settle the parent wait even when a child ignores its signal.
 * The losing operation stays observed; callers must fence its late side effects.
 */
export async function awaitChildOperation<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
	signal.throwIfAborted()
	let onAbort: (() => void) | undefined
	const cancelled = new Promise<never>((_resolve, reject) => {
		onAbort = () => reject(signal.reason ?? new Error("Child operation cancelled."))
		signal.addEventListener("abort", onAbort, { once: true })
	})
	try {
		return await Promise.race([
			Promise.resolve().then(() => {
				signal.throwIfAborted()
				return operation()
			}),
			cancelled,
		])
	} finally {
		if (onAbort) signal.removeEventListener("abort", onAbort)
	}
}
