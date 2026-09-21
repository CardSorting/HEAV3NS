import path from "node:path"
import { bootstrapProjectKnowledge, validateProjectKnowledge } from "../src/core/workspace-intelligence/ProjectKnowledgeLifecycle"

const args = new Set(process.argv.slice(2))
const bootstrap = args.has("--bootstrap")
const checkTransitions = args.has("--transitions")
const checkAppendOnly = args.has("--append-only")
const baselineRef = process.argv.find((arg) => arg.startsWith("--baseline="))?.slice("--baseline=".length)
const workspaceArg = process.argv.find((arg) => arg.startsWith("--workspace="))?.slice("--workspace=".length)

async function main(): Promise<void> {
	const cwd = path.resolve(workspaceArg ?? process.cwd())
	if (bootstrap) {
		const result = await bootstrapProjectKnowledge(cwd)
		if (result.warning) {
			console.error(result.warning)
			process.exitCode = 1
			return
		}
		for (const file of result.created) console.log(`created ${file}`)
	}

	const result = await validateProjectKnowledge(cwd, {
		checkTransitions,
		checkAppendOnly,
		baselineRef,
	})
	for (const diagnostic of result.diagnostics) {
		const location = [diagnostic.path, diagnostic.entityId].filter(Boolean).join("#")
		const prefix = diagnostic.severity === "error" ? "ERROR" : "WARN"
		console.log(`${prefix} ${diagnostic.code}${location ? ` (${location})` : ""}: ${diagnostic.message}`)
	}
	console.log(
		`${result.valid ? "valid" : "invalid"}: ${result.decisions.length} ADR(s), ${result.incidents.length} incident(s), ${result.followUps.length} follow-up(s), ${result.events.length} event(s)`,
	)
	if (!result.valid) process.exitCode = 1
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
