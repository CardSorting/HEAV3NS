import { appendFileSync, readFileSync } from "node:fs"

const [reportPath] = process.argv.slice(2)
const summaryPath = process.env.GITHUB_STEP_SUMMARY

if (!reportPath || !summaryPath) {
	console.error("Usage: GITHUB_STEP_SUMMARY=<path> node scripts/write-agent-flight-summary.mjs <report.json>")
	process.exit(2)
}

const report = JSON.parse(readFileSync(reportPath, "utf8"))
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const validReport =
	isObject(report) &&
	report.benchmark === "HEAV3NS Agent Flight Test" &&
	typeof report.version === "string" &&
	report.reportSchemaVersion === 2 &&
	report.track === "harness-conformance" &&
	typeof report.passed === "boolean" &&
	Array.isArray(report.scenarios) &&
	isObject(report.summary) &&
	Number.isInteger(report.summary.passedScenarios) &&
	Number.isInteger(report.summary.totalScenarios) &&
	Number.isInteger(report.summary.failedScenarios) &&
	isObject(report.runtime) &&
	typeof report.runtime.node === "string" &&
	isObject(report.source) &&
	(typeof report.source.revision === "string" || report.source.revision === null) &&
	(typeof report.source.worktreeDirty === "boolean" || report.source.worktreeDirty === null) &&
	/^[a-f0-9]{64}$/.test(report.source.benchmarkInputsSha256) &&
	Array.isArray(report.source.benchmarkInputFiles) &&
	report.source.benchmarkInputFiles.every((file) => typeof file === "string") &&
	new Set(report.source.benchmarkInputFiles).size === report.source.benchmarkInputFiles.length &&
	report.scenarios.every(
		(scenario) =>
			isObject(scenario) &&
			typeof scenario.id === "string" &&
			typeof scenario.name === "string" &&
			typeof scenario.passed === "boolean" &&
			typeof scenario.durationMs === "number" &&
			Number.isInteger(scenario.providerRequests) &&
			Number.isInteger(scenario.toolCalls) &&
			Array.isArray(scenario.assertions) &&
			scenario.assertions.every(
				(assertion) =>
					isObject(assertion) &&
					typeof assertion.name === "string" &&
					typeof assertion.passed === "boolean" &&
					typeof assertion.detail === "string",
			),
	) &&
	report.summary.totalScenarios === report.scenarios.length &&
	report.summary.passedScenarios === report.scenarios.filter((scenario) => scenario.passed).length &&
	report.summary.failedScenarios === report.summary.totalScenarios - report.summary.passedScenarios &&
	JSON.stringify(report.scenarios.map((scenario) => scenario.id)) === JSON.stringify(["FT-01", "FT-02", "FT-03", "FT-04", "FT-05"]) &&
	report.passed === (report.scenarios.length === 5 && report.scenarios.every((scenario) => scenario.passed))

if (!validReport) {
	console.error("Invalid Agent Flight Test report: expected the version 2 report contract.")
	process.exit(1)
}

const safe = (value) =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\\", "\\\\")
		.replaceAll("|", "\\|")
		.replaceAll("`", "\\`")
		.replace(/([*_{}\[\]!#])/g, "\\$1")
		.replace(/[\r\n]+/g, " ")
const rows = report.scenarios
	.map((scenario) => {
		const passed = scenario.assertions.filter((assertion) => assertion.passed).length
		const status = scenario.passed ? "PASS" : "FAIL"
		return `| ${safe(scenario.id)} | ${safe(scenario.name)} | ${status} | ${passed}/${scenario.assertions.length} |`
	})
	.join("\n")

const failedAssertions = report.scenarios.flatMap((scenario) =>
	scenario.assertions
		.filter((assertion) => !assertion.passed)
		.map((assertion) => `- **${safe(scenario.id)} · ${safe(assertion.name)}:** ${safe(assertion.detail)}`),
)
const artifactUrl = process.env.FLIGHT_REPORT_ARTIFACT_URL ?? ""
const reportLink = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/actions\/runs\/\d+\/artifacts\/\d+$/.test(artifactUrl)
	? `[Download full JSON report](${artifactUrl})`
	: "Full JSON report: open this workflow run's Artifacts section."

const lines = [
	`### Agent Flight Test: ${report.passed ? "PASS" : "FAIL"}`,
	"",
	`**${report.summary.passedScenarios}/${report.summary.totalScenarios}** harness-conformance scenarios · suite ${safe(report.version)} · schema ${safe(report.reportSchemaVersion)}`,
	"",
	`Provider: scripted local fixture · Runtime: ${safe(report.runtime.node)} · Commit: ${safe(report.source.revision ?? "unavailable")}`,
	"",
	"This checks harness integration only; it is not a live-model coding score.",
	"",
	"| ID | Scenario | Result | Checks |",
	"| --- | --- | --- | ---: |",
	rows,
	...(failedAssertions.length ? ["", "#### Failed checks", "", ...failedAssertions] : []),
	"",
	reportLink,
	"",
]

appendFileSync(summaryPath, lines.join("\n"), "utf8")
