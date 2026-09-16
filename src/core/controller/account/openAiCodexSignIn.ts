import type { IController as Controller } from "@core/controller/types"
import { Empty, EmptyRequest } from "@shared/proto/dietcode/common"

/**
 * Legacy OpenAI Codex sign in (deprecated in favor of GALX AI)
 */
export async function openAiCodexSignIn(_controller: Controller, _: EmptyRequest): Promise<Empty> {
	return {}
}
