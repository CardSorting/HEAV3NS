import { ApiProvider } from "@shared/api"
import PROVIDERS from "@shared/providers/providers.json"
import { Mode } from "@shared/storage/types"
import { useMemo } from "react"
import { normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ApiKeyField } from "./common/ApiKeyField"
import { DROPDOWN_Z_INDEX, DropdownContainer } from "./constants"
import OpenRouterModelPicker from "./OpenRouterModelPicker"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

interface ApiOptionsProps {
	showModelOptions: boolean
	apiErrorMessage?: string
	modelIdErrorMessage?: string
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

// This is necessary to ensure dropdown opens downward, important for when this is used in popup.
export { DROPDOWN_Z_INDEX }

// DropdownContainer lives in the ./constants leaf to break the ApiOptions ↔
// provider-component cycle. Imported above for local use + re-exported for compat.
export { DropdownContainer }
export type { ApiProvider }

const ApiOptions = ({ showModelOptions, apiErrorMessage, modelIdErrorMessage, isPopup, currentMode }: ApiOptionsProps) => {
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange } = useApiConfigurationHandlers()
	const { selectedProvider } = normalizeApiConfiguration(apiConfiguration, currentMode)

	const providerOptions = useMemo(() => {
		return PROVIDERS.list
	}, [])

	const currentProviderLabel = useMemo(() => {
		return providerOptions.find((option) => option.value === selectedProvider)?.label || "OpenRouter"
	}, [providerOptions, selectedProvider])

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<label className="text-xs font-medium text-foreground">Active AI Provider</label>
				<div className="px-3 py-2 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs text-foreground">
					<span className="font-semibold text-lumi">{currentProviderLabel}</span>
					<span className="text-[11px] text-muted-foreground">OpenAI-compatible routing</span>
				</div>
			</div>

			{apiConfiguration && (
				<div className="flex flex-col gap-3">
					<ApiKeyField
						initialValue={apiConfiguration.openRouterApiKey || ""}
						onChange={(value) => handleFieldChange("openRouterApiKey", value)}
						placeholder="Enter API Key..."
						providerName="OpenRouter"
						signupUrl="https://openrouter.ai/keys"
					/>
					{showModelOptions && <OpenRouterModelPicker currentMode={currentMode} isPopup={isPopup} showProviderRouting={true} />}
				</div>
			)}

			{apiErrorMessage && (
				<p
					style={{
						margin: "-10px 0 4px 0",
						fontSize: 12,
						color: "var(--vscode-errorForeground)",
					}}>
					{apiErrorMessage}
				</p>
			)}
			{modelIdErrorMessage && (
				<p
					style={{
						margin: "-10px 0 4px 0",
						fontSize: 12,
						color: "var(--vscode-errorForeground)",
					}}>
					{modelIdErrorMessage}
				</p>
			)}
		</div>
	)
}

export default ApiOptions
