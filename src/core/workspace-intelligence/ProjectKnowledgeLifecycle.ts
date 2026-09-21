import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { appendFile, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export const PROJECT_KNOWLEDGE_PATHS = {
	decisionRegistry: ".wiki/adr/lifecycle.json",
	decisionViews: ".wiki/adr/managed",
	decisionIndex: ".wiki/adr/LIFECYCLE.md",
	sourceMap: ".wiki/knowledge/source-map.json",
	incidentRegister: ".wiki/incidents/register.json",
	incidentEvents: ".wiki/incidents/events.jsonl",
	incidentViews: ".wiki/incidents/records",
	incidentIndex: ".wiki/incidents/INDEX.md",
} as const

export const DECISION_STATUSES = ["proposed", "accepted", "rejected", "deprecated", "superseded"] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export const DECISION_DELIVERY_STATES = ["not-started", "in-progress", "implemented", "verified", "not-applicable"] as const
export type DecisionDeliveryState = (typeof DECISION_DELIVERY_STATES)[number]

export const INCIDENT_STATUSES = ["investigating", "contained", "recovered", "closed"] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const FOLLOW_UP_STATUSES = ["open", "in-progress", "completed", "waived"] as const
export type IncidentFollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number]

export const EVIDENCE_KINDS = [
	"decision-basis",
	"project-directive",
	"source",
	"change-record",
	"commit",
	"test-result",
	"runtime-check",
	"manual-check",
	"incident-observation",
	"other",
] as const
export type ProjectEvidenceKind = (typeof EVIDENCE_KINDS)[number]

export interface ProjectEvidence {
	kind: ProjectEvidenceKind
	path: string
	description: string
	observedAt: string
	sha256?: string
	target?: string
	revision?: string
}

export interface ProjectArchitectureDecision {
	id: string
	title: string
	status: DecisionStatus
	context: string
	rationale: string
	alternatives: Array<{ option: string; rationale: string }>
	decision: string
	consequences: string
	affectedSurfaces: string[]
	deliveryState: DecisionDeliveryState
	implementationEvidence: ProjectEvidence[]
	verificationEvidence: ProjectEvidence[]
	approval?: {
		authority: "human-directive" | "project-policy"
		statement: string
		acceptedAt: string
		evidence: ProjectEvidence[]
	}
	supersedes: string[]
	supersededBy?: string
	createdAt: string
	updatedAt: string
	createdBy: "human" | "agent" | "project-directive"
}

export interface ProjectIncident {
	id: string
	title: string
	severity: "low" | "medium" | "high" | "critical"
	status: IncidentStatus
	summary: string
	impact: string
	affectedSurfaces: string[]
	observedAt: string
	initialEvidence: ProjectEvidence[]
	cause: {
		state: "unknown" | "hypothesis" | "confirmed"
		summary: string
		evidence: ProjectEvidence[]
	}
	contributingConditions: string[]
	remediation: string[]
	recoveryEvidence: ProjectEvidence[]
	closureEvidence: ProjectEvidence[]
	recurrenceOf?: string
	createdAt: string
	updatedAt: string
	createdBy: "human" | "agent" | "project-directive"
}

export interface ProjectIncidentFollowUp {
	id: string
	incidentId: string
	title: string
	status: IncidentFollowUpStatus
	ownerRole: string
	nextStep: string
	closureCriteria: string
	required: boolean
	reviewBy?: string
	completionEvidence: ProjectEvidence[]
	waiverRationale?: string
	createdAt: string
	updatedAt: string
}

export interface ProjectIncidentEvent {
	id: string
	incidentId: string
	observedAt: string
	kind: "observation" | "containment" | "remediation" | "recovery" | "verification" | "follow-up" | "correction"
	observation: string
	action: string
	result: string
	nextStep: string
	evidence: ProjectEvidence[]
	supersedes?: string
}

export interface KnowledgeSourceMapEntry {
	source: string
	documents: string[]
	ownerRole?: string
}

export interface ProjectKnowledgeImpact {
	changedFiles: string[]
	currentStateDocuments: string[]
	decisionReviews: Array<{ id: string; title: string; changedFiles: string[]; invalidatedEvidence: string[] }>
	incidentReviews: Array<{ id: string; title: string; status: IncidentStatus; changedFiles: string[]; openFollowUps: string[] }>
	invalidatedEvidence: Array<{ recordId: string; path: string; reason: "changed" | "missing" | "fingerprint-mismatch" }>
	unmappedFiles: string[]
}

export interface ProjectKnowledgeDiagnostic {
	severity: "error" | "warning"
	code: string
	path?: string
	entityId?: string
	message: string
}

export interface ProjectKnowledgeSnapshot {
	decisions: ProjectArchitectureDecision[]
	incidents: ProjectIncident[]
	followUps: ProjectIncidentFollowUp[]
	events: ProjectIncidentEvent[]
	sourceMap: KnowledgeSourceMapEntry[]
	diagnostics: ProjectKnowledgeDiagnostic[]
	impact: ProjectKnowledgeImpact
}

export interface ProjectKnowledgeValidationResult extends ProjectKnowledgeSnapshot {
	valid: boolean
}

export interface BootstrapProjectKnowledgeResult {
	created: string[]
	warning?: string
}

export interface ProjectKnowledgeMutation {
	decisions?: ProjectArchitectureDecision[]
	incidents?: ProjectIncident[]
	followUps?: ProjectIncidentFollowUp[]
	events?: ProjectIncidentEvent[]
	sourceMap?: KnowledgeSourceMapEntry[]
}

interface DecisionRegistry {
	schemaVersion: 1
	decisions: ProjectArchitectureDecision[]
}

interface IncidentRegister {
	schemaVersion: 1
	incidents: ProjectIncident[]
	followUps: ProjectIncidentFollowUp[]
}

interface SourceMap {
	schemaVersion: 1
	entries: KnowledgeSourceMapEntry[]
}

const MAX_CONTEXT_DECISIONS = 4
const MAX_CONTEXT_INCIDENTS = 3
const MAX_CONTEXT_HISTORICAL_INCIDENTS = 1
const MAX_CONTEXT_MAPPED_DOCUMENTS = 4
const MAX_EVENT_BYTES = 8_000_000
const MAX_RECORDS = 500
const MAX_EVIDENCE_PER_FIELD = 100
const GENERATED_ADR_MARKER = "<!-- HEAV3NS:generated-adr"
const GENERATED_INCIDENT_MARKER = "<!-- HEAV3NS:generated-incident"
const GENERATED_INDEX_MARKER = "<!-- HEAV3NS:generated-knowledge-index -->"

const ALLOWED_EVENT_FIELDS = new Set([
	"id",
	"incidentId",
	"observedAt",
	"kind",
	"observation",
	"action",
	"result",
	"nextStep",
	"evidence",
	"supersedes",
])

const ALLOWED_EVIDENCE_FIELDS = new Set(["kind", "path", "description", "observedAt", "sha256", "target", "revision"])
const ALLOWED_DECISION_FIELDS = new Set([
	"id",
	"title",
	"status",
	"context",
	"rationale",
	"alternatives",
	"decision",
	"consequences",
	"affectedSurfaces",
	"deliveryState",
	"implementationEvidence",
	"verificationEvidence",
	"approval",
	"supersedes",
	"supersededBy",
	"createdAt",
	"updatedAt",
	"createdBy",
])

/**
 * Create only the empty, project-local structures needed for future lifecycle records.
 * Existing registries and human-authored ADRs are left intact; no sample record is added.
 */
export async function bootstrapProjectKnowledge(cwd: string): Promise<BootstrapProjectKnowledgeResult> {
	const created: string[] = []
	try {
		const root = await projectRoot(cwd)
		for (const directory of [".wiki", ".wiki/adr", ".wiki/knowledge", ".wiki/incidents"]) {
			await ensureLocalDirectory(root, directory)
		}
		const emptyFiles: Array<{ path: string; content: string }> = [
			{
				path: PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
				content: `${JSON.stringify({ schemaVersion: 1, decisions: [] }, null, 2)}\n`,
			},
			{
				path: PROJECT_KNOWLEDGE_PATHS.sourceMap,
				content: `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`,
			},
			{
				path: PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				content: `${JSON.stringify({ schemaVersion: 1, incidents: [], followUps: [] }, null, 2)}\n`,
			},
			{ path: PROJECT_KNOWLEDGE_PATHS.incidentEvents, content: "" },
		]
		for (const file of emptyFiles) {
			if (await writeNewLocalFile(root, file.path, file.content)) created.push(file.path)
		}
		return { created }
	} catch (error) {
		return { created, warning: `Project knowledge lifecycle bootstrap failed safely: ${errorMessage(error)}.` }
	}
}

/**
 * Read and validate project-local ADR/incident state. This is a structural/evidence check,
 * not a semantic truth oracle. Optional Git checks compare lifecycle transitions and the
 * append-only incident prefix to the committed baseline.
 */
export async function validateProjectKnowledge(
	cwd: string,
	options: { checkTransitions?: boolean; checkAppendOnly?: boolean; baselineRef?: string } = {},
): Promise<ProjectKnowledgeValidationResult> {
	const root = await projectRoot(cwd)
	const diagnostics: ProjectKnowledgeDiagnostic[] = []
	const decisions = await readDecisionRegistry(root, diagnostics)
	const register = await readIncidentRegister(root, diagnostics)
	const sourceMap = await readSourceMap(root, diagnostics)
	const events = await readIncidentEvents(root, diagnostics)

	if (decisions.length > MAX_RECORDS) {
		diagnostics.push(
			error(
				"ADR_LIMIT_EXCEEDED",
				PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
				`Limit lifecycle-managed ADRs to ${MAX_RECORDS} per workspace.`,
			),
		)
	}
	if (register.incidents.length > MAX_RECORDS || register.followUps.length > MAX_RECORDS) {
		diagnostics.push(
			error(
				"INCIDENT_LIMIT_EXCEEDED",
				PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				`Limit incident records and follow-ups to ${MAX_RECORDS} each.`,
			),
		)
	}

	await validateSourceMap(root, sourceMap, diagnostics)
	await validateDecisions(root, decisions, diagnostics)
	await validateDecisionRelationships(decisions, diagnostics)
	await validateIncidents(root, register.incidents, register.followUps, events, diagnostics)
	await validateCanonicalAuthorityClaims(root, diagnostics)
	await validateGeneratedViews(root, decisions, register.incidents, register.followUps, events, diagnostics)

	if (options.checkTransitions || options.checkAppendOnly) {
		const baselineRef = options.baselineRef ?? "HEAD"
		const baseline = await readGitBaseline(root, baselineRef)
		if (baseline.error) {
			diagnostics.push(warning("GIT_BASELINE_UNAVAILABLE", undefined, baseline.error))
		} else if (baseline.available) {
			if (options.checkTransitions) {
				validateLifecycleTransitions(
					decisions,
					register,
					baseline.decisions,
					baseline.incidents,
					baseline.followUps,
					diagnostics,
				)
			}
			if (options.checkAppendOnly && baseline.events !== undefined) {
				const current = await safeReadFile(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)
				if (current !== undefined && !current.startsWith(baseline.events)) {
					diagnostics.push(
						error(
							"INCIDENT_HISTORY_REWRITTEN",
							PROJECT_KNOWLEDGE_PATHS.incidentEvents,
							"Committed incident history was changed. Append a correction event that references the earlier event instead of rewriting it.",
						),
					)
				}
			}
		}
	}

	const impact = discoverKnowledgeImpactFromData(decisions, register.incidents, register.followUps, sourceMap, [], "", events)
	for (const item of diagnostics) {
		if (!item.entityId || !item.path) continue
		const reason =
			item.code === "EVIDENCE_PATH_MISSING"
				? "missing"
				: item.code === "EVIDENCE_FINGERPRINT_STALE"
					? "fingerprint-mismatch"
					: undefined
		if (reason) impact.invalidatedEvidence.push({ recordId: item.entityId, path: item.path, reason })
	}
	impact.invalidatedEvidence = uniqueEvidenceImpacts(impact.invalidatedEvidence)
	return {
		decisions,
		incidents: register.incidents,
		followUps: register.followUps,
		events,
		sourceMap,
		diagnostics,
		impact,
		valid: !diagnostics.some((item) => item.severity === "error"),
	}
}

/**
 * Resolve scoped decisions, incident state, open follow-ups and mapped guides for a fresh
 * session without loading the historical postmortem archive into the prompt.
 */
