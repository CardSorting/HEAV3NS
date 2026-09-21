import type { Dirent } from "node:fs"
import { lstat, mkdir, open, readdir, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { bootstrapProjectKnowledge, buildProjectLifecycleContext } from "./ProjectKnowledgeLifecycle"
import { WorkspaceIntelligenceReader } from "./WorkspaceIntelligenceReader"
import { WorkspaceIntelligenceStore } from "./WorkspaceIntelligenceStore"

const MAX_CONTEXT_CHARS = 12_000
const MAX_KNOWLEDGE_FILES = 240
const MAX_KNOWLEDGE_SCAN_BYTES = 768_000
const MAX_RELEVANT_DOCUMENTS = 4

const ENTRY_DOCUMENTS = [
	"AGENTS.md",
	"README.md",
	"CONTRIBUTING.md",
	"PRODUCT.md",
	"ROADMAP.md",
	"DECISIONS.md",
	"WIKI.md",
	"TROUBLESHOOTING.md",
	"HANDOFF.md",
	".wiki/index.md",
	".wiki/agent/agent-memory.md",
	".wiki/agent/playbook.md",
] as const

const KNOWLEDGE_DIRECTORIES = [
	".wiki/agent",
	".wiki/architecture",
	".wiki/adr",
	".wiki/policy",
	".wiki/roadmap",
	".wiki/ip",
	"docs/adr",
	"docs/architecture",
	"docs/decisions",
	"docs/policies",
] as const

const IGNORED_ENTRIES = new Set([".git", "node_modules", "dist", "out", "coverage", "__pycache__"])
const SEARCH_STOP_WORDS = new Set([
	"after",
	"also",
	"and",
	"are",
	"before",
	"but",
	"can",
	"could",
	"does",
	"for",
	"from",
	"have",
	"into",
	"just",
	"more",
	"need",
	"only",
	"please",
	"should",
	"that",
	"the",
	"their",
	"then",
	"this",
	"through",
	"with",
	"work",
	"working",
	"would",
	"your",
])

interface WorkspacePackageShape {
	name?: unknown
	version?: unknown
	scripts?: unknown
}

interface ScannedDocument {
	path: string
	text: string
	score: number
}

export interface WorkspaceKnowledgeBootstrapResult {
	created: string[]
	warning?: string
}

/**
 * Ensure every project has a small, project-local knowledge entry surface.
 * Existing pages are preserved; this only creates missing files.
 */
export async function bootstrapWorkspaceKnowledge(cwd: string): Promise<WorkspaceKnowledgeBootstrapResult> {
	const created: string[] = []
	try {
		const root = await workspaceRoot(cwd)
		await ensureLocalDirectory(root, ".wiki")
		await ensureLocalDirectory(root, ".wiki/agent")

		const entrySources = await discoverEntrySources(root)
		const packageIdentity = await readPackageIdentity(root)
		const files = [
			{
				path: ".wiki/index.md",
				content: buildBootstrapIndex(packageIdentity, entrySources),
			},
			{
				path: ".wiki/agent/playbook.md",
				content: buildBootstrapPlaybook(),
			},
		]

		for (const file of files) {
			if (await writeNewWorkspaceFile(root, file.path, file.content)) created.push(file.path)
		}
		const lifecycle = await bootstrapProjectKnowledge(root)
		created.push(...lifecycle.created)
		return { created, warning: lifecycle.warning }
	} catch (error) {
		return {
			created,
			warning: `Project knowledge bootstrap could not write local entry files: ${errorMessage(error)}.`,
		}
	}
}

/**
 * Build the bounded project-local knowledge context inserted into each fresh task prompt.
 * The workspace files remain canonical; database-backed memory is intentionally not read here.
 */
export async function loadWorkspaceKnowledgeContext(cwd: string, taskDescription: string): Promise<string> {
	const root = await workspaceRoot(cwd)
	const bootstrap = await bootstrapWorkspaceKnowledge(root)
	const tokens = searchTerms(taskDescription)
	const sections: Array<{ title: string; body: string; limit: number }> = []
	let lifecycleDecisionIds: string[] = []

	sections.push({
		title: "Entry status",
		limit: 650,
		body: [
			`Workspace: ${path.basename(root) || "unnamed workspace"}.`,
			"This context is built from this project's files. Read excerpts as evidence pointers and verify consequential claims against current source, tests, runtime evidence, and explicit project instructions.",
			"When evidence conflicts, classify the disagreement and keep it unresolved until reconciled. No stored summary automatically overrides the other evidence.",
			bootstrap.warning,
		]
			.filter(Boolean)
			.join("\n"),
	})

	sections.push({
		title: "Base project orientation",
		limit: 1_000,
		body: await buildOrientationSection(root),
	})

	try {
		const lifecycle = await buildProjectLifecycleContext(root, taskDescription)
		lifecycleDecisionIds = lifecycle.validation.decisions.map((decision) => decision.id)
		sections.push({
			title: "Task-scoped ADR and incident lifecycle",
			limit: 3_600,
			body: lifecycle.text,
		})
	} catch (error) {
		sections.push({
			title: "Task-scoped ADR and incident lifecycle",
			limit: 900,
			body: `Lifecycle registries could not be safely read. Treat decision and incident state as unresolved; inspect project-local .wiki/adr/lifecycle.json, .wiki/incidents/register.json, .wiki/incidents/events.jsonl, and supporting project files. ${errorMessage(error)}`,
		})
	}

	sections.push({
		title: "Project instructions and knowledge entry points",
		limit: 2_000,
		body: await buildInstructionSection(root),
	})

	const model = await new WorkspaceIntelligenceStore(root).readModel()
	if (model) {
		try {
			sections.push({
				title: "Task-relevant local model",
				limit: 2_300,
				body: new WorkspaceIntelligenceReader(model, root).getTaskScopedSummary(taskDescription),
			})
		} catch {
			sections.push({
				title: "Task-relevant local model",
				limit: 700,
				body: "A workspace model file exists but could not be safely interpreted. Treat its claims as unresolved and inspect the local JSON, sources, tests, and project instructions before relying on it.",
			})
		}
	} else {
		sections.push({
			title: "Current-state coverage",
			limit: 700,
			body: "No readable `.wiki/intelligence/workspace-intelligence.json` exists yet. This session has a bootstrapped local entry map, but current state, decisions, and evidence coverage remain unresolved until verified and recorded.",
		})
	}

	const relevantDocuments = await findRelevantDocuments(root, tokens, lifecycleDecisionIds)
	sections.push({
		title: "Task-relevant project knowledge",
		limit: 2_400,
		body: relevantDocuments.length
			? relevantDocuments.map((document) => `Source: ${document.path}\n${excerpt(document.text, 1_050)}`).join("\n\n")
			: "No task-matched decision or guide excerpts were found in the bounded project knowledge scan. Follow the local source pointers above and verify directly.",
	})

	const rendered = sections.map(({ title, body, limit }) => `## ${title}\n${excerpt(body, limit)}`).join("\n\n")
	return `PROJECT-LOCAL KNOWLEDGE\n\n${excerpt(rendered, MAX_CONTEXT_CHARS)}\n\nAfter substantive changes, call run_finalization with a concise handoff covering changed behavior, supporting project-local files or checks, affected decisions/constraints/incidents, and uncertainty. If a consequential decision or qualifying incident changed, also submit complete structured project_knowledge JSON records. Never infer canonical ADR/incident state from handoff prose. Preserve append-only incident events and unresolved follow-ups; do not create ADRs for trivial choices, incidents for ordinary bugs, or claim verification/closure without evidence. The stored handoff remains an unverified agent report.\n\nEnd of bounded knowledge context. Open the cited local files before relying on an excerpt.`
}

async function buildOrientationSection(root: string): Promise<string> {
	const packageText = await readWorkspaceText(root, "package.json", 20_000)
	let packageIdentity = "No package identity was observed from `package.json`."
	let scriptsLine = "No package scripts were observed."
	if (packageText) {
		try {
			const parsed = JSON.parse(packageText.text) as WorkspacePackageShape
			const name = typeof parsed.name === "string" ? parsed.name : undefined
			const version = typeof parsed.version === "string" ? parsed.version : undefined
			if (name || version)
				packageIdentity = `Observed package identity: ${[name, version].filter(Boolean).join(" @ ")} [package.json].`
			if (parsed.scripts && typeof parsed.scripts === "object" && !Array.isArray(parsed.scripts)) {
				const scripts = Object.keys(parsed.scripts).sort().slice(0, 10)
				if (scripts.length)
					scriptsLine = `Observed package scripts: ${scripts.map((script) => `\`${script}\``).join(", ")} [package.json].`
			}
		} catch {
			packageIdentity = "`package.json` exists but could not be parsed; package identity is unresolved."
		}
	}

	const readme = await readWorkspaceText(root, "README.md", 2_500)
	const readmeExcerpt = readme ? excerpt(readme.text, 850) : "No `README.md` was observed."
	const rootEntries = await listRootEntries(root)
	const sources = (await discoverEntrySources(root)).map((source) => `\`${source}\``)
	return [
		packageIdentity,
		scriptsLine,
		`Observed root entries: ${rootEntries.length ? rootEntries.map((entry) => `\`${entry}\``).join(", ") : "none readable"}.`,
		`Project-local knowledge sources present: ${sources.length ? sources.join(", ") : "none of the standard entry files"}.`,
		`README evidence: ${readmeExcerpt}`,
	].join("\n")
}

async function buildInstructionSection(root: string): Promise<string> {
	const instructions: string[] = []
	for (const relPath of ["AGENTS.md", ".wiki/agent/agent-memory.md", ".wiki/agent/playbook.md"]) {
		const file = await readWorkspaceText(root, relPath, 10_000)
		if (!file) continue
		instructions.push(`Source: ${relPath}\n${excerpt(file.text, relPath === "AGENTS.md" ? 1_300 : 1_000)}`)
	}
	const index = await readWorkspaceText(root, ".wiki/index.md", 8_000)
	if (index) instructions.push(`Knowledge index: .wiki/index.md\n${summarizeIndex(index.text)}`)
	return instructions.length
		? instructions.join("\n\n")
		: "No project-specific AGENTS.md or agent guide was found. The bootstrap index records observed local entry paths only."
}

async function findRelevantDocuments(
	root: string,
	terms: string[],
	lifecycleDecisionIds: string[] = [],
): Promise<ScannedDocument[]> {
	if (!terms.length) return []
	const candidates = new Set(await listKnowledgeDocuments(root))
	const registeredDecisionIds = new Set(lifecycleDecisionIds.map((id) => id.toUpperCase()))
	for (const relPath of Array.from(candidates)) {
		const legacyId = path
			.basename(relPath)
			.match(/^(ADR-\d+)(?:[-_.]|$)/i)?.[1]
			?.toUpperCase()
		if (
			relPath.startsWith(".wiki/adr/managed/") ||
			relPath === ".wiki/adr/LIFECYCLE.md" ||
			(legacyId && registeredDecisionIds.has(legacyId))
		)
			candidates.delete(relPath)
	}
	for (const relPath of [
		"CONTRIBUTING.md",
		"PRODUCT.md",
		"ROADMAP.md",
		"DECISIONS.md",
		"WIKI.md",
		"TROUBLESHOOTING.md",
		"HANDOFF.md",
	]) {
		if ((await safeStat(root, relPath))?.isFile()) candidates.add(relPath)
	}
	const scanned: ScannedDocument[] = []
	let bytesRead = 0

	for (const relPath of Array.from(candidates).sort()) {
		if (
			["README.md", "AGENTS.md", ".wiki/index.md", ".wiki/agent/agent-memory.md", ".wiki/agent/playbook.md"].includes(
				relPath,
			)
		)
			continue
		if (scanned.length >= MAX_KNOWLEDGE_FILES || bytesRead >= MAX_KNOWLEDGE_SCAN_BYTES) break
		const file = await readWorkspaceText(root, relPath, 3_200)
		if (!file) continue
		bytesRead += Buffer.byteLength(file.text, "utf-8")
		const title = file.text.split("\n").find((line) => line.startsWith("# ")) ?? ""
		const score =
			countMatches(terms, relPath.toLowerCase()) * 5 +
			countMatches(terms, title.toLowerCase()) * 4 +
			countMatches(terms, file.text.toLowerCase())
		if (score > 0) scanned.push({ path: relPath, text: file.text, score })
	}

	return scanned
		.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
		.slice(0, MAX_RELEVANT_DOCUMENTS)
}

async function listKnowledgeDocuments(root: string): Promise<string[]> {
	const results: string[] = []
	for (const relDir of KNOWLEDGE_DIRECTORIES) {
		await walkMarkdown(root, relDir, 0, results)
		if (results.length >= MAX_KNOWLEDGE_FILES) break
	}
	return Array.from(new Set(results)).sort()
}

async function walkMarkdown(root: string, relDir: string, depth: number, results: string[]): Promise<void> {
	if (depth > 3 || results.length >= MAX_KNOWLEDGE_FILES) return
	const stat = await safeStat(root, relDir)
	if (!stat?.isDirectory()) return
	let entries: Dirent[] = []
	try {
		entries = await readdir(path.join(root, relDir), { withFileTypes: true })
	} catch {
		return
	}
	entries.sort((left, right) => left.name.localeCompare(right.name))
	for (const entry of entries) {
		if (results.length >= MAX_KNOWLEDGE_FILES || IGNORED_ENTRIES.has(entry.name) || entry.isSymbolicLink()) continue
		const childPath = path.posix.join(relDir, entry.name)
		if (entry.isDirectory()) {
			await walkMarkdown(root, childPath, depth + 1, results)
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
			const childStat = await safeStat(root, childPath)
			if (childStat?.isFile() && Number(childStat.size) <= 256_000) results.push(childPath)
		}
	}
}

async function discoverEntrySources(root: string): Promise<string[]> {
	const paths: string[] = []
	for (const relPath of ENTRY_DOCUMENTS) {
		const stat = await safeStat(root, relPath)
		if (stat?.isFile()) paths.push(relPath)
	}
	for (const relPath of [
		".wiki/adr",
		".wiki/architecture",
		".wiki/policy",
		".wiki/roadmap",
		".wiki/intelligence",
		"docs/adr",
		"docs/architecture",
	]) {
		const stat = await safeStat(root, relPath)
		if (stat?.isDirectory()) paths.push(`${relPath}/`)
	}
	return paths
}

async function readPackageIdentity(root: string): Promise<string | undefined> {
	const file = await readWorkspaceText(root, "package.json", 20_000)
	if (!file) return undefined
	try {
		const parsed = JSON.parse(file.text) as WorkspacePackageShape
		return typeof parsed.name === "string" ? parsed.name : undefined
	} catch {
		return undefined
	}
}

async function listRootEntries(root: string): Promise<string[]> {
	try {
		return (await readdir(root, { withFileTypes: true }))
			.filter((entry) => !IGNORED_ENTRIES.has(entry.name) && !entry.isSymbolicLink())
			.map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
			.sort((left, right) => left.localeCompare(right))
			.slice(0, 16)
	} catch {
		return []
	}
}

async function ensureLocalDirectory(root: string, relPath: string): Promise<void> {
	let current = root
	for (const segment of relPath.split(/[\\/]+/).filter(Boolean)) {
		current = path.join(current, segment)
		try {
			const stat = await lstat(current)
			if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe knowledge directory: ${relPath}`)
		} catch (error) {
			if (errorCode(error) !== "ENOENT") throw error
			try {
				await mkdir(current)
			} catch (createError) {
				if (errorCode(createError) !== "EEXIST") throw createError
				const createdStat = await lstat(current)
				if (createdStat.isSymbolicLink() || !createdStat.isDirectory()) {
					throw new Error(`Unsafe knowledge directory: ${relPath}`)
				}
			}
		}
	}
}

