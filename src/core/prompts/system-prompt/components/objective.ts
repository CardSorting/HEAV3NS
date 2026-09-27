import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const getObjectiveTemplateText = (context: SystemPromptContext) =>
	`[OBJECTIVE_CONTRACT]
- ITERATIVE_EXECUTION: Accomplish task sequentially. Analyze environment_details file structure and evaluate required vs inferred tool parameters inside <thinking></thinking> tags before tool use.
- PARAMETER_POLICY: Discover required parameters with available tools or infer them from evidence. Do not call tools with invented placeholders. Ask only for indispensable values that cannot be discovered${context.yoloModeToggled === true ? "; otherwise choose a grounded approach using the information available" : ""}. Do not ask for optional parameters if missing.
- ATTEMPT_COMPLETION_FUNNEL: attempt_completion is the sole authoritative funnel. Verify requirements & output files exist before completing. Never end completion results with questions/conversational offers.`

export async function getObjectiveSection(variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const template = variant.componentOverrides?.[SystemPromptSection.OBJECTIVE]?.template || getObjectiveTemplateText

	return new TemplateEngine().resolve(template, context, {})
}