export async function buildProjectLifecycleContext(
	cwd: string,
	taskDescription: string,
	changedFiles: string[] = [],
	maxChars = 4_400,
): Promise<{ text: string; validation: ProjectKnowledgeValidationResult }> {
	const root = await projectRoot(cwd)
	const validation = await validateProjectKnowledge(root)
	const impact = discoverKnowledgeImpactFromData(
		validation.decisions,
		validation.incidents,
		validation.followUps,
		validation.sourceMap,
		changedFiles,
		taskDescription,
		validation.events,
	)
	impact.invalidatedEvidence = uniqueEvidenceImpacts([...impact.invalidatedEvidence, ...validation.impact.invalidatedEvidence])
	validation.impact = impact
	const terms = knowledgeTerms(taskDescription)
	const diagnosticsById = groupDiagnosticsByEntity(validation.diagnostics)
	const validDecisionIds = new Set(
		validation.decisions
			.filter(
				(decision) =>
					typeof decision.id === "string" &&
					isUsableDecisionAuthority(decision, diagnosticsById.get(decision.id) ?? []),
			)
			.map((decision) => decision.id),
	)
	const taskPaths = extractTaskPaths(taskDescription)

	const activeDecisions = validation.decisions
		.filter((decision) => decision.status === "accepted" && validDecisionIds.has(decision.id))
		.map((decision) => ({
			decision,
			score: relevanceScore(terms, taskPaths, [
				decision.id,
				decision.title,
				decision.decision,
				decision.context,
				decision.affectedSurfaces.join(" "),
			]),
		}))
		.filter(({ decision, score }) => score > 0 || decision.affectedSurfaces.includes("**"))
		.sort((left, right) => right.score - left.score || left.decision.id.localeCompare(right.decision.id))
		.slice(0, MAX_CONTEXT_DECISIONS)

	const proposals = validation.decisions
		.filter(
			(decision) =>
				decision.status === "proposed" &&
				typeof decision.id === "string" &&
				!(diagnosticsById.get(decision.id) ?? []).some((item) => item.severity === "error"),
		)
		.map((decision) => ({
			decision,
			score: relevanceScore(terms, taskPaths, [
				decision.id,
				decision.title,
				decision.decision,
				decision.context,
				decision.affectedSurfaces.join(" "),
			]),
		}))
		.filter(({ score }) => score > 0)
		.sort((left, right) => right.score - left.score || left.decision.id.localeCompare(right.decision.id))
		.slice(0, 2)

	const historicalDecisions = validation.decisions
		.filter(
			(decision) =>
				typeof decision.id === "string" &&
				(decision.status === "superseded" || decision.status === "deprecated" || decision.status === "rejected") &&
				!(diagnosticsById.get(decision.id) ?? []).some((item) => item.severity === "error"),
		)
		.map((decision) => ({
			decision,
			score: relevanceScore(terms, taskPaths, [
				decision.id,
				decision.title,
				decision.decision,
				decision.affectedSurfaces.join(" "),
			]),
		}))
		.filter(({ score }) => score > 0 && isHistoryQuery(terms))
		.sort((left, right) => right.score - left.score || left.decision.id.localeCompare(right.decision.id))
		.slice(0, 2)

	const fullTextDecisions = [
		...activeDecisions.map(({ decision }) => renderDecision(decision, diagnosticsById.get(decision.id) ?? [], false)),
		...proposals.map(({ decision }) => renderDecision(decision, diagnosticsById.get(decision.id) ?? [], false)),
		...historicalDecisions.map(({ decision }) => renderDecision(decision, diagnosticsById.get(decision.id) ?? [], true)),
	]

	const renderableIncidents = validation.incidents.filter(isRenderableIncident)
	const openIncidents = renderableIncidents.filter((incident) => incident.status !== "closed")
	const relevantOpenIncidents = openIncidents
		.map((incident) => ({
			incident,
			score: relevanceScore(terms, taskPaths, [
				incident.id,
				incident.title,
				incident.summary,
				incident.impact,
				incident.affectedSurfaces.join(" "),
			]),
		}))
		.sort((left, right) => right.score - left.score || left.incident.id.localeCompare(right.incident.id))
	const selectedOpenIncidents = relevantOpenIncidents
		.filter(({ incident, score }) => score > 0 || incident.affectedSurfaces.includes("**"))
		.slice(0, MAX_CONTEXT_INCIDENTS)
	const historicalIncidents = renderableIncidents
		.filter((incident) => incident.status === "closed")
		.map((incident) => ({
			incident,
			score: relevanceScore(terms, taskPaths, [
				incident.id,
				incident.title,
				incident.summary,
				incident.impact,
				incident.affectedSurfaces.join(" "),
			]),
		}))
		.filter(({ score }) => score > 0 && isHistoryQuery(terms))
		.sort((left, right) => right.score - left.score || left.incident.id.localeCompare(right.incident.id))
		.slice(0, MAX_CONTEXT_HISTORICAL_INCIDENTS)
	const fullTextIncidents = [
		...selectedOpenIncidents.map(({ incident }) =>
			renderIncident(incident, validation.followUps, validation.events, diagnosticsById.get(incident.id) ?? []),
		),
		...historicalIncidents.map(({ incident }) =>
			renderIncident(incident, validation.followUps, validation.events, diagnosticsById.get(incident.id) ?? []),
		),
	]
	const mappedDocuments = getTaskRelevantSourceMap(
		validation.sourceMap.filter(
			(entry) =>
				typeof entry.source === "string" &&
				Array.isArray(entry.documents) &&
				entry.documents.every((document) => typeof document === "string"),
		),
		taskDescription,
	)
	const openFollowUps = validation.followUps.filter(
		(followUp) => followUp.status === "open" || followUp.status === "in-progress",
	)
	const activeIncidentLines = openIncidents.slice(0, 8).map((incident) => {
		const count = openFollowUps.filter((followUp) => followUp.incidentId === incident.id).length
		return `- ${incident.id} [${incident.status}; ${count} open follow-up${count === 1 ? "" : "s"}; surfaces=${incident.affectedSurfaces.join(", ")}; .wiki/incidents/records/${incident.id}.md]`
	})

	const lines = [
		"ADR and incident records are project-local. The lifecycle registry/register is canonical; generated Markdown is a readable view. Structural checks and evidence fingerprints detect inconsistency, not semantic truth.",
		`Authority files: \`${PROJECT_KNOWLEDGE_PATHS.decisionRegistry}\`, \`${PROJECT_KNOWLEDGE_PATHS.incidentRegister}\`, \`${PROJECT_KNOWLEDGE_PATHS.incidentEvents}\`, \`${PROJECT_KNOWLEDGE_PATHS.sourceMap}\`.`,
		"Legacy ADR Markdown outside the lifecycle registry is historical/unregistered. Its embedded status is a claim, not validated active authority.",
	]
	lines.push("\nTask-relevant accepted decisions:")
	lines.push(
		...(fullTextDecisions.length
			? fullTextDecisions
			: [
					"- No lifecycle-managed ADR matched this task. Check the bounded mapped guide excerpts and any legacy ADR marked unregistered.",
				]),
	)
	lines.push("\nProposed decisions (not authorized instructions):")
	lines.push(
		...(proposals.length
			? proposals.map(({ decision }) => `- ${decision.id}: ${decision.title} [proposed; not accepted]`)
			: ["- None matched this task."]),
	)
	lines.push("\nOpen incident register:")
	lines.push(...(activeIncidentLines.length ? activeIncidentLines : ["- No non-closed incident is registered."]))
	lines.push("\nTask-relevant incident records and follow-ups:")
	lines.push(
		...(fullTextIncidents.length ? fullTextIncidents : ["- No active or history-requested incident matched this task."]),
	)
	lines.push("\nSource-to-knowledge impact map:")
	lines.push(
		...(mappedDocuments.length
			? mappedDocuments.map((item) => `- ${item.source} -> ${item.documents.join(", ")}`)
			: [
					"- No task-matched source mapping is registered. During finalization, inspect unmapped changed paths and relevant current-state guides.",
				]),
	)
	if (impact.changedFiles.length) lines.push(`\nCurrent finalization impact: ${renderImpactOneLine(impact)}`)
	const issueLines = validation.diagnostics
		.slice(0, 12)
		.map((item) => `- ${item.severity.toUpperCase()} ${item.code}${item.path ? ` (${item.path})` : ""}: ${item.message}`)
	if (issueLines.length) lines.push("\nLifecycle/evidence issues to reconcile:", ...issueLines)
	else
		lines.push(
			"\nLifecycle/evidence validation: no structural issue detected; continue to verify decision meaning and runtime truth against current project evidence.",
		)

	const rendered = lines.join("\n")
	return { text: truncate(rendered, maxChars), validation }
}

/**
 * Return source-to-knowledge relationships and lifecycle records touched by changed files.
 * A match creates a review obligation; it never declares that the implementation is wrong.
 */
export function discoverKnowledgeImpactFromData(
	decisions: ProjectArchitectureDecision[],
	incidents: ProjectIncident[],
	followUps: ProjectIncidentFollowUp[],
	sourceMap: KnowledgeSourceMapEntry[],
	changedFiles: string[],
	taskDescription = "",
	events: ProjectIncidentEvent[] = [],
): ProjectKnowledgeImpact {
	const normalizedChangedFiles = Array.from(new Set(changedFiles.map(normalizeWorkspacePath).filter(Boolean))).sort()
	const terms = knowledgeTerms(taskDescription)
	const taskPaths = extractTaskPaths(taskDescription)
	const safeDecisions = decisions.filter(
		(item) => isRecord(item) && typeof item.id === "string" && Array.isArray(item.affectedSurfaces),
	)
	const safeIncidents = incidents.filter((item) => isRenderableIncident(item))
	const safeFollowUps = followUps.filter(
		(item) => isRecord(item) && typeof item.incidentId === "string" && typeof item.id === "string",
	)
	const safeSourceMap = sourceMap.filter(
		(item) =>
			isRecord(item) &&
			typeof item.source === "string" &&
			Array.isArray(item.documents) &&
			item.documents.every((document) => typeof document === "string"),
	)
	const affectedMapEntries = safeSourceMap.filter(
		(entry) =>
			normalizedChangedFiles.some((file) => matchesSurface(file, entry.source)) ||
			relevanceScore(terms, taskPaths, [entry.source, ...entry.documents]) > 0,
	)
	const currentStateDocuments = Array.from(
		new Set([
			...affectedMapEntries.flatMap((entry) => entry.documents),
			...normalizedChangedFiles.filter(isCurrentStateDocument),
		]),
	).sort()
	const invalidatedEvidence: ProjectKnowledgeImpact["invalidatedEvidence"] = []
	const decisionReviews: ProjectKnowledgeImpact["decisionReviews"] = []
	for (const decision of safeDecisions) {
		const surfaceFiles = normalizedChangedFiles.filter((file) =>
			decision.affectedSurfaces.some((surface) => matchesSurface(file, surface)),
		)
		const changedEvidence = [
			...(Array.isArray(decision.implementationEvidence) ? decision.implementationEvidence : []),
			...(Array.isArray(decision.verificationEvidence) ? decision.verificationEvidence : []),
			...(Array.isArray(decision.approval?.evidence) ? decision.approval.evidence : []),
		]
			.filter((item) => isRecord(item) && typeof item.path === "string")
			.filter((item) => normalizedChangedFiles.includes(normalizeWorkspacePath(item.path)))
			.map((item) => normalizeWorkspacePath(item.path))
		for (const evidencePath of changedEvidence)
			invalidatedEvidence.push({ recordId: decision.id, path: evidencePath, reason: "changed" })
		if (surfaceFiles.length || changedEvidence.length) {
			decisionReviews.push({
				id: decision.id,
				title: decision.title,
				changedFiles: surfaceFiles,
				invalidatedEvidence: changedEvidence,
			})
		}
	}
	const incidentReviews: ProjectKnowledgeImpact["incidentReviews"] = []
	for (const incident of safeIncidents) {
		const surfaceFiles = normalizedChangedFiles.filter((file) =>
			incident.affectedSurfaces.some((surface) => matchesSurface(file, surface)),
		)
		const incidentEvidence = [
			...(Array.isArray(incident.initialEvidence) ? incident.initialEvidence : []),
			...(Array.isArray(incident.cause?.evidence) ? incident.cause.evidence : []),
			...(Array.isArray(incident.recoveryEvidence) ? incident.recoveryEvidence : []),
			...(Array.isArray(incident.closureEvidence) ? incident.closureEvidence : []),
		]
			.filter((item) => isRecord(item) && typeof item.path === "string")
			.map((item) => normalizeWorkspacePath(item.path))
		const changedEvidence = incidentEvidence.filter((evidencePath) => normalizedChangedFiles.includes(evidencePath))
		for (const evidencePath of changedEvidence)
			invalidatedEvidence.push({ recordId: incident.id, path: evidencePath, reason: "changed" })
		const openActionIds = safeFollowUps
			.filter(
				(followUp) =>
					followUp.incidentId === incident.id && (followUp.status === "open" || followUp.status === "in-progress"),
			)
			.map((followUp) => followUp.id)
		if ((surfaceFiles.length || changedEvidence.length) && incident.status !== "closed") {
			incidentReviews.push({
				id: incident.id,
				title: incident.title,
				status: incident.status,
				changedFiles: surfaceFiles,
				openFollowUps: openActionIds,
			})
		}
	}
	const mappedFiles = normalizedChangedFiles.filter((file) => safeSourceMap.some((entry) => matchesSurface(file, entry.source)))
	const decisionFiles = normalizedChangedFiles.filter((file) =>
		safeDecisions.some((decision) => decision.affectedSurfaces.some((surface) => matchesSurface(file, surface))),
	)
	const incidentFiles = normalizedChangedFiles.filter((file) =>
		safeIncidents.some((incident) => incident.affectedSurfaces.some((surface) => matchesSurface(file, surface))),
	)
	for (const followUp of safeFollowUps) {
		const changedEvidence = (Array.isArray(followUp.completionEvidence) ? followUp.completionEvidence : [])
			.filter((item) => isRecord(item) && typeof item.path === "string")
			.map((item) => normalizeWorkspacePath(item.path))
			.filter((evidencePath) => normalizedChangedFiles.includes(evidencePath))
		for (const evidencePath of changedEvidence)
			invalidatedEvidence.push({ recordId: followUp.id, path: evidencePath, reason: "changed" })
	}
	for (const event of events) {
		if (!isRecord(event) || typeof event.incidentId !== "string") continue
		const changedEvidence = (Array.isArray(event.evidence) ? event.evidence : [])
			.filter((item) => isRecord(item) && typeof item.path === "string")
			.map((item) => normalizeWorkspacePath(item.path))
			.filter((evidencePath) => normalizedChangedFiles.includes(evidencePath))
		for (const evidencePath of changedEvidence)
			invalidatedEvidence.push({
				recordId: typeof event.id === "string" ? event.id : event.incidentId,
				path: evidencePath,
				reason: "changed",
			})
	}
	const unmappedFiles = normalizedChangedFiles.filter(
		(file) =>
			!mappedFiles.includes(file) &&
			!decisionFiles.includes(file) &&
			!incidentFiles.includes(file) &&
			!invalidatedEvidence.some((item) => item.path === file) &&
			!isKnowledgeRecordPath(file),
	)
	return {
		changedFiles: normalizedChangedFiles,
		currentStateDocuments,
		decisionReviews: decisionReviews.sort((left, right) => left.id.localeCompare(right.id)),
		incidentReviews: incidentReviews.sort((left, right) => left.id.localeCompare(right.id)),
		invalidatedEvidence: uniqueEvidenceImpacts(invalidatedEvidence),
		unmappedFiles,
	}
}

/** Read tracked, staged, and untracked paths changed in the current working tree. */
export async function getProjectChangedFiles(cwd: string): Promise<string[]> {
	const root = await projectRoot(cwd)
	try {
		const result = await execFileAsync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 4_000_000,
		})
		const fields = result.stdout.split("\0").filter(Boolean)
		const paths: string[] = []
		for (let index = 0; index < fields.length; index += 1) {
			const entry = fields[index]
			const currentPath = entry.length > 3 ? entry.slice(3) : ""
			if (currentPath) paths.push(normalizeWorkspacePath(currentPath))
			if (/^[RC]/.test(entry.slice(0, 2)) && fields[index + 1]) {
				paths.push(normalizeWorkspacePath(fields[index + 1]))
				index += 1
			}
		}
		return Array.from(new Set(paths.filter(Boolean))).sort()
	} catch {
		return []
	}
}

/** Human-readable, review-oriented finalization evidence; no semantic conclusion is inferred. */
export function renderProjectKnowledgeImpact(impact: ProjectKnowledgeImpact): string {
	const shortList = (values: string[], max = 24): string =>
		values.length > max ? `${values.slice(0, max).join(", ")} … (${values.length - max} more)` : values.join(", ")
	const items: string[] = [
		`Changed workspace paths (${impact.changedFiles.length}): ${impact.changedFiles.length ? shortList(impact.changedFiles) : "none detected by Git"}.`,
		`Potentially affected current-state documents: ${impact.currentStateDocuments.length ? shortList(impact.currentStateDocuments) : "none mapped"}.`,
	]
	for (const decision of impact.decisionReviews) {
		items.push(
			`ADR review required: ${decision.id} (${decision.title}); changed=${decision.changedFiles.join(", ") || "evidence-only"}; invalidated evidence=${decision.invalidatedEvidence.join(", ") || "none"}.`,
		)
	}
	for (const incident of impact.incidentReviews) {
		items.push(
			`Incident review required: ${incident.id} (${incident.title}; ${incident.status}); changed=${incident.changedFiles.join(", ")}; open follow-ups=${incident.openFollowUps.join(", ") || "none"}.`,
		)
	}
	for (const evidence of impact.invalidatedEvidence)
		items.push(`Evidence needs review: ${evidence.recordId} -> ${evidence.path} (${evidence.reason}).`)
	if (impact.unmappedFiles.length)
		items.push(`Unmapped changed paths need knowledge review: ${shortList(impact.unmappedFiles)}.`)
	items.push(
		"This impact list identifies review candidates. It does not decide whether documentation, code, tests, or runtime behavior is correct.",
	)
	return truncate(items.map((item) => `- ${item}`).join("\n"), 4_000)
}

