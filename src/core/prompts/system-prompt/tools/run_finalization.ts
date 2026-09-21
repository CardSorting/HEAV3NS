import { ModelFamily } from "@/shared/prompts"
import { DietCodeDefaultTool } from "@/shared/tools"
import type { DietCodeToolSpec } from "../spec"

const id = DietCodeDefaultTool.RUN_FINALIZATION

const generic: DietCodeToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "run_finalization",
	description: `Run same-session documentation and ledger finalization after engineering is verified. Use this after substantive work that changed project reality, when completion retry is locked, or when documentation (.wiki/) still needs updating. For substantive changes, provide summary as a concise agent-reported handoff: what changed, which local files or checks support it, relevant decision or constraint impact, and any unresolved uncertainty. The stored handoff remains unverified until the next session checks its evidence. Does not re-run engineering work. Call with seal=true after finalization succeeds to emit a sealed receipt and end the session without another attempt_completion.`,
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
	],
}

export const run_finalization_variants = [generic]
