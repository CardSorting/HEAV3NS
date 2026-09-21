import type { SVGProps } from "react"

/**
 * Legacy export kept for downstream imports. The paths now resolve to the
 * HEAV3NS signal mark so old logo component names cannot reintroduce the orb.
 */
export const LumiOrbPaths = ({
	accentColor = "#d8ff5e",
	coreColor = "currentColor",
	className,
}: {
	accentColor?: string
	coreColor?: string
	className?: string
}) => (
	<g className={className}>
		<path d="M14 18h28l12 12-12 12H14V18Z" fill="none" stroke={coreColor} strokeWidth="6" />
		<path d="M14 58h28l12 12-12 12H14V58Z" fill="none" stroke={coreColor} strokeWidth="6" />
		<path d="M66 18h20M66 50h13M66 82h20" stroke={accentColor} strokeLinecap="square" strokeWidth="6" />
		<path d="M66 18v64" opacity="0.35" stroke={accentColor} strokeWidth="2" />
		<rect fill={accentColor} height="12" width="12" x="66" y="44" />
	</g>
)

const LumiOrbIcon = (props: SVGProps<SVGSVGElement>) => (
	<svg fill="none" height="50" viewBox="0 0 100 100" width="50" xmlns="http://www.w3.org/2000/svg" {...props}>
		<LumiOrbPaths />
	</svg>
)

export default LumiOrbIcon
