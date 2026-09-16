import { type ReactNode } from "react"
import { ErrorBoundary } from "./components/common/ErrorBoundary"
import { DietCodeAuthProvider } from "./context/DietCodeAuthContext"
import { ExtensionStateContextProvider } from "./context/ExtensionStateContext"
import { PlatformProvider } from "./context/PlatformContext"

export function Providers({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary>
			<PlatformProvider>
				<ExtensionStateContextProvider>
					<DietCodeAuthProvider>{children}</DietCodeAuthProvider>
				</ExtensionStateContextProvider>
			</PlatformProvider>
		</ErrorBoundary>
	)
}

