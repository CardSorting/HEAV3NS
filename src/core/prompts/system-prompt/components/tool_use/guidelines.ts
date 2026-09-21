import { TemplateEngine } from "../../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../../types"

export const TOOL_USE_GUIDELINES_TEMPLATE_TEXT = `# Tool Use Guidelines

1. In <thinking> tags, assess what information you already have and what information you need to proceed with the task.
2. Choose the most appropriate tool based on the task and the tool descriptions provided. Assess if you need additional information to proceed, and which of the available tools would be most effective for gathering this information. For example using the list_files tool is more effective than running a command like \`ls\` in the terminal. It's critical that you think about each available tool and use the one that best fits the current step in the task.
3. {{TOOL_BATCHING_GUIDANCE}} Do not assume the outcome of any tool use; dependent steps must use the returned result as their next input.
4. Formulate your tool use using the XML format specified for each tool.
5. After each tool use, use the returned result as the source of truth for the next step. It may include:
  - Information about whether the tool succeeded or failed, along with any reasons for failure.
  - Linter errors that may have arisen due to the changes you made, which you'll need to address.
  - New terminal output in reaction to the changes, which you may need to consider or act upon.
  - Any other relevant feedback or information related to the tool use.
6. Continue from the tool result as soon as it is available. The approval mechanism is the confirmation boundary; do not add a second conversational confirmation step. For mutations, verify the returned result before issuing dependent work.

`

export async function getToolUseGuidelinesSection(_variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const batchingGuidance = context.enableParallelToolCalling
		? "When actions are independent, batch read-only discovery calls in one response. Use sequential calls when one result determines the next, or when a mutation/approval must settle first."
		: "Use one tool at a time when the lane does not permit parallel calls, and wait for the result before dependent work."
	return new TemplateEngine().resolve(TOOL_USE_GUIDELINES_TEMPLATE_TEXT, context, {
		TOOL_BATCHING_GUIDANCE: batchingGuidance,
	})
}
