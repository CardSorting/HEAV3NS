import { expect } from "chai"
import { describe, it } from "mocha"
import {
	createOpenAiCodexPkcePair,
	normalizeOpenAiCodexModels,
	parseOpenAiCodexOAuthCredentials,
	serializeOpenAiCodexOAuthCredentials,
} from "../OpenAiCodexOAuthService"

function createJwt(payload: Record<string, unknown>): string {
	return ["header", Buffer.from(JSON.stringify(payload)).toString("base64url"), "signature"].join(".")
}

describe("OpenAiCodexOAuthService", () => {
	it("creates URL-safe S256 PKCE values", () => {
		const { verifier, challenge } = createOpenAiCodexPkcePair()

		expect(verifier).to.match(/^[A-Za-z0-9_-]+$/)
		expect(challenge).to.match(/^[A-Za-z0-9_-]+$/)
		expect(verifier).to.have.length(86)
		expect(challenge).to.have.length(43)
	})

	it("parses source-compatible OAuth credentials and extracts the account claim", () => {
		const idToken = createJwt({
			"https://api.openai.com/auth.chatgpt_account_id": "acct_codex",
		})
		const accessToken = createJwt({ exp: 2_000_000_000 })
		const credentials = parseOpenAiCodexOAuthCredentials(
			JSON.stringify({ access_token: accessToken, refresh_token: "refresh", id_token: idToken }),
		)

		expect(credentials).to.deep.include({
			accessToken,
			refreshToken: "refresh",
			idToken,
			accountId: "acct_codex",
			expiresAt: 2_000_000_000_000,
		})
	})

	it("round-trips the persisted credential shape", () => {
		const credentials = {
			accessToken: "access",
			refreshToken: "refresh",
			accountId: "acct_codex",
			expiresAt: 2_000_000_000_000,
		}

		expect(JSON.parse(serializeOpenAiCodexOAuthCredentials(credentials))).to.deep.equal(credentials)
	})

	it("normalizes provider models and preserves provider ordering", () => {
		const models = normalizeOpenAiCodexModels({
			models: [
				{
					slug: "catalog-model-later",
					display_name: "Later model",
					priority: 20,
					supported_in_api: true,
					input_modalities: ["text"],
					context_window: 100_000,
				},
				{
					slug: "catalog-model-first",
					display_name: "First model",
					priority: 1,
					supported_in_api: true,
					supported_reasoning_levels: [{ effort: "medium" }],
					input_modalities: ["text", "image"],
					context_window: 200_000,
				},
				{ slug: "catalog-model-chat-only", priority: 0, supported_in_api: false },
			],
		})

		expect(Object.keys(models)).to.deep.equal(["catalog-model-chat-only", "catalog-model-first", "catalog-model-later"])
		expect(models["catalog-model-first"]).to.include({
			name: "First model",
			contextWindow: 200_000,
			supportsImages: true,
			supportsReasoning: true,
		})
		expect(models["catalog-model-later"].supportsImages).to.equal(false)
	})
})
