import type { IController as Controller } from "@core/controller/types"
import { EmptyRequest } from "@shared/proto/dietcode/common"
import { ProviderModelCatalog } from "@shared/proto/dietcode/models"
import { toProtobufModels } from "../../../shared/proto-conversions/models/typeConversion"
import { refreshBasetenModels } from "./refreshBasetenModels"

/**
 * Handles protobuf conversion for gRPC service
 * @param controller The controller instance
 * @param request Empty request object
 * @returns Response containing Baseten models (protobuf types)
 */
export async function refreshBasetenModelsRpc(controller: Controller, _request: EmptyRequest): Promise<ProviderModelCatalog> {
	const models = await refreshBasetenModels(controller)
	return ProviderModelCatalog.create({
		models: toProtobufModels(models),
	})
}
