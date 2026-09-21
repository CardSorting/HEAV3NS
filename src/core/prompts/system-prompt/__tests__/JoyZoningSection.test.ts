import { strict as assert } from "node:assert"
import { describe, it } from "mocha"
import { formatResponse } from "@core/prompts/responses"
import { getJoyZoningSection } from "../components/joy_zoning"
import type { SystemPromptContext } from "../types"

describe("JoyZoning prompt steering", () => {
	it("omits the steering section and its live-context reads when disabled", async () => {
		const section = await getJoyZoningSection(undefined, {
			joyZoningSteeringEnabled: false,
		} as SystemPromptContext)

		assert.equal(section, undefined)
	})

	it("uses neutral plan guidance when disabled", () => {
		const planInstructions = formatResponse.planModeInstructions(false)

		assert.doesNotMatch(planInstructions, /JoyZoning|Joy-Zoning/i)
		assert.match(planInstructions, /Keep the plan neutral/)
	})

	it("formats file lists without steering metadata when disabled", () => {
		const files = formatResponse.formatFilesList(
			"/workspace",
			["/workspace/src/domain.ts"],
			false,
			undefined,
			false,
		)

		assert.equal(files, "src/domain.ts")
	})
})
