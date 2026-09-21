import { SystemPromptSection } from "../../templates/placeholders"
import { TemplateEngine } from "../../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../../types"
import { getToolUseExamplesSection } from "./examples"
import { getToolUseFormattingSection } from "./formatting"
import { getToolUseGuidelinesSection } from "./guidelines"
import { getToolUseToolsSection } from "./tools"

export async function getToolUseSection(variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const template = variant.componentOverrides?.[SystemPromptSection.TOOL_USE]?.template || TOOL_USE_TEMPLATE_TEXT

	const templateEngine = new TemplateEngine()
	return templateEngine.resolve(template, context, {
		TOOL_USE_FORMATTING_SECTION: await getToolUseFormattingSection(variant, context),
		TOOLS_SECTION: await getToolUseToolsSection(variant, context),
		TOOL_USE_EXAMPLES_SECTION: await getToolUseExamplesSection(variant, context),
		TOOL_USE_GUIDELINES_SECTION: await getToolUseGuidelinesSection(variant, context),
		CWD: context.cwd,
	})
}

const TOOL_USE_TEMPLATE_TEXT = (context: SystemPromptContext) => `TOOL USE

You have access to a set of tools that are executed upon the user's approval. ${context.enableParallelToolCalling ? "You may issue multiple independent read-only calls in one response; use dependent calls sequentially." : "Use one tool per message when the lane does not support parallel calls."} You will receive tool results in the user's response and must use those results before dependent work.

{{TOOL_USE_FORMATTING_SECTION}}

{{TOOLS_SECTION}}

{{TOOL_USE_EXAMPLES_SECTION}}

{{TOOL_USE_GUIDELINES_SECTION}}`
