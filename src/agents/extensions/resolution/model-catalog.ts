import { DynamicModelCache } from "./dynamic-model-cache.js"
import { DeterministicLocalEndpointEngine } from "../../../tooling/extensions/endpoints/deterministic-local-endpoint-engine.js"
import { GalxProviderEngine } from "./galx-provider-engine.js"

export interface ModelSpecs {
	modelName: string
	provider: "galx" | "custom"
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

/**
 * ModelCatalog & Context Pricing Registry.
 * Exclusively maintains GALX AI Wholesale Compute Clearinghouse model specs and turn token cost calculations.
 */
export class ModelCatalog {
	private readonly catalog: Map<string, ModelSpecs> = new Map()
	private readonly dynamicCache: DynamicModelCache = new DynamicModelCache()
	private readonly localEngine: DeterministicLocalEndpointEngine
	private readonly galxEngine: GalxProviderEngine

	constructor(localEngine?: DeterministicLocalEndpointEngine, galxEngine?: GalxProviderEngine) {
		this.localEngine = localEngine ?? new DeterministicLocalEndpointEngine()
		this.galxEngine = galxEngine ?? new GalxProviderEngine()
		this.registerDefaults()
	}

	public getLocalEngine(): DeterministicLocalEndpointEngine {
		return this.localEngine
	}

	private registerDefaults(): void {
		// GALX Wholesale Compute Clearinghouse Models
		if (typeof this.galxEngine?.getFallbackModelSpecs === "function") {
			for (const galxSpec of this.galxEngine.getFallbackModelSpecs()) {
				this.registerModel(galxSpec)
			}
		}
	}

	registerModel(specs: ModelSpecs): void {
		const key = `${specs.provider.toLowerCase()}::${specs.modelName}`
		this.catalog.set(key, specs)
	}

	getAllModels(): ModelSpecs[] {
		return Array.from(this.catalog.values())
	}

	getModelsForProvider(provider: string): ModelSpecs[] {
		return this.getAllModels().filter((m) => m.provider.toLowerCase() === provider.toLowerCase())
	}

	getModelInfo(modelName: string, provider = "galx"): ModelSpecs {
		const canonical = modelName.toLowerCase().replace(/^galx\//, "")
		const key = `${provider.toLowerCase()}::${canonical}`
		if (this.catalog.has(key)) {
			return this.catalog.get(key)!
		}

		const spec =
			this.catalog.get(`galx::${canonical}`) || Array.from(this.catalog.values()).find((m) => m.modelName === canonical)
		if (spec) return spec

		// Fallback default spec (gpt-5.6-terra)
		return (
			this.catalog.get("galx::gpt-5.6-terra") ?? {
				modelName: "gpt-5.6-terra",
				provider: "galx",
				contextWindowTokens: 900_000,
				maxOutputTokens: 128_000,
				inputPricePer1M: 2.25,
				outputPricePer1M: 9.0,
				supportsVision: true,
				supportsReasoning: true,
				estimatedLatencyMs: 25,
				description: "Balanced frontier agentic coding model for daily development",
			}
		)
	}

	/**
	 * Dynamically fetches live available models from GALX Wholesale Compute Clearinghouse.
	 */
	async fetchGalxModels(apiToken?: string, forceRefresh = false, baseUrl?: string): Promise<ModelSpecs[]> {
		const cacheKey = "galx:models"
		const cached = !forceRefresh ? this.dynamicCache.getCachedModels(cacheKey) : null
		if (cached && cached.length > 0) {
			return cached
		}

		try {
			const models = await this.galxEngine.fetchGalxModels(apiToken, baseUrl, forceRefresh)
			for (const m of models) {
				this.registerModel(m)
			}
			if (models.length > 0) {
				this.dynamicCache.setCachedModels(cacheKey, models, 300_000)
				return models
			}
		} catch {
			// Fall back to in-memory defaults
		}

		return this.getAllModels()
	}

	calculateTurnCost(modelName: string, inputTokens: number, outputTokens: number): {
		inputCost: number
		outputCost: number
		totalCost: number
	} {
		const info = this.getModelInfo(modelName)
		const inputCost = (inputTokens / 1_000_000) * info.inputPricePer1M
		const outputCost = (outputTokens / 1_000_000) * info.outputPricePer1M
		return {
			inputCost,
			outputCost,
			totalCost: inputCost + outputCost,
		}
	}
}
