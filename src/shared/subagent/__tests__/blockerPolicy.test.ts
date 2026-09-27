import { strict as assert } from "node:assert"
import { describe, it } from "mocha"
import {
	classifyBlockerSeverity,
	deriveLaneAuthorityState,
	filterAdvisoryParentSignals,
	isAdvisoryParentGateSignal,
} from "../blockerPolicy"

describe("blockerPolicy", () => {
	it("classifies parent context as advisory", () => {
		assert.equal(classifyBlockerSeverity("parent_context", "gate blocked"), "advisory")
	})

	it("never promotes a quality rating or its severity wording into lane authority", () => {
		for (const source of ["completion_gate", "lane_gate", "audit_preflight", "parent_context"] as const) {
			for (const reason of ["critical severity", "missing transcript", "retry cooldown", "failed lanes"]) {
				assert.equal(classifyBlockerSeverity(source, reason), "advisory")
			}
		}
	})

	it("classifies merge corruption as hard", () => {
		assert.equal(classifyBlockerSeverity("coordinator_merge", "split-brain lock authority detected"), "hard")
	})

	it("classifies supersession conflict as soft", () => {
		assert.equal(classifyBlockerSeverity("coordinator_merge", "unsealed retry cannot supersede prior sealed receipt"), "soft")
	})

	it("filters advisory parent gate signals", () => {
		const signals = [
			"ADVISORY: GATE: PARENT_BLOCKED (2)",
			"SIGNAL: PARENT_CRITICAL_VIOLATIONS",
			"ADVISORY: SIGNAL: PARENT_GATE_BLOCKED",
		]
		const advisory = filterAdvisoryParentSignals(signals)
		assert.equal(advisory.length, 3)
		assert.ok(advisory.every((s) => s.startsWith("ADVISORY:")))
		assert.ok(advisory.includes("ADVISORY: SIGNAL: PARENT_CRITICAL_VIOLATIONS"))
		assert.ok(isAdvisoryParentGateSignal("ADVISORY: GATE: PARENT_BLOCKED (2)"))
	})

	it("derives lane authority state for partial progress", () => {
		assert.equal(
			deriveLaneAuthorityState({
				status: "running",
				advisorySignalCount: 2,
				hasPartialResult: true,
			}),
			"partial",
		)
	})
})
