import { ApiConfiguration } from "@shared/api"
import { Mode } from "@shared/storage/types"

export function validateApiConfiguration(_currentMode: Mode, apiConfiguration?: ApiConfiguration): string | undefined {
	if (!apiConfiguration) {
		return undefined
	}

	if (!apiConfiguration.galxApiKey) {
		return "You must provide a valid GALX AI API key."
	}

	return undefined
}

export function validateModelId(
	_currentMode: Mode,
	_apiConfiguration?: ApiConfiguration,
): string | undefined {
	return undefined
}
