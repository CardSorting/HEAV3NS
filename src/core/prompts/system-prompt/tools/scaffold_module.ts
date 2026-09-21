import { ModelFamily } from "@/shared/prompts"
import { DietCodeDefaultTool } from "@/shared/tools"
import type { DietCodeToolSpec } from "../spec"
import { TASK_PROGRESS_PARAMETER } from "../types"

/**
 * ## scaffold_module
 * Description: Scaffolds a new module in a canonical JoyZoning workspace. Established repositories should use their native file and test patterns instead.
 * Parameters:
 * - name: (required) Module name.
 * - layer: (required) Canonical layer: domain, core, infrastructure, plumbing, or ui.
 * - dir: (optional) Subdirectory within the canonical layer.
 */

const id = DietCodeDefaultTool.STABILITY_SCAFFOLD

const GENERIC: DietCodeToolSpec = {
	variant: ModelFamily.GENERIC,
	id,
	name: "scaffold_module",
	description:
		"Scaffolds a new module in a canonical JoyZoning workspace. For an established repository, create the module using its existing path, naming, and test conventions.",
	contextRequirements: (context) =>
		context.joyZoningSteeringEnabled !== false && context.workspaceArchitectureProfile?.enforceCanonicalLayers !== false,
	parameters: [
		{
			name: "name",
			required: true,
			type: "string",
			instruction: "Module name.",
		},
		{
			name: "layer",
			required: true,
			type: "string",
			instruction: "Canonical JoyZoning layer: domain, core, infrastructure, plumbing, or ui.",
			enum: ["domain", "core", "infrastructure", "plumbing", "ui"],
		},
		{
			name: "dir",
			required: false,
			type: "string",
			instruction: "Optional subdirectory within the selected canonical layer.",
		},
		TASK_PROGRESS_PARAMETER,
	],
}

export const scaffold_module_variants = [GENERIC]
