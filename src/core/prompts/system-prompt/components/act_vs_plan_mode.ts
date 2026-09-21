import {
	detectWorkspaceArchitectureProfile,
	resolveWorkspaceArchitectureSteering,
} from "@/core/policy/WorkspaceArchitectureProfile"
import { SystemPromptSection } from "../templates/placeholders"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const getActVsPlanModeTemplateText = (context: SystemPromptContext) => {
	const steering = resolveWorkspaceArchitectureSteering(
		context.workspaceArchitectureProfile ?? detectWorkspaceArchitectureProfile(context.cwd),
		context.joyZoningSteeringEnabled !== false,
	)
	const planningContract =
		steering === "canonical"
			? "Sovereign Drafting Requirement: Draft in scratchpad.md using Triad Audit (Architect, Critic, SRE) with verifiable evidence."
			: steering === "blended"
				? "Planning Contract: Use the workspace's existing planning notes when useful. Ground the plan in native boundaries, evidence, risks, and verification seams."
				: "Planning Contract: Keep planning lightweight and native to the workspace. Do not create a scratchpad or apply an additional architecture model solely for this workflow."

	return `[MODE_EXECUTION_CONTRACT]

- MODE_OVERVIEW: System manages PLAN/ACT mode transitions automatically based on environment_details.
- ACT_MODE: Execute tasks directly with all available tools. Complete with attempt_completion.
- PLAN_MODE: Gather context, explore codebase, architect detailed plan.
  - Existing Codebase Workflow: project_map first -> Fact Check (search_files/read_file) -> Plan.
  - ${planningContract}
  - Final Plan Delivery: Call plan_mode_respond with finished plan. System automatically transitions to ACT_MODE.
  - Scope Pivots: If user redirects scope in ACT_MODE, system transitions back to PLAN_MODE automatically.${context.yoloModeToggled === true ? " (YOLO_MODE: Tasks start directly in ACT_MODE, skipping plan phase.)" : ""}`
}

export async function getActVsPlanModeSection(variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const template = variant.componentOverrides?.[SystemPromptSection.ACT_VS_PLAN]?.template || getActVsPlanModeTemplateText

	return new TemplateEngine().resolve(template, context, {})
}
