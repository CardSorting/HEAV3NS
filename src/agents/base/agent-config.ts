import type { AgentProviderId } from "../../core/providers/provider-ids.js"
import {
	CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL,
	OPENAI_CODEX_PROVIDER,
	isClaudeSubscriptionDirectSdkProvider,
	normalizeAgentProvider,
	normalizeClaudeSubscriptionDirectSdkModel,
} from "../../core/providers/provider-ids.js"

export interface AgentConfigOptions {
	modelName: string
	systemPrompt: string
	maxTurns: number
	temperature: number
	provider?: AgentProviderId
	claudePluginDir?: string
	claudePythonPath?: string
	claudeCommand?: string
	providerTimeoutMs?: number
}

export class AgentConfig {
	readonly modelName: string
	readonly systemPrompt: string
	readonly maxTurns: number
	readonly temperature: number
	readonly provider: AgentProviderId
	readonly claudePluginDir?: string
	readonly claudePythonPath?: string
	readonly claudeCommand?: string
	readonly providerTimeoutMs?: number

	constructor(options: AgentConfigOptions) {
		const provider = normalizeAgentProvider(options.provider)
		this.modelName = isClaudeSubscriptionDirectSdkProvider(provider)
			? normalizeClaudeSubscriptionDirectSdkModel(options.modelName)
			: options.modelName
		this.systemPrompt = options.systemPrompt
		this.maxTurns = options.maxTurns
		this.temperature = options.temperature
		this.provider = provider
		this.claudePluginDir = options.claudePluginDir
		this.claudePythonPath = options.claudePythonPath
		this.claudeCommand = options.claudeCommand
		this.providerTimeoutMs = options.providerTimeoutMs
	}

	static createDefault(overrides: Partial<AgentConfigOptions> = {}): AgentConfig {
		const provider = overrides.provider ?? OPENAI_CODEX_PROVIDER
		return new AgentConfig({
			modelName: isClaudeSubscriptionDirectSdkProvider(provider)
				? CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL
				: "gpt-5.6-terra",
			systemPrompt: "You are LUMI, an advanced agentic assistant.",
			maxTurns: 30,
			temperature: 0.2,
			...overrides,
		})
	}
}
