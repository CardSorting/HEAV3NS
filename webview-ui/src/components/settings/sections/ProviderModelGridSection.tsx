import {
	ModelInfo,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
} from "@shared/api"
import { Search, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import styled from "styled-components"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { getModelBadges, isRecentModel, ModelFilterTabs, type ModelFilterType } from "../common/ModelTypeTab"
import OpenAiCodexAuthControl from "../OpenAiCodexAuthControl"
import OpenAiCodexModelPicker from "../OpenAiCodexModelPicker"
import OpenRouterModelPicker from "../OpenRouterModelPicker"
import Section from "../Section"
import { normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

export type SupportedProviderTabID = "provider-openrouter" | "provider-openai-codex"

export interface ProviderMeta {
	id: SupportedProviderTabID
	apiProviderValue: string
	name: string
	label: string
	iconName: string
	description: string
}

export const SUPPORTED_PROVIDERS: ProviderMeta[] = [
	{
		id: "provider-openai-codex",
		apiProviderValue: "openai-codex",
		name: "OpenAI Codex",
		label: "OpenAI Codex Models",
		iconName: "Sparkles",
		description: "ChatGPT subscription access through the OpenAI Codex OAuth strategy.",
	},
	{
		id: "provider-openrouter",
		apiProviderValue: "openrouter",
		name: "OpenRouter",
		label: "OpenRouter Models",
		iconName: "Globe",
		description: "OpenAI-compatible model routing with live model discovery and provider selection.",
	},
]

const ITEMS_PER_PAGE = 4

interface ProviderModelGridSectionProps {
	providerTabId: SupportedProviderTabID
	renderSectionHeader?: (tabId: string) => JSX.Element | null
}

/**
 * OpenRouter credential setup and paginated model catalog.
 */
export const ProviderModelGridSection = ({ providerTabId, renderSectionHeader }: ProviderModelGridSectionProps) => {
	const {
		apiConfiguration,
		openAiCodexIsAuthenticated,
		openAiCodexModels,
		openAiCodexModelsError,
		openAiCodexModelsLoading,
		openRouterModels,
	} = useExtensionState()
	const { handleModeFieldsChange } = useApiConfigurationHandlers()
	const isOpenAiCodex = providerTabId === "provider-openai-codex"

	const [activeFilter, setActiveFilter] = useState<ModelFilterType>("all")
	const [searchQuery, setSearchQuery] = useState("")
	const [currentPage, setCurrentPage] = useState(1)
	const [lastActivatedModelId, setLastActivatedModelId] = useState<string | null>(null)

	const handleSearchChange = (query: string) => {
		setSearchQuery(query)
		setCurrentPage(1)
	}

	const handleFilterChange = (filter: ModelFilterType) => {
		setActiveFilter(filter)
		setCurrentPage(1)
	}

	const providerMeta = SUPPORTED_PROVIDERS.find((provider) => provider.id === providerTabId) || SUPPORTED_PROVIDERS[0]
	const providerModelsRecord: Record<string, ModelInfo> = useMemo(
		() =>
			isOpenAiCodex
				? openAiCodexModels
				: Object.keys(openRouterModels).length > 0
					? openRouterModels
					: { [openRouterDefaultModelId]: openRouterDefaultModelInfo },
		[isOpenAiCodex, openAiCodexModels, openRouterModels],
	)

	// Active configuration
	const currentConfig = useMemo(
		() => normalizeApiConfiguration(apiConfiguration, "plan", { openAiCodexModels, openRouterModels }),
		[apiConfiguration, openAiCodexModels, openRouterModels],
	)

	// Filter models array by search and recency filter
	const filteredGridModels = useMemo(() => {
		let entries = Object.entries(providerModelsRecord)

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim()
			entries = entries.filter(([id, info]) => id.toLowerCase().includes(query) || info.name?.toLowerCase().includes(query))
		}

		if (activeFilter === "recent") {
			entries = entries.filter(([id, info]) => isRecentModel(id, info))
		}

		return entries
	}, [providerModelsRecord, searchQuery, activeFilter])

	// Pagination calculations
	const totalPages = Math.max(1, Math.ceil(filteredGridModels.length / ITEMS_PER_PAGE))
	const paginatedGridModels = useMemo(() => {
		const start = (currentPage - 1) * ITEMS_PER_PAGE
		return filteredGridModels.slice(start, start + ITEMS_PER_PAGE)
	}, [filteredGridModels, currentPage])
	const emptyStateMessage = isOpenAiCodex
		? openAiCodexModelsLoading
			? "Loading the OpenAI Codex model catalog..."
			: openAiCodexModelsError ||
			  (Object.keys(providerModelsRecord).length === 0
					? openAiCodexIsAuthenticated
						? "No models are available. Use Refresh in the model selector to try again."
						: "Sign in to load the OpenAI Codex model catalog."
					: `No models found matching "${searchQuery}"`)
		: `No models found matching "${searchQuery}"`

	const handleSelectModel = (modelId: string) => {
		const modelInfo = providerModelsRecord[modelId]
		if (isOpenAiCodex) {
			handleModeFieldsChange(
				{
					apiProvider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
					apiModelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
				},
				{ apiProvider: "openai-codex", apiModelId: modelId },
				"plan",
			)
			handleModeFieldsChange(
				{
					apiProvider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
					apiModelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
				},
				{ apiProvider: "openai-codex", apiModelId: modelId },
				"act",
			)
			setLastActivatedModelId(modelId)
			setTimeout(() => setLastActivatedModelId(null), 2500)
			return
		}

		handleModeFieldsChange(
			{
				apiProvider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
				openRouterModelId: { plan: "planModeOpenRouterModelId", act: "actModeOpenRouterModelId" },
				openRouterModelInfo: { plan: "planModeOpenRouterModelInfo", act: "actModeOpenRouterModelInfo" },
			},
			{ apiProvider: "openrouter", openRouterModelId: modelId, openRouterModelInfo: modelInfo },
			"plan",
		)
		handleModeFieldsChange(
			{
				apiProvider: { plan: "planModeApiProvider", act: "actModeApiProvider" },
				openRouterModelId: { plan: "planModeOpenRouterModelId", act: "actModeOpenRouterModelId" },
				openRouterModelInfo: { plan: "planModeOpenRouterModelInfo", act: "actModeOpenRouterModelInfo" },
			},
			{ apiProvider: "openrouter", openRouterModelId: modelId, openRouterModelInfo: modelInfo },
			"act",
		)

		setLastActivatedModelId(modelId)
		setTimeout(() => setLastActivatedModelId(null), 2500)
	}

	return (
		<div>
			{renderSectionHeader?.(providerTabId)}

			{/* Top Credentials & Settings Block */}
			<CredentialsCardWrapper>
				<div style={{ marginBottom: 12 }}>
					<SectionTitleRow>
						<h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--vscode-foreground)" }}>
							{providerMeta.name} Authentication & Configuration
						</h3>
					</SectionTitleRow>
					<p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
						{providerMeta.description}
					</p>
				</div>
				{isOpenAiCodex ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<OpenAiCodexAuthControl />
						<OpenAiCodexModelPicker currentMode="plan" isPopup={false} />
					</div>
				) : (
					<OpenRouterModelPicker currentMode="plan" isPopup={false} showProviderRouting={true} />
				)}
			</CredentialsCardWrapper>

			{/* Models Grid & Model Discovery Block */}
			<Section style={{ marginTop: 16 }}>
				<HeaderContainer>
					<TitleWrapper>
						<Sparkles className="size-4 text-lumi shrink-0" />
						<TitleText>{providerMeta.name} Model Catalog</TitleText>
					</TitleWrapper>
					<BadgeText>
						{isOpenAiCodex && !openAiCodexIsAuthenticated
							? "Sign-in required"
							: isOpenAiCodex && openAiCodexModelsLoading
							? "Loading models…"
							: isOpenAiCodex && openAiCodexModelsError
								? "Catalog unavailable"
								: `${filteredGridModels.length} models available`}
					</BadgeText>
				</HeaderContainer>

				{/* Search & Recency Filter Bar */}
				<FilterSearchRow>
					<SearchInputWrapper>
						<Search className="size-3.5 text-description absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
						<StyledSearchInput
							onChange={(e) => handleSearchChange(e.target.value)}
							placeholder={`Search ${providerMeta.name} models...`}
							type="text"
							value={searchQuery}
						/>
					</SearchInputWrapper>
				</FilterSearchRow>

				<ModelFilterTabs activeTab={activeFilter} models={providerModelsRecord} onTabChange={handleFilterChange} />

				{/* Models Compact Table */}
				{filteredGridModels.length === 0 ? (
					<EmptyStateWrapper>
						<p
							aria-live="polite"
							role={isOpenAiCodex && openAiCodexModelsError ? "alert" : "status"}
							style={{
								color:
									isOpenAiCodex && openAiCodexModelsError
										? "var(--vscode-errorForeground)"
										: "var(--vscode-descriptionForeground)",
								fontSize: 12,
								margin: 0,
							}}>
							{emptyStateMessage}
						</p>
					</EmptyStateWrapper>
				) : (
					<ModelGridContainer>
						{paginatedGridModels.map(([modelId, modelInfo]) => {
							const isPlanActive =
								currentConfig.selectedProvider === providerMeta.apiProviderValue &&
									(isOpenAiCodex
										? apiConfiguration?.planModeApiModelId
										: apiConfiguration?.planModeOpenRouterModelId || openRouterDefaultModelId) === modelId
							const isActActive =
								currentConfig.selectedProvider === providerMeta.apiProviderValue &&
									(isOpenAiCodex
										? apiConfiguration?.actModeApiModelId
										: apiConfiguration?.actModeOpenRouterModelId || openRouterDefaultModelId) === modelId
							const isSelected = isPlanActive || isActActive
							const isJustActivated = lastActivatedModelId === modelId

							const badges = getModelBadges(modelId, modelInfo)

							return (
								<ModelCard key={modelId} isSelected={isSelected}>
									<CardHeaderRow>
										<ModelTitleColumn>
											<ModelNameText title={modelInfo.name || modelId}>{modelInfo.name || modelId}</ModelNameText>
											<ModelIdCode>{modelId}</ModelIdCode>
										</ModelTitleColumn>
										<SelectButton
											disabled={isSelected}
											isActivated={isJustActivated}
											isSelected={isSelected}
											onClick={() => handleSelectModel(modelId)}>
											{isJustActivated ? "Activated!" : isSelected ? "Active" : "Select"}
										</SelectButton>
									</CardHeaderRow>

									{/* Badges & Properties */}
									<BadgesRow>
										{badges.map((badge) => (
											<BadgeItem key={badge}>
												{badge}
											</BadgeItem>
										))}
									</BadgesRow>

									{/* Price & Specs Line */}
									<SpecsRow>
										<span>
											Ctx: <strong>{Math.round((modelInfo.contextWindow || 0) / 1000)}k</strong>
										</span>
										<span>•</span>
										<span>
											Out: <strong>{Math.round((modelInfo.maxTokens || 0) / 1000)}k</strong>
										</span>
										<span>•</span>
										<span>
											In: <strong>${modelInfo.inputPrice ?? 0}/1M</strong>
										</span>
										<span>•</span>
										<span>
											Out: <strong>${modelInfo.outputPrice ?? 0}/1M</strong>
										</span>
									</SpecsRow>

									{modelInfo.description && <ModelDescText>{modelInfo.description}</ModelDescText>}
								</ModelCard>
							)
						})}
					</ModelGridContainer>
				)}

				{/* Pagination Controls */}
				{totalPages > 1 && (
					<PaginationContainer>
						<PaginationButton disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
							Previous
						</PaginationButton>
						<PageIndicator>
							Page {currentPage} of {totalPages}
						</PageIndicator>
						<PaginationButton
							disabled={currentPage === totalPages}
							onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
							Next
						</PaginationButton>
					</PaginationContainer>
				)}
			</Section>
		</div>
	)
}