/** Calculate SHA-256 references for newly added evidence fields during finalization. */
export async function fingerprintNewProjectEvidence(cwd: string): Promise<string[]> {
	const root = await projectRoot(cwd)
	const diagnostics: ProjectKnowledgeDiagnostic[] = []
	const decisions = await readDecisionRegistry(root, diagnostics)
	const register = await readIncidentRegister(root, diagnostics)
	const events = await readIncidentEvents(root, diagnostics)
	if (diagnostics.some((item) => item.severity === "error")) return []
	await validateDecisions(root, decisions, diagnostics)
	await validateDecisionRelationships(decisions, diagnostics)
	await validateIncidents(root, register.incidents, register.followUps, events, diagnostics)
	if (diagnostics.some((item) => item.severity === "error")) return []
	let decisionsChanged = false
	let incidentsChanged = false
	const update = async (item: ProjectEvidence): Promise<void> => {
		if (item.sha256) return
		const file = await safeReadFile(root, item.path)
		if (file === undefined) return
		item.sha256 = sha256(file)
	}
	for (const decision of decisions) {
		const before = evidenceFingerprintKey(decision)
		await Promise.all([
			...decision.implementationEvidence.map(update),
			...decision.verificationEvidence.map(update),
			...(decision.approval?.evidence ?? []).map(update),
		])
		if (before !== evidenceFingerprintKey(decision)) decisionsChanged = true
	}
	for (const incident of register.incidents) {
		const before = evidenceFingerprintKey(incident)
		await Promise.all([
			...incident.initialEvidence.map(update),
			...incident.cause.evidence.map(update),
			...incident.recoveryEvidence.map(update),
			...incident.closureEvidence.map(update),
		])
		if (before !== evidenceFingerprintKey(incident)) incidentsChanged = true
	}
	for (const followUp of register.followUps) {
		const before = evidenceFingerprintKey(followUp)
		await Promise.all(followUp.completionEvidence.map(update))
		if (before !== evidenceFingerprintKey(followUp)) incidentsChanged = true
	}
	const written: string[] = []
	if (decisionsChanged) {
		await writeLocalFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
			`${JSON.stringify({ schemaVersion: 1, decisions }, null, 2)}\n`,
			true,
		)
		written.push(PROJECT_KNOWLEDGE_PATHS.decisionRegistry)
	}
	if (incidentsChanged) {
		await writeLocalFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.incidentRegister,
			`${JSON.stringify({ schemaVersion: 1, incidents: register.incidents, followUps: register.followUps }, null, 2)}\n`,
			true,
		)
		written.push(PROJECT_KNOWLEDGE_PATHS.incidentRegister)
	}
	return written
}

/** Render immutable-from-agent-facing indexes and postmortem/ADR views from canonical JSON. */
export async function syncProjectKnowledgeViews(
	cwd: string,
): Promise<{ written: string[]; diagnostics: ProjectKnowledgeDiagnostic[] }> {
	const root = await projectRoot(cwd)
	const diagnostics: ProjectKnowledgeDiagnostic[] = []
	const decisions = await readDecisionRegistry(root, diagnostics)
	const register = await readIncidentRegister(root, diagnostics)
	const events = await readIncidentEvents(root, diagnostics)
	if (diagnostics.some((item) => item.severity === "error")) return { written: [], diagnostics }
	await validateDecisions(root, decisions, diagnostics)
	await validateDecisionRelationships(decisions, diagnostics)
	await validateIncidents(root, register.incidents, register.followUps, events, diagnostics)
	if (diagnostics.some((item) => item.severity === "error")) return { written: [], diagnostics }
	const written: string[] = []
	await ensureLocalDirectory(root, PROJECT_KNOWLEDGE_PATHS.decisionViews)
	await ensureLocalDirectory(root, PROJECT_KNOWLEDGE_PATHS.incidentViews)
	const writes: Array<{ path: string; content: string; marker: string }> = [
		{
			path: PROJECT_KNOWLEDGE_PATHS.decisionIndex,
			content: renderDecisionIndex(decisions),
			marker: GENERATED_INDEX_MARKER,
		},
		{
			path: PROJECT_KNOWLEDGE_PATHS.incidentIndex,
			content: renderIncidentIndex(register.incidents, register.followUps),
			marker: GENERATED_INDEX_MARKER,
		},
	]
	for (const decision of decisions) {
		writes.push({
			path: `${PROJECT_KNOWLEDGE_PATHS.decisionViews}/${decision.id}.md`,
			content: renderDecisionView(decision),
			marker: `${GENERATED_ADR_MARKER} ${decision.id} -->`,
		})
	}
	for (const incident of register.incidents) {
		writes.push({
			path: `${PROJECT_KNOWLEDGE_PATHS.incidentViews}/${incident.id}.md`,
			content: renderIncidentView(incident, register.followUps, events),
			marker: `${GENERATED_INCIDENT_MARKER} ${incident.id} -->`,
		})
	}
	for (const item of writes) {
		try {
			if (await writeLocalFile(root, item.path, item.content, true, item.marker)) written.push(item.path)
		} catch (failure) {
			diagnostics.push(error("GENERATED_VIEW_WRITE_FAILED", item.path, errorMessage(failure)))
		}
	}
	return { written, diagnostics }
}

/** Append a new incident event without replacing or truncating the event stream. */
export async function appendIncidentEvent(cwd: string, event: ProjectIncidentEvent): Promise<void> {
	const root = await projectRoot(cwd)
	await ensureLocalDirectory(root, ".wiki/incidents")
	const current = (await safeReadFile(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)) ?? ""
	const existing = parseEvents(current)
	if (existing.some((item) => item.id === event.id)) throw new Error(`Duplicate incident event ID: ${event.id}`)
	const registerDiagnostics: ProjectKnowledgeDiagnostic[] = []
	const register = await readIncidentRegister(root, registerDiagnostics)
	if (registerDiagnostics.some((item) => item.severity === "error"))
		throw new Error("Incident register is invalid; repair it before appending an event.")
	if (!register.incidents.some((item) => item.id === event.incidentId)) {
		throw new Error(`Incident event references an unregistered incident: ${event.incidentId}`)
	}
	const malformed = validateIncidentEventFields(event)
	if (malformed) throw new Error(malformed)
	if (event.kind === "correction") {
		const prior = existing.find((item) => item.id === event.supersedes)
		if (!prior || prior.incidentId !== event.incidentId || prior.observedAt > event.observedAt)
			throw new Error("A correction must supersede an earlier event for the same incident.")
	} else if (event.supersedes) {
		throw new Error("Only a correction event may reference supersedes.")
	}
	for (const evidence of event.evidence) {
		if (!isSafeWorkspacePath(evidence.path)) throw new Error(`Unsafe incident evidence path: ${String(evidence.path)}`)
		const content = await safeReadFile(root, evidence.path)
		if (content === undefined) throw new Error(`Incident evidence path does not exist: ${evidence.path}`)
	}
	const next = `${JSON.stringify(event)}\n`
	await assertLocalFileDestination(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)
	await appendFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents), next, { encoding: "utf-8", flag: "a" })
}

/**
 * Apply explicit, structured lifecycle changes supplied to run_finalization.
 * Agent prose is never parsed into canonical records. Existing IDs are merged,
 * omitted history is preserved, and evidence is fingerprinted before promotion.
 */
export async function applyProjectKnowledgeMutation(cwd: string, serialized: string | undefined): Promise<string[]> {
	if (!serialized?.trim()) return []
	if (Buffer.byteLength(serialized, "utf8") > 1_000_000)
		throw new Error("Structured project knowledge update exceeds the 1 MB limit.")
	let parsed: unknown
	try {
		parsed = JSON.parse(serialized)
	} catch (failure) {
		throw new Error(`Structured project knowledge update is not valid JSON: ${errorMessage(failure)}`)
	}
	if (!isRecord(parsed)) throw new Error("Structured project knowledge update must be a JSON object.")
	const updateFields = new Set(["decisions", "incidents", "followUps", "events", "sourceMap"])
	if (Object.keys(parsed).some((field) => !updateFields.has(field)))
		throw new Error("Structured project knowledge update contains unknown top-level fields.")
	for (const field of updateFields) {
		if (parsed[field] !== undefined && !Array.isArray(parsed[field]))
			throw new Error(`Structured project knowledge ${field} must be an array.`)
	}
	const updates = parsed as unknown as ProjectKnowledgeMutation
	const hasUpdates = Boolean(
		updates.decisions?.length ||
			updates.incidents?.length ||
			updates.followUps?.length ||
			updates.events?.length ||
			updates.sourceMap?.length,
	)
	if (!hasUpdates) return []

	const root = await projectRoot(cwd)
	const diagnostics: ProjectKnowledgeDiagnostic[] = []
	const decisions = await readDecisionRegistry(root, diagnostics)
	const register = await readIncidentRegister(root, diagnostics)
	const sourceMap = await readSourceMap(root, diagnostics)
	const currentEvents = await readIncidentEvents(root, diagnostics)
	if (diagnostics.some((item) => item.severity === "error"))
		throw new Error(
			"Cannot mutate invalid project knowledge. Run the lifecycle validator and reconcile its diagnostics first.",
		)

	const nextDecisions = mergeRecordsById(decisions, updates.decisions ?? [], "decision")
	const nextIncidents = mergeRecordsById(register.incidents, updates.incidents ?? [], "incident")
	const nextFollowUps = mergeRecordsById(register.followUps, updates.followUps ?? [], "follow-up")
	const nextSourceMap = mergeSourceMapEntries(sourceMap, updates.sourceMap ?? [])
	const existingEventIds = new Set(currentEvents.map((event) => event.id.toUpperCase()))
	for (const event of updates.events ?? []) {
		if (!isRecord(event) || typeof event.id !== "string")
			throw new Error("Every appended incident event must be a JSON object with an ID.")
		if (existingEventIds.has(event.id.toUpperCase()))
			throw new Error(`Incident event IDs are append-only and cannot be repeated: ${event.id}`)
		existingEventIds.add(event.id.toUpperCase())
	}
	const nextEvents = [...currentEvents, ...(updates.events ?? [])]
	await fingerprintEvidenceInRecords(root, nextDecisions, nextIncidents, nextFollowUps)
	const candidateDiagnostics: ProjectKnowledgeDiagnostic[] = []
	await validateDecisions(root, nextDecisions, candidateDiagnostics)
	await validateDecisionRelationships(nextDecisions, candidateDiagnostics)
	await validateIncidents(root, nextIncidents, nextFollowUps, nextEvents, candidateDiagnostics)
	await validateSourceMap(root, nextSourceMap, candidateDiagnostics)
	validateLifecycleTransitions(
		nextDecisions,
		{ incidents: nextIncidents, followUps: nextFollowUps },
		decisions,
		register.incidents,
		register.followUps,
		candidateDiagnostics,
	)
	if (candidateDiagnostics.some((item) => item.severity === "error")) {
		const summary = candidateDiagnostics
			.filter((item) => item.severity === "error")
			.slice(0, 12)
			.map((item) => `${item.code}: ${item.message}`)
			.join("\n")
		throw new Error(`Structured project knowledge update failed validation:\n${summary}`)
	}

	const written: string[] = []
	if (updates.decisions?.length) {
		await writeLocalFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
			`${JSON.stringify({ schemaVersion: 1, decisions: nextDecisions }, null, 2)}\n`,
			true,
		)
		written.push(PROJECT_KNOWLEDGE_PATHS.decisionRegistry)
	}
	if (updates.incidents?.length || updates.followUps?.length) {
		await writeLocalFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.incidentRegister,
			`${JSON.stringify({ schemaVersion: 1, incidents: nextIncidents, followUps: nextFollowUps }, null, 2)}\n`,
			true,
		)
		written.push(PROJECT_KNOWLEDGE_PATHS.incidentRegister)
	}
	if (updates.sourceMap?.length) {
		await writeLocalFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.sourceMap,
			`${JSON.stringify({ schemaVersion: 1, entries: nextSourceMap }, null, 2)}\n`,
			true,
		)
		written.push(PROJECT_KNOWLEDGE_PATHS.sourceMap)
	}
	if (updates.events?.length) {
		const lines = updates.events.map((event) => `${JSON.stringify(event)}\n`).join("")
		await assertLocalFileDestination(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)
		await appendFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents), lines, { encoding: "utf-8", flag: "a" })
		written.push(PROJECT_KNOWLEDGE_PATHS.incidentEvents)
	}
	return written
}

function mergeRecordsById<T extends { id: string }>(current: T[], updates: T[], label: string): T[] {
	const byId = new Map(current.map((item) => [item.id.toUpperCase(), item]))
	const received = new Set<string>()
	for (const item of updates) {
		if (!isRecord(item) || typeof item.id !== "string")
			throw new Error(`Every ${label} update must be an object with a stable ID.`)
		const key = item.id.toUpperCase()
		if (received.has(key)) throw new Error(`Duplicate ${label} update ID: ${item.id}`)
		received.add(key)
		byId.set(key, item)
	}
	return Array.from(byId.values())
}

function mergeSourceMapEntries(
	current: KnowledgeSourceMapEntry[],
	updates: KnowledgeSourceMapEntry[],
): KnowledgeSourceMapEntry[] {
	const byPattern = new Map(current.map((item) => [item.source.toLowerCase(), item]))
	const received = new Set<string>()
	for (const item of updates) {
		if (!isRecord(item) || typeof item.source !== "string")
			throw new Error("Every source-map update must contain a source pattern.")
		const key = item.source.toLowerCase()
		if (received.has(key)) throw new Error(`Duplicate source-map update: ${item.source}`)
		received.add(key)
		byPattern.set(key, item)
	}
	return Array.from(byPattern.values())
}

async function fingerprintEvidenceInRecords(
	root: string,
	decisions: ProjectArchitectureDecision[],
	incidents: ProjectIncident[],
	followUps: ProjectIncidentFollowUp[],
): Promise<void> {
	const update = async (item: ProjectEvidence): Promise<void> => {
		if (item.sha256) return
		if (!isSafeWorkspacePath(item.path)) return
		const content = await safeReadFile(root, item.path)
		if (content !== undefined) item.sha256 = sha256(content)
	}
	for (const decision of decisions) {
		if (!Array.isArray(decision.implementationEvidence) || !Array.isArray(decision.verificationEvidence)) continue
		await Promise.all([
			...decision.implementationEvidence.map(update),
			...decision.verificationEvidence.map(update),
			...(Array.isArray(decision.approval?.evidence) ? decision.approval.evidence : []).map(update),
		])
	}
	for (const incident of incidents) {
		if (
			!Array.isArray(incident.initialEvidence) ||
			!Array.isArray(incident.recoveryEvidence) ||
			!Array.isArray(incident.closureEvidence)
		)
			continue
		await Promise.all([
			...incident.initialEvidence.map(update),
			...(Array.isArray(incident.cause?.evidence) ? incident.cause.evidence : []).map(update),
			...incident.recoveryEvidence.map(update),
			...incident.closureEvidence.map(update),
		])
	}
	for (const followUp of followUps) {
		if (Array.isArray(followUp.completionEvidence)) await Promise.all(followUp.completionEvidence.map(update))
	}
}

async function readDecisionRegistry(
	root: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<ProjectArchitectureDecision[]> {
	const raw = await readJsonFile(root, PROJECT_KNOWLEDGE_PATHS.decisionRegistry, diagnostics, "ADR_REGISTRY")
	if (raw === undefined) return []
	if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.decisions)) {
		diagnostics.push(
			error(
				"ADR_REGISTRY_SCHEMA",
				PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
				"Expected schemaVersion 1 with a decisions array.",
			),
		)
		return []
	}
	checkAllowedFields(raw, new Set(["schemaVersion", "decisions"]), PROJECT_KNOWLEDGE_PATHS.decisionRegistry, diagnostics)
	if (raw.decisions.some((item) => !isRecord(item)))
		diagnostics.push(
			error("ADR_RECORD_INVALID", PROJECT_KNOWLEDGE_PATHS.decisionRegistry, "Every decisions entry must be a JSON object."),
		)
	return raw.decisions.filter(isRecord) as unknown as ProjectArchitectureDecision[]
}

