import type { TaskAuditMetadata } from "./types"

/** Filters violations already present in the workspace baseline. */
export function filterNewViolationsSinceBaseline(
	violations: string[] | undefined,
	baseline: TaskAuditMetadata | undefined,
): string[] {
	if (!violations?.length) return []
	if (!baseline?.violations?.length) return violations
	const baselineSet = new Set(baseline.violations)
	return violations.filter((violation) => !baselineSet.has(violation))
}
