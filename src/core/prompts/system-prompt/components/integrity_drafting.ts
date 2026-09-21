import {
	detectWorkspaceArchitectureProfile,
	resolveWorkspaceArchitectureSteering,
} from "@/core/policy/WorkspaceArchitectureProfile"
import { TemplateEngine } from "../templates/TemplateEngine"
import type { PromptVariant, SystemPromptContext } from "../types"

const getIntegrityDraftingTemplateText = (steering: "disabled" | "blended" | "canonical") => {
	if (steering === "canonical") {
		return `[INTEGRITY_DRAFTING_CONTRACT]

- SCRATCHPAD_REQUIREMENT: Write physical scratchpad.md via write_to_file tool. Do NOT use internal <scratchpad> tags or thinking blocks.
- GROUNDED_TRIAD_AUDIT: Process every plan through 3 probes with cited file paths/evidence:
  1. THE ARCHITECT (Boundary Probe): Vulnerability, JoyZoning boundary compliance proof.
  2. THE CRITIC (Assumption Probe): Dangerous assumption, specific architectural fix/guardrail.
  3. THE SRE (Atomic Probe): Partial failure path, concrete atomic recovery logic & error boundaries.
- QUALITY_STANDARDS: Cite specific file paths (src/...) | Substantive depth | Concrete failure recovery path.
- AUDIT_TEMPLATE: Header # INTEGRITY AUDIT: [Task] | Probes (Boundary, Assumption, Atomic) | Final Resolution (Synthesis & verification).
- ACT_TRANSITION: Update implementation_plan.md -> Call plan_mode_respond immediately after final resolution.`
	}

	const artifactGuidance =
		steering === "blended"
			? "Use an existing workspace planning artifact when useful; do not create scratchpad.md solely for this contract."
			: "Keep planning in the workspace's normal notes or plan response; do not create scratchpad.md solely for this contract."
	const auditGuidance =
		steering === "blended"
			? "For non-trivial changes, use three lightweight probes with cited file paths/evidence: boundary fit, risky assumption, and partial-failure recovery."
			: "Keep review proportional to risk. For consequential changes, record boundary fit, risky assumptions, and partial-failure recovery with cited file paths/evidence."
	const transitionGuidance =
		steering === "blended"
			? "Keep implementation_plan.md or the established planning artifact current, then call plan_mode_respond after the plan is grounded."
			: "Present the grounded plan with plan_mode_respond; use implementation_plan.md only when it is already part of the workspace workflow."

	return `[INTEGRITY_DRAFTING_CONTRACT]

- PLANNING_ARTIFACT: ${artifactGuidance} Do NOT use internal <scratchpad> tags or thinking blocks.
- GROUNDED_PLAN_REVIEW: ${auditGuidance}
- QUALITY_STANDARDS: Cite specific file paths | Match the workspace's native terminology | State concrete verification and recovery paths.
- AUDIT_TEMPLATE: Boundary fit | Assumptions | Risks | Recovery | Synthesis & verification.
- ACT_TRANSITION: ${transitionGuidance}`
}

export async function getIntegrityDraftingSection(_variant: PromptVariant, context: SystemPromptContext): Promise<string> {
	const steering = resolveWorkspaceArchitectureSteering(
		context.workspaceArchitectureProfile ?? detectWorkspaceArchitectureProfile(context.cwd),
		context.joyZoningSteeringEnabled !== false,
	)
	const template = getIntegrityDraftingTemplateText(steering)
	return new TemplateEngine().resolve(template, context, {})
}
