import type { WorkspaceArchitectureSteering } from "@/core/policy/WorkspaceArchitectureProfile"

export function getDeepPlanningArchitectureGuidance(steering: WorkspaceArchitectureSteering): string {
	if (steering === "canonical") {
		return "Use canonical layer names only when the workspace is greenfield or explicitly JoyZoned; otherwise mirror native boundaries."
	}

	if (steering === "blended") {
		return "Treat JoyZoning classifications as advisory. Follow the repository's existing modules, naming, dependencies, and verification seams; never reorganize solely to fit canonical layers."
	}

	return "Do not apply JoyZoning steering, layer tags, or canonical folder assumptions. Follow the repository's existing boundaries, vocabulary, and verification seams."
}

export function getDeepPlanningAuditGuidance(steering: WorkspaceArchitectureSteering): string {
	if (steering === "canonical") {
		return "**Draft**: Use `scratchpad.md` for your investigation. You MUST follow the **Sovereign Triad V8 Template** (Grounding Probes -> Hazard Analysis -> Resolution)."
	}

	if (steering === "blended") {
		return "**Draft**: Use `scratchpad.md` only when it is an established workspace artifact or materially improves the plan; capture boundary, assumption, and recovery evidence in native terms."
	}

	return "**Draft**: Keep planning in the workspace's normal notes or plan document; do not create `scratchpad.md` solely for this workflow. Capture boundaries, assumptions, risks, and recovery evidence in native terms."
}

export function getDeepPlanningEvidenceLocation(steering: WorkspaceArchitectureSteering): string {
	if (steering === "canonical") return "`scratchpad.md`"
	if (steering === "blended") {
		return "the established workspace planning artifact (use `scratchpad.md` only if it already exists or is already part of the workflow)"
	}
	return "the plan response or the workspace's normal planning notes"
}

export function resolveDeepPlanningArchitectureGuidance(
	template: string,
	steering: WorkspaceArchitectureSteering = "canonical",
): string {
	return template
		.replaceAll("{{ARCHITECTURE_STEERING_GUIDANCE}}", getDeepPlanningArchitectureGuidance(steering))
		.replaceAll("{{DEEP_PLANNING_AUDIT_GUIDANCE}}", getDeepPlanningAuditGuidance(steering))
		.replaceAll("{{DEEP_PLANNING_EVIDENCE_LOCATION}}", getDeepPlanningEvidenceLocation(steering))
}