async function readIncidentRegister(
	root: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<{ incidents: ProjectIncident[]; followUps: ProjectIncidentFollowUp[] }> {
	const raw = await readJsonFile(root, PROJECT_KNOWLEDGE_PATHS.incidentRegister, diagnostics, "INCIDENT_REGISTER")
	if (raw === undefined) return { incidents: [], followUps: [] }
	if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.incidents) || !Array.isArray(raw.followUps)) {
		diagnostics.push(
			error(
				"INCIDENT_REGISTER_SCHEMA",
				PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				"Expected schemaVersion 1 with incidents and followUps arrays.",
			),
		)
		return { incidents: [], followUps: [] }
	}
	checkAllowedFields(
		raw,
		new Set(["schemaVersion", "incidents", "followUps"]),
		PROJECT_KNOWLEDGE_PATHS.incidentRegister,
		diagnostics,
	)
	if (raw.incidents.some((item) => !isRecord(item)))
		diagnostics.push(
			error(
				"INCIDENT_RECORD_INVALID",
				PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				"Every incidents entry must be a JSON object.",
			),
		)
	if (raw.followUps.some((item) => !isRecord(item)))
		diagnostics.push(
			error(
				"INCIDENT_FOLLOWUP_RECORD_INVALID",
				PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				"Every followUps entry must be a JSON object.",
			),
		)
	return {
		incidents: raw.incidents.filter(isRecord) as unknown as ProjectIncident[],
		followUps: raw.followUps.filter(isRecord) as unknown as ProjectIncidentFollowUp[],
	}
}

async function readSourceMap(root: string, diagnostics: ProjectKnowledgeDiagnostic[]): Promise<KnowledgeSourceMapEntry[]> {
	const raw = await readJsonFile(root, PROJECT_KNOWLEDGE_PATHS.sourceMap, diagnostics, "SOURCE_MAP")
	if (raw === undefined) return []
	if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.entries)) {
		diagnostics.push(
			error("SOURCE_MAP_SCHEMA", PROJECT_KNOWLEDGE_PATHS.sourceMap, "Expected schemaVersion 1 with an entries array."),
		)
		return []
	}
	checkAllowedFields(raw, new Set(["schemaVersion", "entries"]), PROJECT_KNOWLEDGE_PATHS.sourceMap, diagnostics)
	if (raw.entries.some((item) => !isRecord(item)))
		diagnostics.push(
			error("SOURCE_MAP_ENTRY_INVALID", PROJECT_KNOWLEDGE_PATHS.sourceMap, "Every source map entry must be a JSON object."),
		)
	return raw.entries.filter(isRecord) as unknown as KnowledgeSourceMapEntry[]
}

async function readIncidentEvents(root: string, diagnostics: ProjectKnowledgeDiagnostic[]): Promise<ProjectIncidentEvent[]> {
	let raw: string | undefined
	try {
		raw = await safeReadFile(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)
	} catch (failure) {
		diagnostics.push(error("INCIDENT_EVENTS_UNSAFE", PROJECT_KNOWLEDGE_PATHS.incidentEvents, errorMessage(failure)))
		return []
	}
	if (raw === undefined) {
		diagnostics.push(
			error(
				"INCIDENT_EVENTS_MISSING",
				PROJECT_KNOWLEDGE_PATHS.incidentEvents,
				"Bootstrap the append-only incident event file.",
			),
		)
		return []
	}
	if (Buffer.byteLength(raw, "utf-8") > MAX_EVENT_BYTES) {
		diagnostics.push(
			error(
				"INCIDENT_EVENTS_LIMIT",
				PROJECT_KNOWLEDGE_PATHS.incidentEvents,
				`Incident event history exceeds the ${MAX_EVENT_BYTES}-byte validation bound.`,
			),
		)
		return []
	}
	const events: ProjectIncidentEvent[] = []
	for (const [index, line] of raw.split(/\r?\n/).entries()) {
		if (!line.trim()) continue
		try {
			const parsed: unknown = JSON.parse(line)
			if (!isRecord(parsed)) throw new Error("event line must contain a JSON object")
			if (Object.keys(parsed).some((field) => !ALLOWED_EVENT_FIELDS.has(field)))
				throw new Error("event line contains unknown fields")
			events.push(parsed as unknown as ProjectIncidentEvent)
		} catch (failure) {
			diagnostics.push(
				error(
					"INCIDENT_EVENT_JSON",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`Line ${index + 1}: ${errorMessage(failure)}`,
				),
			)
		}
	}
	return events
}

async function readJsonFile(
	root: string,
	relPath: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
	label: string,
): Promise<unknown | undefined> {
	let text: string | undefined
	try {
		text = await safeReadFile(root, relPath)
	} catch (failure) {
		diagnostics.push(error(`${label}_UNSAFE`, relPath, errorMessage(failure)))
		return undefined
	}
	if (text === undefined) {
		diagnostics.push(error(`${label}_MISSING`, relPath, "Run project knowledge bootstrap before relying on this registry."))
		return undefined
	}
	try {
		return JSON.parse(text) as unknown
	} catch (failure) {
		diagnostics.push(error(`${label}_JSON`, relPath, errorMessage(failure)))
		return undefined
	}
}

async function validateSourceMap(
	root: string,
	entries: KnowledgeSourceMapEntry[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<void> {
	const seen = new Map<string, string>()
	for (const entry of entries) {
		if (!isRecord(entry)) continue
		checkAllowedFields(entry, new Set(["source", "documents", "ownerRole"]), PROJECT_KNOWLEDGE_PATHS.sourceMap, diagnostics)
		if (!isSafeSurface(entry.source)) {
			diagnostics.push(
				error("SOURCE_MAP_PATTERN", PROJECT_KNOWLEDGE_PATHS.sourceMap, `Invalid source pattern: ${String(entry.source)}`),
			)
			continue
		}
		if (!Array.isArray(entry.documents) || entry.documents.length === 0 || entry.documents.length > 32) {
			diagnostics.push(
				error(
					"SOURCE_MAP_DOCUMENTS",
					PROJECT_KNOWLEDGE_PATHS.sourceMap,
					`Source ${entry.source} must map to 1–32 current-state documents.`,
				),
			)
			continue
		}
		const signature = Array.from(entry.documents)
			.filter((item): item is string => typeof item === "string")
			.sort()
			.join("\0")
		const previous = seen.get(entry.source)
		if (previous !== undefined) {
			diagnostics.push(
				error(
					previous === signature ? "SOURCE_MAP_DUPLICATE" : "SOURCE_MAP_COMPETING_AUTHORITY",
					PROJECT_KNOWLEDGE_PATHS.sourceMap,
					`Source pattern ${entry.source} has ${previous === signature ? "a duplicate mapping" : "competing guide mappings"}.`,
				),
			)
		}
		seen.set(entry.source, signature)
		for (const document of entry.documents) {
			if (typeof document !== "string" || !isSafeWorkspacePath(document)) {
				diagnostics.push(
					error(
						"SOURCE_MAP_PATH_UNSAFE",
						PROJECT_KNOWLEDGE_PATHS.sourceMap,
						`Unsafe mapped document path: ${String(document)}`,
					),
				)
				continue
			}
			await validateWorkspaceFile(
				root,
				document,
				PROJECT_KNOWLEDGE_PATHS.sourceMap,
				diagnostics,
				"SOURCE_MAP_DOCUMENT_MISSING",
			)
		}
		if (entry.ownerRole !== undefined && (typeof entry.ownerRole !== "string" || !entry.ownerRole.trim())) {
			diagnostics.push(
				error("SOURCE_MAP_OWNER", PROJECT_KNOWLEDGE_PATHS.sourceMap, `Source ${entry.source} has an invalid ownerRole.`),
			)
		}
	}
}

async function validateDecisions(
	root: string,
	decisions: ProjectArchitectureDecision[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<void> {
	const seen = new Set<string>()
	for (const decision of decisions) {
		if (!isRecord(decision)) continue
		const id = typeof decision.id === "string" ? decision.id : "<missing-id>"
		checkAllowedFields(decision, ALLOWED_DECISION_FIELDS, PROJECT_KNOWLEDGE_PATHS.decisionRegistry, diagnostics, id)
		if (typeof decision.id !== "string" || !/^ADR-[0-9]{3,}$/.test(decision.id)) {
			diagnostics.push(
				error("ADR_ID_INVALID", PROJECT_KNOWLEDGE_PATHS.decisionRegistry, `Invalid stable ADR identifier: ${id}`, id),
			)
		}
		const normalizedId = id.toUpperCase()
		if (seen.has(normalizedId))
			diagnostics.push(error("ADR_ID_DUPLICATE", PROJECT_KNOWLEDGE_PATHS.decisionRegistry, `Duplicate ADR ID: ${id}`, id))
		seen.add(normalizedId)
		for (const field of ["title", "context", "rationale", "decision", "consequences"] as const) {
			if (!boundedText(decision[field], 12_000))
				diagnostics.push(
					error(
						"ADR_FIELD_REQUIRED",
						PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
						`${id} requires a non-empty ${field} string within the 12,000-character limit.`,
						id,
					),
				)
		}
		if (!DECISION_STATUSES.includes(decision.status))
			diagnostics.push(
				error(
					"ADR_STATUS_INVALID",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} has invalid decision status ${String(decision.status)}.`,
					id,
				),
			)
		if (!DECISION_DELIVERY_STATES.includes(decision.deliveryState)) {
			diagnostics.push(
				error(
					"ADR_DELIVERY_INVALID",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} has invalid delivery state ${String(decision.deliveryState)}.`,
					id,
				),
			)
		}
		if (!Array.isArray(decision.alternatives) || decision.alternatives.length > 30) {
			diagnostics.push(
				error(
					"ADR_ALTERNATIVES_INVALID",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} alternatives must be an array of at most 30 entries.`,
					id,
				),
			)
		} else {
			for (const alternative of decision.alternatives) {
				if (
					!isRecord(alternative) ||
					!boundedText(alternative.option, 2_000) ||
					!boundedText(alternative.rationale, 4_000)
				) {
					diagnostics.push(
						error(
							"ADR_ALTERNATIVE_INVALID",
							PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
							`${id} has a malformed alternative; use option and rationale fields.`,
							id,
						),
					)
				}
			}
		}
		validateSurfaceList(decision.affectedSurfaces, id, PROJECT_KNOWLEDGE_PATHS.decisionRegistry, diagnostics)
		if (!Array.isArray(decision.supersedes) || decision.supersedes.some((value) => typeof value !== "string")) {
			diagnostics.push(
				error(
					"ADR_SUPERSEDES_INVALID",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} supersedes must be an array of ADR IDs.`,
					id,
				),
			)
		}
		if (
			!isTimestamp(decision.createdAt) ||
			!isTimestamp(decision.updatedAt) ||
			(isTimestamp(decision.createdAt) &&
				isTimestamp(decision.updatedAt) &&
				Date.parse(decision.updatedAt) < Date.parse(decision.createdAt))
		) {
			diagnostics.push(
				error(
					"ADR_METADATA_DATES",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} requires valid UTC creation/update timestamps in chronological order.`,
					id,
				),
			)
		}
		if (!(["human", "agent", "project-directive"] as const).includes(decision.createdBy)) {
			diagnostics.push(
				error("ADR_CREATED_BY", PROJECT_KNOWLEDGE_PATHS.decisionRegistry, `${id} has invalid createdBy provenance.`, id),
			)
		}

		const statusRequiresApproval = decision.status === "accepted" || decision.status === "superseded"
		if (decision.approval !== undefined || statusRequiresApproval) {
			if (!isRecord(decision.approval)) {
				diagnostics.push(
					error(
						"ADR_APPROVAL_MISSING",
						PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
						`${id} requires a recorded human/project-policy approval basis.`,
						id,
					),
				)
			} else {
				checkAllowedFields(
					decision.approval,
					new Set(["authority", "statement", "acceptedAt", "evidence"]),
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					diagnostics,
					id,
				)
				if (
					!(decision.approval.authority === "human-directive" || decision.approval.authority === "project-policy") ||
					!boundedText(decision.approval.statement, 2_000) ||
					!isTimestamp(decision.approval.acceptedAt)
				) {
					diagnostics.push(
						error(
							"ADR_APPROVAL_INVALID",
							PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
							`${id} approval requires authority, statement, and acceptedAt.`,
							id,
						),
					)
				}
				await validateEvidenceList(root, decision.approval.evidence, id, "approval", diagnostics, true)
				const approvalEvidence = Array.isArray(decision.approval.evidence) ? decision.approval.evidence : []
				if (
					!approvalEvidence.some(
						(item) => isRecord(item) && (item.kind === "project-directive" || item.kind === "decision-basis"),
					)
				) {
					diagnostics.push(
						error(
							"ADR_APPROVAL_EVIDENCE",
							PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
							`${id} approval needs local project-directive or decision-basis evidence.`,
							id,
						),
					)
				}
			}
		}

		await validateEvidenceList(root, decision.implementationEvidence, id, "implementation", diagnostics, true)
		await validateEvidenceList(root, decision.verificationEvidence, id, "verification", diagnostics, true)
		const implementationEvidence = Array.isArray(decision.implementationEvidence) ? decision.implementationEvidence : []
		const verificationEvidence = Array.isArray(decision.verificationEvidence) ? decision.verificationEvidence : []
		if (
			(decision.deliveryState === "implemented" || decision.deliveryState === "verified") &&
			!implementationEvidence.some(
				(item) => isRecord(item) && ["source", "change-record", "commit"].includes(String(item.kind)),
			)
		) {
			diagnostics.push(
				error(
					"ADR_IMPLEMENTATION_EVIDENCE",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} delivery ${decision.deliveryState} requires source/change/commit evidence.`,
					id,
				),
			)
		}
		if (
			decision.deliveryState === "verified" &&
			!verificationEvidence.some(
				(item) => isRecord(item) && ["test-result", "runtime-check", "manual-check"].includes(String(item.kind)),
			)
		) {
			diagnostics.push(
				error(
					"ADR_VERIFICATION_EVIDENCE",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} delivery verified requires test-result, runtime-check, or manual-check evidence.`,
					id,
				),
			)
		}
		if (decision.deliveryState !== "verified" && verificationEvidence.length && decision.deliveryState === "not-started") {
			diagnostics.push(
				warning(
					"ADR_EVIDENCE_STATE_MISMATCH",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${id} has verification evidence while delivery remains not-started.`,
					id,
				),
			)
		}
	}
}

