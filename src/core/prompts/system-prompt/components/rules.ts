import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const BROWSER_RULES = `- BROWSER_POLICY: Use browser_action for non-dev web tasks (news/weather) only if no MCP tool is available.\n`

const BROWSER_WAIT_RULES = ` Launch site via browser_action, wait for user confirmation & screenshot, test functionality if needed, wait for screenshot, then close browser.`

const CLI_RULES = `- CLI_VALIDATION: Run project validation scripts (lint, tsc --noEmit, build) post-edit to catch issues early.\n`

const getRulesTemplateText = (context: SystemPromptContext) => `[CORE_OPERATIONAL_RULES]

- OPERATING_CWD: Fixed at '{{CWD}}'. Standalone cd is BANNED. Prepend cd <dir> && <cmd> for external operations.
- PATH_FORMAT: Exact path params required. Do NOT use ~ or $HOME.
- COMMAND_EXECUTION: Tailor commands to OS context | Prepend cd for external dirs | Prefix positional args with -- to prevent flag confusion | Verify results before assuming command success.
- SEARCH_REPLACE_RULES: Use replace_in_file or write_to_file directly without pre-displaying changes. In replace_in_file, include complete exact lines in SEARCH blocks ordered top-to-bottom as they appear in file. Valid XML markers strictly required.
- PROJECT_CREATION: Place new projects in dedicated directories with clean runnable structure.
- CONVERSATION_STYLE: DIRECT & TECHNICAL. BANNED INTROS: "Great", "Certainly", "Okay", "Sure". BANNED OUTROS: Never end attempt_completion with questions/conversational prompts.
- FOLLOWUP_QUESTIONS: ${context.yoloModeToggled !== true ? "Use ask_followup_question only when strictly required and tools cannot resolve the detail." : "Use available tools and best judgment without asking followup questions."}
- ACCURACY_VERIFICATION: Produce exact specified output without debug noise. Verify numerical/accuracy thresholds before completion.
{{BROWSER_RULES}}{{CLI_RULES}}- ENV_DETAILS: Auto-generated context at end of user messages—use for insight, do not assume user explicitly typed it. Check active terminals before re-launching servers.
- {{TOOL_SYNCHRONIZATION}}{{BROWSER_WAIT_RULES}}
- MCP_EXECUTION: Run MCP tools sequentially with success verification.`

export async function getRulesSection(variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const template = variant.componentOverrides?.[SystemPromptSection.RULES]?.template || getRulesTemplateText

	const browserRules = context.supportsBrowserUse ? BROWSER_RULES : ""
	const browserWaitRules = context.supportsBrowserUse ? BROWSER_WAIT_RULES : ""
	const cliRules = context.isCliEnvironment ? CLI_RULES : ""
	const toolSynchronization = context.enableParallelToolCalling
		? "TOOL_SYNCHRONIZATION: Batch independent read-only discovery calls when useful. Wait for each result before dependent work, and wait for mutation/approval results before building on them."
		: "TOOL_SYNCHRONIZATION: Wait for the result of each tool before making a dependent call. Do not ask for an extra human confirmation when the tool result or approval mechanism already provides it."

	const resolved = new TemplateEngine().resolve(template, context, {
		CWD: context.cwd || process.cwd(),
		BROWSER_RULES: browserRules,
		BROWSER_WAIT_RULES: browserWaitRules,
		CLI_RULES: cliRules,
		TOOL_SYNCHRONIZATION: toolSynchronization,
	})

	const isSubagent = context.isSubagentRun === true
	const ledgerLabel = context.joyZoningSteeringEnabled === false ? "KNOWLEDGE LEDGER" : "SOVEREIGN KNOWLEDGE LEDGER"
	const WIKI_RULES = isSubagent
		? `\n- ${ledgerLabel}: Return ledger-ready evidence for your assigned scope. Write directly to \`.wiki/\` only when your lane explicitly owns documentation and was launched with mutation/write-set authority; otherwise leave shared-ledger synthesis to the parent to avoid cross-lane conflicts. Do NOT attempt to run \`run_finalization\` (it is unavailable to subagents). When done, call \`attempt_completion\` to complete your task.`
		: `\n- ${ledgerLabel}: Maintain the project's Knowledge Ledger (SKL) through the workspace documentation workflow. For substantive changes, include a concise handoff summary when calling \`run_finalization\`: changed behavior, supporting project-local files/checks, affected decisions or constraints, and unresolved uncertainty. Its agent-reported summary is marked for verification and is not canonical truth. \`run_finalization\` is post-completion documentation maintenance only; it cannot authorize, block, reopen, or seal task completion.`

	const GOVERNED_AUTHORITY_RULES =
		context.subagentsEnabled === true
			? isSubagent
				? `\n- GOVERNED EXECUTION AUTHORITY: Lane receipts and gate envelopes are forensic history for the parent seal barrier — not permission to freeze sibling lanes or override coordinator decisions.`
				: `\n- GOVERNED EXECUTION AUTHORITY: Receipts, gate snapshots, and audit traces record history — they do not alone authorize halting the swarm. Only you (parent coordinator) decide merge, seal, and continuation. Do not stop delegated work solely because a lane receipt or stale audit suggests blockage; re-check current state and prefer repair/continuation over recursive escalation. Progress is evidence; repeated validation without state change is failure.`
			: ""

	let actModeRules = ""
	if (context.mode === "act") {
		actModeRules = `\n- EXECUTION RULE: Continue executing while a valid next action exists. Do not return to planning or request additional validation unless a named hard blocker prevents progress.\n- COMPLETION RULE: When all required work and verification conditions are satisfied, call \`attempt_completion\`. Advisory warnings do not block completion.`
	}

	const throughputRules = context.isSubagentRun
		? "\n- LANE_THROUGHPUT: Complete independent reads in parallel when the lane allows it. Make a reversible, evidence-backed assumption for non-critical ambiguity, state it in the report, and continue. Stop only for a hard authority, safety, or missing-input blocker.\n- LANE_HANDOFF: End with a concise result containing outcome, evidence paths, verification, changed files (if any), and blockers classified as hard or advisory."
		: context.subagentsEnabled === true
			? "\n- PARENT_THROUGHPUT: Dispatch independent research lanes together, let each lane finish its owned scope, and synthesize receipts before deciding whether a follow-up is necessary. Treat advisory findings as context, not automatic blockers."
			: ""

	return resolved + WIKI_RULES + GOVERNED_AUTHORITY_RULES + actModeRules + throughputRules
}
