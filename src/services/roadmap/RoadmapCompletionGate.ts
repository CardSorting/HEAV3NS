import * as fs from "fs/promises"
import * as path from "path"
import {
	AUTO_GOVERNANCE,
	buildRoadmapGateStructuredEnvelope,
	formatBlockingGatesList,
	formatRemediationNote,
	isAutoClearableGovernanceOnly,
	STALE_AUTO_TOUCH_REASONS,
} from "./RoadmapAutoGovernance"
import { getRoadmapConfig } from "./RoadmapConfig"
import { blockingClosedGates } from "./RoadmapGateCatalog"
import { readOptionalRoadmapFile, withRoadmapMutation } from "./RoadmapPersistence"
import { findBootstrapPlaceholders, stampRecentCheckpointDate, validateRoadmapContent } from "./RoadmapSchema"
import { RoadmapService } from "./RoadmapService"

export interface RoadmapCompletionBlock {
	blocked: boolean
	message?: string
	blockingGates?: Array<{ id?: string; label: string; why: string; fix?: string }>
	remediationSteps?: string[]
	dryRunAdvisory?: boolean
	autoClearableOnly?: boolean
}

export interface RoadmapCompletionEvaluateOptions {
	/** Non-mutating preview for preflight readiness — no ROADMAP.md writes. */
	dryRun?: boolean
}

interface RemediationPlan {
	validationWasPending: boolean
	bootstrapNeeded: boolean
	mechanicalStaleTouch: boolean
}

async function buildRemediationPlan(workspace: string, _options?: RoadmapCompletionEvaluateOptions): Promise<RemediationPlan> {
	const svc = RoadmapService.getInstance()
	const cfg = getRoadmapConfig()
	const rawState = await svc.readState(workspace)
	const validationWasPending = !!rawState.validation_pending

	const roadmapPath = path.join(workspace, "ROADMAP.md")
	let bootstrapNeeded = false
	try {
		const text = await fs.readFile(roadmapPath, "utf8")
		bootstrapNeeded = cfg.auto_bootstrap_fill && findBootstrapPlaceholders(text).length > 0
	} catch {
		bootstrapNeeded = false
	}

	let mechanicalStaleTouch = false
	if (cfg.warn_on_stale_before_complete) {
		try {
			const liveStatus = await svc.getOperationalStatus(workspace, "", "light")
			const gate = (liveStatus.roadmap_gate || {}) as Record<string, unknown>
			const staleReason = String(gate.stale_reason || "")
			mechanicalStaleTouch = !!gate.checkpoint_stale && STALE_AUTO_TOUCH_REASONS.has(staleReason)
		} catch {
			mechanicalStaleTouch = false
		}
	}

	return { validationWasPending, bootstrapNeeded, mechanicalStaleTouch }
}

function plannedStepsFromPlan(plan: RemediationPlan, executed?: Partial<RemediationPlan>): string[] {
	const steps: string[] = []
	const prefix = executed ? "auto" : "will"
	if (plan.bootstrapNeeded) {
		steps.push(`${prefix}-fill bootstrap placeholders in ROADMAP.md at attempt_completion`)
	}
	if (plan.validationWasPending || plan.bootstrapNeeded) {
		steps.push(`${prefix}-validate ROADMAP.md schema at attempt_completion`)
	}
	if (plan.mechanicalStaleTouch) {
		steps.push(`${prefix}-stamp Recent Checkpoint date in ROADMAP.md at attempt_completion`)
	}
	return steps
}

function isAutoClearableOnlyBlock(liveStatus: Record<string, unknown>): boolean {
	const gate = (liveStatus.roadmap_gate || {}) as Record<string, unknown>
	const blocking = (gate.blocking_gates || []) as Array<{ id?: string }>
	return isAutoClearableGovernanceOnly({
		kanbanCompleteAllowed: liveStatus.kanban_complete_allowed as boolean | undefined,
		validationPending: !!liveStatus.validation_pending,
		schemaValid: liveStatus.schema_valid as boolean | null | undefined,
		blockingGates: blocking,
	})
}