async function validateDecisionRelationships(
	decisions: ProjectArchitectureDecision[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<void> {
	const byId = new Map(decisions.filter((item) => typeof item.id === "string").map((item) => [item.id.toUpperCase(), item]))
	for (const decision of decisions) {
		if (!isRecord(decision) || typeof decision.id !== "string") continue
		const id = decision.id.toUpperCase()
		if (decision.status === "superseded" && typeof decision.supersededBy !== "string") {
			diagnostics.push(
				error(
					"ADR_SUPERSEDED_WITHOUT_SUCCESSOR",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${decision.id} is superseded but has no supersededBy reference.`,
					decision.id,
				),
			)
		}
		if (decision.supersededBy !== undefined) {
			const successor =
				typeof decision.supersededBy === "string" ? byId.get(decision.supersededBy.toUpperCase()) : undefined
			if (
				!successor ||
				!Array.isArray(successor.supersedes) ||
				!successor.supersedes.some((value) => String(value).toUpperCase() === id)
			) {
				diagnostics.push(
					error(
						"ADR_SUPERSESSION_NOT_RECIPROCAL",
						PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
						`${decision.id} successor must exist and reciprocally list it in supersedes.`,
						decision.id,
					),
				)
			} else if (successor.status === "proposed" || successor.status === "rejected" || successor.status === "deprecated") {
				diagnostics.push(
					error(
						"ADR_SUPERSESSION_NOT_ACTIVE",
						PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
						`${decision.id} cannot be retired by non-active successor ${successor.id}.`,
						decision.id,
					),
				)
			}
		}
		if (Array.isArray(decision.supersedes)) {
			for (const priorId of decision.supersedes) {
				const prior = typeof priorId === "string" ? byId.get(priorId.toUpperCase()) : undefined
				if (!prior || prior.status !== "superseded" || prior.supersededBy?.toUpperCase() !== id) {
					diagnostics.push(
						error(
							"ADR_SUPERSESSION_BROKEN",
							PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
							`${decision.id} supersedes must reciprocate a retained superseded ADR.`,
							decision.id,
						),
					)
				}
			}
		}
		const visited = new Set<string>([id])
		let successorId: string | undefined =
			typeof decision.supersededBy === "string" ? decision.supersededBy.toUpperCase() : undefined
		while (successorId && byId.has(successorId)) {
			if (visited.has(successorId)) {
				diagnostics.push(
					error(
						"ADR_SUPERSESSION_CYCLE",
						PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
						`Supersession chain containing ${decision.id} has a cycle.`,
						decision.id,
					),
				)
				break
			}
			visited.add(successorId)
			const successor = byId.get(successorId)
			successorId =
				successor && typeof successor.supersededBy === "string" ? successor.supersededBy.toUpperCase() : undefined
		}
	}
}

async function validateIncidents(
	root: string,
	incidents: ProjectIncident[],
	followUps: ProjectIncidentFollowUp[],
	events: ProjectIncidentEvent[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<void> {
	const incidentsById = new Map<string, ProjectIncident>()
	const seenIncidentIds = new Set<string>()
	for (const incident of incidents) {
		if (!isRecord(incident)) continue
		const id = typeof incident.id === "string" ? incident.id : "<missing-id>"
		checkAllowedFields(
			incident,
			new Set([
				"id",
				"title",
				"severity",
				"status",
				"summary",
				"impact",
				"affectedSurfaces",
				"observedAt",
				"initialEvidence",
				"cause",
				"contributingConditions",
				"remediation",
				"recoveryEvidence",
				"closureEvidence",
				"recurrenceOf",
				"createdAt",
				"updatedAt",
				"createdBy",
			]),
			PROJECT_KNOWLEDGE_PATHS.incidentRegister,
			diagnostics,
			id,
		)
		if (typeof incident.id !== "string" || !/^INC-[A-Z0-9][A-Z0-9-]{2,63}$/.test(incident.id)) {
			diagnostics.push(
				error(
					"INCIDENT_ID_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`Invalid stable incident identifier: ${id}`,
					id,
				),
			)
		}
		const normalizedId = id.toUpperCase()
		if (seenIncidentIds.has(normalizedId))
			diagnostics.push(
				error("INCIDENT_ID_DUPLICATE", PROJECT_KNOWLEDGE_PATHS.incidentRegister, `Duplicate incident ID: ${id}`, id),
			)
		seenIncidentIds.add(normalizedId)
		incidentsById.set(normalizedId, incident)
		for (const field of ["title", "summary", "impact"] as const) {
			if (!boundedText(incident[field], 12_000))
				diagnostics.push(
					error(
						"INCIDENT_FIELD_REQUIRED",
						PROJECT_KNOWLEDGE_PATHS.incidentRegister,
						`${id} requires a non-empty ${field} string.`,
						id,
					),
				)
		}
		if (!"low medium high critical".split(" ").includes(incident.severity)) {
			diagnostics.push(
				error(
					"INCIDENT_SEVERITY_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} has invalid severity ${String(incident.severity)}.`,
					id,
				),
			)
		}
		if (!INCIDENT_STATUSES.includes(incident.status)) {
			diagnostics.push(
				error(
					"INCIDENT_STATUS_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} has invalid state ${String(incident.status)}.`,
					id,
				),
			)
		}
		validateSurfaceList(incident.affectedSurfaces, id, PROJECT_KNOWLEDGE_PATHS.incidentRegister, diagnostics)
		if (!isTimestamp(incident.observedAt) || !isTimestamp(incident.createdAt) || !isTimestamp(incident.updatedAt)) {
			diagnostics.push(
				error(
					"INCIDENT_METADATA_DATES",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} requires valid observedAt, createdAt and updatedAt UTC timestamps.`,
					id,
				),
			)
		} else if (Date.parse(incident.updatedAt) < Date.parse(incident.createdAt)) {
			diagnostics.push(
				error(
					"INCIDENT_METADATA_DATES",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} updatedAt precedes createdAt.`,
					id,
				),
			)
		}
		if (!(incident.createdBy === "human" || incident.createdBy === "agent" || incident.createdBy === "project-directive")) {
			diagnostics.push(
				error(
					"INCIDENT_CREATED_BY",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} has invalid createdBy provenance.`,
					id,
				),
			)
		}
		await validateEvidenceList(root, incident.initialEvidence, id, "initial incident observation", diagnostics, true)
		if (
			!Array.isArray(incident.initialEvidence) ||
			!incident.initialEvidence.some((item) => isRecord(item) && item.kind === "incident-observation")
		) {
			diagnostics.push(
				error(
					"INCIDENT_INITIAL_EVIDENCE",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} needs local incident-observation evidence.`,
					id,
				),
			)
		}
		if (
			!isRecord(incident.cause) ||
			!(incident.cause.state === "unknown" || incident.cause.state === "hypothesis" || incident.cause.state === "confirmed")
		) {
			diagnostics.push(
				error(
					"INCIDENT_CAUSE_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} cause needs an explicit unknown, hypothesis, or confirmed state.`,
					id,
				),
			)
		} else {
			checkAllowedFields(
				incident.cause,
				new Set(["state", "summary", "evidence"]),
				PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				diagnostics,
				id,
			)
			if (!boundedText(incident.cause.summary, 8_000))
				diagnostics.push(
					error(
						"INCIDENT_CAUSE_SUMMARY",
						PROJECT_KNOWLEDGE_PATHS.incidentRegister,
						`${id} needs a bounded cause summary, including when the cause remains unknown.`,
						id,
					),
				)
			await validateEvidenceList(root, incident.cause.evidence, id, "cause", diagnostics, true)
			if (
				incident.cause.state === "confirmed" &&
				(!Array.isArray(incident.cause.evidence) || incident.cause.evidence.length === 0)
			) {
				diagnostics.push(
					error(
						"INCIDENT_CONFIRMED_CAUSE_EVIDENCE",
						PROJECT_KNOWLEDGE_PATHS.incidentRegister,
						`${id} cannot label a cause confirmed without supporting evidence.`,
						id,
					),
				)
			}
		}
		validateTextList(incident.contributingConditions, id, "contributingConditions", diagnostics, 40, 4_000)
		validateTextList(incident.remediation, id, "remediation", diagnostics, 60, 4_000)
		await validateEvidenceList(root, incident.recoveryEvidence, id, "recovery", diagnostics, true)
		await validateEvidenceList(root, incident.closureEvidence, id, "closure", diagnostics, true)
		if (
			incident.recurrenceOf !== undefined &&
			(typeof incident.recurrenceOf !== "string" || !/^INC-[A-Z0-9][A-Z0-9-]{2,63}$/.test(incident.recurrenceOf))
		) {
			diagnostics.push(
				error(
					"INCIDENT_RECURRENCE_REFERENCE",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} has an invalid recurrenceOf reference.`,
					id,
				),
			)
		}
		if (incident.status === "recovered" || incident.status === "closed") {
			if (!Array.isArray(incident.remediation) || incident.remediation.length === 0) {
				diagnostics.push(
					error(
						"INCIDENT_REMEDIATION_MISSING",
						PROJECT_KNOWLEDGE_PATHS.incidentRegister,
						`${id} cannot be recovered or closed without a recorded remediation.`,
						id,
					),
				)
			}
			if (!Array.isArray(incident.recoveryEvidence) || !incident.recoveryEvidence.length) {
				diagnostics.push(
					error(
						"INCIDENT_RECOVERY_EVIDENCE_MISSING",
						PROJECT_KNOWLEDGE_PATHS.incidentRegister,
						`${id} recovered state requires local recovery evidence.`,
						id,
					),
				)
			}
			if (
				!events.some((event) => event.incidentId === id && (event.kind === "recovery" || event.kind === "verification"))
			) {
				diagnostics.push(
					error(
						"INCIDENT_RECOVERY_EVENT_MISSING",
						PROJECT_KNOWLEDGE_PATHS.incidentEvents,
						`${id} needs a recovery or verification event before recovery can be claimed.`,
						id,
					),
				)
			}
		}
		if (incident.status === "contained" && !events.some((event) => event.incidentId === id && event.kind === "containment")) {
			diagnostics.push(
				error(
					"INCIDENT_CONTAINMENT_EVENT_MISSING",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`${id} needs a containment event before containment can be claimed.`,
					id,
				),
			)
		}
		if (incident.status === "closed" && (!Array.isArray(incident.closureEvidence) || incident.closureEvidence.length === 0)) {
			diagnostics.push(
				error(
					"INCIDENT_CLOSURE_EVIDENCE_MISSING",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} cannot be closed without closure evidence.`,
					id,
				),
			)
		}
		if (
			incident.status === "closed" &&
			!events.some((event) => event.incidentId === id && (event.kind === "verification" || event.kind === "follow-up"))
		) {
			diagnostics.push(
				error(
					"INCIDENT_CLOSURE_EVENT_MISSING",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`${id} needs a verification or follow-up event before closure can be claimed.`,
					id,
				),
			)
		}
	}

	const followUpIds = new Set<string>()
	for (const followUp of followUps) {
		if (!isRecord(followUp)) continue
		const id = typeof followUp.id === "string" ? followUp.id : "<missing-id>"
		checkAllowedFields(
			followUp,
			new Set([
				"id",
				"incidentId",
				"title",
				"status",
				"ownerRole",
				"nextStep",
				"closureCriteria",
				"required",
				"reviewBy",
				"completionEvidence",
				"waiverRationale",
				"createdAt",
				"updatedAt",
			]),
			PROJECT_KNOWLEDGE_PATHS.incidentRegister,
			diagnostics,
			id,
		)
		if (typeof followUp.id !== "string" || !/^FU-[A-Z0-9][A-Z0-9-]{2,63}$/.test(followUp.id)) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_ID_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`Invalid follow-up ID: ${id}`,
					id,
				),
			)
		}
		if (followUpIds.has(id.toUpperCase()))
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_ID_DUPLICATE",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`Duplicate follow-up ID: ${id}`,
					id,
				),
			)
		followUpIds.add(id.toUpperCase())
		if (typeof followUp.incidentId !== "string" || !incidentsById.has(followUp.incidentId.toUpperCase())) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_ORPHAN",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} references an unregistered incident ${String(followUp.incidentId)}.`,
					id,
				),
			)
		}
		for (const field of ["title", "ownerRole", "nextStep", "closureCriteria"] as const) {
			if (!boundedText(followUp[field], 4_000))
				diagnostics.push(
					error(
						"INCIDENT_FOLLOWUP_FIELD",
						PROJECT_KNOWLEDGE_PATHS.incidentRegister,
						`${id} requires a non-empty ${field}.`,
						id,
					),
				)
		}
		if (!FOLLOW_UP_STATUSES.includes(followUp.status))
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_STATUS",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} has invalid status ${String(followUp.status)}.`,
					id,
				),
			)
		if (typeof followUp.required !== "boolean" || !isTimestamp(followUp.createdAt) || !isTimestamp(followUp.updatedAt)) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_METADATA",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} requires required and valid creation/update metadata.`,
					id,
				),
			)
		}
		if (followUp.reviewBy !== undefined && !isTimestamp(followUp.reviewBy))
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_REVIEW_DATE",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} has invalid reviewBy timestamp.`,
					id,
				),
			)
		await validateEvidenceList(root, followUp.completionEvidence, id, "follow-up completion", diagnostics, true)
		if (
			followUp.status === "completed" &&
			(!Array.isArray(followUp.completionEvidence) || followUp.completionEvidence.length === 0)
		) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_EVIDENCE_MISSING",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} cannot be completed without local evidence.`,
					id,
				),
			)
		}
		if (
			followUp.status === "waived" &&
			(!boundedText(followUp.waiverRationale, 4_000) ||
				!Array.isArray(followUp.completionEvidence) ||
				followUp.completionEvidence.length === 0)
		) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_WAIVER_EVIDENCE",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${id} waiver requires a rationale and project-local evidence.`,
					id,
				),
			)
		}
		const incident =
			typeof followUp.incidentId === "string" ? incidentsById.get(followUp.incidentId.toUpperCase()) : undefined
		if (
			incident?.status === "closed" &&
			followUp.required &&
			(followUp.status === "open" || followUp.status === "in-progress")
		) {
			diagnostics.push(
				error(
					"INCIDENT_CLOSED_WITH_OPEN_FOLLOWUP",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`Closed incident ${incident.id} has unresolved required follow-up ${id}.`,
					incident.id,
				),
			)
		}
	}

	const eventIds = new Set<string>()
	const eventsById = new Map<string, ProjectIncidentEvent>()
	for (const event of events) {
		const id = typeof event?.id === "string" ? event.id : "<missing-id>"
		const issue = validateIncidentEventFields(event)
		if (issue)
			diagnostics.push(
				error(
					"INCIDENT_EVENT_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`${id}: ${issue}`,
					typeof event?.incidentId === "string" ? event.incidentId : undefined,
				),
			)
		if (eventIds.has(id.toUpperCase()))
			diagnostics.push(
				error(
					"INCIDENT_EVENT_ID_DUPLICATE",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`Duplicate event ID: ${id}`,
					event.incidentId,
				),
			)
		eventIds.add(id.toUpperCase())
		eventsById.set(id.toUpperCase(), event)
		if (typeof event?.incidentId !== "string" || !incidentsById.has(event.incidentId.toUpperCase())) {
			diagnostics.push(
				error(
					"INCIDENT_EVENT_ORPHAN",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`${id} references an unregistered incident.`,
					event?.incidentId,
				),
			)
		}
		if (event.kind === "correction") {
			const prior = typeof event.supersedes === "string" ? eventsById.get(event.supersedes.toUpperCase()) : undefined
			if (!prior || prior.incidentId !== event.incidentId || prior.observedAt > event.observedAt) {
				diagnostics.push(
					error(
						"INCIDENT_CORRECTION_REFERENCE",
						PROJECT_KNOWLEDGE_PATHS.incidentEvents,
						`${id} correction must refer to an earlier event for the same incident.`,
						event.incidentId,
					),
				)
			}
		} else if (event.supersedes !== undefined) {
			diagnostics.push(
				error(
					"INCIDENT_EVENT_SUPERSEDES_KIND",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`${id} uses supersedes but is not a correction event.`,
					event.incidentId,
				),
			)
		}
		await validateEvidenceList(root, event.evidence, event.incidentId ?? id, `event ${id}`, diagnostics, false)
	}
	for (const incident of incidents) {
		if (!isRecord(incident) || typeof incident.id !== "string") continue
		const related = events.filter((event) => event.incidentId === incident.id)
		if (!related.some((event) => event.kind === "observation")) {
			diagnostics.push(
				error(
					"INCIDENT_OBSERVATION_EVENT_MISSING",
					PROJECT_KNOWLEDGE_PATHS.incidentEvents,
					`${incident.id} must have at least one append-only observation event.`,
					incident.id,
				),
			)
		}
		if (incident.recurrenceOf && !incidentsById.has(incident.recurrenceOf.toUpperCase())) {
			diagnostics.push(
				error(
					"INCIDENT_RECURRENCE_BROKEN",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${incident.id} recurrenceOf reference ${incident.recurrenceOf} is not registered.`,
					incident.id,
				),
			)
		}
	}
}

function validateIncidentEventFields(event: unknown): string | undefined {
	if (!isRecord(event)) return "event must be an object"
	const extraFields = Object.keys(event).filter((field) => !ALLOWED_EVENT_FIELDS.has(field))
	if (extraFields.length) return `unknown field(s): ${extraFields.join(", ")}`
	if (typeof event.id !== "string" || !/^EVT-[A-Z0-9][A-Z0-9-]{2,63}$/.test(event.id))
		return "id must be a stable EVT-* identifier"
	if (typeof event.incidentId !== "string" || !/^INC-[A-Z0-9][A-Z0-9-]{2,63}$/.test(event.incidentId))
		return "incidentId must be a stable incident identifier"
	if (!isTimestamp(event.observedAt)) return "observedAt must be a UTC timestamp"
	if (!"observation containment remediation recovery verification follow-up correction".split(" ").includes(event.kind))
		return "kind is not a recognized incident event"
	for (const field of ["observation", "action", "result", "nextStep"] as const) {
		if (!boundedText(event[field], 8_000)) return `${field} must be a non-empty bounded string`
	}
	if (
		event.supersedes !== undefined &&
		(typeof event.supersedes !== "string" || !/^EVT-[A-Z0-9][A-Z0-9-]{2,63}$/.test(event.supersedes))
	)
		return "supersedes must reference a stable event identifier"
	if (!Array.isArray(event.evidence) || event.evidence.length > MAX_EVIDENCE_PER_FIELD)
		return `evidence must be an array with at most ${MAX_EVIDENCE_PER_FIELD} entries`
	return undefined
}

async function validateEvidenceList(
	root: string,
	value: unknown,
	entityId: string | undefined,
	purpose: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
	requireFingerprints: boolean,
): Promise<void> {
	if (!Array.isArray(value) || value.length > MAX_EVIDENCE_PER_FIELD) {
		diagnostics.push(
			error(
				"EVIDENCE_LIST_INVALID",
				undefined,
				`${purpose} evidence must be an array with at most ${MAX_EVIDENCE_PER_FIELD} entries.`,
				entityId,
			),
		)
		return
	}
	for (const item of value) {
		if (!isRecord(item)) {
			diagnostics.push(error("EVIDENCE_ENTRY_INVALID", undefined, `${purpose} evidence entry must be an object.`, entityId))
			continue
		}
		checkAllowedFields(item, ALLOWED_EVIDENCE_FIELDS, undefined, diagnostics, entityId)
		if (!EVIDENCE_KINDS.includes(item.kind)) {
			diagnostics.push(
				error(
					"EVIDENCE_KIND_INVALID",
					typeof item.path === "string" ? item.path : undefined,
					`${purpose} evidence has invalid kind ${String(item.kind)}.`,
					entityId,
				),
			)
		}
		if (!isSafeWorkspacePath(item.path)) {
			diagnostics.push(
				error(
					"EVIDENCE_PATH_UNSAFE",
					typeof item.path === "string" ? item.path : undefined,
					`${purpose} evidence path must be a safe workspace-relative regular file.`,
					entityId,
				),
			)
			continue
		}
		if (!boundedText(item.description, 4_000) || !isTimestamp(item.observedAt)) {
			diagnostics.push(
				error(
					"EVIDENCE_METADATA_INVALID",
					item.path,
					`${purpose} evidence requires a bounded description and UTC observedAt timestamp.`,
					entityId,
				),
			)
		}
		if (item.sha256 !== undefined && (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256))) {
			diagnostics.push(
				error(
					"EVIDENCE_FINGERPRINT_INVALID",
					item.path,
					`${purpose} evidence sha256 must contain 64 lowercase hexadecimal characters.`,
					entityId,
				),
			)
		}
		if (item.target !== undefined && !boundedText(item.target, 1_000))
			diagnostics.push(
				error("EVIDENCE_TARGET_INVALID", item.path, `${purpose} evidence target must be a bounded string.`, entityId),
			)
		if (item.revision !== undefined && !boundedText(item.revision, 1_000))
			diagnostics.push(
				error("EVIDENCE_REVISION_INVALID", item.path, `${purpose} evidence revision must be a bounded string.`, entityId),
			)
		if (requireFingerprints && !item.sha256) {
			diagnostics.push(
				warning(
					"EVIDENCE_FINGERPRINT_MISSING",
					item.path,
					`${purpose} evidence has no content fingerprint yet; finalization can record one.`,
					entityId,
				),
			)
		}
		try {
			const content = await safeReadFile(root, item.path)
			if (content === undefined) {
				diagnostics.push(error("EVIDENCE_PATH_MISSING", item.path, `${purpose} evidence file is missing.`, entityId))
			} else if (typeof item.sha256 === "string" && sha256(content) !== item.sha256) {
				diagnostics.push(
					error(
						"EVIDENCE_FINGERPRINT_STALE",
						item.path,
						`${purpose} evidence content changed after its fingerprint was recorded; reconcile it before relying on this claim.`,
						entityId,
					),
				)
			}
		} catch (failure) {
			diagnostics.push(
				error(
					"EVIDENCE_PATH_UNSAFE",
					item.path,
					`${purpose} evidence path is unsafe: ${errorMessage(failure)}`,
					entityId,
				),
			)
		}
	}
}

async function validateWorkspaceFile(
	root: string,
	relPath: string,
	ownerPath: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
	missingCode: string,
): Promise<void> {
	try {
		const content = await safeReadFile(root, relPath)
		if (content === undefined)
			diagnostics.push(error(missingCode, ownerPath, `Project-local file does not exist: ${relPath}`))
	} catch (failure) {
		diagnostics.push(
			error(`${missingCode}_UNSAFE`, ownerPath, `Project-local path ${relPath} is unsafe: ${errorMessage(failure)}`),
		)
	}
}

async function validateCanonicalAuthorityClaims(root: string, diagnostics: ProjectKnowledgeDiagnostic[]): Promise<void> {
	for (const relPath of [".wiki/adr/README.md", "docs/adr/README.md", "DECISIONS.md"]) {
		try {
			const content = await safeReadFile(root, relPath)
			if (
				content &&
				/\b(?:active|canonical|current)\s+(?:architecture\s+)?(?:decision|ADR)(?:s|\s+index|\s+catalog)?\b/i.test(content)
			) {
				diagnostics.push(
					warning(
						"LEGACY_DECISION_INDEX_UNREGISTERED",
						relPath,
						"This legacy Markdown catalog appears to claim current decision authority, but its records are not lifecycle-validated. Curate individual records into the canonical lifecycle registry without treating the catalog as migrated truth.",
					),
				)
			}
		} catch (failure) {
			diagnostics.push(error("KNOWLEDGE_AUTHORITY_PATH_UNSAFE", relPath, errorMessage(failure)))
		}
	}
}

async function validateGeneratedViews(
	root: string,
	decisions: ProjectArchitectureDecision[],
	incidents: ProjectIncident[],
	followUps: ProjectIncidentFollowUp[],
	events: ProjectIncidentEvent[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<void> {
	for (const decision of decisions) {
		const relPath = `${PROJECT_KNOWLEDGE_PATHS.decisionViews}/${decision.id}.md`
		await validateGeneratedFile(root, relPath, renderDecisionView(decision), GENERATED_ADR_MARKER, undefined, diagnostics)
	}
	for (const incident of incidents) {
		const relPath = `${PROJECT_KNOWLEDGE_PATHS.incidentViews}/${incident.id}.md`
		await validateGeneratedFile(
			root,
			relPath,
			renderIncidentView(incident, followUps, events),
			GENERATED_INCIDENT_MARKER,
			incident.id,
			diagnostics,
		)
	}
	if (decisions.length) {
		await validateGeneratedFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.decisionIndex,
			renderDecisionIndex(decisions),
			GENERATED_INDEX_MARKER,
			undefined,
			diagnostics,
		)
	}
	if (incidents.length) {
		await validateGeneratedFile(
			root,
			PROJECT_KNOWLEDGE_PATHS.incidentIndex,
			renderIncidentIndex(incidents, followUps),
			GENERATED_INDEX_MARKER,
			undefined,
			diagnostics,
		)
	}
}

async function validateGeneratedFile(
	root: string,
	relPath: string,
	expected: string,
	marker: string,
	entityId: string | undefined,
	diagnostics: ProjectKnowledgeDiagnostic[],
): Promise<void> {
	try {
		const current = await safeReadFile(root, relPath)
		if (current === undefined) {
			diagnostics.push(
				error("KNOWLEDGE_VIEW_MISSING", relPath, `Generated project-local view is missing: ${relPath}`, entityId),
			)
		} else if (!current.includes(marker) || current !== expected) {
			diagnostics.push(
				error(
					"KNOWLEDGE_VIEW_STALE",
					relPath,
					`Generated view does not match its canonical lifecycle registry: ${relPath}`,
					entityId,
				),
			)
		}
	} catch (failure) {
		diagnostics.push(error("KNOWLEDGE_VIEW_UNSAFE", relPath, errorMessage(failure), entityId))
	}
}

interface GitKnowledgeBaseline {
	available: boolean
	error?: string
	decisions: ProjectArchitectureDecision[]
	incidents: ProjectIncident[]
	followUps: ProjectIncidentFollowUp[]
	events?: string
}

async function readGitBaseline(root: string, baselineRef: string): Promise<GitKnowledgeBaseline> {
	const empty: GitKnowledgeBaseline = { available: false, decisions: [], incidents: [], followUps: [] }
	if (!(baselineRef === "HEAD" || /^[a-f0-9]{40}$/.test(baselineRef))) {
		return { ...empty, error: "Lifecycle baseline must be HEAD or a full 40-character commit hash." }
	}
	try {
		const resolved = await execFileAsync("git", ["rev-parse", "--verify", baselineRef], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 1_000_000,
		})
		const commit = resolved.stdout.trim()
		if (!/^[a-f0-9]{40}$/.test(commit))
			return { ...empty, error: `Git returned an invalid baseline commit for ${baselineRef}.` }
		const [decisionText, incidentText, eventText] = await Promise.all([
			readGitKnowledgeFile(root, commit, PROJECT_KNOWLEDGE_PATHS.decisionRegistry),
			readGitKnowledgeFile(root, commit, PROJECT_KNOWLEDGE_PATHS.incidentRegister),
			readGitKnowledgeFile(root, commit, PROJECT_KNOWLEDGE_PATHS.incidentEvents),
		])
		const decisionJson = decisionText ? (JSON.parse(decisionText) as unknown) : { schemaVersion: 1, decisions: [] }
		const incidentJson = incidentText
			? (JSON.parse(incidentText) as unknown)
			: { schemaVersion: 1, incidents: [], followUps: [] }
		if (
			!isRecord(decisionJson) ||
			!Array.isArray(decisionJson.decisions) ||
			!isRecord(incidentJson) ||
			!Array.isArray(incidentJson.incidents) ||
			!Array.isArray(incidentJson.followUps)
		) {
			return { ...empty, error: `Committed lifecycle files at ${commit.slice(0, 12)} have invalid registry shapes.` }
		}
		return {
			available: true,
			decisions: decisionJson.decisions.filter(isRecord) as unknown as ProjectArchitectureDecision[],
			incidents: incidentJson.incidents.filter(isRecord) as unknown as ProjectIncident[],
			followUps: incidentJson.followUps.filter(isRecord) as unknown as ProjectIncidentFollowUp[],
			events: eventText ?? "",
		}
	} catch (failure) {
		return { ...empty, error: `Committed lifecycle baseline unavailable: ${errorMessage(failure)}` }
	}
}

async function readGitKnowledgeFile(root: string, commit: string, relPath: string): Promise<string | undefined> {
	try {
		await execFileAsync("git", ["cat-file", "-e", `${commit}:${relPath}`], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 1_000_000,
		})
		const result = await execFileAsync("git", ["show", `${commit}:${relPath}`], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: MAX_EVENT_BYTES + 1_000_000,
		})
		return result.stdout
	} catch (failure) {
		const message = errorMessage(failure)
		if (/not a valid object|does not exist in|path .* exists on disk, but not in|could not be found in/i.test(message))
			return undefined
		throw failure
	}
}

function validateLifecycleTransitions(
	decisions: ProjectArchitectureDecision[],
	currentRegister: { incidents: ProjectIncident[]; followUps: ProjectIncidentFollowUp[] },
	priorDecisions: ProjectArchitectureDecision[],
	priorIncidents: ProjectIncident[],
	priorFollowUps: ProjectIncidentFollowUp[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): void {
	const currentDecisionMap = new Map(decisions.map((item) => [item.id.toUpperCase(), item]))
	for (const prior of priorDecisions) {
		const current = currentDecisionMap.get(prior.id.toUpperCase())
		if (!current) {
			diagnostics.push(
				error(
					"ADR_HISTORY_REMOVED",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${prior.id} was removed from the lifecycle registry; preserve it as historical state.`,
					prior.id,
				),
			)
			continue
		}
		if (!isAllowedDecisionTransition(prior.status, current.status)) {
			diagnostics.push(
				error(
					"ADR_STATUS_TRANSITION_INVALID",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${prior.id} cannot transition from ${prior.status} to ${current.status}.`,
					prior.id,
				),
			)
		}
		if (!isAllowedDeliveryTransition(prior.deliveryState, current.deliveryState)) {
			diagnostics.push(
				error(
					"ADR_DELIVERY_TRANSITION_INVALID",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${prior.id} cannot transition delivery from ${prior.deliveryState} to ${current.deliveryState}.`,
					prior.id,
				),
			)
		}
		if (
			JSON.stringify(prior) !== JSON.stringify(current) &&
			isTimestamp(prior.updatedAt) &&
			isTimestamp(current.updatedAt) &&
			Date.parse(current.updatedAt) <= Date.parse(prior.updatedAt)
		) {
			diagnostics.push(
				error(
					"ADR_UPDATE_TIMESTAMP_NOT_ADVANCED",
					PROJECT_KNOWLEDGE_PATHS.decisionRegistry,
					`${prior.id} changed without advancing updatedAt.`,
					prior.id,
				),
			)
		}
	}

	const currentIncidentMap = new Map(currentRegister.incidents.map((item) => [item.id.toUpperCase(), item]))
	for (const prior of priorIncidents) {
		const current = currentIncidentMap.get(prior.id.toUpperCase())
		if (!current) {
			diagnostics.push(
				error(
					"INCIDENT_HISTORY_REMOVED",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${prior.id} was removed from the incident register; preserve the record and close it with evidence.`,
					prior.id,
				),
			)
			continue
		}
		if (!isAllowedIncidentTransition(prior.status, current.status)) {
			diagnostics.push(
				error(
					"INCIDENT_STATUS_TRANSITION_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${prior.id} cannot transition from ${prior.status} to ${current.status}.`,
					prior.id,
				),
			)
		}
		if (
			JSON.stringify(prior) !== JSON.stringify(current) &&
			isTimestamp(prior.updatedAt) &&
			isTimestamp(current.updatedAt) &&
			Date.parse(current.updatedAt) <= Date.parse(prior.updatedAt)
		) {
			diagnostics.push(
				error(
					"INCIDENT_UPDATE_TIMESTAMP_NOT_ADVANCED",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${prior.id} changed without advancing updatedAt.`,
					prior.id,
				),
			)
		}
	}

	const currentFollowUpMap = new Map(currentRegister.followUps.map((item) => [item.id.toUpperCase(), item]))
	for (const prior of priorFollowUps) {
		const current = currentFollowUpMap.get(prior.id.toUpperCase())
		if (!current) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_REMOVED",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${prior.id} was removed; preserve it as completed or waived history.`,
					prior.incidentId,
				),
			)
			continue
		}
		if (!isAllowedFollowUpTransition(prior.status, current.status)) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_TRANSITION_INVALID",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${prior.id} cannot transition from ${prior.status} to ${current.status}.`,
					prior.incidentId,
				),
			)
		}
		if (
			JSON.stringify(prior) !== JSON.stringify(current) &&
			isTimestamp(prior.updatedAt) &&
			isTimestamp(current.updatedAt) &&
			Date.parse(current.updatedAt) <= Date.parse(prior.updatedAt)
		) {
			diagnostics.push(
				error(
					"INCIDENT_FOLLOWUP_TIMESTAMP_NOT_ADVANCED",
					PROJECT_KNOWLEDGE_PATHS.incidentRegister,
					`${prior.id} changed without advancing updatedAt.`,
					prior.incidentId,
				),
			)
		}
	}
}

