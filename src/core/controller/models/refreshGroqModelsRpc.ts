import type { IController as Controller } from "@core/controller/types"
import { EmptyRequest } from "@shared/proto/dietcode/common"
import { ProviderModelCatalog } from "@shared/proto/dietcode/models"
import { toProtobufModels } from "../../../shared/proto-conversions/models/typeConversion"
import { refreshGroqModels } from "./refreshGroqModels"

/**
 * Handles protobuf conversion for gRPC service
 * @param controller The controller instance
 * @param request Empty request object
 * @returns Response containing Groq models (protobuf types)
 */
export async function refreshGroqModelsRpc(controller: Controller, _request: EmptyRequest): Promise<ProviderModelCatalog> {
	const models = await refreshGroqModels(controller)
	return ProviderModelCatalog.create({
		models: toProtobufModels(models),
	})
}
