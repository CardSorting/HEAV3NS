import { describe, it } from "mocha"
import "should"
import type { DietCodeStorageMessage } from "@/shared/messages/content"
import { convertToOpenAIResponsesInput } from "../openai-response-format"

describe("convertToOpenAIResponsesInput", () => {
	it("keeps stateless history complete and encodes assistant text as output", () => {
		const messages: DietCodeStorageMessage[] = [
			{ role: "user", content: "Build a snake game" },
			{ role: "assistant", content: "I'm checking the project." },
			{ role: "user", content: "Continue." },
		]

		const result = convertToOpenAIResponsesInput(messages, { usePreviousResponseId: false })
		const assistantItem = result.input[1] as any

		;(result.previousResponseId === undefined).should.be.true()
		result.input.should.have.length(3)
		assistantItem.type.should.equal("message")
		assistantItem.role.should.equal("assistant")
		assistantItem.content[0].type.should.equal("output_text")
		assistantItem.content[0].text.should.equal("I'm checking the project.")
	})

	it("merges streamed redacted and summary reasoning before a tool call", () => {
		const messages: DietCodeStorageMessage[] = [
			{
				role: "assistant",
				content: [
					{ type: "redacted_thinking", data: "encrypted-reasoning", call_id: "rs_1" },
					{
						type: "thinking",
						thinking: "",
						summary: [{ type: "summary_text", text: "I will inspect the project." }],
						call_id: "rs_1",
						signature: "rs_1",
					},
					{ type: "tool_use", id: "tool_1", call_id: "call_1", name: "read_file", input: { path: "README.md" } },
				],
			},
		]

		const result = convertToOpenAIResponsesInput(messages, { usePreviousResponseId: false })
		const reasoningItem = result.input[0] as any

		result.input.should.have.length(2)
		reasoningItem.type.should.equal("reasoning")
		reasoningItem.id.should.equal("rs_1")
		reasoningItem.encrypted_content.should.equal("encrypted-reasoning")
		reasoningItem.summary[0].text.should.equal("I will inspect the project.")
		;(result.input[1] as any).type.should.equal("function_call")
	})
})