function isAllowedDecisionTransition(prior: DecisionStatus, current: DecisionStatus): boolean {
	if (prior === current) return true
	if (prior === "proposed") return current === "accepted" || current === "rejected" || current === "deprecated"
	if (prior === "accepted") return current === "superseded" || current === "deprecated" || current === "rejected"
	return false
}

function isAllowedDeliveryTransition(prior: DecisionDeliveryState, current: DecisionDeliveryState): boolean {
	const allowed: Record<DecisionDeliveryState, DecisionDeliveryState[]> = {
		"not-started": ["not-started", "in-progress", "not-applicable"],
		"in-progress": ["in-progress", "implemented", "verified"],
		implemented: ["implemented", "verified"],
		verified: ["verified"],
		"not-applicable": ["not-applicable"],
	}
	return allowed[prior]?.includes(current) ?? false
}

function isAllowedIncidentTransition(prior: IncidentStatus, current: IncidentStatus): boolean {
	if (prior === current) return true
	if (prior === "investigating") return current === "contained" || current === "recovered"
	if (prior === "contained") return current === "recovered"
	if (prior === "recovered") return current === "closed"
	return false
}

function isAllowedFollowUpTransition(prior: IncidentFollowUpStatus, current: IncidentFollowUpStatus): boolean {
	if (prior === current) return true
	if (prior === "open") return current === "in-progress" || current === "completed" || current === "waived"
	if (prior === "in-progress") return current === "completed" || current === "waived"
	return false
}

