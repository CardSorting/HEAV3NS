import type { IController as Controller } from "@core/controller/types"
import { Empty, EmptyRequest } from "@shared/proto/dietcode/common"

export async function xaiOauthSignOut(_controller: Controller, _: EmptyRequest): Promise<Empty> {
	return {}
}
