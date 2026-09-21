import type { Mode } from "@shared/storage/types"
import { useMemo } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { getModeSpecificFields } from "./utils/providerUtils"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

interface OpenAiCodexModelPickerProps {
	currentMode: Mode
	isPopup?: boolean
}

export default function OpenAiCodexModelPicker({ currentMode, isPopup }: OpenAiCodexModelPickerProps) {
	const {
		apiConfiguration,
		openAiCodexIsAuthenticated,
		openAiCodexModels = {},
		refreshOpenAiCodexModels,
	} = useExtensionState()
	const { handleModeFieldsChange } = useApiConfigurationHandlers()
	const modeFields = getModeSpecificFields(apiConfiguration, currentMode)
	const selectedModelId = modeFields.apiModelId || ""
	const selectedModelInfo = selectedModelId ? openAiCodexModels[selectedModelId] : undefined

	const modelOptions = useMemo(
		() => Object.entries(openAiCodexModels).sort(([left], [right]) => left.localeCompare(right)),
		[openAiCodexModels],
	)
	const hasSelectedModel = Boolean(selectedModelId && selectedModelInfo)

	const handleModelChange = (modelId: string) => {
		void handleModeFieldsChange(
			{
				apiProvider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
				apiModelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
			},
			{ apiProvider: "openai-codex", apiModelId: modelId },
			currentMode,
		)
	}

	return (
		<div style={{ width: "100%", paddingBottom: 2 }}>
			<label htmlFor="openai-codex-model" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
				<span style={{ fontWeight: 500 }}>Model</span>
				<select
					aria-label="OpenAI Codex model"
					disabled={!openAiCodexIsAuthenticated || modelOptions.length === 0}
					id="openai-codex-model"
					onChange={(event) => handleModelChange(event.target.value)}
					style={{
						background: "var(--vscode-dropdown-background)",
						border: "1px solid var(--vscode-dropdown-border)",
						color: "var(--vscode-dropdown-foreground)",
						fontSize: 12,
						padding: "5px 7px",
						width: isPopup ? "100%" : "min(100%, 520px)",
					}}
					value={hasSelectedModel ? selectedModelId : ""}>
					<option value="">
						{!openAiCodexIsAuthenticated
							? "Sign in to load models"
							: modelOptions.length === 0
								? "Loading available models..."
								: selectedModelId
									? `Previously selected model is unavailable: ${selectedModelId}`
									: "Select a model"}
					</option>
					{modelOptions.map(([modelId]) => (
						<option key={modelId} value={modelId}>
							{modelId}
						</option>
					))}
				</select>
			</label>
			<div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between", marginTop: 6 }}>
				<p style={{ color: "var(--vscode-descriptionForeground)", fontSize: 11, margin: 0 }}>
					{selectedModelInfo?.description || "Models are loaded from the authenticated OpenAI Codex provider."}
				</p>
				{openAiCodexIsAuthenticated && (
					<button
						onClick={() => void refreshOpenAiCodexModels()}
						style={{
							background: "transparent",
							border: "1px solid var(--vscode-button-border, var(--vscode-widget-border))",
							color: "var(--vscode-descriptionForeground)",
							cursor: "pointer",
							fontSize: 11,
							padding: "2px 6px",
							whiteSpace: "nowrap",
						}}
						type="button">
						Refresh
					</button>
				)}
			</div>
		</div>
	)
}
