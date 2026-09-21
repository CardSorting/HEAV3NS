/**
 * Reject when a host-managed or otherwise uninterruptible operation fails to
 * settle in time. The underlying operation may still complete later.
 */
export class TimeoutError extends Error {
	constructor(operationName: string, timeoutMs: number) {
		super(`${operationName} timed out after ${timeoutMs} ms`)
		this.name = "TimeoutError"
	}
}

export function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, operationName: string): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => reject(new TimeoutError(operationName, timeoutMs)), timeoutMs)
	})

	return Promise.race([Promise.resolve(operation), timeoutPromise]).finally(() => {
		if (timeout) clearTimeout(timeout)
	})
}