/** Internal pre-completion remediation — no agent tool or MCP calls. */
export async function remediateRoadmapGatesInternally(
	workspace: string,
	options?: RoadmapCompletionEvaluateOptions,
): Promise<{ steps: string[]; status: Record<string, unknown> }> {
	const svc = RoadmapService.getInstance()
	if (options?.dryRun) {
		const plan = await buildRemediationPlan(workspace, options)
		return { steps: plannedStepsFromPlan(plan), status: await svc.getOperationalStatus(workspace, "", "light") }
	}
	return withRoadmapMutation(workspace, async () => {
		const plan = await buildRemediationPlan(workspace, options)
		const steps: string[] = []
		const original = await readOptionalRoadmapFile(path.join(workspace, "ROADMAP.md"))
		let draft = original
		try {
			if (draft !== null && plan.bootstrapNeeded) {
				const evidence = await svc.gatherEvidence(workspace, draft, "standard")
				const filled = svc.applyBootstrapFillDraft(draft, evidence)
				draft = filled.preview_text
				if (filled.applied_count > 0) steps.push(`auto-filled ${filled.applied_count} bootstrap field(s) in ROADMAP.md`)
			}
			if (draft !== null && plan.mechanicalStaleTouch) {
				const touched = stampRecentCheckpointDate(draft, new Date().toISOString().slice(0, 10))
				if (touched !== draft) steps.push("auto-stamped Recent Checkpoint date in ROADMAP.md")
				draft = touched
			}
			if (plan.validationWasPending || draft !== original) {
				// Reject a bad draft before any document write. There is no stale backup to restore.
				if (!validateRoadmapContent(draft ?? "").valid)
					throw new Error("Roadmap draft has schema errors; repair ROADMAP.md before retrying.")
				if (draft !== original && draft !== null) await svc.commitRoadmapText(workspace, draft, original)
				await svc.validateRoadmap(workspace)
				steps.push("auto-validated ROADMAP.md schema")
			}
			let status = await svc.getOperationalStatus(workspace, "", "light")
			if (steps.length > 0 && (status.schema_valid === false || status.validation_pending === true)) {
				throw new Error("Validation is incomplete after internal remediation")
			}
			if (steps.length > 0) {
				await svc.recordMutationLineage(workspace, {
					action: "remediation_commit",
					tool: "completion_remediator",
					diff_summary: `Remediation completed successfully: ${steps.join("; ")}`,
				})
				status = await svc.getOperationalStatus(workspace, "", "light")
			}
			return { steps, status }
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			// Keep current bytes and independent state intact, including edits made by an external writer.
			await svc.writeState(workspace, { validation_pending: true, schema_valid: null })
			await svc.recordMutationLineage(workspace, {
				action: "remediation_rejected",
				tool: "completion_remediator",
				diff_summary: `Remediation stopped without restoring stale backups: ${reason}`,
			})
			const status = await svc.getOperationalStatus(workspace, "", "light")
			return {
				steps: [`remediation stopped: ${reason}`],
				status: { ...status, kanban_complete_allowed: false, validation_pending: true },
			}
		}
	})
}

