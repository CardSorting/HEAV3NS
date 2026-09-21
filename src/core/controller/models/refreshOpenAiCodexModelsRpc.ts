import type { IController as Controller } from "@core/controller/types"
import { EmptyRequest } from "@shared/proto/dietcode/common"
import { ProviderModelCatalog } from "@shared/proto/dietcode/models"
import { Logger } from "@/shared/services/Logger"
import { OpenAiCodexOAuthService } from "@/services/auth/OpenAiCodexOAuthService"
import { toProtobufModels } from "../../../shared/proto-conversions/models/typeConversion"

/** Refreshes the model catalog exposed by the authenticated OpenAI Codex provider. */
export async function refreshOpenAiCodexModelsRpc(
	_controller: Controller,
	_request: EmptyRequest,
): Promise<ProviderModelCatalog> {
	try {
		const models = await OpenAiCodexOAuthService.listModels()
		return ProviderModelCatalog.create({
			models: toProtobufModels(models),
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		Logger.error(`Error fetching OpenAI Codex models: ${message}`)
		throw error instanceof Error ? error : new Error(message)
	}
}
