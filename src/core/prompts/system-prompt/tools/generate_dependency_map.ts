import { ModelFamily } from "@/shared/prompts"
import { DietCodeDefaultTool } from "@/shared/tools"
import type { DietCodeToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

/**
 * ## generate_dependency_map
 * Description: Generates a dependency map for the project or an optional subtree. Visualizes coupling and structural risk.
 * Parameters:
 * - rootPath: (optional) Root path to start the map from (defaults to src).
 */

const id = DietCodeDefaultTool.STABILITY_MAP

const GENERIC: DietCodeToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "generate_dependency_map",
	description: "Generates a dependency map to visualize project coupling and structural risk. In workspace-native mode, classifier categories are evidence only.",
	parameters: [
		{
			name: "rootPath",
			required: false,
			type: "string",
			instruction: "Root path for the dependency map.",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const generate_dependency_map_variants = [GENERIC]
