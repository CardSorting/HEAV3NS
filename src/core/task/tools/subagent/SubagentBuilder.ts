import { buildApiHandler } from "@core/api"
import { PromptRegistry } from "@core/prompts/system-prompt"
import { DietCodeToolSet } from "@core/prompts/system-prompt/registry/DietCodeToolSet"
import type { SystemPromptContext } from "@core/prompts/system-prompt/types"
import type { LaneExecutionMode } from "@shared/subagent/governedExecution"
import { DietCodeDefaultTool } from "@shared/tools"
import {
	detectWorkspaceArchitectureProfile,
	resolveWorkspaceArchitectureSteering,
} from "@/core/policy/WorkspaceArchitectureProfile"
import { ApiConfiguration, ApiProvider } from "@/shared/api"
import { getProviderModelIdKey } from "@/shared/storage/provider-keys"
import type { TaskConfig } from "../types/TaskConfig"
import type { AgentBaseConfig } from "./AgentConfigLoader"
import { AgentConfigLoader } from "./AgentConfigLoader"

export type AgentConfig = Partial<AgentBaseConfig>

/**
 * Explicit dependency seam for subagent construction. ESM namespace exports
 * are immutable by design, so tests and embedders replace these ordinary
 * object properties instead of mutating imported module bindings.
 */
export const subagentBuilderRuntime = {
	getAgentConfigLoader: (): AgentConfigLoader => AgentConfigLoader.getInstance(),
	buildApiHandler,
	getModelFamily: (context: SystemPromptContext) => PromptRegistry.getInstance().getModelFamily(context),
	getToolsForVariantWithFallback: (family: ReturnType<PromptRegistry["getModelFamily"]>, tools: string[]) =>
		DietCodeToolSet.getToolsForVariantWithFallback(family, tools),
	getNativeConverter: (providerId: string, modelId?: string) => DietCodeToolSet.getNativeConverter(providerId, modelId),
}

export const SUBAGENT_DEFAULT_ALLOWED_TOOLS: DietCodeDefaultTool[] = [
	DietCodeDefaultTool.FILE_READ,
	DietCodeDefaultTool.FILE_EDIT,
	DietCodeDefaultTool.FILE_NEW,
	DietCodeDefaultTool.LIST_FILES,
	DietCodeDefaultTool.SEARCH,
	DietCodeDefaultTool.LIST_CODE_DEF,
	DietCodeDefaultTool.BASH,
	DietCodeDefaultTool.USE_SKILL,
	DietCodeDefaultTool.ATTEMPT,
	DietCodeDefaultTool.MCP_USE,
	DietCodeDefaultTool.MCP_ACCESS,
	DietCodeDefaultTool.MEM_REFRESH,
	DietCodeDefaultTool.STABILITY_DIAGNOSE,
	DietCodeDefaultTool.STABILITY_SWEEP,
]

export const SUBAGENT_NON_MUTATING_ALLOWED_TOOLS = new Set<DietCodeDefaultTool>([
	DietCodeDefaultTool.FILE_READ,
	DietCodeDefaultTool.LIST_FILES,
	DietCodeDefaultTool.SEARCH,
	DietCodeDefaultTool.LIST_CODE_DEF,
	DietCodeDefaultTool.USE_SKILL,
	DietCodeDefaultTool.STABILITY_DIAGNOSE,
	DietCodeDefaultTool.ATTEMPT,
])

export function constrainSubagentToolsForLane(tools: DietCodeDefaultTool[], mutatingAuthority: boolean): DietCodeDefaultTool[] {
	return mutatingAuthority ? tools : tools.filter((tool) => SUBAGENT_NON_MUTATING_ALLOWED_TOOLS.has(tool))
}

