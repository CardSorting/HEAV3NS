import type { IController as Controller } from "@core/controller/types"
import { EmptyRequest } from "@shared/proto/dietcode/common"
import { ProviderModelCatalog } from "@shared/proto/dietcode/models"
import { toProtobufModels } from "../../../shared/proto-conversions/models/typeConversion"
import { refreshNousResearchModels } from "./refreshNousResearchModels"

/**
 * Handles protobuf conversion for gRPC service
 * @param controller The controller instance
 * @param _request Empty request object
 * @returns Response containing NousResearch models (protobuf types)
 */
export async function refreshNousResearchModelsRpc(
	controller: Controller,
	_request: EmptyRequest,
): Promise<ProviderModelCatalog> {
	const models = await refreshNousResearchModels(controller)
	return ProviderModelCatalog.create({
		models: toProtobufModels(models),
	})
}
