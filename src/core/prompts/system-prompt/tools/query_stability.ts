import { ModelFamily } from "@/shared/prompts"
import { DietCodeDefaultTool } from "@/shared/tools"
import type { DietCodeToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

/**
 * ## query_stability
 * Description: Queries the stability registry using optional classifier and health filters. Returns detailed activity metrics and churn history.
 */

const id = DietCodeDefaultTool.STABILITY_QUERY

const GENERIC: DietCodeToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "query_stability",
	description: "Queries stability metrics with optional health and classifier filters. Useful for understanding churn and activity hotspots.",
	parameters: [
		{
			name: "layer",
			required: false,
			type: "string",
			instruction: "Optional classifier signal to filter by (for example domain or infrastructure). In workspace-native mode this is evidence only.",
		},
		{
			name: "minLogicDensity",
			required: false,
			type: "string",
			instruction: "Minimum logic density from 0 to 1.",
		},
		{
			name: "maxIOEntropy",
			required: false,
			type: "string",
			instruction: "Maximum I/O entropy from 0 to 1.",
		},
		{
			name: "minComplexity",
			required: false,
			type: "string",
			instruction: "Minimum AST complexity score.",
		},
		{
			name: "orphanedOnly",
			required: false,
			type: "boolean",
			instruction: "Return only disconnected/orphaned nodes.",
		},
		{
			name: "limit",
			required: false,
			type: "integer",
			instruction: "Maximum number of results to return (default 20).",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const query_stability_variants = [GENERIC]
