import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { AutonomousDocumentationFinalizer } from "@core/task/tools/finalization/AutonomousDocumentationFinalizer"
import type { TaskConfig } from "@core/task/tools/types/TaskConfig"
import { expect } from "chai"
import {
	applyProjectKnowledgeMutation,
	bootstrapProjectKnowledge,
	buildProjectLifecycleContext,
	discoverKnowledgeImpactFromData,
	PROJECT_KNOWLEDGE_PATHS,
	ProjectArchitectureDecision,
	ProjectEvidence,
	ProjectIncident,
	ProjectIncidentEvent,
	ProjectIncidentFollowUp,
	ProjectKnowledgeMutation,
	syncProjectKnowledgeViews,
	validateProjectKnowledge,
} from "../ProjectKnowledgeLifecycle"
import { loadWorkspaceKnowledgeContext } from "../WorkspaceKnowledgeContext"

const timestamp = "2026-09-20T10:00:00.000Z"

async function createWorkspace(): Promise<string> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-project-lifecycle-"))
	await fs.mkdir(path.join(root, "docs"), { recursive: true })
	await fs.mkdir(path.join(root, "src"), { recursive: true })
	await fs.writeFile(path.join(root, "README.md"), "# Copper Project\n\nProject-local lifecycle tests.\n", "utf8")
	await fs.writeFile(path.join(root, "src/copper.ts"), "export const intake = 'copper';\n", "utf8")
	await bootstrapProjectKnowledge(root)
	return root
}

async function writeEvidence(root: string, relPath: string, text = `Evidence for ${relPath}.\n`): Promise<void> {
	const absolute = path.join(root, relPath)
	await fs.mkdir(path.dirname(absolute), { recursive: true })
	await fs.writeFile(absolute, text, "utf8")
}

function evidence(kind: ProjectEvidence["kind"], relPath: string, description = `Observed ${relPath}.`): ProjectEvidence {
	return { kind, path: relPath, description, observedAt: timestamp }
}

function makeAcceptedDecision(
	id: string,
	title: string,
	surface: string,
	chosen = "Keep the current boundary.",
): ProjectArchitectureDecision {
	return {
		id,
		title,
		status: "accepted",
		context: `The ${title} surface needs a stable boundary.`,
		rationale: "A local decision keeps ownership explicit.",
		alternatives: [{ option: "Move all behavior into one module", rationale: "Rejected because it obscures ownership." }],
		decision: chosen,
		consequences: "The affected surface keeps its current ownership boundary.",
		affectedSurfaces: [surface],
		deliveryState: "not-started",
		implementationEvidence: [],
		verificationEvidence: [],
		approval: {
			authority: "project-policy",
			statement: "README.md records the project boundary directive.",
			acceptedAt: timestamp,
			evidence: [evidence("project-directive", "README.md", "Project boundary directive.")],
		},
		supersedes: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		createdBy: "project-directive",
	}
}

function makeOpenIncident(): ProjectIncident {
	return {
		id: "INC-COPPER-001",
		title: "Copper intake outage",
		severity: "high",
		status: "investigating",
		summary: "Copper requests intermittently stopped reaching the intake handler.",
		impact: "Some copper submissions were delayed.",
		affectedSurfaces: ["src/copper.ts"],
		observedAt: timestamp,
		initialEvidence: [evidence("incident-observation", "docs/copper-observation.md")],
		cause: { state: "unknown", summary: "The cause remains under investigation.", evidence: [] },
		contributingConditions: ["The existing alert did not identify dropped requests."],
		remediation: [],
		recoveryEvidence: [],
		closureEvidence: [],
		createdAt: timestamp,
		updatedAt: timestamp,
		createdBy: "agent",
	}
}

