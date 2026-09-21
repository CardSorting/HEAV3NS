import { SVGProps } from "react"
import type { Environment } from "../../../src/shared/config-types"
import { getEnvironmentColor } from "../utils/environmentColors"
import { Heav3nsSignalMark } from "./Heav3nsSignalMark"

/**
 * HEAV3NS logo with automatic theme adaptation and environment-based color indicators.
 */
const DietCodeLogoVariable = (props: SVGProps<SVGSVGElement> & { environment?: Environment }) => {
	const { environment, ...svgProps } = props
	const signalColor = environment ? getEnvironmentColor(environment) : "var(--vscode-icon-foreground)"

	return (
		<Heav3nsSignalMark accentColor={signalColor} {...svgProps} />
	)
}

export default DietCodeLogoVariable
