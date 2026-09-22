import { ModelInfo } from "@shared/api"
import { ApiFormat } from "@shared/proto/dietcode/models"
import {
	CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL,
	type ClaudeSubscriptionDirectSdkMessage,
	type ClaudeSubscriptionDirectSdkTool,
	createClaudeSubscriptionDirectSdkCompletion,
} from "@/integrations/claude-subscription-directsdk/provider"
import { normalizeClaudeSubscriptionDirectSdkModel } from "@/core/providers/provider-ids"
import type { DietCodeStorageMessage } from "@/shared/messages/content"
import type { DietCodeTool } from "@/shared/tools"
import type { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { ApiHandler, CommonApiHandlerOptions } from "../types"

export interface ClaudeSubscriptionDirectSdkHandlerOptions extends CommonApiHandlerOptions {
	claudeSubscriptionDirectSdkModelId?: string
	claudeSubscriptionDirectSdkPluginDir?: string
	claudeSubscriptionDirectSdkPythonPath?: string
	claudeSubscriptionDirectSdkCommand?: string
	claudeSubscriptionDirectSdkTimeoutMs?: number
	reasoningEffort?: string
	thinkingBudgetTokens?: number
}

function modelInfoFor(modelId: string): ModelInfo {
	const normalized = normalizeClaudeSubscriptionDirectSdkModel(modelId)
	const lowered = normalized.toLowerCase()
	const contextWindowTokens = lowered.endsWith("[1m]") ? 1_000_000 : 200_000
	return {
		name: normalized,
		maxTokens: lowered.includes("haiku") ? 64_000 : 128_000,
		contextWindow: contextWindowTokens,
		supportsImages: true,
		supportsPromptCache: false,
		supportsReasoning: true,
		inputPrice: 0,
		outputPrice: 0,
		apiFormat: ApiFormat.OPENAI_CHAT,
		description: "Official Claude Code CLI subscription transport; native usage and entitlement remain account-owned.",
	}
}

function textContent(content: unknown): string {
	if (typeof content === "string") return content
	if (!Array.isArray(content)) return ""
	return content
		.filter((block): block is { type: "text"; text: string } => {
			return (
				typeof block === "object" &&
				block !== null &&
				(block as { type?: unknown }).type === "text" &&
				typeof (block as { text?: unknown }).text === "string"
			)
		})
		.map((block) => block.text)
		.join("")
}

function toBridgeMessage(message: DietCodeStorageMessage): ClaudeSubscriptionDirectSdkMessage {
	const content = message.content
	const blocks = Array.isArray(content) ? content : []
	const toolCalls = blocks
		.filter((block): block is { type: "tool_use"; id: string; name: string; input: unknown } => {
			return (
				typeof block === "object" &&
				block !== null &&
				(block as { type?: unknown }).type === "tool_use" &&
				typeof (block as { id?: unknown }).id === "string" &&
				typeof (block as { name?: unknown }).name === "string"
			)
		})
		.map((block) => ({
			id: block.id,
			type: "function" as const,
			function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
		}))
	const bridgeMessage: ClaudeSubscriptionDirectSdkMessage = {
		role: message.role,
		content: textContent(content) || (typeof content === "string" ? content : null),
	}
	if (toolCalls.length > 0) bridgeMessage.tool_calls = toolCalls
	const reasoningDetails = (message as DietCodeStorageMessage & { reasoning_details?: unknown[] }).reasoning_details
	if (reasoningDetails) {
		;(bridgeMessage as ClaudeSubscriptionDirectSdkMessage & { reasoning_details?: unknown[] }).reasoning_details =
			reasoningDetails
	}
	return bridgeMessage
}

function toBridgeTool(tool: DietCodeTool): ClaudeSubscriptionDirectSdkTool | null {
	if (typeof tool !== "object" || tool === null) return null
	const candidate = tool as Record<string, unknown>
	if (candidate.type === "function" && typeof candidate.function === "object" && candidate.function !== null) {
		const fn = candidate.function as Record<string, unknown>
		if (typeof fn.name !== "string") return null
		return {
			type: "function",
			function: {
				name: fn.name,
				description: typeof fn.description === "string" ? fn.description : "",
				parameters: (fn.parameters as Record<string, unknown> | undefined) ?? { type: "object", properties: {} },
			},
		}
	}
	if (typeof candidate.name === "string") {
		return {
			type: "function",
			function: {
				name: candidate.name,
				description: typeof candidate.description === "string" ? candidate.description : "",
				parameters: (candidate.input_schema as Record<string, unknown> | undefined) ?? { type: "object", properties: {} },
			},
		}
	}
	return null
}

/** Compatibility handler for the older host API. The active monolith uses the
 * same transport directly; this adapter emits complete response chunks when
 * the legacy host expects an AsyncGenerator. */
export class ClaudeSubscriptionDirectSdkHandler implements ApiHandler {
	private readonly options: ClaudeSubscriptionDirectSdkHandlerOptions
	private activeAbortController: AbortController | undefined
	private lastUsage: ApiStreamUsageChunk | undefined

	constructor(options: ClaudeSubscriptionDirectSdkHandlerOptions) {
		this.options = options
	}

	async *createMessage(
		systemPrompt: string,
		messages: DietCodeStorageMessage[],
		tools?: DietCodeTool[],
		_useResponseApi?: boolean,
	): ApiStream {
		this.activeAbortController = new AbortController()
		this.lastUsage = undefined
		try {
			const history: ClaudeSubscriptionDirectSdkMessage[] = []
			if (systemPrompt.trim()) history.push({ role: "system", content: systemPrompt })
			history.push(...messages.map(toBridgeMessage))
			const bridgeTools = (tools ?? [])
				.map(toBridgeTool)
				.filter((tool): tool is ClaudeSubscriptionDirectSdkTool => tool !== null)
			const model = this.getModel()
			const response = await createClaudeSubscriptionDirectSdkCompletion(
				{
					model: model.id || CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL,
					messages: history,
					max_tokens: model.info.maxTokens ?? 128_000,
					...(bridgeTools.length > 0 ? { tools: bridgeTools } : {}),
				},
				{
					pluginDir: this.options.claudeSubscriptionDirectSdkPluginDir,
					pythonPath: this.options.claudeSubscriptionDirectSdkPythonPath,
					command: this.options.claudeSubscriptionDirectSdkCommand,
					timeoutMs: this.options.claudeSubscriptionDirectSdkTimeoutMs,
					signal: this.activeAbortController.signal,
				},
			)
			const choice = response.choices?.[0]
			const message = choice?.message
			if (message?.content) yield { type: "text", text: message.content, id: response.id }
			if (message?.reasoning_content) yield { type: "reasoning", reasoning: message.reasoning_content, id: response.id }
			for (const toolCall of message?.tool_calls ?? []) {
				yield {
					type: "tool_calls",
					id: response.id,
					tool_call: {
						call_id: toolCall.id,
						function: {
							id: toolCall.id,
							name: toolCall.function.name,
							arguments: toolCall.function.arguments,
						},
					},
				}
			}
			const usage = response.usage
			if (usage) {
				this.lastUsage = {
					type: "usage",
					inputTokens: Number(usage.prompt_tokens ?? 0),
					outputTokens: Number(usage.completion_tokens ?? 0),
					totalCost: 0,
					id: response.id,
				}
				yield this.lastUsage
			}
		} finally {
			this.activeAbortController = undefined
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		const requested = this.options.claudeSubscriptionDirectSdkModelId || CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL
		const id = normalizeClaudeSubscriptionDirectSdkModel(requested)
		return { id, info: modelInfoFor(id) }
	}

	async getApiStreamUsage(): Promise<ApiStreamUsageChunk | undefined> {
		return this.lastUsage
	}

	abort(): void {
		this.activeAbortController?.abort()
	}
}