function makeOpenFollowUp(): ProjectIncidentFollowUp {
	return {
		id: "FU-COPPER-001",
		incidentId: "INC-COPPER-001",
		title: "Add a durable dropped-request alert",
		status: "open",
		ownerRole: "maintainer",
		nextStep: "Add an alert for dropped copper submissions.",
		closureCriteria: "A controlled dropped submission triggers the alert.",
		required: true,
		completionEvidence: [],
		createdAt: timestamp,
		updatedAt: timestamp,
	}
}

function makeEvent(overrides: Partial<ProjectIncidentEvent> = {}): ProjectIncidentEvent {
	return {
		id: "EVT-COPPER-001",
		incidentId: "INC-COPPER-001",
		observedAt: timestamp,
		kind: "observation",
		observation: "The request counter increased while the intake handler did not receive the request.",
		action: "Compared the request counter with the handler trace.",
		result: "A dropped-request symptom was reproduced.",
		nextStep: "Inspect the retry boundary.",
		evidence: [evidence("incident-observation", "docs/copper-observation.md")],
		...overrides,
	}
}

async function apply(root: string, mutation: ProjectKnowledgeMutation): Promise<void> {
	await applyProjectKnowledgeMutation(root, JSON.stringify(mutation))
}

async function expectFailure(operation: Promise<unknown>, message: string): Promise<void> {
	let failure = ""
	try {
		await operation
	} catch (error) {
		failure = error instanceof Error ? error.message : String(error)
	}
	expect(failure).to.include(message)
}