function renderDecisionView(decision: ProjectArchitectureDecision): string {
	const alternatives = decision.alternatives.length
		? decision.alternatives.map((item) => `- **${markdownText(item.option)}:** ${markdownText(item.rationale)}`).join("\n")
		: "_No alternatives recorded._"
	const approvalRecord = decision.approval
	const approval = approvalRecord
		? `**Authority:** ${approvalRecord.authority}\n\n**Basis:** ${markdownText(approvalRecord.statement)}\n\n**Accepted:** ${approvalRecord.acceptedAt}\n\n${renderEvidence(approvalRecord.evidence)}`
		: "_No acceptance approval is recorded._"
	return `${GENERATED_ADR_MARKER} ${decision.id} -->
# ${decision.id}: ${markdownText(decision.title)}

**Decision status:** ${decision.status}<br>
**Delivery state:** ${decision.deliveryState}<br>
**Affected surfaces:** ${decision.affectedSurfaces.map((item) => `\`${item}\``).join(", ") || "_unmapped_"}<br>
**Created:** ${decision.createdAt} by ${decision.createdBy}<br>
**Updated:** ${decision.updatedAt}

## Context

${markdownText(decision.context)}

## Decision

${markdownText(decision.decision)}

## Rationale

${markdownText(decision.rationale)}

## Alternatives considered

${alternatives}

## Consequences

${markdownText(decision.consequences)}

## Decision authority

${approval}

## Delivery evidence

${renderEvidence(decision.implementationEvidence)}

## Verification evidence

${renderEvidence(decision.verificationEvidence)}

## Supersession

- Supersedes: ${decision.supersedes.length ? decision.supersedes.map((id) => `[${id}](${id}.md)`).join(", ") : "_none_"}
- Superseded by: ${decision.supersededBy ? `[${decision.supersededBy}](${decision.supersededBy}.md)` : "_none_"}

Decision status records the project choice. Delivery state records implementation and verification separately. The evidence references are project-local claims whose current contents still need semantic review.
`
}

function renderDecisionIndex(decisions: ProjectArchitectureDecision[]): string {
	const rows = [...decisions]
		.sort((left, right) => left.id.localeCompare(right.id))
		.map(
			(item) =>
				`| [${item.id}](managed/${item.id}.md) | ${markdownText(item.title)} | ${item.status} | ${item.deliveryState} | ${item.affectedSurfaces.map((surface) => `\`${surface}\``).join(", ") || "_unmapped_"} |`,
		)
	return `${GENERATED_INDEX_MARKER}
# ADR lifecycle index

The registry \`${PROJECT_KNOWLEDGE_PATHS.decisionRegistry}\` is canonical. This generated view distinguishes the decision lifecycle from delivery and evidence. Superseded decisions remain available as history and are not active instruction.

| ID | Title | Decision status | Delivery | Affected surfaces |
| --- | --- | --- | --- | --- |
${rows.length ? rows.join("\n") : "| _No lifecycle-managed decisions_ |  |  |  |  |"}
`
}

function renderIncidentIndex(incidents: ProjectIncident[], followUps: ProjectIncidentFollowUp[]): string {
	const rows = [...incidents]
		.sort((left, right) => left.id.localeCompare(right.id))
		.map((incident) => {
			const pending = followUps.filter(
				(item) => item.incidentId === incident.id && (item.status === "open" || item.status === "in-progress"),
			)
			const requiredCount = pending.filter((item) => item.required).length
			return `| [${incident.id}](records/${incident.id}.md) | ${markdownText(incident.title)} | ${incident.status} | ${incident.severity} | ${requiredCount} required / ${pending.length} total | ${incident.affectedSurfaces.map((surface) => `\`${surface}\``).join(", ") || "_unmapped_"} |`
		})
	return `${GENERATED_INDEX_MARKER}
# Incident register

Canonical incident state and follow-ups are stored in \`${PROJECT_KNOWLEDGE_PATHS.incidentRegister}\`; the append-only event history is \`${PROJECT_KNOWLEDGE_PATHS.incidentEvents}\`. Each record link is the authoritative generated postmortem view. The current register is sufficient to locate open work without scanning history.

| ID | Incident | State | Severity | Open follow-ups | Affected surfaces |
| --- | --- | --- | --- | --- | --- |
${rows.length ? rows.join("\n") : "| _No incidents registered_ |  |  |  |  |  |"}
`
}

function renderIncidentView(
	incident: ProjectIncident,
	followUps: ProjectIncidentFollowUp[],
	events: ProjectIncidentEvent[],
): string {
	const actions = followUps
		.filter((item) => item.incidentId === incident.id)
		.sort((left, right) => left.id.localeCompare(right.id))
	const timeline = events
		.filter((item) => item.incidentId === incident.id)
		.sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id))
	const eventText = timeline.length
		? timeline
				.map(
					(item) =>
						`### ${item.id} — ${item.kind} — ${item.observedAt}\n\n- Observation: ${markdownText(item.observation)}\n- Action: ${markdownText(item.action)}\n- Result: ${markdownText(item.result)}\n- Next step: ${markdownText(item.nextStep)}\n- Supersedes: ${item.supersedes ? item.supersedes : "_none_"}\n\n${renderEvidence(item.evidence)}`,
				)
				.join("\n\n")
		: "_No append-only event has been recorded._"
	const followUpText = actions.length
		? actions
				.map(
					(item) =>
						`- **${item.id} — ${markdownText(item.title)}** [${item.status}; ${item.required ? "required" : "optional"}; owner=${markdownText(item.ownerRole)}]\n  - Next: ${markdownText(item.nextStep)}\n  - Closure criteria: ${markdownText(item.closureCriteria)}\n  - Evidence: ${renderEvidenceInline(item.completionEvidence)}\n  - Waiver: ${item.waiverRationale ? markdownText(item.waiverRationale) : "_none_"}`,
				)
				.join("\n")
		: "_No follow-up actions are registered._"
	return `${GENERATED_INCIDENT_MARKER} ${incident.id} -->
# ${incident.id}: ${markdownText(incident.title)}

**State:** ${incident.status}<br>
**Severity:** ${incident.severity}<br>
**Observed:** ${incident.observedAt}<br>
**Affected surfaces:** ${incident.affectedSurfaces.map((item) => `\`${item}\``).join(", ") || "_unmapped_"}<br>
**Created:** ${incident.createdAt} by ${incident.createdBy}<br>
**Updated:** ${incident.updatedAt}

## What happened

${markdownText(incident.summary)}

## Impact

${markdownText(incident.impact)}

## Initial evidence

${renderEvidence(incident.initialEvidence)}

## Cause and contributing conditions

- Cause status: ${incident.cause.state}
- Current explanation: ${markdownText(incident.cause.summary)}
- Contributing conditions: ${incident.contributingConditions.length ? incident.contributingConditions.map(markdownText).join("; ") : "_none recorded_"}

${renderEvidence(incident.cause.evidence)}

## Remediation and recovery

${incident.remediation.length ? incident.remediation.map((item) => `- ${markdownText(item)}`).join("\n") : "_No remediation recorded._"}

### Recovery evidence

${renderEvidence(incident.recoveryEvidence)}

### Closure evidence

${renderEvidence(incident.closureEvidence)}

## Follow-ups

${followUpText}

## Append-only event history

Events in \`${PROJECT_KNOWLEDGE_PATHS.incidentEvents}\` are observations/actions/results at their recorded time. Corrections append a new event that references an earlier event; they do not rewrite it.

${eventText}

The register is current state; this postmortem view is generated from the register and event history. A changed or completed code path alone does not close an incident. Closure requires recovery evidence, closure evidence, and resolution or evidenced waiver of every required follow-up.
`
}

function renderEvidence(items: ProjectEvidence[]): string {
	return items.length
		? items
				.map(
					(item) =>
						`- **${item.kind}:** [${item.path}](${relativeMarkdownLink(item.path)}) — ${markdownText(item.description)} (observed ${item.observedAt}; sha256=${item.sha256 ?? "not-recorded"}${item.target ? `; target=${markdownText(item.target)}` : ""}${item.revision ? `; revision=${markdownText(item.revision)}` : ""})`,
				)
				.join("\n")
		: "_No evidence recorded._"
}

function renderEvidenceInline(items: ProjectEvidence[]): string {
	return items.length ? items.map((item) => `[${item.kind}](${relativeMarkdownLink(item.path)})`).join(", ") : "_none_"
}

function renderDecision(
	decision: ProjectArchitectureDecision,
	diagnostics: ProjectKnowledgeDiagnostic[],
	historical: boolean,
): string {
	const issues = diagnostics.filter((item) => item.severity === "error").map((item) => `${item.code}: ${item.message}`)
	const evidenceState =
		decision.deliveryState === "verified"
			? `delivery=verified, with ${decision.verificationEvidence.length} verification evidence reference(s)`
			: decision.deliveryState === "implemented"
				? `delivery=implemented, not verified (${decision.verificationEvidence.length} verification evidence reference(s))`
				: `delivery=${decision.deliveryState}`
	const approvalBasis = decision.approval?.evidence?.length
		? `approval evidence=${renderEvidenceRefs(decision.approval.evidence)}`
		: "approval evidence=none recorded"
	const implementation = decision.implementationEvidence.length
		? renderEvidenceRefs(decision.implementationEvidence)
		: "none recorded"
	const verification = decision.verificationEvidence.length
		? renderEvidenceRefs(decision.verificationEvidence)
		: "none recorded"
	return `- **${decision.id}: ${decision.title}** [decision=${decision.status}; ${evidenceState}] surfaces=${decision.affectedSurfaces.join(", ") || "_unmapped_"}. Choice: ${compactText(decision.decision, 360)} Rationale: ${compactText(decision.rationale, 220)} Implementation evidence: ${implementation}. Verification evidence: ${verification}. ${approvalBasis}. ${historical ? "Historical decision; not current instruction. " : ""}${issues.length ? `Lifecycle issues: ${issues.join("; ")}` : ""} Source: ${PROJECT_KNOWLEDGE_PATHS.decisionViews}/${decision.id}.md`
}

function renderIncident(
	incident: ProjectIncident,
	followUps: ProjectIncidentFollowUp[],
	events: ProjectIncidentEvent[],
	diagnostics: ProjectKnowledgeDiagnostic[],
): string {
	const incidentActions = followUps.filter((item) => isRecord(item) && item.incidentId === incident.id)
	const actions = incidentActions.filter((item) => item.status === "open" || item.status === "in-progress")
	const actionSummary = incidentActions.length
		? incidentActions
				.map(
					(item) =>
						`${String(item.id)}=${String(item.status)}${item.required ? "; required" : "; optional"}: ${String(item.title)}; next=${String(item.nextStep)}`,
				)
				.join(" | ")
		: "none registered"
	const latestEvent = events
		.filter((event) => isRecord(event) && event.incidentId === incident.id && typeof event.observedAt === "string")
		.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]
	const issues = diagnostics.filter((item) => item.severity === "error").map((item) => item.code)
	const observationEvidence = renderEvidenceRefs(incident.initialEvidence)
	const recoveryEvidence = renderEvidenceRefs(incident.recoveryEvidence)
	const closureEvidence = renderEvidenceRefs(incident.closureEvidence)
	return `- **${incident.id}: ${incident.title}** [${incident.status}; severity=${incident.severity}; ${actions.length} open follow-up(s)]. surfaces=${incident.affectedSurfaces.join(", ") || "_unmapped_"}. What happened: ${compactText(incident.summary, 220)} Impact: ${compactText(incident.impact, 180)} Cause=${incident.cause.state}: ${compactText(incident.cause.summary, 180)}. Initial evidence=${observationEvidence}; recovery evidence=${recoveryEvidence}; closure evidence=${closureEvidence}. Follow-ups: ${actionSummary}. Latest event: ${latestEvent ? `${latestEvent.kind} ${latestEvent.observedAt} — ${latestEvent.result}` : "missing"}. ${issues.length ? `Lifecycle issues: ${issues.join(", ")}. ` : ""}Source: ${PROJECT_KNOWLEDGE_PATHS.incidentViews}/${incident.id}.md`
}

function renderEvidenceRefs(items: ProjectEvidence[]): string {
	const validItems = Array.isArray(items) ? items.filter(isRecord) : []
	if (!validItems.length) return "none recorded"
	const selected = validItems
		.slice(0, 4)
		.map(
			(item) =>
				`${String(item.kind)} ${String(item.path)}: ${compactText(typeof item.description === "string" ? item.description : "description unavailable", 120)}`,
		)
	return `${selected.join("; ")}${validItems.length > selected.length ? `; ${validItems.length - selected.length} more in the lifecycle record` : ""}`
}

function compactText(value: string, maxChars: number): string {
	const normalized = value.replace(/\s+/g, " ").trim()
	return normalized.length <= maxChars ? normalized : `${normalized.slice(0, maxChars - 1).trimEnd()}…`
}

function renderImpactOneLine(impact: ProjectKnowledgeImpact): string {
	const decisions = impact.decisionReviews.map((item) => item.id)
	const incidents = impact.incidentReviews.map((item) => item.id)
	const evidence = impact.invalidatedEvidence.map((item) => `${item.recordId}:${item.path} (${item.reason})`)
	return `changed=${impact.changedFiles.length}; current-state docs=${impact.currentStateDocuments.join(", ") || "none mapped"}; ADR review=${decisions.join(", ") || "none"}; incident review=${incidents.join(", ") || "none"}; evidence invalidation=${evidence.join(", ") || "none"}; unmapped=${impact.unmappedFiles.join(", ") || "none"}.`
}

function groupDiagnosticsByEntity(diagnostics: ProjectKnowledgeDiagnostic[]): Map<string, ProjectKnowledgeDiagnostic[]> {
	const result = new Map<string, ProjectKnowledgeDiagnostic[]>()
	for (const diagnostic of diagnostics) {
		if (!diagnostic.entityId) continue
		const current = result.get(diagnostic.entityId) ?? []
		current.push(diagnostic)
		result.set(diagnostic.entityId, current)
	}
	return result
}