async function writeNewWorkspaceFile(root: string, relPath: string, content: string): Promise<boolean> {
	const parent = path.posix.dirname(relPath)
	await ensureLocalDirectory(root, parent)
	const stat = await safeStat(root, relPath)
	if (stat) return false
	const absolute = path.join(root, relPath)
	try {
		await writeFile(absolute, content, { encoding: "utf-8", flag: "wx" })
		return true
	} catch (error) {
		if (errorCode(error) === "EEXIST") return false
		throw error
	}
}

async function safeStat(root: string, relPath: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
	const segments = relPath.split(/[\\/]+/).filter(Boolean)
	let current = root
	for (let index = 0; index < segments.length; index += 1) {
		current = path.join(current, segments[index])
		try {
			const stat = await lstat(current)
			if (stat.isSymbolicLink()) return undefined
			if (index < segments.length - 1 && !stat.isDirectory()) return undefined
			if (index === segments.length - 1) return stat
		} catch (error) {
			if (errorCode(error) === "ENOENT") return undefined
			return undefined
		}
	}
	return undefined
}

async function readWorkspaceText(
	root: string,
	relPath: string,
	maxBytes: number,
): Promise<{ text: string; truncated: boolean } | undefined> {
	const stat = await safeStat(root, relPath)
	if (!stat?.isFile()) return undefined
	let handle: Awaited<ReturnType<typeof open>> | undefined
	try {
		handle = await open(path.join(root, relPath), "r")
		const length = Math.min(maxBytes, Number(stat.size))
		const buffer = Buffer.alloc(length)
		const { bytesRead } = await handle.read(buffer, 0, length, 0)
		return { text: buffer.subarray(0, bytesRead).toString("utf-8"), truncated: Number(stat.size) > bytesRead }
	} catch {
		return undefined
	} finally {
		await handle?.close().catch(() => undefined)
	}
}

