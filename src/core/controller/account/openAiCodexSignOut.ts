import type { IController as Controller } from "@core/controller/types"
import { Empty, EmptyRequest } from "@shared/proto/dietcode/common"

/**
 * Legacy OpenAI Codex sign out.
 */
export async function openAiCodexSignOut(_controller: Controller, _: EmptyRequest): Promise<Empty> {
	return {}
}