const CONSENSUS_PROTO = `
### PARENT RECONCILIATION
You cannot spawn peer agents from a worker lane. Complete your assigned work and local verification without waiting on unrelated lanes. Return useful evidence and remaining uncertainty directly to the parent; workers are compute, not an approval committee. The parent owns cross-lane reconciliation and the next action. If independent review would materially help, include 'SIGNAL: REVIEW_REQUESTED' with its exact scope as an advisory, never as a prerequisite to handoff. Do not claim consensus without actual supporting evidence.
`

const AUTONOMOUS_NUDGE_PROTO = `
AUTONOMOUS DISCOVERY: Resolve missing context with task-relevant reads and searches. Use 'mem_refresh' when it supplies needed evidence, not as a ritual. Make and state a reasonable scoped assumption when evidence supports it; return an exact missing input to the parent only when available discovery cannot resolve it.
ANTI-STALL: Do not wait for a parent response when a safe, reversible, evidence-backed next action exists. Stop only for a hard authority, safety, or missing-input blocker; record advisory uncertainty and continue.
AUTONOMY: Carry the assigned work through implementation, verification, and handoff using the parent's granted capabilities. Resolve routine choices yourself. Quality scores, severity labels, confidence ratings, and completion checklists are advisory; they never require user approval or prevent returning results to the parent. Reconcile useful findings and remaining uncertainty with the parent without repeating completed work to satisfy a rating.
`

const STRUCTURED_SIGNALING_PROTO = `
STRUCTURED SIGNALING: When signaling critical findings or final results, use structured markers [SIGNAL: ARCHITECTURE_VIOLATION] or [SIGNAL: SECURITY_RISK] followed by detailed JSON metadata if possible.
CONFIDENCE PRESERVATION: For the principal finding, report [confidence: high|medium|low|unknown], [confidence_reason: direct_evidence|indirect_evidence|underspecified_goal|conflicting_evidence|missing_context|exploratory_hypothesis|model_uncertainty|other], and [criticality: critical|important|advisory]. Low or unknown confidence is a valid exploratory result; do not inflate it to pass a gate. State material assumptions as "Assumption: ...".
`

const FORENSIC_AXIOMS = `
### FORENSIC HARDENING AXIOMS
1. DOCUMENTATION IS CODE: Return ledger-ready evidence for technical changes. Write to the shared Knowledge Ledger (.wiki/) only when this lane explicitly owns documentation and has mutation/write-set authority; the parent owns final cross-lane synthesis.
2. THE OMNI-BRIDGE RULE: When documentation is in scope, define constraints, schemas, and implementation patterns clearly enough for humans and agents to use.
3. HIERARCHICAL TAXONOMY: Documentation-owner lanes should follow the repository's existing wiki structure and avoid root clutter. Do not invent a taxonomy for a code-only task.
4. DECISIONS & RISK MAPPING: Record the "Why" and blast radius when the assigned scope changes a meaningful architectural decision.
5. ENVIRONMENTAL PARITY: Include the smallest useful self-verification commands when documentation is owned by the lane.
6. VISUAL CLARITY: Use Mermaid only when a diagram materially clarifies a complex relationship or state flow.
7. ENVIRONMENTAL REALITY: Document what the workspace is, not just what changed, when the assigned scope calls for it.
8. PHYSICAL VERIFICATION RULE: Cite relative paths of modified files in owned documentation.
9. METABOLIC CITATIONS GAUGE: Documentation depth is proportional to churn and risk.
10. ZERO HALLUCINATION: Citations must be grounded in actual file reads and tool diagnostics.
11. ANTI-STALL: Avoid massive git-log reads; use structural tools and focused evidence.
12. STRUCTURAL SYNC: Verify only the wiki links and indexes touched by the lane.
`

