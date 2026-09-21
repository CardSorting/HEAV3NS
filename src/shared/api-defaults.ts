import type { ApiProvider, ModelInfo } from "./api"

/**
 * Small, chat-safe provider defaults. Keep these separate from api.ts so the
 * webview shell does not parse the complete model catalog just to render the
 * composer.
 */
export const DEFAULT_API_PROVIDER: ApiProvider = "openrouter"

export const openRouterDefaultModelId = "gpt-5.6-terra"
export const openRouterDefaultModelInfo: ModelInfo = {
	name: "OpenAI Codex GPT-5.6 Terra (Balanced Frontier)",
	maxTokens: 128_000,
	contextWindow: 900_000,
	supportsImages: true,
	supportsPromptCache: true,
	supportsReasoning: true,
	inputPrice: 2.25,
	outputPrice: 9.0,
	cacheReadsPrice: 0.75,
	description:
		"Balanced frontier agentic coding model for large-scale refactoring and daily development through OpenRouter.",
}

export const requestyDefaultModelId = "gpt-5.6-terra"
export const requestyDefaultModelInfo: ModelInfo = openRouterDefaultModelInfo
