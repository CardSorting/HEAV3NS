import { moonshotDefaultModelId } from "@shared/api"
import { expect } from "chai"
import { describe, it } from "mocha"
import { getProviderDefaultModelId, getProviderModelIdKey } from "../provider-keys"

describe("Provider key mapping", () => {
	it("returns Moonshot default model ID", () => {
		expect(getProviderDefaultModelId("moonshot")).to.equal(moonshotDefaultModelId)
	})

	it("uses generic model key for Moonshot", () => {
		expect(getProviderModelIdKey("moonshot", "act")).to.equal("actModeApiModelId")
		expect(getProviderModelIdKey("moonshot", "plan")).to.equal("planModeApiModelId")
	})

	it("uses the generic model key for OpenAI Codex", () => {
		expect(getProviderModelIdKey("openai-codex", "act")).to.equal("actModeApiModelId")
		expect(getProviderModelIdKey("openai-codex", "plan")).to.equal("planModeApiModelId")
	})

	it("uses provider-specific model key behavior for DietCode", () => {
		expect(getProviderModelIdKey("dietcode", "act")).to.equal("actModeDietCodeModelId")
		expect(getProviderModelIdKey("dietcode", "plan")).to.equal("planModeDietCodeModelId")
	})
})
