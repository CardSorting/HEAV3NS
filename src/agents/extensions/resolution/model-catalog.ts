import { DynamicModelCache } from "./dynamic-model-cache.js"
import { DeterministicLocalEndpointEngine } from "../../../tooling/extensions/endpoints/deterministic-local-endpoint-engine.js"

export interface ModelSpecs {
	modelName: string
	provider: "openai-codex" | "custom"
	contextWindowTokens: number
	maxOutputTokens: number
	inputPricePer1M: number
	outputPricePer1M: number
	supportsVision: boolean
	supportsReasoning?: boolean
	estimatedLatencyMs?: number
	description?: string
	isLocal?: boolean
}
const OPENAI_CODEX_BASE_URL = "https://api.openai.com/v1"

const defaultOpenAiCodexModel: ModelSpecs = {
	modelName: "gpt-5.6-terra",
	provider: "openai-codex",
	contextWindowTokens: 900_000,
	maxOutputTokens: 128_000,
	inputPricePer1M: 2.25,
	outputPricePer1M: 9.0,
	supportsVision: true,
	supportsReasoning: true,
	estimatedLatencyMs: 25,
	description: "Balanced frontier agentic coding model for daily development through OpenAI Codex",
}

type CodexModelResponse = {
	data?: Array<{
		id?: string
		name?: string
		context_length?: number
		max_output_tokens?: number
		pricing?: { prompt?: string | number; completion?: string | number }
		architecture?: { modality?: string }
	}>
}

/** Model catalog and context pricing registry for the supported provider. */
export class ModelCatalog {
	private readonly catalog: Map<string, ModelSpecs> = new Map()
	private readonly dynamicCache = new DynamicModelCache()
	private readonly localEngine: DeterministicLocalEndpointEngine

	constructor(localEngine?: DeterministicLocalEndpointEngine) {
		this.localEngine = localEngine ?? new DeterministicLocalEndpointEngine()
		this.registerDefaults()
	}

	public getLocalEngine(): DeterministicLocalEndpointEngine {
		return this.localEngine
	}

	private registerDefaults(): void {
		this.registerModel(defaultOpenAiCodexModel)
	}

	registerModel(specs: ModelSpecs): void {
		const key = `${specs.provider.toLowerCase()}::${specs.modelName.toLowerCase()}`
		this.catalog.set(key, specs)
	}

	getAllModels(): ModelSpecs[] {
		return Array.from(this.catalog.values())
	}

	getModelsForProvider(provider: string): ModelSpecs[] {
		return this.getAllModels().filter((model) => model.provider.toLowerCase() === provider.toLowerCase())
	}

	getModelInfo(modelName: string, provider = "openai-codex"): ModelSpecs {
		const canonical = modelName.toLowerCase().replace(/^openai-codex\//, "")
		const exact = this.catalog.get(`${provider.toLowerCase()}::${canonical}`)
		if (exact) return exact

		const matchingModel = Array.from(this.catalog.values()).find((model) => model.modelName.toLowerCase() === canonical)
		return matchingModel ?? this.catalog.get("openai-codex::gpt-5.6-terra") ?? defaultOpenAiCodexModel
	}

	/** Fetch the current OpenAI model catalog, falling back to the built-in model when unavailable. */
	async fetchCodexModels(
		apiToken?: string | { Authorization?: string },
		forceRefresh = false,
		baseUrl = OPENAI_CODEX_BASE_URL,
	): Promise<ModelSpecs[]> {
		const token = typeof apiToken === "string" ? apiToken : apiToken?.Authorization?.replace(/^Bearer\s+/i, "")
		const cacheKey = "openai-codex:models"
		const cached = !forceRefresh ? this.dynamicCache.getCachedModels(cacheKey) : null
		if (cached && cached.length > 0) return cached

		try {
			const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
				headers: token ? { Authorization: `Bearer ${token}` } : undefined,
			})
			if (!response.ok) throw new Error(`OpenAI model catalog returned HTTP ${response.status}`)
			const payload = (await response.json()) as CodexModelResponse
			const models = (payload.data ?? [])
				.filter((model): model is typeof model & { id: string } => typeof model.id === "string" && model.id.length > 0)
				.map((model): ModelSpecs => {
					const promptPrice = Number(model.pricing?.prompt ?? defaultOpenAiCodexModel.inputPricePer1M / 1_000_000)
					const completionPrice = Number(model.pricing?.completion ?? defaultOpenAiCodexModel.outputPricePer1M / 1_000_000)
					return {
						modelName: model.id,
						provider: "openai-codex",
						contextWindowTokens: model.context_length ?? defaultOpenAiCodexModel.contextWindowTokens,
						maxOutputTokens: model.max_output_tokens ?? defaultOpenAiCodexModel.maxOutputTokens,
						inputPricePer1M: Number.isFinite(promptPrice) ? promptPrice * 1_000_000 : defaultOpenAiCodexModel.inputPricePer1M,
						outputPricePer1M: Number.isFinite(completionPrice)
							? completionPrice * 1_000_000
							: defaultOpenAiCodexModel.outputPricePer1M,
						supportsVision: model.architecture?.modality?.toLowerCase().includes("image") ?? false,
						description: model.name,
					}
				})
			if (models.length === 0) throw new Error("OpenAI returned no models")
			for (const model of models) this.registerModel(model)
			this.dynamicCache.setCachedModels(cacheKey, models, 300_000)
			return models
		} catch {
			return [this.getModelInfo("gpt-5.6-terra")]
		}
	}

	filterModelSpecs(models: ModelSpecs[], provider = "openai-codex"): ModelSpecs[] {
		return models.filter((model) => model.provider.toLowerCase() === provider.toLowerCase())
	}

	calculateTurnCost(modelName: string, inputTokens: number, outputTokens: number): {
		inputCost: number
		outputCost: number
		totalCost: number
	} {
		const info = this.getModelInfo(modelName)
		const inputCost = (inputTokens / 1_000_000) * info.inputPricePer1M
		const outputCost = (outputTokens / 1_000_000) * info.outputPricePer1M
		return { inputCost, outputCost, totalCost: inputCost + outputCost }
	}
}
