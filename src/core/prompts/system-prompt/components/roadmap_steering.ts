import {
	AUTO_GOVERNANCE,
	formatKanbanGateStatusLine,
	ROADMAP_DIAGNOSTIC_SLASH_COMMANDS,
} from "@/services/roadmap/RoadmapAutoGovernance"
import { getRoadmapConfig } from "@/services/roadmap/RoadmapConfig"
import { sessionBrief } from "@/services/roadmap/RoadmapSession"
import { SystemPromptSection } from "../templates/placeholders"
import type { ComponentFunction } from "../types"

export const getRoadmapSteeringSection: ComponentFunction = async (_variant, context) => {
	const cfg = getRoadmapConfig()
	if (!cfg.enabled || !context.cwd) {
		return ""
	}

	const brief = await sessionBrief(context.cwd)
	if (!brief || brief.success === false) {
		return ""
	}

	const identity = brief.project_identity_line || brief.steering_brief || "this project"
	const nextCall = brief.agent_next_call || brief.first_call || "roadmap(action='guide')"
	const gate = (brief.roadmap_gate || {}) as Record<string, unknown>
	const blocking = (gate.blocking_gates || []) as Array<{ id?: string }>
	const gateStatus =
		formatKanbanGateStatusLine({
			kanbanCompleteAllowed: brief.kanban_complete_allowed as boolean | undefined,
			validationPending: !!brief.validation_pending,
			schemaValid: brief.schema_valid as boolean | null | undefined,
			blockingGates: blocking,
		}) || ""
	const governancePolicy = brief.governance_policy || AUTO_GOVERNANCE.governancePolicy
	const midTaskNote =
		(brief.governance_mid_task as string | undefined) ||
		(brief.auto_clearable_governance_only || brief.validation_pending || brief.bootstrap_complete === false
			? AUTO_GOVERNANCE.continueTaskMidPass
			: AUTO_GOVERNANCE.validationAtCompletion)

	return `=== ${SystemPromptSection.ROADMAP_STEERING} ===

# Auto-Rolling Roadmap

ROADMAP.md at the workspace root is the long-horizon steering surface — not a backlog.

**Project:** ${identity}
**Phase:** ${brief.phase || "unknown"}
**Health:** ${brief.health_status || "unknown"}
**Prime directive:** Did the latest work strengthen or weaken the project's center of gravity?

**Execution authority:** Continue the user's task — your I/O loop is primary. Roadmap governance clears at \`attempt_completion\`; do not mid-task validate/doctor unless completion is blocked.

**Rolling checkpoint:** When authorized work changes roadmap progress, update ROADMAP.md once before completion: retain stable item IDs, archive verified outcomes with evidence, carry unfinished work forward, and record each blocker with its owner and unblock action. Promote the highest-priority ready Next item only within the user's authorized scope and available Now capacity (prefer 1–3, never more than 5). Promotion is planning, not permission to start unrelated work. Replace the Recent Checkpoint rather than appending repeated audits; do not mark work done based on a summary or elapsed time alone.

**Parent flow:** Batch independent authorized reads, continue ready work while another item waits, and keep dependent mutations ordered through the execution funnel. Retry a blocker only after its inputs or recovery action change; report unresolved dependencies explicitly.

**Governance policy:** ${governancePolicy}

**Auto-governance at completion:** ${AUTO_GOVERNANCE.bootstrapAtCompletion} ${AUTO_GOVERNANCE.validationAtCompletion} ${AUTO_GOVERNANCE.checkpointTouchAtCompletion}

**Mid-task guidance:** ${midTaskNote}
${gateStatus ? `\n**Gate status:** ${gateStatus}` : ""}

**Recommended next call:** ${nextCall}

Tool actions (optional — governance is internal at \`attempt_completion\`):
${ROADMAP_DIAGNOSTIC_SLASH_COMMANDS.map((cmd) => `- \`${cmd}\``).join("\n")}
- \`roadmap(action='checkpoint')\` — full evidence before major direction changes
- \`roadmap(action='apply_bootstrap_fill')\` — preview evidence autofill (write runs automatically at completion)

If \`attempt_completion\` is blocked by roadmap gates, edit ROADMAP.md per the gate message — do not call validate or MCP for governance.`
}
