import type { IController as Controller } from "@core/controller/types"
import { Empty, EmptyRequest } from "@shared/proto/dietcode/common"
import { OpenAiCodexOAuthService } from "@/services/auth/OpenAiCodexOAuthService"

/**
 * Starts the OpenAI Codex PKCE OAuth flow and stores the resulting session.
 */
export async function openAiCodexSignIn(controller: Controller, _: EmptyRequest): Promise<Empty> {
	await OpenAiCodexOAuthService.signIn()
	await controller.postStateToWebview()
	return Empty.create({})
}
