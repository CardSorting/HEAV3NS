import { writeFileSync } from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { AgentHarnessFlightTest } from "../src/tooling/extensions/evals/agent-flight-test.js"

function usage(): string {
	return [
		"Usage: npm run benchmark:flight -- [options]",
		"       npm run --silent benchmark:flight -- --format json  (clean JSON stream)",
		"",
		"Options:",
		"  -o, --output <path>  Write the full JSON report to a file",
		"  -f, --format <type>  Output `text` (default) or `json` to stdout",
		"  -h, --help           Show this help",
		"",
		"No provider credentials or network access are required.",
		"This suite checks harness conformance, not live-model coding quality.",
	].join("\n")
}

let values: { output?: string; format?: string; help?: boolean }
try {
	;({ values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			output: { type: "string", short: "o" },
			format: { type: "string", short: "f" },
			help: { type: "boolean", short: "h" },
		},
		strict: true,
	}))
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error))
	console.error(usage())
	process.exitCode = 2
	process.exit()
}

if (values.help) {
	console.log(usage())
	process.exit(0)
}

const format = values.format ?? "text"
if (format !== "text" && format !== "json") {
	console.error(`Unsupported output format: ${format}`)
	console.error(usage())
	process.exit(2)
}

const report = await new AgentHarnessFlightTest().run()
const jsonReport = `${JSON.stringify(report, null, 2)}\n`

if (values.output) {
	const outputPath = path.resolve(values.output)
	writeFileSync(outputPath, jsonReport, { encoding: "utf8" })
	if (format === "text") console.log(`JSON report: ${outputPath}`)
}

if (format === "json") {
	process.stdout.write(jsonReport)
} else {
	console.log(
		`${report.passed ? "PASS" : "FAIL"} · ${report.summary.passedScenarios}/${report.summary.totalScenarios} harness-conformance scenarios · v${report.version}`,
	)
	console.log("Track: deterministic local harness integration; this is not a model-quality score.")
	for (const scenario of report.scenarios) {
		const passedAssertions = scenario.assertions.filter((item) => item.passed).length
		console.log(
			`${scenario.passed ? "PASS" : "FAIL"} ${scenario.id} ${scenario.name} · ${passedAssertions}/${scenario.assertions.length} checks · ${scenario.durationMs} ms diagnostic`,
		)
		for (const item of scenario.assertions.filter((assertion) => !assertion.passed)) {
			console.log(`  - ${item.name}: ${item.detail}`)
		}
	}
	console.log(`Total wall time: ${report.totalDurationMs} ms diagnostic; do not compare across machines.`)
}

if (!report.passed) process.exitCode = 1
