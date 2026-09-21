import { strict as assert } from "node:assert"
import { describe, it } from "mocha"
import { PlanModeEnforcer } from "../PlanModeEnforcer"

describe("PlanModeEnforcer architecture posture", () => {
	it("does not manufacture a scratchpad when steering is disabled", async () => {
		const enforcer = new PlanModeEnforcer("/tmp/lumi-native-plan", () => "disabled")

		assert.deepEqual(await enforcer.enforceStrategicReview(), { allowed: true })
		assert.match(await enforcer.generateStrategicReviewPrompts(), /scratchpad review is optional/i)
	})

	it("does not classify native vocabulary as a canonical layer violation", () => {
		const enforcer = new PlanModeEnforcer("/tmp/lumi-native-plan", () => "blended")
		const issues = enforcer.performArchitectAudit("The domain module calls the infrastructure adapter through a local boundary.")

		assert.equal(issues.some((issue) => issue.includes("Geo-Clash") || issue.includes("ARCHITECTURAL VIOLATIONS")), false)
	})
})
