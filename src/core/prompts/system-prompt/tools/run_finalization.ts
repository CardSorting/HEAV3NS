import { ModelFamily } from "@/shared/prompts"
import { DietCodeDefaultTool } from "@/shared/tools"
import type { DietCodeToolSpec } from "../spec"

const id = DietCodeDefaultTool.RUN_FINALIZATION

const generic: DietCodeToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "run_finalization",
	description: `Run same-session documentation and project-knowledge finalization after engineering is verified. Use this after substantive work that changed project reality. Provide summary as an unverified handoff. When a consequential architectural decision or qualifying incident changed, provide project_knowledge as JSON text with complete structured lifecycle records; never infer canonical records from summary prose. Does not re-run engineering work. Call with seal=true after finalization succeeds to emit a sealed receipt and end the session without another attempt_completion.`,
	parameters: [
		{
			name: "seal",
			required: false,
			instruction: "Set to true to emit the sealed receipt and end the session after finalization evidence exists.",
			usage: "true",
		},
		{
			name: "summary",
			required: false,
			instruction:
				"For substantive changes, provide a concise handoff with changed behavior, project-local evidence or verification, affected decisions/constraints, and unresolved uncertainty. This is an agent report marked for verification, not canonical truth.",
			usage: "Changed X; verified with Y; Z remains unresolved.",
		},
		{
			name: "project_knowledge",
			required: false,
			instruction: `Optional JSON text for actual ADR/incident lifecycle mutations. Shape: {"decisions":[full ADR records],"incidents":[full incident current-state records],"followUps":[full follow-up records],"events":[new append-only incident events],"sourceMap":[{"source":"src/path/**","documents":[".wiki/current-state.md"]}]}. A full ADR record has id,title,status,context,rationale,alternatives[{option,rationale}],decision,consequences,affectedSurfaces,deliveryState,implementationEvidence,verificationEvidence,approval?,supersedes,supersededBy?,createdAt,updatedAt,createdBy. Approval requires authority human-directive or project-policy, statement, acceptedAt and local decision-basis/project-directive evidence. Delivery evidence is separate: implemented needs source/change/commit evidence; verified additionally needs test/runtime/manual-check evidence. A full incident has id,title,severity,status,summary,impact,affectedSurfaces,observedAt,initialEvidence,cause{state,summary,evidence},contributingConditions,remediation,recoveryEvidence,closureEvidence,recurrenceOf?,createdAt,updatedAt,createdBy. A follow-up has id,incidentId,title,status,ownerRole,nextStep,closureCriteria,required,reviewBy?,completionEvidence,waiverRationale?,createdAt,updatedAt. Each appended event has id,incidentId,observedAt,kind,observation,action,result,nextStep,evidence,supersedes?. Source-map entries identify changed source globs and one or more existing current-state guides. Use project-relative evidence file paths. Provide complete records for changed IDs/patterns; existing history is merged and cannot be deleted. Do not create ADRs for routine coding choices or incidents for ordinary bugs. Accepted/superseded/implemented/verified/closed claims fail validation without the required authority, lifecycle and evidence.`,
			usage: `{"decisions":[],"incidents":[],"followUps":[],"events":[],"sourceMap":[]}`,
		},
	],
}

export const run_finalization_variants = [generic]