export async function evaluateRoadmapCompletionBlock(
	workspace: string,
	options?: RoadmapCompletionEvaluateOptions,
): Promise<RoadmapCompletionBlock> {
	const cfg = getRoadmapConfig()
	if (!cfg.enabled) {
		return { blocked: false }
	}

	let remediation: Awaited<ReturnType<typeof remediateRoadmapGatesInternally>>
	try {
		remediation = await remediateRoadmapGatesInternally(workspace, options)
	} catch (error) {
		return {
			blocked: true,
			message: `${AUTO_GOVERNANCE.gateEvaluationFailed} ${error instanceof Error ? error.message : String(error)}`,
		}
	}
	const { steps, status: liveStatus } = remediation

	if (options?.dryRun) {
		if (liveStatus.kanban_complete_allowed === false && isAutoClearableOnlyBlock(liveStatus)) {
			return {
				blocked: false,
				remediationSteps: steps,
				dryRunAdvisory: true,
				autoClearableOnly: true,
				message: `${AUTO_GOVERNANCE.continueTaskMidPass} Planned: ${steps.join("; ")}.`,
			}
		}
	}

	const remediationNote = formatRemediationNote(steps)

	if (liveStatus.validation_pending) {
		return {
			blocked: true,
			message: `${AUTO_GOVERNANCE.autoValidateFailed}${remediationNote}\n\n${AUTO_GOVERNANCE.editRoadmapResolve}`,
			remediationSteps: steps,
			autoClearableOnly: false,
		}
	}

	if (liveStatus.kanban_complete_allowed === false) {
		const gate = (liveStatus.roadmap_gate || {}) as Record<string, unknown>
		const blockingGates = (gate.blocking_gates || []) as Array<{ label: string; why: string; fix: string; id?: string }>
		const closedGatesMsg = formatBlockingGatesList(blockingGates)
		return {
			blocked: true,
			message:
				`${AUTO_GOVERNANCE.gatesBlockedPrefix}\n` +
				(closedGatesMsg || "- Unknown gate closed") +
				remediationNote +
				`\n\n${AUTO_GOVERNANCE.editRoadmapResolve}`,
			blockingGates,
			remediationSteps: steps,
			autoClearableOnly: false,
		}
	}

	if (liveStatus.kanban_complete_allowed !== true) {
		return {
			blocked: true,
			message: AUTO_GOVERNANCE.gateEvaluationFailed + remediationNote,
			remediationSteps: steps,
		}
	}

	return { blocked: false, remediationSteps: steps.length > 0 ? steps : undefined, dryRunAdvisory: options?.dryRun }
}

/** Maps dry-run completion evaluation to preflight readiness issues (CI merge-preview style). */
export function roadmapPreflightReadinessFromDryRun(block: RoadmapCompletionBlock): {
	stage: "roadmap"
	message: string
	severity: "block" | "info"
} | null {
	if (block.blocked) {
		return {
			stage: "roadmap",
			message: block.message || AUTO_GOVERNANCE.gateEvaluationFailed,
			severity: "block",
		}
	}
	if (block.dryRunAdvisory || block.autoClearableOnly) {
		return {
			stage: "roadmap",
			message: block.message || AUTO_GOVERNANCE.midTaskGovernanceNote,
			severity: "info",
		}
	}
	return null
}

/** Kernel-style pre-completion gate — mirrors dietcode require_fresh_checkpoint_before_complete. */
export async function requireFreshCheckpointBeforeComplete(workspace: string): Promise<string | null> {
	const cfg = getRoadmapConfig()
	if (!cfg.enabled) return null

	const block = await evaluateRoadmapCompletionBlock(workspace)
	if (!block.blocked) return null

	const remediated =
		block.remediationSteps && block.remediationSteps.length > 0 ? ` (${block.remediationSteps.join("; ")})` : ""

	if (block.blockingGates && block.blockingGates.length > 0) {
		const first = block.blockingGates[0]
		return (
			`ROADMAP steering gate closed (${first.label}) — ${first.why}. ` +
			`${AUTO_GOVERNANCE.editRoadmapResolve}${remediated}`
		)
	}

	return (block.message || `ROADMAP steering gate closed — ${AUTO_GOVERNANCE.editRoadmapResolve}`) + remediated
}

export function failClosedCompletionMessage(): string {
	return AUTO_GOVERNANCE.gateEvaluationFailed
}

export function isGateBlockingSchema(closedGates: Array<{ id?: string }>, cfg = getRoadmapConfig()): boolean {
	return blockingClosedGates(closedGates as never, cfg).some((g) => g.id === "schema_valid")
}

/** Structured recovery blocks for completion gate agent envelope. */
export function buildRoadmapCompletionExtraBlocks(block: RoadmapCompletionBlock): string[] {
	return [
		buildRoadmapGateStructuredEnvelope({
			remediationSteps: block.remediationSteps,
			blockingGates: block.blockingGates,
			autoClearableOnly: block.autoClearableOnly ?? block.dryRunAdvisory ?? false,
		}),
	]
}