function isUsableDecisionAuthority(decision: ProjectArchitectureDecision, diagnostics: ProjectKnowledgeDiagnostic[]): boolean {
	const authorityErrors = new Set([
		"ADR_ID_INVALID",
		"ADR_STATUS_INVALID",
		"ADR_FIELD_REQUIRED",
		"ADR_METADATA_DATES",
		"ADR_CREATED_BY",
		"ADR_ALTERNATIVES_INVALID",
		"ADR_ALTERNATIVE_INVALID",
		"KNOWLEDGE_SURFACES_INVALID",
		"ADR_SUPERSEDES_INVALID",
		"ADR_APPROVAL_MISSING",
		"ADR_APPROVAL_INVALID",
		"ADR_APPROVAL_EVIDENCE",
		"ADR_SUPERSEDED_WITHOUT_SUCCESSOR",
		"ADR_SUPERSESSION_NOT_RECIPROCAL",
		"ADR_SUPERSESSION_NOT_ACTIVE",
		"ADR_SUPERSESSION_BROKEN",
		"ADR_SUPERSESSION_CYCLE",
	])
	const approvalEvidencePaths = new Set(
		Array.isArray(decision.approval?.evidence)
			? decision.approval.evidence
					.filter((item) => isRecord(item) && typeof item.path === "string")
					.map((item) => item.path)
			: [],
	)
	return (
		decision.status === "accepted" &&
		!diagnostics.some(
			(item) =>
				item.severity === "error" &&
				(authorityErrors.has(item.code) || Boolean(item.path && approvalEvidencePaths.has(item.path))),
		)
	)
}

function isRenderableIncident(incident: ProjectIncident): boolean {
	return (
		isRecord(incident) &&
		typeof incident.id === "string" &&
		typeof incident.title === "string" &&
		typeof incident.summary === "string" &&
		typeof incident.impact === "string" &&
		Array.isArray(incident.affectedSurfaces) &&
		isRecord(incident.cause) &&
		typeof incident.cause.state === "string" &&
		typeof incident.cause.summary === "string" &&
		Array.isArray(incident.initialEvidence) &&
		Array.isArray(incident.recoveryEvidence) &&
		Array.isArray(incident.closureEvidence)
	)
}

function knowledgeTerms(text: string): string[] {
	const ignored = new Set([
		"add",
		"all",
		"any",
		"area",
		"change",
		"check",
		"code",
		"continue",
		"docs",
		"file",
		"files",
		"fix",
		"from",
		"for",
		"implementation",
		"in",
		"into",
		"javascript",
		"js",
		"make",
		"md",
		"modify",
		"path",
		"paths",
		"please",
		"project",
		"src",
		"that",
		"this",
		"ts",
		"typescript",
		"using",
		"wiki",
		"with",
		"work",
		"update",
	])
	return Array.from(
		new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2 && !ignored.has(word))),
	).slice(0, 60)
}

function extractTaskPaths(text: string): string[] {
	const candidates =
		text.match(
			/(?:^|[\s`"'(])(?:\.wiki|src|docs|scripts|tests?|packages)\/[A-Za-z0-9_.*{}[\]-]+(?:\/[A-Za-z0-9_.*{}[\]-]+)*/g,
		) ?? []
	return Array.from(
		new Set(
			candidates
				.map((item) => normalizeWorkspacePath(item.trim().replace(/^[`"'(\s]+|[`"'),;.!?]+$/g, "")))
				.filter(Boolean),
		),
	)
}

function relevanceScore(terms: string[], taskPaths: string[], values: string[]): number {
	const normalized = values.join(" ").toLowerCase()
	const termScore = terms.reduce((count, term) => count + (normalized.includes(term) ? 2 : 0), 0)
	const pathScore = taskPaths.reduce(
		(count, taskPath) =>
			count +
			(values.some(
				(value) =>
					matchesSurface(taskPath, normalizeWorkspacePath(value)) ||
					matchesSurface(normalizeWorkspacePath(value), taskPath),
			)
				? 12
				: 0),
		0,
	)
	return termScore + pathScore
}

function getTaskRelevantSourceMap(entries: KnowledgeSourceMapEntry[], taskDescription: string): KnowledgeSourceMapEntry[] {
	const terms = knowledgeTerms(taskDescription)
	const paths = extractTaskPaths(taskDescription)
	return entries
		.map((entry) => ({ entry, score: relevanceScore(terms, paths, [entry.source, ...entry.documents]) }))
		.filter((item) => item.score > 0)
		.sort((left, right) => right.score - left.score || left.entry.source.localeCompare(right.entry.source))
		.slice(0, MAX_CONTEXT_MAPPED_DOCUMENTS)
		.map((item) => item.entry)
}

function termMatch(terms: string[], value: string): boolean {
	const normalized = value.toLowerCase()
	return terms.some((term) => normalized.includes(term))
}

function isHistoryQuery(terms: string[]): boolean {
	return terms.some((term) =>
		[
			"history",
			"historical",
			"previous",
			"past",
			"legacy",
			"old",
			"retired",
			"superseded",
			"closed",
			"postmortem",
			"incident",
		].includes(term),
	)
}

function isSafeSurface(value: unknown): value is string {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 240 ||
		value.startsWith("/") ||
		value.includes("\\") ||
		value.includes("\0")
	)
		return false
	if (/^[A-Za-z]:/.test(value) || value.split("/").some((segment) => segment === ".." || segment === ".")) return false
	return /^[A-Za-z0-9_.*?{}\-/]+$/.test(value)
}

function isSafeWorkspacePath(value: unknown): value is string {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 500 ||
		value.startsWith("/") ||
		value.includes("\\") ||
		value.includes("\0")
	)
		return false
	if (/^[A-Za-z]:/.test(value) || value.split("/").some((segment) => segment === ".." || segment === "." || !segment))
		return false
	return !value.split("/").some((segment) => segment === ".git")
}

function matchesSurface(relPath: string, pattern: string): boolean {
	const normalizedPath = normalizeWorkspacePath(relPath)
	const normalizedPattern = normalizeWorkspacePath(pattern).replace(/\/$/, "")
	if (!normalizedPath || !normalizedPattern || !isSafeSurface(normalizedPattern)) return false
	if (!normalizedPattern.includes("*") && !normalizedPattern.includes("?")) {
		if (normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`)) return true
	}
	let expression = "^"
	for (let index = 0; index < normalizedPattern.length; index += 1) {
		const character = normalizedPattern[index]
		if (character === "*" && normalizedPattern[index + 1] === "*") {
			expression += ".*"
			index += 1
		} else if (character === "*") expression += "[^/]*"
		else if (character === "?") expression += "[^/]"
		else expression += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
	}
	return new RegExp(`${expression}$`).test(normalizedPath)
}

function normalizeWorkspacePath(value: string): string {
	return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "")
}

function isCurrentStateDocument(value: string): boolean {
	return (
		/^(?:\.wiki\/)?(?:architecture|current-state|knowledge)\/[^/]+\.md$/i.test(value) ||
		/^(?:README|ARCHITECTURE|SYSTEM_OVERVIEW)\.md$/i.test(value)
	)
}

function isKnowledgeRecordPath(value: string): boolean {
	return (
		value === ".wiki/index.md" ||
		value === ".wiki/changelog.md" ||
		value === ".wiki/migration-state.md" ||
		value.startsWith(".wiki/adr/") ||
		value.startsWith(".wiki/incidents/") ||
		value.startsWith(".wiki/knowledge/") ||
		value.startsWith(".wiki/agent/") ||
		value.startsWith(".wiki/intelligence/")
	)
}

function uniqueEvidenceImpacts(
	items: ProjectKnowledgeImpact["invalidatedEvidence"],
): ProjectKnowledgeImpact["invalidatedEvidence"] {
	const unique = new Map<string, ProjectKnowledgeImpact["invalidatedEvidence"][number]>()
	for (const item of items) unique.set(`${item.recordId}\0${item.path}\0${item.reason}`, item)
	return Array.from(unique.values()).sort(
		(left, right) => left.recordId.localeCompare(right.recordId) || left.path.localeCompare(right.path),
	)
}

function checkAllowedFields(
	value: object,
	allowed: Set<string>,
	pathValue: string | undefined,
	diagnostics: ProjectKnowledgeDiagnostic[],
	entityId?: string,
): void {
	const extras = Object.keys(value).filter((key) => !allowed.has(key))
	if (extras.length)
		diagnostics.push(
			error("KNOWLEDGE_FIELD_UNKNOWN", pathValue, `Unknown lifecycle field(s): ${extras.join(", ")}.`, entityId),
		)
}

function validateSurfaceList(
	value: unknown,
	entityId: string,
	pathValue: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
): void {
	if (!Array.isArray(value) || value.length > 40 || value.some((item) => !isSafeSurface(item))) {
		diagnostics.push(
			error(
				"KNOWLEDGE_SURFACES_INVALID",
				pathValue,
				`${entityId} affectedSurfaces must contain at most 40 safe workspace-relative patterns.`,
				entityId,
			),
		)
	}
}

function validateTextList(
	value: unknown,
	entityId: string,
	field: string,
	diagnostics: ProjectKnowledgeDiagnostic[],
	maxItems: number,
	maxLength: number,
): void {
	if (!Array.isArray(value) || value.length > maxItems || value.some((item) => !boundedText(item, maxLength))) {
		diagnostics.push(
			error(
				"KNOWLEDGE_TEXT_LIST_INVALID",
				PROJECT_KNOWLEDGE_PATHS.incidentRegister,
				`${entityId} ${field} must contain at most ${maxItems} non-empty strings within ${maxLength} characters.`,
				entityId,
			),
		)
	}
}

function boundedText(value: unknown, maxLength: number): value is string {
	return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength
}

function isTimestamp(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) &&
		Number.isFinite(Date.parse(value))
	)
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function error(code: string, pathValue: string | undefined, message: string, entityId?: string): ProjectKnowledgeDiagnostic {
	return { severity: "error", code, path: pathValue, entityId, message }
}

function warning(code: string, pathValue: string | undefined, message: string, entityId?: string): ProjectKnowledgeDiagnostic {
	return { severity: "warning", code, path: pathValue, entityId, message }
}

function markdownText(value: string): string {
	return value.replace(/\r/g, "").trim()
}

function relativeMarkdownLink(relPath: string): string {
	return `../../../${relPath.split("/").map(encodeURIComponent).join("/")}`
}

function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex")
}

function evidenceFingerprintKey(value: unknown): string {
	return JSON.stringify(value, (_key, item) =>
		item && typeof item === "object" && !Array.isArray(item)
			? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
			: item,
	)
}

function truncate(value: string, maxChars: number): string {
	if (value.length <= maxChars) return value
	const suffix = "\n[Lifecycle context truncated; open the cited project-local files.]"
	return `${value.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`
}

function errorMessage(failure: unknown): string {
	return failure instanceof Error ? failure.message : String(failure)
}

async function projectRoot(cwd: string): Promise<string> {
	try {
		return await realpath(cwd)
	} catch {
		return path.resolve(cwd)
	}
}

async function ensureLocalDirectory(root: string, relPath: string): Promise<void> {
	if (!isSafeWorkspacePath(relPath)) throw new Error(`Unsafe project-local directory path: ${relPath}`)
	let current = root
	for (const segment of relPath.split("/")) {
		current = path.join(current, segment)
		try {
			const stat = await lstat(current)
			if (stat.isSymbolicLink() || !stat.isDirectory())
				throw new Error(`Knowledge directory must stay project-local: ${relPath}`)
		} catch (failure) {
			if (errorCode(failure) !== "ENOENT") throw failure
			try {
				await mkdir(current)
			} catch (createFailure) {
				if (errorCode(createFailure) !== "EEXIST") throw createFailure
				const stat = await lstat(current)
				if (stat.isSymbolicLink() || !stat.isDirectory())
					throw new Error(`Knowledge directory must stay project-local: ${relPath}`)
			}
		}
	}
}

async function writeNewLocalFile(root: string, relPath: string, content: string): Promise<boolean> {
	const parent = path.posix.dirname(relPath)
	if (parent !== ".") await ensureLocalDirectory(root, parent)
	await assertLocalFileDestination(root, relPath)
	try {
		await writeFile(path.join(root, relPath), content, { encoding: "utf8", flag: "wx" })
		return true
	} catch (failure) {
		if (errorCode(failure) === "EEXIST") return false
		throw failure
	}
}

async function writeLocalFile(
	root: string,
	relPath: string,
	content: string,
	overwrite = false,
	requiredMarker?: string,
): Promise<boolean> {
	const parent = path.posix.dirname(relPath)
	if (parent !== ".") await ensureLocalDirectory(root, parent)
	await assertLocalFileDestination(root, relPath)
	let existing: string | undefined
	try {
		existing = await safeReadFile(root, relPath)
	} catch (failure) {
		throw failure
	}
	if (existing !== undefined) {
		if (!overwrite) return false
		if (requiredMarker && !existing.includes(requiredMarker)) {
			throw new Error(`Refusing to replace human-authored or unmarked knowledge file: ${relPath}`)
		}
		if (existing === content) return false
	} else if (requiredMarker && !content.includes(requiredMarker)) {
		throw new Error(`Generated knowledge content is missing its ownership marker: ${relPath}`)
	}
	await writeFile(path.join(root, relPath), content, { encoding: "utf8", flag: existing === undefined ? "wx" : "w" })
	return true
}

async function assertLocalFileDestination(root: string, relPath: string): Promise<void> {
	if (!isSafeWorkspacePath(relPath)) throw new Error(`Unsafe project-local knowledge file path: ${relPath}`)
	const segments = relPath.split("/")
	let current = root
	for (let index = 0; index < segments.length; index += 1) {
		current = path.join(current, segments[index])
		try {
			const stat = await lstat(current)
			const final = index === segments.length - 1
			if (stat.isSymbolicLink() || (final ? !stat.isFile() : !stat.isDirectory())) {
				throw new Error(`Project-local knowledge path must not traverse symlinks: ${relPath}`)
			}
		} catch (failure) {
			if (errorCode(failure) === "ENOENT") return
			throw failure
		}
	}
}

async function safeReadFile(root: string, relPath: string): Promise<string | undefined> {
	if (!isSafeWorkspacePath(relPath)) throw new Error(`Unsafe project-local knowledge path: ${relPath}`)
	const segments = relPath.split("/")
	let current = root
	for (let index = 0; index < segments.length; index += 1) {
		current = path.join(current, segments[index])
		let stat: Awaited<ReturnType<typeof lstat>>
		try {
			stat = await lstat(current)
		} catch (failure) {
			if (errorCode(failure) === "ENOENT") return undefined
			throw failure
		}
		const final = index === segments.length - 1
		if (stat.isSymbolicLink() || (final ? !stat.isFile() : !stat.isDirectory())) {
			throw new Error(`Project-local knowledge path traverses an unsafe entry: ${relPath}`)
		}
		if (final && Number(stat.size) > 16_000_000)
			throw new Error(`Project-local evidence exceeds the 16 MB read bound: ${relPath}`)
	}
	return readFile(path.join(root, ...segments), "utf8")
}

function parseEvents(raw: string): ProjectIncidentEvent[] {
	const parsed: ProjectIncidentEvent[] = []
	for (const [index, line] of raw.split(/\r?\n/).entries()) {
		if (!line.trim()) continue
		let value: unknown
		try {
			value = JSON.parse(line)
		} catch (failure) {
			throw new Error(`Incident event history has malformed JSON at line ${index + 1}: ${errorMessage(failure)}`)
		}
		if (!isRecord(value)) throw new Error(`Incident event history line ${index + 1} must be an object.`)
		parsed.push(value as unknown as ProjectIncidentEvent)
	}
	return parsed
}

function errorCode(failure: unknown): string | undefined {
	return failure && typeof failure === "object" && "code" in failure && typeof failure.code === "string"
		? failure.code
		: undefined
}