export const SUBAGENT_EXECUTION_CONTRACT = `
### WORKER EXECUTION CONTRACT — HEAV3NS MANDATE
Own the assigned objective through INSPECT → REASON → ACT → OBSERVE → ADAPT → VERIFY. Use the parent's granted capabilities to implement and repair within the assigned scope; do not stop at a plan, recommendation, or fixable defect. Discover routine choices from the environment instead of asking for permission to do already-authorized work.
Observe command output and exit status, inspect changed state, and reproduce the previously failing path after repair. Repair missing observation before claiming a result.
NO BLIND RETRIES: Before retrying, identify what failed, the evidence, and what material input, state, or approach will change. If nothing changes, investigate or choose another approach instead of repeating the action.
Remove redundant local gates when no required invariant depends on them. Preserve actual scope, cancellation, data integrity, and truthful results. Do not declare conflicting or unmerged work successfully applied.
HANDOFF AND FINISH: Return the outcome, relevant evidence, verification, changed files, and unresolved assumptions concisely. Once the assigned outcome works and relevant verification passes, hand off and stop; do not create another audit, architecture report, or cleanup pass merely to satisfy a rating.
Prefer repository-native commands and terminal evidence. Do not assume an editor UI or an interactive IDE is available. Keep progress updates short, decision-oriented, and useful to the parent orchestrator.
`

interface SubagentLaneContext {
	index: number
	executionMode: LaneExecutionMode
	readSet?: string[]
	writeSet?: string[]
	dependsOn?: number[]
	lockRequired?: boolean
}

export const SUBAGENT_SYSTEM_SUFFIX = `
${AUTONOMOUS_NUDGE_PROTO}
${STRUCTURED_SIGNALING_PROTO}
${CONSENSUS_PROTO}
${FORENSIC_AXIOMS}

Standardized Swarm Reporting:
1. ARCHITECTURE CONTEXT: Use the repository's architectural layers (Domain, Core, Infrastructure, UI, or Plumbing) when they materially explain a finding; do not classify every explored file for ceremony.
2. DOMAIN-FIRST: Prioritize understanding the Domain layer before exploring implementation details in Infrastructure or UI.
3. TASK-RELEVANT REPORTING: Include "JoyZoning Alignment" only when the task changes or investigates architecture; routine results need no additional architecture report.
4. DEPENDENCY RULE: Ensure your recommendations respect the "Outside-In" dependency rule (Infrastructure/UI -> Core -> Domain).
5. SWARM IDENTITY: You are part of a collective swarm. Value inherited context as foundational truth, but adjust dynamically based on your specialized research.
6. SHARED KNOWLEDGE: Proactively signal critical findings (hotspots, violations) via your result messages to inform the broader swarm.
7. AUTONOMOUS DISCOVERY: Resolve uncertainty with available evidence and scoped assumptions; report only genuinely unresolved inputs to the parent.
8. STRUCTURED SIGNALING: When signaling critical findings or final results, use structured markers [SIGNAL: ARCHITECTURE_VIOLATION] or [SIGNAL: SECURITY_RISK] followed by detailed JSON metadata if possible.
`

const SUBAGENT_NEUTRAL_SYSTEM_SUFFIX = `
${AUTONOMOUS_NUDGE_PROTO}
${STRUCTURED_SIGNALING_PROTO}
${CONSENSUS_PROTO}
${FORENSIC_AXIOMS}

Standardized Swarm Reporting:
1. ARCHITECTURE CONTEXT: Identify repository roles, boundaries, or ownership when they materially explain a finding, not for every explored file.
2. EVIDENCE-FIRST: Prioritize files directly connected to the task before expanding into adjacent implementation details.
3. TASK-RELEVANT REPORTING: Include an "Architecture Fit" section only when the task changes or investigates repository boundaries or conventions.
4. BOUNDARY RULE: Preserve the repository's existing dependency direction and import conventions; do not introduce a new architecture vocabulary without evidence.
5. SWARM IDENTITY: You are part of a collective swarm. Value inherited context as foundational truth, but adjust dynamically based on your specialized research.
6. SHARED KNOWLEDGE: Proactively signal critical findings (hotspots, violations) via your result messages to inform the broader swarm.
7. AUTONOMOUS DISCOVERY: Resolve uncertainty with available evidence and scoped assumptions; report only genuinely unresolved inputs to the parent.
8. STRUCTURED SIGNALING: When signaling critical findings or final results, use structured markers [SIGNAL: ARCHITECTURE_VIOLATION] or [SIGNAL: SECURITY_RISK] followed by detailed JSON metadata if possible.
`

