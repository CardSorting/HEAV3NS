import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect } from "chai"
import { BroccoliContextCompactionStore, shutdownBroccoliContextCompactionStores } from "../BroccoliContextCompactionStore"

describe("BroccoliContextCompactionStore", () => {
	it("bridges exact context through the table kernel and survives a restart", async () => {
		const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-broccoli-context-"))
		const store = new BroccoliContextCompactionStore(temporaryRoot)
		const sourceText = Array.from({ length: 1_000 }, (_, index) => `bridge source ${index}`).join("\n")
		const projectionText = '<system_context_projection schema="2"/> bridge projection'
		const sourceSha256 = createHash("sha256").update(sourceText).digest("hex")
		const projectionSha256 = createHash("sha256").update(projectionText).digest("hex")
		const now = Date.now()

		try {
			const committed = await store.commit({
				scopeId: "task:bridge",
				scopeKind: "task",
				workspaceId: store.workspaceId,
				recoverySource: store.getRecoverySource("task:bridge"),
				records: [
					{
						messageId: "ctx_msg_bridge",
						blockId: "ctx_blk_bridge",
						ref: "ctx_msg_bridge:ctx_blk_bridge",
						sourceLocator: store.getRecoverySource("task:bridge"),
						sourceText,
						sourceSha256,
						projectionText,
						projectionSha256,
						tier: "emergency",
						tierRank: 6,
						originalCharacters: sourceText.length,
						originalLines: 1_000,
					},
				],
				cursor: { messageOffset: 7, blockOffset: 2, activeStart: 2 },
				run: {
					trigger: "bridge_test",
					tier: "emergency",
					scannedMessages: 8,
					scannedBlocks: 3,
					compactedBlocks: 1,
					originalCharacters: sourceText.length,
					projectedCharacters: projectionText.length,
					startedAt: now,
					completedAt: now,
				},
			})
			expect(committed.committed).to.equal(true)
			expect(committed.recoverySource).to.equal("broccolidb://context/task%3Abridge")

			const loaded = await store.load({ scopeId: "task:bridge" })
			expect(loaded.projections).to.have.lengthOf(1)
			expect(loaded.cursor).to.deep.equal({ messageOffset: 7, blockOffset: 2, activeStart: 2 })

			const hydrated = await store.hydrate({
				scopeId: "task:bridge",
				messageId: "ctx_msg_bridge",
				blockId: "ctx_blk_bridge",
				sourceSha256,
			})
			expect(hydrated.text).to.equal(sourceText)

			await shutdownBroccoliContextCompactionStores()
			const restartedStore = new BroccoliContextCompactionStore(temporaryRoot)
			const reloaded = await restartedStore.load({ scopeId: "task:bridge" })
			expect(reloaded.projections).to.have.lengthOf(1)
			expect(reloaded.cursor).to.deep.equal({ messageOffset: 7, blockOffset: 2, activeStart: 2 })
			expect(
				(
					await restartedStore.hydrate({
						scopeId: "task:bridge",
						messageId: "ctx_msg_bridge",
						blockId: "ctx_blk_bridge",
						sourceSha256,
					})
				).text,
			).to.equal(sourceText)
		} finally {
			await shutdownBroccoliContextCompactionStores()
			await fs.rm(temporaryRoot, { recursive: true, force: true })
		}
	})
})
