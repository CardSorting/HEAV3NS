import {
	ApiConfiguration,
	ApiProvider,
	galxDefaultModelId,
	galxDefaultModelInfo,
	galxModels,
	ModelInfo,
} from "@shared/api"
import { Mode } from "@shared/storage/types"
import * as reasoningSupport from "@shared/utils/reasoning-support"

export function supportsReasoningEffortForModelId(modelId?: string, _allowShortOpenAiIds = false): boolean {
	return reasoningSupport.supportsReasoningEffortForModel(modelId)
}

/**
 * Returns the static model list for a provider.
 */
export function getModelsForProvider(
	provider: ApiProvider,
	_apiConfiguration?: ApiConfiguration,
	_dynamicModels: { liteLlmModels?: Record<string, ModelInfo>; basetenModels?: Record<string, ModelInfo> } = {},
): Record<string, ModelInfo> | undefined {
	if (provider === "galx") {
		return galxModels
	}
	return undefined
}

/**
 * Interface for normalized API configuration
 */
export interface NormalizedApiConfig {
	selectedProvider: ApiProvider
	selectedModelId: string
	selectedModelInfo: ModelInfo
}

/**
 * Normalizes API configuration to ensure consistent values
 */
export function normalizeApiConfiguration(
	apiConfiguration: ApiConfiguration | undefined,
	currentMode: Mode,
): NormalizedApiConfig {
	const provider =
		(currentMode === "plan" ? apiConfiguration?.planModeApiProvider : apiConfiguration?.actModeApiProvider) || "galx"

	const galxModelId =
		currentMode === "plan" ? apiConfiguration?.planModeGalxModelId : apiConfiguration?.actModeGalxModelId
	const galxModelInfo =
		currentMode === "plan" ? apiConfiguration?.planModeGalxModelInfo : apiConfiguration?.actModeGalxModelInfo

	const selectedModelId = galxModelId || galxDefaultModelId
	const selectedModelInfo = galxModelInfo || galxModels[selectedModelId] || galxDefaultModelInfo

	return {
		selectedProvider: (provider as ApiProvider) || "galx",
		selectedModelId,
		selectedModelInfo,
	}
}

/**
 * Gets mode-specific field values from API configuration
 * @param apiConfiguration The API configuration object
 * @param mode The current mode ("plan" or "act")
 * @returns Object containing mode-specific field values for clean destructuring
 */
export function getModeSpecificFields(apiConfiguration: ApiConfiguration | undefined, mode: Mode) {
	if (!apiConfiguration) {
		return {
			// Core fields
			apiProvider: undefined,
			apiModelId: undefined,

			// Provider-specific model IDs
			openRouterModelId: undefined,
			galxModelId: undefined,

			// Model info objects
			openRouterModelInfo: undefined,
			galxModelInfo: undefined,

			// Other mode-specific fields
			thinkingBudgetTokens: undefined,
			reasoningEffort: undefined,
		}
	}

	const galxModelId =
		mode === "plan" ? apiConfiguration.planModeGalxModelId : apiConfiguration.actModeGalxModelId
	const galxModelInfo =
		mode === "plan" ? apiConfiguration.planModeGalxModelInfo : apiConfiguration.actModeGalxModelInfo

	return {
		// Core fields
		apiProvider: mode === "plan" ? apiConfiguration.planModeApiProvider : apiConfiguration.actModeApiProvider,
		apiModelId: mode === "plan" ? apiConfiguration.planModeApiModelId : apiConfiguration.actModeApiModelId,

		// Provider-specific model IDs
		openRouterModelId: undefined,
		galxModelId,

		// Model info objects
		openRouterModelInfo: undefined,
		galxModelInfo,

		// Other mode-specific fields
		thinkingBudgetTokens:
			mode === "plan" ? apiConfiguration.planModeThinkingBudgetTokens : apiConfiguration.actModeThinkingBudgetTokens,
		reasoningEffort: mode === "plan" ? apiConfiguration.planModeReasoningEffort : apiConfiguration.actModeReasoningEffort,
	}
}

/**
 * Synchronizes mode configurations by copying the source mode's settings to both modes
 * This is used when the "Use different models for Plan and Act modes" toggle is unchecked
 */
export async function syncModeConfigurations(
	apiConfiguration: ApiConfiguration | undefined,
	sourceMode: Mode,
	handleFieldsChange: (updates: Partial<ApiConfiguration>) => Promise<void>,
): Promise<void> {
	if (!apiConfiguration) {
		return
	}

	const sourceFields = getModeSpecificFields(apiConfiguration, sourceMode)
	const { apiProvider } = sourceFields

	if (!apiProvider) {
		return
	}

	// Build the complete update object with both plan and act mode fields
	const updates: Partial<ApiConfiguration> = {
		// Always sync common fields
		planModeApiProvider: sourceFields.apiProvider,
		actModeApiProvider: sourceFields.apiProvider,
		planModeThinkingBudgetTokens: sourceFields.thinkingBudgetTokens,
		actModeThinkingBudgetTokens: sourceFields.thinkingBudgetTokens,
		planModeReasoningEffort: sourceFields.reasoningEffort,
		actModeReasoningEffort: sourceFields.reasoningEffort,
		planModeGalxModelId: sourceFields.galxModelId,
		actModeGalxModelId: sourceFields.galxModelId,
		planModeGalxModelInfo: sourceFields.galxModelInfo,
		actModeGalxModelInfo: sourceFields.galxModelInfo,
	}

	// Make the atomic update
	await handleFieldsChange(updates)
}

export { filterOpenRouterModelIds } from "@shared/utils/model-filters"

// Helper to get provider-specific configuration info and empty state guidance
export const getProviderInfo = (
	_provider: ApiProvider,
	_apiConfiguration: ApiConfiguration,
	_effectiveMode: "plan" | "act",
): { modelId?: string; baseUrl?: string; helpText: string } => {
	return {
		modelId: undefined,
		baseUrl: undefined,
		helpText: "Configure GALX AI provider in model settings",
	}
}