const SUBAGENT_BLENDED_SYSTEM_SUFFIX = `
${AUTONOMOUS_NUDGE_PROTO}
${STRUCTURED_SIGNALING_PROTO}
${CONSENSUS_PROTO}
${FORENSIC_AXIOMS}

Standardized Swarm Reporting:
1. ARCHITECTURE CONTEXT: Identify repository roles, boundaries, or ownership when they materially explain a finding, not for every explored file.
2. EVIDENCE-FIRST: Prioritize files directly connected to the task before expanding into adjacent implementation details.
3. TASK-RELEVANT REPORTING: Include an "Architecture Fit" section only when the task changes or investigates architecture, and note any JoyZoning signals as advisory.
4. BOUNDARY RULE: Preserve the repository's existing dependency direction and import conventions; use layer classification as evidence, not as a folder contract.
5. COHESION RULE: Keep decisions, effects, ownership, and verification explicit at the workspace's existing seams without introducing canonical directories for appearance.
6. SWARM IDENTITY: You are part of a collective swarm. Value inherited context as foundational truth, but adjust dynamically based on your specialized research.
7. SHARED KNOWLEDGE: Proactively signal critical findings (hotspots, violations) via your result messages to inform the broader swarm.
8. AUTONOMOUS DISCOVERY: Resolve uncertainty with available evidence and scoped assumptions; report only genuinely unresolved inputs to the parent.
9. STRUCTURED SIGNALING: When signaling critical findings or final results, use structured markers [SIGNAL: ARCHITECTURE_VIOLATION] or [SIGNAL: SECURITY_RISK] followed by detailed JSON metadata if possible.
`

export class SubagentBuilder {
	private readonly agentConfig: AgentConfig = {}
	private allowedTools: DietCodeDefaultTool[]
	private readonly apiHandler: ReturnType<typeof buildApiHandler>
	private parentStreamContext: string | null = null
	private siblingLanesContext = ""
	private laneContext?: SubagentLaneContext

	constructor(
		private readonly baseConfig: TaskConfig,
		subagentName?: string,
	) {
		const subagentConfig = subagentBuilderRuntime.getAgentConfigLoader().getCachedConfig(subagentName)
		this.agentConfig = subagentConfig ?? {}
		this.allowedTools = this.resolveAllowedTools(this.agentConfig.tools)

		const mode = this.baseConfig.services.stateManager.getGlobalSettingsKey("mode")
		const apiConfiguration = this.baseConfig.services.stateManager.getApiConfiguration()
		const effectiveApiConfiguration = {
			...apiConfiguration,
			ulid: this.baseConfig.ulid,
		}

		this.applyModelOverride(effectiveApiConfiguration as Record<string, unknown>, mode, this.agentConfig.modelId)
		this.apiHandler = subagentBuilderRuntime.buildApiHandler(effectiveApiConfiguration as typeof apiConfiguration, mode)
	}

	setAllowedTools(tools: DietCodeDefaultTool[]): void {
		this.allowedTools = Array.from(new Set([...tools, DietCodeDefaultTool.ATTEMPT]))
	}

	getApiHandler(): ReturnType<typeof buildApiHandler> {
		return this.apiHandler
	}

	setParentStreamContext(context: string): void {
		this.parentStreamContext = context
	}

	setSiblingLanesContext(context: string): void {
		this.siblingLanesContext = context
	}

	setLaneExecutionContext(context: SubagentLaneContext): void {
		this.laneContext = context
	}

