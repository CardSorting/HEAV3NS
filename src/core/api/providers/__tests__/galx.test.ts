import { galxDefaultBaseUrl, galxDefaultModelId, galxDefaultModelInfo } from "@shared/api"
import type OpenAI from "openai"
import should from "should"
import sinon from "sinon"
import { broccoliTransportSubstrate } from "@/integrations/galx/BroccoliTransportSubstrate"
import { GalxHandler } from "../galx"

interface GalxHandlerPrivate {
	ensureClient: () => OpenAI
}

describe("GalxHandler", () => {
	afterEach(() => {
		sinon.restore()
	})

	const createAsyncIterable = <T>(data: T[] = []) => ({
		[Symbol.asyncIterator]: async function* () {
			yield* data
		},
	})

	it("should have https://galx.ai/v1 as default base URL", () => {
		should(galxDefaultBaseUrl).equal("https://galx.ai/v1")
	})

	it("should return default model if none specified", () => {
		const handler = new GalxHandler({
			galxApiKey: "galx_live_test_key",
		})
		const model = handler.getModel()
		should(model.id).equal(galxDefaultModelId)
		should(model.info).deepEqual(galxDefaultModelInfo)
	})

	it("should return configured gpt-5.6-terra correctly", () => {
		const terraHandler = new GalxHandler({ galxApiKey: "galx_live_test_key", galxModelId: "gpt-5.6-terra" })
		should(terraHandler.getModel().id).equal("gpt-5.6-terra")
		should(terraHandler.getModel().info.name).equal("OpenAI Codex GPT-5.6 Terra (Balanced Frontier)")
	})

	it("should throw if no API key is provided when creating client", () => {
		const handler = new GalxHandler({})
		should(() => {
			;(handler as unknown as GalxHandlerPrivate).ensureClient()
		}).throw("GALXAI API key is required. Please configure your key in Settings.")
	})

	it("should use galxDefaultBaseUrl when galxBaseUrl is not specified", () => {
		const handler = new GalxHandler({
			galxApiKey: "galx_live_test_key",
		})
		const client = (handler as unknown as GalxHandlerPrivate).ensureClient()
		should(client.baseURL).equal("https://galx.ai/v1")
		should(client.apiKey).equal("galx_live_test_key")
	})

	it("should yield text and calculate usage correctly with prompt caching discount", async () => {
		const handler = new GalxHandler({
			galxApiKey: "galx_live_test_key",
			galxModelId: "gpt-5.6-terra",
		})

		const fakeClient = {
			chat: {
				completions: {
					create: sinon.stub().resolves(
						createAsyncIterable([
							{
								choices: [
									{
										delta: {
											content: "Hello from GALXAI",
										},
									},
								],
							},
							{
								choices: [{}],
								usage: {
									prompt_tokens: 1000,
									completion_tokens: 200,
									prompt_tokens_details: {
										cached_tokens: 800,
									},
								},
							},
						]),
					),
				},
			},
		}
		sinon.stub(handler as unknown as GalxHandlerPrivate, "ensureClient").returns(fakeClient as unknown as OpenAI)

		const stream = handler.createMessage("system", [{ role: "user", content: "hi" } as any])
		const chunks = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		should(chunks.length).equal(2)
		should(chunks[0]).deepEqual({ type: "text", text: "Hello from GALXAI" })

		const usageChunk = chunks[1]
		// 1000 prompt tokens total, 800 cached tokens (75% cache discount), 200 uncached input tokens, 200 output tokens
		// gpt-5.6-terra: inputPrice = 2.25, outputPrice = 9.0, cacheReadsPrice = 0.75
		// inputCost: (200 / 1e6) * 2.25 = 0.00045
		// outputCost: (200 / 1e6) * 9.0 = 0.00180
		// cacheCost: (800 / 1e6) * 0.75 = 0.00060
		// total: 0.00045 + 0.00180 + 0.00060 = 0.00285
		should(usageChunk).be.ok()
		if (usageChunk && usageChunk.type === "usage") {
			should(usageChunk.inputTokens).equal(200)
			should(usageChunk.cacheReadTokens).equal(800)
			should(usageChunk.outputTokens).equal(200)
			if (usageChunk.totalCost !== undefined) {
				Math.abs(usageChunk.totalCost - 0.00285).should.be.below(0.00001)
			}
		}
	})

	it("should not bake activeSessionAffinity into defaultHeaders", () => {
		const handler = new GalxHandler({
			galxApiKey: "galx_live_test_key",
		})
		sinon.stub(broccoliTransportSubstrate, "getActiveSessionAffinity").returns("aff_v1_test_ignore")

		const client = (handler as unknown as GalxHandlerPrivate).ensureClient()
		const defaultHeaders = ((client as any)._options?.defaultHeaders || (client as any).defaultHeaders) as Record<string, string> | undefined
		should(defaultHeaders?.["X-GALX-Client"]).equal("LUMI/12.5.1")
		should(defaultHeaders?.["X-Galx-Session-Affinity"]).be.undefined()
		should(defaultHeaders?.["X-Galx-Shard-Id"]).be.undefined()
	})

	it("should evict session affinity and auto-retry without affinity header when capacity_constrained occurs", async () => {
		const handler = new GalxHandler({
			galxApiKey: "galx_live_test_key",
			galxModelId: "gpt-5.6-sol",
		})

		sinon.stub(broccoliTransportSubstrate, "getActiveSessionAffinity").returns("aff_v1_sample_ticket")
		const clearAffinitySpy = sinon.spy(broccoliTransportSubstrate, "clearActiveSessionAffinity")

		const createStub = sinon.stub()
		// First call fails with 429 capacity_constrained
		const capacityError = Object.assign(
			new Error("429 Compute capacity is temporarily constrained for this model. Automatic failover active. Please retry shortly."),
			{ status: 429 },
		)
		createStub.onFirstCall().rejects(capacityError)
		// Second call (retry without affinity) succeeds
		createStub.onSecondCall().resolves(
			createAsyncIterable([
				{
					choices: [
						{
							delta: {
								content: "Recovered successfully",
							},
						},
					],
				},
			]),
		)

		const fakeClient = {
			chat: {
				completions: {
					create: createStub,
				},
			},
		}

		sinon.stub(handler as unknown as GalxHandlerPrivate, "ensureClient").returns(fakeClient as unknown as OpenAI)

		const chunks = []
		for await (const chunk of handler.createMessage("system prompt", [{ role: "user", content: "Hi" }])) {
			chunks.push(chunk)
		}

		should(createStub.calledTwice).be.true()
		// First call had X-Galx-Session-Affinity
		should(createStub.firstCall.args[1]?.headers?.["X-Galx-Session-Affinity"]).equal("aff_v1_sample_ticket")
		// Second call had no session affinity header
		should(createStub.secondCall.args[1]?.headers?.["X-Galx-Session-Affinity"]).be.undefined()
		// Session affinity was cleared
		should(clearAffinitySpy.called).be.true()
		// Chunk received from retry
		should(chunks[0]).deepEqual({
			type: "text",
			text: "Recovered successfully",
		})
	})
})

