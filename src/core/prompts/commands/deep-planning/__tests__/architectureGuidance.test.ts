import { strict as assert } from "node:assert"
import { describe, it } from "mocha"
import {
	getDeepPlanningArchitectureGuidance,
	getDeepPlanningAuditGuidance,
	resolveDeepPlanningArchitectureGuidance,
} from "../architectureGuidance"

describe("deep-planning architecture guidance", () => {
	it("keeps disabled steering native and avoids scratchpad creation", () => {
		const resolved = resolveDeepPlanningArchitectureGuidance(
			"{{ARCHITECTURE_STEERING_GUIDANCE}}\n{{DEEP_PLANNING_AUDIT_GUIDANCE}}\nEvidence: {{DEEP_PLANNING_EVIDENCE_LOCATION}}",
			"disabled",
		)

		assert.match(resolved, /Do not apply JoyZoning steering/i)
		assert.match(resolved, /do not create `scratchpad\.md` solely/i)
		assert.match(resolved, /plan response or the workspace's normal planning notes/i)
		assert.doesNotMatch(resolved, /Sovereign Triad/i)
	})

	it("keeps blended guidance advisory instead of relocation-oriented", () => {
		assert.match(getDeepPlanningArchitectureGuidance("blended"), /classifications as advisory/i)
		assert.match(getDeepPlanningAuditGuidance("blended"), /established workspace artifact/i)
	})
})