describe("ProjectKnowledgeLifecycle", () => {
	it("bootstraps only empty, project-local lifecycle structures and is idempotent", async () => {
		const root = await createWorkspace()
		try {
			const second = await bootstrapProjectKnowledge(root)
			const third = await bootstrapProjectKnowledge(root)
			const decisions = JSON.parse(await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.decisionRegistry), "utf8"))
			const incidents = JSON.parse(await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentRegister), "utf8"))

			expect(second.created).to.deep.equal([])
			expect(third.created).to.deep.equal([])
			expect(decisions.decisions).to.deep.equal([])
			expect(incidents.incidents).to.deep.equal([])
			expect(incidents.followUps).to.deep.equal([])
			expect(await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents), "utf8")).to.equal("")
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("persists a structured decision through finalization for the next fresh session", async () => {
		const root = await createWorkspace()
		try {
			const decision = makeAcceptedDecision("ADR-031", "Copper Intake Boundary", "src/copper.ts")
			const serializedMutation = JSON.stringify({ decisions: [decision] })
			const config = {
				cwd: root,
				taskId: "session-a",
				services: undefined,
				universalGuard: {
					getSessionImpactSummary: () => "Changed file: src/copper.ts",
					checkForensicCompliance: async () => ({ compliant: true }),
				},
			} as unknown as TaskConfig
			const result = await new AutonomousDocumentationFinalizer(config).run(
				undefined,
				"Implemented copper intake boundary; verified with docs/copper-test.md.",
				serializedMutation,
			)
			const nextSession = await loadWorkspaceKnowledgeContext(root, "Continue work in src/copper.ts")
			const registry = JSON.parse(await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.decisionRegistry), "utf8"))

			expect(result.evidence.projectKnowledgeValidated).to.equal(true)
			expect(result.evidence.projectKnowledgeMutationHash).to.be.a("string")
			expect(registry.decisions.map((item: ProjectArchitectureDecision) => item.id)).to.include("ADR-031")
			expect(await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.decisionViews, "ADR-031.md"), "utf8")).to.include(
				"Copper Intake Boundary",
			)
			expect(nextSession).to.include("ADR-031")
			expect(nextSession).to.include("decision=accepted")
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("keeps accepted decisions separate from delivery and requires evidence for verification", async () => {
		const root = await createWorkspace()
		try {
			await writeEvidence(root, "docs/copper-test.md", "Copper intake test passed.\n")
			const accepted = makeAcceptedDecision("ADR-001", "Copper Intake Boundary", "src/copper.ts")
			const unrelated = makeAcceptedDecision("ADR-002", "Amber Queue Boundary", "src/amber.ts")
			await writeEvidence(root, "src/amber.ts", "export const queue = 'amber';\n")
			await apply(root, { decisions: [accepted, unrelated] })
			await syncProjectKnowledgeViews(root)

			const entry = await loadWorkspaceKnowledgeContext(root, "Continue work in src/copper.ts")
			expect(entry).to.include("ADR-001")
			expect(entry).not.to.include("ADR-002")
			expect(entry).to.include("decision=accepted")
			expect(entry).to.include("delivery=not-started")
			expect(entry).not.to.include(".wiki/intelligence/workspace-intelligence.json exists")

			const inProgress: ProjectArchitectureDecision = {
				...accepted,
				deliveryState: "in-progress",
				implementationEvidence: [evidence("source", "src/copper.ts", "Copper boundary implementation.")],
				updatedAt: "2026-09-20T11:00:00.000Z",
			}
			await apply(root, { decisions: [inProgress] })
			const implemented: ProjectArchitectureDecision = {
				...inProgress,
				deliveryState: "implemented",
				updatedAt: "2026-09-20T12:00:00.000Z",
			}
			await apply(root, { decisions: [implemented] })

			const missingVerification = {
				...implemented,
				deliveryState: "verified" as const,
				updatedAt: "2026-09-20T13:00:00.000Z",
			}
			await expectFailure(apply(root, { decisions: [missingVerification] }), "ADR_VERIFICATION_EVIDENCE")

			const verified: ProjectArchitectureDecision = {
				...missingVerification,
				verificationEvidence: [evidence("test-result", "docs/copper-test.md", "Copper intake test result.")],
			}
			await apply(root, { decisions: [verified] })
			await syncProjectKnowledgeViews(root)
			const validation = await validateProjectKnowledge(root)
			const nextSession = await loadWorkspaceKnowledgeContext(root, "Inspect src/copper.ts")

			expect(validation.valid).to.equal(true)
			expect(nextSession).to.include("delivery=verified")
			expect(nextSession).to.include("Copper intake test result")

			await fs.writeFile(path.join(root, "docs/copper-test.md"), "The historical test report was replaced.\n", "utf8")
			const drifted = await buildProjectLifecycleContext(root, "Inspect src/copper.ts")
			expect(drifted.validation.valid).to.equal(false)
			expect(drifted.validation.diagnostics.map((item) => item.code)).to.include("EVIDENCE_FINGERPRINT_STALE")
			expect(drifted.text).to.include("EVIDENCE_FINGERPRINT_STALE")
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("supersedes decisions without exposing the retired ADR as active task instruction", async () => {
		const root = await createWorkspace()
		try {
			const prior = makeAcceptedDecision(
				"ADR-011",
				"Copper Queue Boundary",
				"src/copper.ts",
				"Use the original copper queue.",
			)
			const next = makeAcceptedDecision(
				"ADR-012",
				"Copper Intake Boundary",
				"src/copper.ts",
				"Use the segmented copper intake.",
			)
			await apply(root, { decisions: [prior] })
			const retired: ProjectArchitectureDecision = {
				...prior,
				status: "superseded",
				supersededBy: next.id,
				updatedAt: "2026-09-20T11:00:00.000Z",
			}
			await apply(root, { decisions: [retired, { ...next, supersedes: [prior.id] }] })
			await syncProjectKnowledgeViews(root)

			const currentContext = await buildProjectLifecycleContext(root, "Continue work in src/copper.ts")
			const historyContext = await buildProjectLifecycleContext(root, "Review historical copper queue decisions")
			const validation = await validateProjectKnowledge(root)
			await expectFailure(apply(root, { decisions: [{ ...next, supersedes: ["ADR-999"] }] }), "ADR_SUPERSESSION_BROKEN")
			await expectFailure(
				apply(root, { decisions: [{ ...next, status: "proposed", updatedAt: "2026-09-20T12:00:00.000Z" }] }),
				"ADR_STATUS_TRANSITION_INVALID",
			)

			expect(validation.valid).to.equal(true)
			expect(currentContext.text).to.include("ADR-012")
			expect(currentContext.text).not.to.include("ADR-011: Copper Queue Boundary**")
			expect(historyContext.text).to.include("ADR-011: Copper Queue Boundary**")
			expect(historyContext.text).to.include("Historical decision; not current instruction.")
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("keeps incident events append-only, follows required actions, and gates closure on evidence", async () => {
		const root = await createWorkspace()
		try {
			for (const item of [
				"src/amber.ts",
				"docs/copper-observation.md",
				"docs/recovery-check.md",
				"docs/closure-check.md",
				"docs/follow-up-check.md",
				"docs/amber-observation.md",
				"docs/amber-recovery.md",
				"docs/amber-closure.md",
			])
				await writeEvidence(root, item)
			const copper = makeOpenIncident()
			const amber: ProjectIncident = {
				id: "INC-AMBER-002",
				title: "Amber queue timeout",
				severity: "low",
				status: "closed",
				summary: "The amber queue timed out during a controlled load run.",
				impact: "One synthetic request timed out.",
				affectedSurfaces: ["src/amber.ts"],
				observedAt: timestamp,
				initialEvidence: [evidence("incident-observation", "docs/amber-observation.md")],
				cause: {
					state: "confirmed",
					summary: "A test queue had an intentionally short timeout.",
					evidence: [evidence("source", "src/amber.ts")],
				},
				contributingConditions: [],
				remediation: ["Restored the controlled test timeout."],
				recoveryEvidence: [evidence("runtime-check", "docs/amber-recovery.md")],
				closureEvidence: [evidence("manual-check", "docs/amber-closure.md")],
				createdAt: timestamp,
				updatedAt: timestamp,
				createdBy: "human",
			}
			const amberEvents = [
				makeEvent({
					id: "EVT-AMBER-001",
					incidentId: amber.id,
					evidence: [evidence("incident-observation", "docs/amber-observation.md")],
				}),
				makeEvent({
					id: "EVT-AMBER-002",
					incidentId: amber.id,
					observedAt: "2026-09-20T11:00:00.000Z",
					kind: "recovery",
					evidence: [evidence("runtime-check", "docs/amber-recovery.md")],
				}),
				makeEvent({
					id: "EVT-AMBER-003",
					incidentId: amber.id,
					observedAt: "2026-09-20T12:00:00.000Z",
					kind: "verification",
					evidence: [evidence("manual-check", "docs/amber-closure.md")],
				}),
			]
			await apply(root, {
				incidents: [copper, amber],
				followUps: [makeOpenFollowUp()],
				events: [makeEvent(), ...amberEvents],
			})
			await syncProjectKnowledgeViews(root)

			const observationHistory = await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents), "utf8")
			await apply(root, {
				events: [
					makeEvent({
						id: "EVT-COPPER-002",
						observedAt: "2026-09-20T10:30:00.000Z",
						kind: "correction",
						observation: "Correction: the request counter increments after the handler acknowledges receipt.",
						action: "Reviewed the original handler trace.",
						result: "The prior event omitted its acknowledgement timing.",
						nextStep: "Keep investigating retries.",
						supersedes: "EVT-COPPER-001",
					}),
				],
			})
			const correctedHistory = await fs.readFile(path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents), "utf8")
			expect(correctedHistory.startsWith(observationHistory)).to.equal(true)

			const firstSession = await loadWorkspaceKnowledgeContext(root, "Investigate copper intake in src/copper.ts")
			expect(firstSession).to.include("INC-COPPER-001")
			expect(firstSession).to.include("Add a durable dropped-request alert")
			expect(firstSession).not.to.include("INC-AMBER-002")

			const recovered: ProjectIncident = {
				...copper,
				status: "recovered",
				remediation: ["Restarted the copper intake worker and confirmed queue drain."],
				recoveryEvidence: [evidence("runtime-check", "docs/recovery-check.md")],
				updatedAt: "2026-09-20T13:00:00.000Z",
			}
			await apply(root, {
				incidents: [recovered],
				events: [
					makeEvent({
						id: "EVT-COPPER-003",
						observedAt: "2026-09-20T13:00:00.000Z",
						kind: "recovery",
						evidence: [evidence("runtime-check", "docs/recovery-check.md")],
					}),
				],
			})
			const prematurelyClosed: ProjectIncident = {
				...recovered,
				status: "closed",
				closureEvidence: [evidence("manual-check", "docs/closure-check.md")],
				updatedAt: "2026-09-20T14:00:00.000Z",
			}
			await expectFailure(
				apply(root, {
					incidents: [prematurelyClosed],
					events: [
						makeEvent({
							id: "EVT-COPPER-004",
							observedAt: "2026-09-20T14:00:00.000Z",
							kind: "verification",
							evidence: [evidence("manual-check", "docs/closure-check.md")],
						}),
					],
				}),
				"INCIDENT_CLOSED_WITH_OPEN_FOLLOWUP",
			)

			const completeFollowUp: ProjectIncidentFollowUp = {
				...makeOpenFollowUp(),
				status: "completed",
				completionEvidence: [evidence("test-result", "docs/follow-up-check.md")],
				updatedAt: "2026-09-20T14:00:00.000Z",
			}
			await apply(root, {
				incidents: [prematurelyClosed],
				followUps: [completeFollowUp],
				events: [
					makeEvent({
						id: "EVT-COPPER-004",
						observedAt: "2026-09-20T14:00:00.000Z",
						kind: "verification",
						evidence: [evidence("manual-check", "docs/closure-check.md")],
					}),
				],
			})
			await syncProjectKnowledgeViews(root)
			const nextSession = await loadWorkspaceKnowledgeContext(root, "Continue work in src/copper.ts")
			const historicalSession = await buildProjectLifecycleContext(root, "Review copper incident postmortem history")
			const validation = await validateProjectKnowledge(root)

			expect(validation.valid).to.equal(true)
			expect(nextSession).to.include("No non-closed incident is registered")
			expect(nextSession).not.to.include("INC-COPPER-001: Copper intake outage**")
			expect(historicalSession.text).to.include("INC-COPPER-001: Copper intake outage**")
			expect(historicalSession.text).to.include("completed; required")
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("scopes unrelated open incidents and reports incident evidence impact", async () => {
		const root = await createWorkspace()
		try {
			await writeEvidence(root, "docs/copper-observation.md")
			await writeEvidence(root, "docs/amber-observation.md")
			const copper = makeOpenIncident()
			const amber: ProjectIncident = {
				...makeOpenIncident(),
				id: "INC-AMBER-002",
				title: "Amber queue outage",
				summary: "Amber requests intermittently stopped reaching the queue handler.",
				impact: "Some amber submissions were delayed.",
				affectedSurfaces: ["src/amber.ts"],
				initialEvidence: [evidence("incident-observation", "docs/amber-observation.md")],
			}
			const amberEvent = makeEvent({
				id: "EVT-AMBER-002",
				incidentId: amber.id,
				evidence: [evidence("incident-observation", "docs/amber-observation.md")],
			})
			await apply(root, { incidents: [copper, amber], events: [makeEvent(), amberEvent] })

			const context = await buildProjectLifecycleContext(root, "Investigate copper intake in src/copper.ts")
			const impact = discoverKnowledgeImpactFromData([], [copper, amber], [], [], ["docs/copper-observation.md"], "", [
				makeEvent(),
				amberEvent,
			])

			expect(context.text).to.include("Copper intake outage")
			expect(context.text).not.to.include("Amber queue outage")
			expect(impact.incidentReviews.map((item) => item.id)).to.include("INC-COPPER-001")
			expect(impact.invalidatedEvidence).to.deep.include({
				recordId: "INC-COPPER-001",
				path: "docs/copper-observation.md",
				reason: "changed",
			})
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("discovers mapped current-state, decision, incident, and evidence impact for changed paths", async () => {
		const root = await createWorkspace()
		try {
			await writeEvidence(root, "docs/current-copper.md", "Current copper-state guide.\n")
			await writeEvidence(root, "docs/copper-observation.md")
			const decision = makeAcceptedDecision("ADR-021", "Copper Intake Boundary", "src/copper.ts")
			await apply(root, {
				decisions: [decision],
				incidents: [makeOpenIncident()],
				followUps: [makeOpenFollowUp()],
				events: [makeEvent()],
				sourceMap: [{ source: "src/copper.ts", documents: ["docs/current-copper.md"] }],
			})
			await syncProjectKnowledgeViews(root)
			const snapshot = await validateProjectKnowledge(root)
			const impact = discoverKnowledgeImpactFromData(
				snapshot.decisions,
				snapshot.incidents,
				snapshot.followUps,
				snapshot.sourceMap,
				["src/copper.ts", "src/unknown.ts"],
			)

			expect(snapshot.valid).to.equal(true)
			expect(impact.currentStateDocuments).to.include("docs/current-copper.md")
			expect(impact.decisionReviews.map((item) => item.id)).to.include("ADR-021")
			expect(impact.incidentReviews.map((item) => item.id)).to.include("INC-COPPER-001")
			expect(impact.unmappedFiles).to.include("src/unknown.ts")
		} finally {
			await fs.rm(root, { recursive: true, force: true })
		}
	})

	it("reports changed append-only event history and refuses symlinked lifecycle files", async () => {
		const root = await createWorkspace()
		const external = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-external-knowledge-"))
		try {
			for (const item of ["docs/copper-observation.md"]) await writeEvidence(root, item)
			await apply(root, { incidents: [makeOpenIncident()], followUps: [makeOpenFollowUp()], events: [makeEvent()] })
			await syncProjectKnowledgeViews(root)
			execFileSync("git", ["init"], { cwd: root, stdio: "ignore" })
			execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: root, stdio: "ignore" })
			execFileSync("git", ["config", "user.name", "Lifecycle Test"], { cwd: root, stdio: "ignore" })
			execFileSync("git", ["add", ".wiki", "README.md", "docs"], { cwd: root, stdio: "ignore" })
			execFileSync("git", ["commit", "-m", "lifecycle baseline"], { cwd: root, stdio: "ignore" })
			const historyPath = path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)
			const original = await fs.readFile(historyPath, "utf8")
			const rewritten = original.replace("A dropped-request symptom was reproduced.", "A different symptom was reported.")
			await fs.writeFile(historyPath, rewritten, "utf8")
			const altered = await validateProjectKnowledge(root, { checkAppendOnly: true })
			expect(altered.diagnostics.map((item) => item.code)).to.include("INCIDENT_HISTORY_REWRITTEN")

			const eventPath = path.join(root, PROJECT_KNOWLEDGE_PATHS.incidentEvents)
			await fs.rm(eventPath)
			const externalHistory = path.join(external, "events.jsonl")
			await fs.writeFile(externalHistory, original, "utf8")
			await fs.symlink(externalHistory, eventPath, "file")
			const unsafe = await validateProjectKnowledge(root)
			expect(unsafe.diagnostics.map((item) => item.code)).to.include("INCIDENT_EVENTS_UNSAFE")
			expect(await fs.readFile(externalHistory, "utf8")).to.equal(original)
		} finally {
			await fs.rm(root, { recursive: true, force: true })
			await fs.rm(external, { recursive: true, force: true })
		}
	})
})