async function workspaceRoot(cwd: string): Promise<string> {
	try {
		return await realpath(cwd)
	} catch {
		return path.resolve(cwd)
	}
}

function buildBootstrapIndex(packageName: string | undefined, entrySources: string[]): string {
	const sources = entrySources.length
		? entrySources.map((source) => `- \`${source}\``).join("\n")
		: "- No standard orientation documents or decision directories were observed."
	return `# Project-local knowledge index\n\nThis small entry map was created from files observed in this workspace. It records paths, not semantic approval or current correctness.\n\n${packageName ? `Observed package identity: \`${packageName}\` in \`package.json\`.\n\n` : ""}## Existing orientation and constraint sources\n\n${sources}\n\n## Durable knowledge maintained by task finalization\n\n- Current workspace model: \`.wiki/intelligence/workspace-intelligence.json\` (project-local derived claims with provenance).\n- Human-readable model: \`.wiki/intelligence/workspace-intelligence.md\`.\n- ADR lifecycle: \`.wiki/adr/lifecycle.json\` with generated views under \`.wiki/adr/managed/\`; registered states distinguish decisions from delivery and verification.\n- Incident register: \`.wiki/incidents/register.json\`; append-only events: \`.wiki/incidents/events.jsonl\`; generated postmortems under \`.wiki/incidents/records/\`.\n- Source-to-knowledge map: \`.wiki/knowledge/source-map.json\`.\n- Historical completion entries: \`.wiki/changelog.md\` (history, not current instructions).\n\nLegacy ADR documents outside the lifecycle registry are unregistered claims until reviewed. Verify current source, tests, runtime evidence, and explicit project instructions before treating a model entry as truth. Preserve unresolved conflicts for review.`
}

