import { expect } from "chai"
import { describe, it } from "mocha"
import { filterAllowedRemoteConfigFields, isProviderAllowed } from "../field-filter"

describe("remote-config provider filtering", () => {
	it("allows xai-oauth even when an organization allow-list only contains another provider", () => {
		expect(isProviderAllowed("xai-oauth", ["anthropic"])).to.equal(true)
		expect(
			filterAllowedRemoteConfigFields({ planModeApiProvider: "xai-oauth", actModeApiProvider: "xai-oauth" }, [
				"anthropic",
			]),
		).to.deep.equal({ planModeApiProvider: "xai-oauth", actModeApiProvider: "xai-oauth" })
	})

	it("allows qwen-token-plan and zai even when an organization allow-list only contains another provider", () => {
		expect(isProviderAllowed("qwen-token-plan", ["anthropic"])).to.equal(true)
		expect(isProviderAllowed("zai", ["anthropic"])).to.equal(true)
		expect(
			filterAllowedRemoteConfigFields({ planModeApiProvider: "qwen-token-plan", actModeApiProvider: "zai" }, [
				"anthropic",
			]),
		).to.deep.equal({ planModeApiProvider: "qwen-token-plan", actModeApiProvider: "zai" })
	})
})
