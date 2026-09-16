import { ApiConfiguration } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { Logger } from "@/shared/services/Logger"
import { GalxHandler } from "./providers/galx"
import { ApiHandler, ApiHandlerModel, ApiProviderInfo, CommonApiHandlerOptions, SingleCompletionHandler } from "./types"

// Re-export the API handler contract for backward compatibility.
// The canonical definitions live in ./types to break the provider↔index cycle.
export type { ApiHandler, ApiHandlerModel, ApiProviderInfo, CommonApiHandlerOptions, SingleCompletionHandler }

function createHandlerForProvider(
	_apiProvider: string | undefined,
	options: Omit<ApiConfiguration, "apiProvider">,
	mode: Mode,
): ApiHandler {
	return new GalxHandler({
		onRetryAttempt: options.onRetryAttempt,
		galxApiKey: options.galxApiKey,
		galxBaseUrl: options.galxBaseUrl,
		galxModelId: mode === "plan" ? options.planModeGalxModelId : options.actModeGalxModelId,
		galxModelInfo: mode === "plan" ? options.planModeGalxModelInfo : options.actModeGalxModelInfo,
		reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
		thinkingBudgetTokens:
			mode === "plan" ? options.planModeThinkingBudgetTokens : options.actModeThinkingBudgetTokens,
	})
}

export function buildApiHandler(configuration: ApiConfiguration, mode: Mode): ApiHandler {
	const { planModeApiProvider, actModeApiProvider, ...options } = configuration

	const apiProvider = mode === "plan" ? planModeApiProvider : actModeApiProvider

	// Validate thinking budget tokens against model's maxTokens to prevent API errors
	// wrapped in a try-catch for safety, but this should never throw
	try {
		const thinkingBudgetTokens = mode === "plan" ? options.planModeThinkingBudgetTokens : options.actModeThinkingBudgetTokens
		if (thinkingBudgetTokens && thinkingBudgetTokens > 0) {
			const handler = createHandlerForProvider(apiProvider, options, mode)

			const modelInfo = handler.getModel().info
			if (modelInfo?.maxTokens && modelInfo.maxTokens > 0 && thinkingBudgetTokens > modelInfo.maxTokens) {
				const clippedValue = modelInfo.maxTokens - 1
				if (mode === "plan") {
					options.planModeThinkingBudgetTokens = clippedValue
				} else {
					options.actModeThinkingBudgetTokens = clippedValue
				}
			} else {
				return handler // don't rebuild unless its necessary
			}
		}
	} catch (error) {
		Logger.error("buildApiHandler pre-flight check error:", error)
		// We continue anyway and return a fresh handler below
	}

	try {
		return createHandlerForProvider(apiProvider, options, mode)
	} catch (error) {
		Logger.error("buildApiHandler: CRITICAL failure in createHandlerForProvider", error)
		// Fallback to GALX
		return createHandlerForProvider("galx", options, mode)
	}
}
