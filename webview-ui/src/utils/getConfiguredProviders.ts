import type { ApiConfiguration, ApiProvider } from "@shared/api"
import PROVIDERS from "@shared/providers/providers.json"
import type { RemoteConfigFields } from "@shared/storage/state-keys"

/**
 * Returns a list of API providers that are configured (have required credentials/settings)
 */
export function getConfiguredProviders(
	_remoteConfig: Partial<RemoteConfigFields> | undefined,
	apiConfiguration: ApiConfiguration | undefined,
): ApiProvider[] {
	const configured: ApiProvider[] = []

	if (apiConfiguration?.galxApiKey) {
		configured.push("galx")
	}

	// Always ensure GALX is available as the default provider
	if (!configured.includes("galx")) {
		configured.push("galx")
	}

	return configured
}

/**
 * Get provider display label from provider value
 * Uses the canonical providers.json as source of truth
 */
export function getProviderLabel(provider: ApiProvider): string {
	const providerEntry = PROVIDERS.list.find((p) => p.value === provider)
	return providerEntry?.label || "GALX AI"
}
