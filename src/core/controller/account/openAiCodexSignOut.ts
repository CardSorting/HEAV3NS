import type { IController as Controller } from "@core/controller/types"
import { Empty, EmptyRequest } from "@shared/proto/dietcode/common"
import { OpenAiCodexOAuthService } from "@/services/auth/OpenAiCodexOAuthService"

/**
 * Clears the locally stored OpenAI Codex OAuth session.
 */
export async function openAiCodexSignOut(controller: Controller, _: EmptyRequest): Promise<Empty> {
	OpenAiCodexOAuthService.signOut()
	await controller.postStateToWebview()
	return Empty.create({})
}
