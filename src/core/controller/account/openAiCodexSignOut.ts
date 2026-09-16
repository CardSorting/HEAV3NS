import type { IController as Controller } from "@core/controller/types"
import { Empty, EmptyRequest } from "@shared/proto/dietcode/common"

/**
 * Legacy OpenAI Codex sign out (deprecated in favor of GALX AI)
 */
export async function openAiCodexSignOut(_controller: Controller, _: EmptyRequest): Promise<Empty> {
	return {}
}
