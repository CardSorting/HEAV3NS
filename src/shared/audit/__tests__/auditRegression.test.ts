import { buildRegressionGateSection, hasAuditScoreRegression } from "@shared/audit/auditRegression"
import { isCompletionBlockedByAudit } from "@shared/audit/completionAudit"
import { enrichAuditMetadata } from "@shared/audit/taskAuditUtils"
import { expect } from "chai"

describe("auditRegression", () => {
	it("detects score regression from plan baseline", () => {
		const baseline = enrichAuditMetadata({ violations: [] })
		const current = enrichAuditMetadata({ violations: ["result_empty"] })
		expect(baseline.hardening_score).to.be.above(current.hardening_score!)
		expect(hasAuditScoreRegression(baseline, current)).to.equal(true)
		expect(hasAuditScoreRegression(baseline, enrichAuditMetadata({ violations: [] }))).to.equal(false)
	})

	it("reports plan regression without blocking completion", () => {
		const baseline = enrichAuditMetadata({ violations: [] })
		const completion = enrichAuditMetadata({ violations: ["result_empty", "missing_validation_evidence"] })
		expect(
			isCompletionBlockedByAudit(completion, {
				planBaselineMetadata: baseline,
				planRegressionGateEnabled: true,
			}),
		).to.equal(false)
		expect(buildRegressionGateSection(baseline, completion)).to.contain("Plan Regression Gate")
	})
})