export default ProviderModelGridSection

// Styled Components
const CredentialsCardWrapper = styled.div`
	padding: 14px;
	border-radius: 8px;
	background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(255, 255, 255, 0.03));
	border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
`

const SectionTitleRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
`

const HeaderContainer = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10px;
`

const TitleWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
`

const TitleText = styled.h4`
	margin: 0;
	font-size: 12px;
	font-weight: 600;
	color: var(--vscode-foreground);
`

const BadgeText = styled.span`
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
`

const FilterSearchRow = styled.div`
	display: flex;
	gap: 8px;
	margin-bottom: 8px;
`

const SearchInputWrapper = styled.div`
	position: relative;
	flex: 1;
`

const StyledSearchInput = styled.input`
	width: 100%;
	padding: 6px 10px 6px 28px;
	font-size: 12px;
	background-color: var(--vscode-input-background);
	color: var(--vscode-input-foreground);
	border: 1px solid var(--vscode-input-border, rgba(255, 255, 255, 0.1));
	border-radius: 6px;
	outline: none;

	&:focus {
		border-color: var(--vscode-focusBorder);
	}
`

const ModelGridContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 8px;
`

const ModelCard = styled.div<{ isSelected: boolean }>`
	padding: 10px 12px;
	border-radius: 6px;
	background-color: ${({ isSelected }) =>
		isSelected ? "var(--vscode-list-activeSelectionBackground, rgba(99, 102, 241, 0.12))" : "var(--vscode-editor-inactiveSelectionBackground, rgba(255, 255, 255, 0.02))"};
	border: 1px solid
		${({ isSelected }) =>
			isSelected ? "var(--vscode-focusBorder, #6366f1)" : "var(--vscode-widget-border, rgba(255, 255, 255, 0.06))"};
	display: flex;
	flex-direction: column;
	gap: 6px;
	transition: all 0.15s ease-in-out;

	&:hover {
		border-color: var(--vscode-focusBorder, #6366f1);
	}
`

