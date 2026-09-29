import { strict as assert } from "node:assert"
import { visibleWidth } from "../../../tui/utils"
import { formatCockpitReport } from "../RoadmapCockpit"

describe("Roadmap cockpit progressive disclosure", () => {
	it("puts status and the next action before supporting details", () => {
		const report = formatCockpitReport({
			kanban_complete_allowed: true,
			agent_next_call: "Continue implementing the requested fix.",
		})
		assert.match(report, /^Roadmap cockpit\nStatus: Roadmap checks passed\nNext: Continue implementing/)
		assert.doesNotMatch(report, /Task complete|Steering Lineage Ledger/)
	})
	it("distinguishes mechanical cleanup from schema repair", () => {
		const payload = {
			kanban_complete_allowed: false,
			validation_pending: true,
			roadmap_gate: { blocking_gates: [{ id: "validation_current" }] },
		}
		assert.match(formatCockpitReport(payload), /Status: Roadmap checks pending/)
		assert.match(formatCockpitReport({ ...payload, schema_valid: false }), /Status: Roadmap needs attention/)
	})
	it("does not treat missing or contradictory gate evidence as ready", () => {
		assert.match(formatCockpitReport({}), /readiness is unknown/)
		assert.match(
			formatCockpitReport({ kanban_complete_allowed: true, roadmap_gate: { kanban_complete_allowed: false } }),
			/needs attention/,
		)
	})
	it("explains an empty roadmap and shows actionable navigation", () => {
		const report = formatCockpitReport({ roadmap_exists: false })
		assert.match(report, /Next: \/roadmap checkpoint/)
		assert.match(report, /No active items/)
		assert.match(report, /\/roadmap cockpit --verbose/)
	})
	for (const width of [80, 120]) {
		it(`wraps the complete recovery action at ${width} columns and bounds long task lists`, () => {
			const action =
				"Inspect the validation result and repair the missing roadmap sections before trying completion again. Keep unrelated work and recovery notes intact."
			const report = formatCockpitReport(
				{
					kanban_complete_allowed: true,
					agent_next_call: action,
					project_identity_line: "项目 👩‍💻 ".repeat(100),
					runtime_state: {
						tasks: {
							now: {
								items: Array.from({ length: 1000 }, (_, i) => ({
									id: String(i),
									title: "Review 工作 ".repeat(100),
								})),
							},
						},
					},
				},
				{ width },
			)
			assert.ok(report.split("\n").every((line) => visibleWidth(line) <= width))
			assert.ok(report.replace(/\s+/g, " ").includes(action))
			assert.match(report, /997 more items/)
			assert.ok(report.split("\n").length < 25)
		})
	}
	it("strips terminal control sequences from compact data", () => {
		const report = formatCockpitReport({ project_identity_line: "project\x1b[2J\rhidden" })
		assert.doesNotMatch(report, /\x1b|\r/)
	})
	it("tolerates incomplete persisted history in the detailed view", () => {
		assert.doesNotThrow(() =>
			formatCockpitReport({ workspace_state: { lineage: [null, { action: "recovered" }] } }, { verbose: true }),
		)
	})
})
