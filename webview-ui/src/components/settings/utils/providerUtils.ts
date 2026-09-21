import {
	ApiConfiguration,
	ApiProvider,
	ModelInfo,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
} from "@shared/api"
import { Mode } from "@shared/storage/types"
import * as reasoningSupport from "@shared/utils/reasoning-support"

export function supportsReasoningEffortForModelId(modelId?: string, _allowShortOpenAiIds = false): boolean {
	return reasoningSupport.supportsReasoningEffortForModel(modelId)
}

export function getModelsForProvider(
	provider: ApiProvider,
	_dynamicConfiguration?: ApiConfiguration,
	dynamicModels: { openRouterModels?: Record<string, ModelInfo> } = {},
): Record<string, ModelInfo> | undefined {
	return provider === "openrouter" ? dynamicModels.openRouterModels : undefined
}

export interface NormalizedApiConfig {
	selectedProvider: ApiProvider
	selectedModelId: string
	selectedModelInfo: ModelInfo
}

export function normalizeApiConfiguration(
	apiConfiguration: ApiConfiguration | undefined,
	currentMode: Mode,
): NormalizedApiConfig {
	const configuredProvider = currentMode === "plan" ? apiConfiguration?.planModeApiProvider : apiConfiguration?.actModeApiProvider
	const provider: ApiProvider = configuredProvider === "openai-codex" ? configuredProvider : "openrouter"
	const selectedModelId =
		(currentMode === "plan" ? apiConfiguration?.planModeOpenRouterModelId : apiConfiguration?.actModeOpenRouterModelId) ||
		(currentMode === "plan" ? apiConfiguration?.planModeApiModelId : apiConfiguration?.actModeApiModelId) ||
		openRouterDefaultModelId
	const selectedModelInfo =
		(currentMode === "plan" ? apiConfiguration?.planModeOpenRouterModelInfo : apiConfiguration?.actModeOpenRouterModelInfo) ||
		openRouterDefaultModelInfo

	return { selectedProvider: provider, selectedModelId, selectedModelInfo }
}

export function getModeSpecificFields(apiConfiguration: ApiConfiguration | undefined, mode: Mode) {
	if (!apiConfiguration) {
		return {
			apiProvider: undefined,
			apiModelId: undefined,
			openRouterModelId: undefined,
			openRouterModelInfo: undefined,
			thinkingBudgetTokens: undefined,
			reasoningEffort: undefined,
		}
	}

	return {
		apiProvider: mode === "plan" ? apiConfiguration.planModeApiProvider : apiConfiguration.actModeApiProvider,
		apiModelId: mode === "plan" ? apiConfiguration.planModeApiModelId : apiConfiguration.actModeApiModelId,
		openRouterModelId: mode === "plan" ? apiConfiguration.planModeOpenRouterModelId : apiConfiguration.actModeOpenRouterModelId,
		openRouterModelInfo:
			mode === "plan" ? apiConfiguration.planModeOpenRouterModelInfo : apiConfiguration.actModeOpenRouterModelInfo,
		thinkingBudgetTokens:
			mode === "plan" ? apiConfiguration.planModeThinkingBudgetTokens : apiConfiguration.actModeThinkingBudgetTokens,
		reasoningEffort: mode === "plan" ? apiConfiguration.planModeReasoningEffort : apiConfiguration.actModeReasoningEffort,
	}
}

export async function syncModeConfigurations(
	apiConfiguration: ApiConfiguration | undefined,
	sourceMode: Mode,
	handleFieldsChange: (updates: Partial<ApiConfiguration>) => Promise<void>,
): Promise<void> {
	if (!apiConfiguration) return

	const sourceFields = getModeSpecificFields(apiConfiguration, sourceMode)
	if (!sourceFields.apiProvider) return

	await handleFieldsChange({
		planModeApiProvider: sourceFields.apiProvider,
		actModeApiProvider: sourceFields.apiProvider,
		planModeThinkingBudgetTokens: sourceFields.thinkingBudgetTokens,
		actModeThinkingBudgetTokens: sourceFields.thinkingBudgetTokens,
		planModeReasoningEffort: sourceFields.reasoningEffort,
		actModeReasoningEffort: sourceFields.reasoningEffort,
		planModeOpenRouterModelId: sourceFields.openRouterModelId,
		actModeOpenRouterModelId: sourceFields.openRouterModelId,
		planModeOpenRouterModelInfo: sourceFields.openRouterModelInfo,
		actModeOpenRouterModelInfo: sourceFields.openRouterModelInfo,
	})
}

export { filterOpenRouterModelIds } from "@shared/utils/model-filters"

export const getProviderInfo = (
	_provider: ApiProvider,
	_apiConfiguration: ApiConfiguration,
	_effectiveMode: "plan" | "act",
): { modelId?: string; baseUrl?: string; helpText: string } => ({
	modelId: undefined,
	baseUrl: undefined,
	helpText: "Configure OpenRouter in model settings",
})
