import { lstat, mkdir, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { Logger } from "@/shared/services/Logger"
import {
	type SubsystemStabilityFact,
	type WorkspaceCognitiveModel,
	type WorkspaceIntelligenceArtifactRecord,
	type WorkspaceKnowledgeHealth,
} from "./types"

export class WorkspaceIntelligenceStore {
	constructor(private readonly workspaceRoot: string) {}

	async readModel(): Promise<WorkspaceCognitiveModel | undefined> {
		const intelligenceDir = await this.resolveIntelligenceDirectory(false)
		if (!intelligenceDir) return undefined
		const jsonPath = path.join(intelligenceDir, "workspace-intelligence.json")
		try {
			const modelStat = await lstat(jsonPath)
			if (modelStat.isSymbolicLink() || !modelStat.isFile()) return undefined
			const { readFile } = await import("node:fs/promises")
			const raw = await readFile(jsonPath, "utf-8")
			const parsed = JSON.parse(raw)
			if (parsed && typeof parsed === "object" && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2)) {
				// Migrate schemaVersion 1 to schemaVersion 2 facts collection on read!
				if (parsed.schemaVersion === 1) {
					parsed.schemaVersion = 2
					parsed.facts = []
					if (Array.isArray(parsed.stableSubsystems)) {
						for (const s of parsed.stableSubsystems) {
							parsed.facts.push({
								id: `fact-subsystem-${s.replace(/[^a-z0-9]+/g, "-")}-stability`,
								type: "subsystem_stability",
								value: { path: s, status: "stable" },
								confidence: "confirmed",
								provenance: [],
								lifecycle: "active",
								lastUpdated: parsed.generatedAt,
							})
						}
					}
					if (Array.isArray(parsed.volatileSubsystems)) {
						for (const s of parsed.volatileSubsystems) {
							parsed.facts.push({
								id: `fact-subsystem-${s.replace(/[^a-z0-9]+/g, "-")}-stability`,
								type: "subsystem_stability",
								value: { path: s, status: "volatile" },
								confidence: "confirmed",
								provenance: [],
								lifecycle: "active",
								lastUpdated: parsed.generatedAt,
							})
						}
					}
					if (Array.isArray(parsed.recentArchitectureDecisions)) {
						for (const d of parsed.recentArchitectureDecisions) {
							parsed.facts.push({
								id: `fact-adr-${d.id.toLowerCase()}`,
								type: "architecture_decision",
								value: d,
								confidence: "confirmed",
								provenance: [],
								lifecycle: "active",
								lastUpdated: parsed.generatedAt,
							})
						}
					}
					// clean up deprecated schemaVersion 1 properties
					delete parsed.stableSubsystems
					delete parsed.volatileSubsystems
					delete parsed.recentArchitectureDecisions
					delete parsed.staleDocumentationSurfaces
					delete parsed.recurringRiskAreas
					delete parsed.handoffRelevantFacts
				}
				return parsed as WorkspaceCognitiveModel
			}
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error)
			if (!errMsg.includes("ENOENT")) {
				Logger.warn(`[Workspace Knowledge System] Failed to parse existing model: ${errMsg}. Recovering best-effort.`)
				try {
					const { appendFile } = await import("node:fs/promises")
					const diagnosticsPath = path.join(intelligenceDir, "diagnostics.jsonl")
					await this.assertLocalFileDestination(diagnosticsPath)
					const entry = {
						severity: "warning" as const,
						code: "PARSE_ERROR",
						message: `failed to parse workspace-intelligence.json: ${errMsg}`,
						timestamp: new Date().toISOString(),
						source: "WorkspaceIntelligenceStore.readModel",
						recoveryHints: [
							"Verify if workspace-intelligence.json JSON format is valid.",
							"Restore a backup of workspace-intelligence.json if it is corrupted.",
						],
					}
					await appendFile(diagnosticsPath, `${JSON.stringify(entry)}\n`, "utf-8")
				} catch {
					// Stay advisory-only
				}
			}
			return undefined
		}
		return undefined
	}

	async writeModel(model: WorkspaceCognitiveModel): Promise<WorkspaceIntelligenceArtifactRecord[]> {
		const intelligenceDir = await this.resolveIntelligenceDirectory(true)
		if (!intelligenceDir) throw new Error("Workspace knowledge requires an existing local workspace directory.")

		const jsonPath = path.join(intelligenceDir, "workspace-intelligence.json")
		const mdPath = path.join(intelligenceDir, "workspace-intelligence.md")
		const diagnosticsPath = path.join(intelligenceDir, "diagnostics.jsonl")
		await this.assertLocalFileDestination(jsonPath)
		await this.assertLocalFileDestination(mdPath)
		await this.assertLocalFileDestination(diagnosticsPath)

		try {
			const { appendFile } = await import("node:fs/promises")
			const entry = {
				severity: "info" as const,
				code: "WRITE_SUCCESS",
				message: "workspace-intelligence.json written successfully",
				timestamp: new Date().toISOString(),
				source: "WorkspaceIntelligenceStore.writeModel",
				recoveryHints: [],
			}
			await appendFile(diagnosticsPath, `${JSON.stringify(entry)}\n`, "utf-8")
		} catch {
			// Stay advisory-only
		}

		let health: WorkspaceKnowledgeHealth | undefined
		try {
			const { WorkspaceIntelligenceReader } = await import("./WorkspaceIntelligenceReader")
			const reader = new WorkspaceIntelligenceReader(model, this.workspaceRoot)
			health = reader.getKnowledgeHealth()
		} catch {
			// Stay advisory-only
		}

		await writeFile(jsonPath, JSON.stringify(model, null, 2), "utf-8")
		await writeFile(mdPath, renderMarkdownModel(model, health), "utf-8")

		return [
			{
				relPath: ".wiki/intelligence/workspace-intelligence.json",
				absPath: jsonPath,
			},
			{
				relPath: ".wiki/intelligence/workspace-intelligence.md",
				absPath: mdPath,
			},
		]
	}

	private async resolveIntelligenceDirectory(create: boolean): Promise<string | undefined> {
		let root: string
		try {
			root = await realpath(this.workspaceRoot)
		} catch {
			return undefined
		}

		const directories = [path.join(root, ".wiki"), path.join(root, ".wiki", "intelligence")]
		for (const directory of directories) {
			let stat: Awaited<ReturnType<typeof lstat>>
			try {
				stat = await lstat(directory)
			} catch (error) {
				if (errorCode(error) !== "ENOENT") throw error
				if (!create) return undefined
				try {
					await mkdir(directory)
					stat = await lstat(directory)
				} catch (createError) {
					if (errorCode(createError) !== "EEXIST") throw createError
					stat = await lstat(directory)
				}
			}
			if (stat.isSymbolicLink() || !stat.isDirectory()) {
				if (create) throw new Error(`Workspace knowledge path must stay project-local: ${path.relative(root, directory)}`)
				return undefined
			}
		}
		return directories[1]
	}

	private async assertLocalFileDestination(filePath: string): Promise<void> {
		try {
			const stat = await lstat(filePath)
			if (stat.isSymbolicLink() || !stat.isFile()) {
				throw new Error(
					`Workspace knowledge artifact must stay project-local: ${path.relative(this.workspaceRoot, filePath)}`,
				)
			}
		} catch (error) {
			if (errorCode(error) !== "ENOENT") throw error
		}
	}
}

