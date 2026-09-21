import { DietCodeError, DietCodeErrorType } from "../../../../src/services/error/DietCodeError"

export interface RecoveryErrorInfo {
	message: string
	status?: number
	requestId?: string
	providerId?: string
	modelId?: string
	code?: string
	kind?: "auth" | "rateLimit"
}

export interface RecoveryCopy {
	title: string
	detail: string
}

const OPAQUE_PROVIDER_MESSAGE = /status code\s*\(no body\)|no response body|without an? (?:error )?body/i
const NETWORK_ERROR_MESSAGE = /network|fetch|connect|timed out|timeout|econn|socket|offline/i
const RATE_LIMIT_ERROR_MESSAGE = /rate limit|too many requests|quota exceeded|capacity constrained|temporarily (?:busy|saturated)/i

/**
 * Parse the compact serialized provider error without exposing raw payloads in
 * the primary timeline. The metadata is intentionally small and safe to show
 * in a support-oriented disclosure.
 */
export function parseRecoveryError(raw: string | undefined, parsed?: DietCodeError): RecoveryErrorInfo | undefined {
	if (!raw) return undefined

	const error = parsed ?? DietCodeError.parse(raw)
	if (!error) return undefined

	const details = error._error
	const kind = error.isErrorType(DietCodeErrorType.Auth)
		? "auth"
		: error.isErrorType(DietCodeErrorType.RateLimit)
			? "rateLimit"
			: undefined
	return {
		message: details?.message || error.message || raw,
		status: typeof details?.status === "number" ? details.status : undefined,
		requestId: details?.request_id,
		providerId: details?.providerId || error.providerId,
		modelId: details?.modelId || error.modelId,
		code: details?.code,
		kind,
	}
}

export function isOpaqueRecoveryError(error: RecoveryErrorInfo | undefined): boolean {
	return Boolean(error && (!error.message || OPAQUE_PROVIDER_MESSAGE.test(error.message)))
}

export function getRecoveryCopy(error: RecoveryErrorInfo | undefined): RecoveryCopy {
	if (error?.kind === "auth") {
		return {
			title: "The provider connection needs attention",
			detail: "Your sign-in or provider credentials were not accepted. Check the connection, then try again.",
		}
	}

	if (error?.kind === "rateLimit") {
		return {
			title: "The provider is busy",
			detail: "Too many requests are arriving right now. Wait a moment, then try again.",
		}
	}

	if (error?.status === 400 || isOpaqueRecoveryError(error)) {
		return {
			title: "The model request was rejected",
			detail: "The provider rejected the request before returning a response. Your current task is still available to retry.",
		}
	}

	if (error?.status === 401 || error?.status === 403) {
		return {
			title: "The provider connection needs attention",
			detail: "Your sign-in or provider credentials were not accepted. Check the connection, then try again.",
		}
	}

	if (error?.status === 429) {
		return {
			title: "The provider is busy",
			detail: "Too many requests are arriving right now. Wait a moment, then try again.",
		}
	}

	if (error && RATE_LIMIT_ERROR_MESSAGE.test(error.message)) {
		return {
			title: "The provider is busy",
			detail: "Too many requests are arriving right now. Wait a moment, then try again.",
		}
	}

	if (error && NETWORK_ERROR_MESSAGE.test(error.message)) {
		return {
			title: "The model connection was interrupted",
			detail: "The response did not arrive completely. Check your connection and try again.",
		}
	}

	return {
		title: "The model could not finish this request",
		detail: "The current task and workspace remain available. Try again, or start a new chat if the problem continues.",
	}
}

/** Keep automatic-retry rows concise; raw JSON belongs in diagnostics only. */
export function getRetryStatusMessage(raw: string | undefined): string | undefined {
	const error = parseRecoveryError(raw)
	if (!error) return raw?.trim() || undefined
	if (error.kind === "auth") return "The provider connection needs attention."
	if (error.kind === "rateLimit") return "The provider is busy; trying again automatically."
	if (error.status !== undefined && isOpaqueRecoveryError(error)) {
		return `Provider request rejected (HTTP ${error.status}).`
	}
	if (isOpaqueRecoveryError(error)) return "The provider returned no error details."
	return error.message || undefined
}

export function hasDiagnosticMetadata(error: RecoveryErrorInfo | undefined): boolean {
	return Boolean(error?.status || error?.requestId || error?.providerId || error?.modelId || error?.code)
}

export function buildRecoveryDiagnostics(error: RecoveryErrorInfo | undefined): string {
	if (!error) return "No structured diagnostic details were returned."

	return [
		"HEAV3NS request diagnostic",
		error.status !== undefined ? `HTTP status: ${error.status}` : undefined,
		error.providerId ? `Provider: ${error.providerId}` : undefined,
		error.modelId ? `Model: ${error.modelId}` : undefined,
		error.code ? `Code: ${error.code}` : undefined,
		error.requestId ? `Request ID: ${error.requestId}` : undefined,
		error.message ? `Provider message: ${error.message}` : undefined,
	]
		.filter((line): line is string => Boolean(line))
		.join("\n")
}
