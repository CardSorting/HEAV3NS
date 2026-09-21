const mockUrl = new URL("./vscode-mock.ts", import.meta.url).href

export function resolve(specifier, context, nextResolve) {
	if (specifier === "vscode" && process.env.INTEGRATION_TEST !== "true") {
		return { url: mockUrl, shortCircuit: true }
	}

	return nextResolve(specifier, context)
}
