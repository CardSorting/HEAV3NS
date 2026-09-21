import type { IController as Controller } from "@core/controller/types"
import { EmptyRequest } from "@shared/proto/dietcode/common"
import { ProviderModelCatalog } from "@shared/proto/dietcode/models"
import { toProtobufModels } from "../../../shared/proto-conversions/models/typeConversion"
import { refreshDietCodeModels } from "./refreshDietCodeModels"

/**
 * Refreshes DietCode models and returns protobuf types for gRPC
 * @param controller The controller instance
 * @param request Empty request (unused but required for gRPC signature)
 * @returns ProviderModelCatalog with protobuf types (reusing the same proto type)
 */
export async function refreshDietCodeModelsRpc(controller: Controller, _request: EmptyRequest): Promise<ProviderModelCatalog> {
	const models = await refreshDietCodeModels(controller)
	return ProviderModelCatalog.create({
		models: toProtobufModels(models),
	})
}
