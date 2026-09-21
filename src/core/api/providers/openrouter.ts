import { ModelInfo, openRouterDefaultModelId, openRouterDefaultModelInfo } from "@shared/api"
import OpenAI from "openai"
import type { ChatCompletionTool as OpenAITool } from "openai/resources/chat/completions"
import { DietCodeStorageMessage } from "@/shared/messages/content"
import { createOpenAIClient } from "@/shared/net"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { ToolCallProcessor } from "../transform/tool-call-processor"
import { ApiHandler, CommonApiHandlerOptions } from "../types"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

export interface OpenRouterHandlerOptions extends CommonApiHandlerOptions {
	openRouterApiKey?: string
	openRouterModelId?: string
	openRouterModelInfo?: ModelInfo
	reasoningEffort?: string
	thinkingBudgetTokens?: number
}

/** OpenRouter's OpenAI-compatible chat completion handler. */
export class OpenRouterHandler implements ApiHandler {
	private options: OpenRouterHandlerOptions
	private client: OpenAI | undefined

	constructor(options: OpenRouterHandlerOptions) {
		this.options = options
	}

	private ensureClient(): OpenAI {
		if (!this.client) {
			if (!this.options.openRouterApiKey) {
				throw new Error("OpenRouter API key is required. Please configure your key in Settings.")
			}

			try {
				this.client = createOpenAIClient({
					baseURL: OPENROUTER_BASE_URL,
					apiKey: this.options.openRouterApiKey,
					defaultHeaders: {
						"X-OpenRouter-Title": "HEAV3NS",
					},
				})
			} catch (error: any) {
				throw new Error(`Error creating OpenRouter client: ${error.message}`)
			}
		}

		return this.client
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: DietCodeStorageMessage[], tools?: OpenAITool[]): ApiStream {
		const client = this.ensureClient()
		const model = this.getModel()
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]
		const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
			model: model.id,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
		}

		if (tools && tools.length > 0) {
			requestParams.tools = tools
		}

		if (model.info.supportsReasoning && this.options.reasoningEffort) {
			;(requestParams as unknown as Record<string, unknown>).reasoning_effort = this.options.reasoningEffort
		}

		const stream = await client.chat.completions.create(requestParams)
		let didOutputUsage = false
		const toolCallProcessor = new ToolCallProcessor()

		for await (const chunk of stream) {
			const chunkRecord = chunk as unknown as { error?: { message?: string } }
			if (chunkRecord.error) {
				throw new Error(`OpenRouter API error: ${chunkRecord.error.message || JSON.stringify(chunkRecord.error)}`)
			}

			const choice = chunk.choices?.[0]
			const delta = choice?.delta as
				| (OpenAI.Chat.ChatCompletionChunk.Choice.Delta & {
						reasoning_content?: string
						reasoning?: string | Record<string, unknown>
				  })
				| undefined

			if (delta?.content) {
				yield { type: "text", text: delta.content }
			}

			if (delta?.tool_calls) {
				yield* toolCallProcessor.processToolCallDeltas(delta.tool_calls)
			}

			if (delta?.reasoning_content) {
				yield { type: "reasoning", reasoning: delta.reasoning_content }
			} else if (delta?.reasoning) {
				yield {
					type: "reasoning",
					reasoning: typeof delta.reasoning === "string" ? delta.reasoning : JSON.stringify(delta.reasoning),
				}
			}

			if (!didOutputUsage && chunk.usage) {
				const promptTokens = chunk.usage.prompt_tokens || 0
				const cachedTokens = chunk.usage.prompt_tokens_details?.cached_tokens || 0
				const inputTokens = Math.max(0, promptTokens - cachedTokens)
				const outputTokens = chunk.usage.completion_tokens || 0
				let totalCost: number | undefined

				if (model.info.inputPrice !== undefined && model.info.outputPrice !== undefined) {
					const inputCost = (inputTokens / 1_000_000) * model.info.inputPrice
					const outputCost = (outputTokens / 1_000_000) * model.info.outputPrice
					const cacheCost =
						model.info.cacheReadsPrice !== undefined
							? (cachedTokens / 1_000_000) * model.info.cacheReadsPrice
							: 0
					totalCost = inputCost + outputCost + cacheCost
				}

				yield {
					type: "usage",
					cacheWriteTokens: 0,
					cacheReadTokens: cachedTokens,
					inputTokens,
					outputTokens,
					totalCost,
				}
				didOutputUsage = true
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.openRouterModelId || openRouterDefaultModelId,
			info: this.options.openRouterModelInfo || openRouterDefaultModelInfo,
		}
	}
}