function buildBootstrapPlaybook(): string {
	return `# Project knowledge handoff\n\nThis page was created only when the project had no agent playbook. It points future sessions to project-local evidence and the existing task finalization path.\n\n- Start with \`.wiki/index.md\`, root \`AGENTS.md\` when present, and the orientation source relevant to the task.\n- Load only task-relevant guides, active ADRs, and relevant open incidents; do not copy the whole wiki or history into the prompt.\n- Treat \`.wiki/adr/lifecycle.json\` and \`.wiki/incidents/register.json\` as the project-local lifecycle authorities; their Markdown views are generated. Legacy ADR files remain unregistered until explicitly curated.\n- Keep decision status separate from implementation delivery and verification evidence. Do not accept, supersede, or verify a decision without its required authority/evidence.\n- Keep incident observations append-only. Record follow-ups in the register and do not close incidents until required actions and closure evidence are complete.\n- Treat model facts as dated claims. Check their evidence paths, confidence, and lifecycle against current source, tests, runtime evidence, and project instructions.\n- Classify documentation drift, implementation regression, stale tests, invariant violations, and insufficient evidence. Do not silently choose a winner.\n- After substantive work, use the existing completion finalizer to update project-local \`.wiki\` records. Keep decisions, evidence, and history in their existing project surfaces.\n\nThe task runtime refreshes this entry on later sessions without replacing human-authored files.`
}

function summarizeIndex(text: string): string {
	const selected = text
		.split("\n")
		.filter((line) => /^(#|\s*[-*]\s+\[|\s*[-*]\s+`)/.test(line))
		.slice(0, 18)
		.join("\n")
	return excerpt(selected || text, 900)
}

function searchTerms(text: string): string[] {
	const words =
		text
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.toLowerCase()
			.match(/[a-z0-9]+/g) ?? []
	return Array.from(new Set(words.filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word)))).slice(0, 60)
}

function countMatches(terms: string[], text: string): number {
	return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0)
}

function excerpt(text: string, maxChars: number): string {
	const trimmed = text.trim()
	if (trimmed.length <= maxChars) return trimmed || "No evidence text available."
	const limit = Math.max(0, maxChars - 54)
	return `${trimmed.slice(0, limit).trimEnd()}\n[Excerpt truncated; read the complete local source before relying on it.]`
}

function errorCode(error: unknown): string | undefined {
	if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code
	return undefined
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