const CardHeaderRow = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 8px;
`

const ModelTitleColumn = styled.div`
	display: flex;
	flex-direction: column;
	min-width: 0;
`

const ModelNameText = styled.span`
	font-size: 12px;
	font-weight: 600;
	color: var(--vscode-foreground);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`

const ModelIdCode = styled.code`
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
	font-family: var(--vscode-editor-font-family, monospace);
`

const SelectButton = styled.button<{ isSelected: boolean; isActivated?: boolean }>`
	padding: 4px 10px;
	font-size: 11px;
	font-weight: 500;
	border-radius: 4px;
	cursor: ${({ isSelected }) => (isSelected ? "default" : "pointer")};
	border: none;
	background-color: ${({ isActivated, isSelected }) =>
		isActivated ? "#10b981" : isSelected ? "var(--vscode-button-secondaryBackground, #4b5563)" : "var(--vscode-button-background, #6366f1)"};
	color: ${({ isActivated, isSelected }) =>
		isActivated ? "#ffffff" : isSelected ? "var(--vscode-button-secondaryForeground, #e5e7eb)" : "var(--vscode-button-foreground, #ffffff)"};
	transition: background-color 0.15s;

	&:hover:not(:disabled) {
		background-color: var(--vscode-button-hoverBackground, #4f46e5);
	}
`

const BadgesRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
`

const BadgeItem = styled.span<{ variant?: string }>`
	font-size: 9px;
	padding: 1px 5px;
	border-radius: 3px;
	font-weight: 500;
	background-color: ${({ variant }) =>
		variant === "speed" ? "rgba(16, 185, 129, 0.15)" : variant === "cost" ? "rgba(245, 158, 11, 0.15)" : "rgba(99, 102, 241, 0.15)"};
	color: ${({ variant }) =>
		variant === "speed" ? "#10b981" : variant === "cost" ? "#f59e0b" : "#818cf8"};
`

const SpecsRow = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 10px;
	color: var(--vscode-descriptionForeground);
`

const ModelDescText = styled.p`
	margin: 0;
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
	line-height: 1.3;
`

const EmptyStateWrapper = styled.div`
	padding: 20px;
	text-align: center;
`

const PaginationContainer = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	margin-top: 12px;
`

const PaginationButton = styled.button`
	padding: 4px 10px;
	font-size: 11px;
	background-color: var(--vscode-button-secondaryBackground);
	color: var(--vscode-button-secondaryForeground);
	border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
	border-radius: 4px;
	cursor: pointer;

	&:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
`

const PageIndicator = styled.span`
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
`
