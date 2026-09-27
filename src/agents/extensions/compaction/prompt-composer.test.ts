import { expect } from "chai"
import { AgentConfig } from "../../base/agent-config.js"
import { SessionContext } from "../../../sessions/base/session-context.js"
import { PromptComposer } from "./prompt-composer.js"

describe("CLI prompt execution mandate", () => {
	const composer = new PromptComposer()
	const sessionContext = new SessionContext({ sessionId: "mandate-test", cwd: "/workspace-does-not-exist" })

	it("includes the shared mandate with custom parent and child prompts", () => {
		for (const systemPrompt of ["Custom parent instructions", "Custom delegated implementation instructions"]) {
			const config = AgentConfig.createDefault({ systemPrompt })
			const result = composer.composeSystemPrompt(config, undefined, undefined, sessionContext)

			expect(result).to.include(systemPrompt)
			expect(result.match(/\[HEAV3NS MANDATE\]/g)).to.have.length(1)
			expect(result).to.include("INSPECT → REASON → ACT → OBSERVE → ADAPT → VERIFY")
			expect(result).to.include("NO BLIND RETRIES")
			expect(result).to.include("reconcile conflicts as the parent")
			expect(result).to.include("return the verified result and STOP")
			expect(result).not.to.include("call attempt_completion")
		}
	})

	it("keeps the mandate pinned to the current system message without elevating memory or stale policy", () => {
		const messages = composer.compileTurnMessages({
			config: AgentConfig.createDefault(),
			sessionContext,
			memoryContext: "Remember the user's interface preference",
			messages: [
				{ role: "system", content: "Stale system instructions", timestamp: 1 },
				{ role: "user", content: "Implement the requested change", timestamp: 2 },
			],
		})

		expect(messages.filter((message) => message.role === "system")).to.have.length(1)
		expect(messages[0].content).to.include("[HEAV3NS MANDATE]")
		expect(messages[0].content).to.include("configured permissions")
		expect(messages[0].content).not.to.include("Remember the user's interface preference")
		expect(messages.map((message) => message.content).join("\n")).not.to.include("Stale system instructions")
		expect(messages.at(-1)?.content).to.equal("Implement the requested change")
	})
})