function errorCode(error: unknown): string | undefined {
	if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code
	return undefined
}

export function renderMarkdownModel(model: WorkspaceCognitiveModel, health?: WorkspaceKnowledgeHealth): string {
	const lines: string[] = []

	lines.push(`# Workspace Intelligence: ${model.workspaceName}`)
	lines.push("")

	if (health) {
		if (health.status === "degraded") {
			lines.push("> [!WARNING]")
			lines.push(`> **Workspace Knowledge Health: degraded**`)
			lines.push(`> - Last Degraded Reason: \`${health.lastDegradedReason || "Unknown"}\``)
			if (health.recoveryHints.length) {
				lines.push("> - Recovery Hints:")
				for (const hint of health.recoveryHints) {
					lines.push(`>   - ${hint}`)
				}
			}
		} else {
			lines.push("> [!NOTE]")
			lines.push(`> **Workspace Knowledge Health: healthy**`)
			if (health.lastSuccessfulWrite) {
				lines.push(`> - Last Successful Write: \`${health.lastSuccessfulWrite}\``)
			}
		}
		lines.push("")

		if (health.recentDiagnostics.length) {
			lines.push("<details>")
			lines.push("<summary>📋 Recent Knowledge System Diagnostics</summary>")
			lines.push("")
			lines.push("| Timestamp | Severity | Code | Source | Message |")
			lines.push("|---|---|---|---|---|")
			for (const diag of health.recentDiagnostics.slice(0, 10)) {
				lines.push(
					`| \`${diag.timestamp}\` | \`${diag.severity}\` | \`${diag.code}\` | \`${diag.source}\` | ${diag.message} |`,
				)
			}
			lines.push("")
			lines.push("</details>")
			lines.push("")
		}
	}

	lines.push(`- Generated At: \`${model.generatedAt}\``)
	lines.push(`- Task ID: \`${model.taskId}\``)
	lines.push(`- Finalization Run ID: \`${model.finalizationRunId}\``)
	lines.push("")

	lines.push("## Source Snapshot Summary", "")
	lines.push(`- Package name: ${model.sourceSnapshot.packageName ? `\`${model.sourceSnapshot.packageName}\`` : "_none_"}`)
	lines.push(
		`- Package version: ${model.sourceSnapshot.packageVersion ? `\`${model.sourceSnapshot.packageVersion}\`` : "_none_"}`,
	)
	lines.push(`- Detected manifests: ${model.sourceSnapshot.manifests.map((m) => `\`${m}\``).join(", ") || "_none_"}`)
	lines.push(
		`- Preferred validation scripts: ${model.sourceSnapshot.preferredCommands.map((c) => `\`${c}\``).join(", ") || "_none_"}`,
	)

	lines.push("", "## Drift Findings", "")
	if (!model.driftFindings.length) {
		lines.push("_No drift findings detected in this pass._")
	} else {
		lines.push("| Severity | Kind | Finding |")
		lines.push("|---|---|---|")
		for (const finding of model.driftFindings) {
			lines.push(`| ${finding.severity} | ${finding.kind} | ${escapeTableCell(finding.summary)} |`)
		}
	}

	lines.push("", "## Workspace State Projections", "")
	lines.push("### Stable Subsystems")
	lines.push(
		renderProvenanceFactsMarkdown(
			model.facts.filter(
				(f) => f.type === "subsystem_stability" && (f.value as SubsystemStabilityFact)?.status === "stable",
			),
			(v: SubsystemStabilityFact) => `${v.path} (${v.status})`,
		),
	)
	lines.push("", "### Volatile Subsystems")
	lines.push(
		renderProvenanceFactsMarkdown(
			model.facts.filter(
				(f) => f.type === "subsystem_stability" && (f.value as SubsystemStabilityFact)?.status === "volatile",
			),
			(v: SubsystemStabilityFact) => `${v.path} (${v.status})`,
		),
	)
	lines.push("", "### Recent Architecture Decisions")
	lines.push(
		renderProvenanceFactsMarkdown(
			model.facts.filter((f) => f.type === "architecture_decision"),
			(d: { id: string; title: string; status: string }) => `${d.id}: ${d.title} (${d.status})`,
		),
	)
	lines.push("", "### Stale Documentation Surfaces")
	lines.push(
		renderProvenanceFactsMarkdown(
			model.facts.filter((f) => f.type === "documentation_surface"),
			(v: { summary: string }) => v.summary,
		),
	)
	lines.push("", "### Recurring Risk Areas")
	lines.push(
		renderProvenanceFactsMarkdown(
			model.facts.filter((f) => f.type === "risk_area"),
			(v: { risk: string }) => v.risk,
		),
	)
	lines.push("", "### Handoff-Relevant Facts")
	lines.push(
		renderProvenanceFactsMarkdown(
			model.facts.filter((f) => f.type === "handoff_fact"),
			(v: { fact: string }) => v.fact,
		),
	)

	lines.push("", "## Meta Reflection", "")
	lines.push("### Repeated Friction")
	lines.push(markdownList(model.metaReflection.repeatedFriction))
	lines.push("", "### Rediscovery Costs")
	lines.push(markdownList(model.metaReflection.rediscoveryCosts))
	lines.push("", "### Self Improvements")
	lines.push(markdownList(model.metaReflection.selfImprovements))
	lines.push("")

	return `${lines.join("\n")}\n`
}

function renderProvenanceFactsMarkdown<T>(
	facts: Array<import("./types").WorkspaceFact> | undefined,
	renderer: (value: T) => string = (v) => String(v),
): string {
	if (!facts || !facts.length) return "_None recorded._"
	const lines: string[] = []
	for (const fact of facts) {
		lines.push(
			`- **${renderer(fact.value as T)}** (confidence: \`${fact.confidence}\`, lifecycle: \`${fact.lifecycle}\`, updated: \`${fact.lastUpdated}\`)`,
		)
		for (const prov of fact.provenance) {
			const typeIcon =
				prov.type === "agent_report"
					? "📝"
					: prov.type === "finalization_evidence"
						? "📜"
						: prov.type === "manifest"
							? "📦"
							: prov.type === "adr"
								? "🏛️"
								: "📁"
			const runInfo = prov.runId ? ` [run: \`${prov.runId.slice(0, 8)}\`]` : ""
			const pathInfo = prov.path ? ` in \`${prov.path}\`` : ""
			lines.push(`  - ${typeIcon} *${prov.description}*${pathInfo}${runInfo} (at \`${prov.timestamp}\`)`)
		}
	}
	return lines.join("\n")
}

function markdownList(items: string[]): string {
	if (!items.length) return "_None recorded._"
	return items.map((item) => `- ${item}`).join("\n")
}

function escapeTableCell(value: string): string {
	return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>")
}