	getAllowedTools(): DietCodeDefaultTool[] {
		return this.allowedTools
	}

	getConfiguredSkills(): string[] | undefined {
		return this.agentConfig.skills
	}

	buildSystemPrompt(generatedSystemPrompt: string): string {
		const configuredSystemPrompt = this.agentConfig?.systemPrompt?.trim()
		const systemPrompt = configuredSystemPrompt || generatedSystemPrompt

		// Nesting depth awareness for the subagent
		const currentDepth = this.baseConfig.taskState?.recursionDepth || 0
		const depthBlock = `\n\n# SWARM NESTING CONTEXT\nYou are operating at nesting depth ${currentDepth} (Max: 3). ${currentDepth >= 2 ? "You are at a deep structural layer; avoid spawning further subagents unless absolutely critical." : ""}`
		const laneBlock = this.laneContext
			? `\n\n# LANE OPERATING CONTRACT\nLane ${this.laneContext.index + 1} is ${this.laneContext.executionMode}.\n` +
				`Read scope: ${this.laneContext.readSet?.length ? this.laneContext.readSet.join(", ") : "task-relevant workspace evidence"}.\n` +
				`Write scope: ${this.laneContext.writeSet?.length ? this.laneContext.writeSet.join(", ") : "none declared"}.\n` +
				`Prerequisites: ${this.laneContext.dependsOn?.length ? this.laneContext.dependsOn.map((index) => `lane ${index + 1}`).join(", ") : "none"}.\n` +
				`Authority: ${this.laneContext.lockRequired ? "mutation is permitted only after the governed lane claim/lock is acquired for the declared scope" : "read/audit authority only; do not mutate workspace files"}.\n` +
				"Operate independently for work outside declared prerequisites. Honor dependency results before dependent work; do not wait on unrelated siblings. Batch independent reads when allowed, verify before dependent work, and finish with outcome, evidence, verification, changed files, assumptions, and hard/advisory blockers."
			: ""

		const joyZoningSteeringEnabled =
			this.baseConfig.services.stateManager.getGlobalSettingsKey("joyZoningSteeringEnabled") !== false
		const steeringMode = joyZoningSteeringEnabled
			? (this.baseConfig.universalGuard?.getArchitectureSteering?.() ??
				resolveWorkspaceArchitectureSteering(
					this.baseConfig.universalGuard?.getArchitectureProfile?.() ??
						detectWorkspaceArchitectureProfile(this.baseConfig.cwd),
					true,
				))
			: "disabled"

		const architectureSignal =
			steeringMode === "canonical"
				? `\n\n# SUBSTRATE HEALTH SIGNAL\n[STATUS: JOY-ZONED]\n[SIGNAL: Every file you modify must respect the architecture axioms defined in 'SOVEREIGN_GUIDE.md'.]`
				: steeringMode === "blended"
					? `\n\n# SUBSTRATE HEALTH SIGNAL\n[STATUS: WORKSPACE-NATIVE]\n[SIGNAL: Mirror the repository's existing boundaries, conventions, and tests. Use JoyZoning as advisory evidence; do not impose canonical folders or layer tags.]`
					: `\n\n# SUBSTRATE HEALTH SIGNAL\n[STATUS: WORKSPACE-NATIVE]\n[SIGNAL: Mirror the repository's existing boundaries, conventions, and tests; do not impose an additional architecture model.]`

		const parentContextBlock = this.parentStreamContext
			? `\n\n# Parent Agent Context\n${this.parentStreamContext}\nUse the context above to prioritize your research within the broader task goals.`
			: ""

		const siblingLanesBlock = this.siblingLanesContext
			? `\n\n# SIBLING LANES CONTEXT\n${this.siblingLanesContext}\nUse the context above to coordinate with other completed lanes and prevent redundant work.`
			: ""

		// Cross-Agent Intelligence (Blackboard)
		const blackboard = this.baseConfig.taskState?.swarmBlackboard || []
		const blackboardBlock =
			blackboard.length > 0
				? `\n\n# SWARM BLACKBOARD (Shared Intelligence)\n${blackboard.map((f) => `- ${f}`).join("\n")}\nCONSIDER the findings above. If your research contradicts or supports these findings, signal it explicitly.`
				: ""

		const suffix =
			steeringMode === "canonical"
				? SUBAGENT_SYSTEM_SUFFIX
				: steeringMode === "blended"
					? SUBAGENT_BLENDED_SYSTEM_SUFFIX
					: SUBAGENT_NEUTRAL_SYSTEM_SUFFIX
		return `${this.buildAgentIdentitySystemPrefix()}${systemPrompt}${depthBlock}${laneBlock}${architectureSignal}${parentContextBlock}${siblingLanesBlock}${blackboardBlock}${SUBAGENT_EXECUTION_CONTRACT}${suffix}`
	}

	buildNativeTools(context: SystemPromptContext) {
		const family = subagentBuilderRuntime.getModelFamily(context)
		const toolSets = subagentBuilderRuntime.getToolsForVariantWithFallback(family, this.allowedTools)
		const filteredToolSpecs = toolSets
			.map((toolSet) => toolSet.config)
			.filter(
				(toolSpec) =>
					this.allowedTools.includes(toolSpec.id) &&
					(!toolSpec.contextRequirements || toolSpec.contextRequirements(context)),
			)

		const converter = subagentBuilderRuntime.getNativeConverter(
			context.providerInfo.providerId,
			context.providerInfo.model.id,
		)
		return filteredToolSpecs.map((tool) => converter(tool, context))
	}

	private resolveAllowedTools(configuredTools?: DietCodeDefaultTool[]): DietCodeDefaultTool[] {
		const sourceTools = configuredTools && configuredTools.length > 0 ? configuredTools : SUBAGENT_DEFAULT_ALLOWED_TOOLS
		return Array.from(new Set([...sourceTools, DietCodeDefaultTool.ATTEMPT]))
	}

	private buildAgentIdentitySystemPrefix(): string {
		const name = this.agentConfig?.name?.trim()
		const description = this.agentConfig?.description?.trim()

		if (!name && !description) {
			return ""
		}

		const lines = ["# AGENT PROFILE"]
		if (name) {
			lines.push(`Identity: ${name}`)
		}
		if (description) {
			lines.push(`Objective: ${description}`)
		}

		return `${lines.join("\n")}\n\n`
	}

	private applyModelOverride(apiConfiguration: ApiConfiguration, _mode: string, modelId?: string): void {
		const trimmedModelId = modelId?.trim()
		if (!trimmedModelId) {
			// Even if no modelId is overridden, we still apply the thinking budget for subagents
			this.applyThinkingBudgetOverride(apiConfiguration)
			return
		}

		const modeKey = _mode === "plan" ? "plan" : "act"
		const providerKey = _mode === "plan" ? "planModeApiProvider" : "actModeApiProvider"
		const provider = apiConfiguration[providerKey as keyof ApiConfiguration] as ApiProvider
		if (provider) {
			const modelKey = getProviderModelIdKey(provider, modeKey)
			const config = apiConfiguration as Record<string, unknown>
			if (modelKey in config) {
				config[modelKey] = trimmedModelId
			}
		}

		// Apply thinking budget after model override
		this.applyThinkingBudgetOverride(apiConfiguration)
	}

	/** Inherit explicit parent budgets; use a worker default only when none was configured. */
	private applyThinkingBudgetOverride(apiConfig: ApiConfiguration): void {
		const config = apiConfig as Record<string, unknown>
		if (config.thinkingBudgetTokens === undefined || config.thinkingBudgetTokens === null) {
			config.thinkingBudgetTokens = 8192
		}
	}
}
