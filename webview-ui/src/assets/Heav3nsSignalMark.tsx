import type { SVGProps } from "react"

export type Heav3nsSignalMarkProps = SVGProps<SVGSVGElement> & {
	accentColor?: string
}

/**
 * HEAV3NS signal mark.
 *
 * The mark is built from a directional bracket and three readout rails. It
 * stays legible at activity-bar size, works in monochrome, and deliberately
 * avoids the rounded companion/orb vocabulary used by the legacy identity.
 */
export const Heav3nsSignalMark = ({ accentColor = "var(--color-heav3ns-active)", ...props }: Heav3nsSignalMarkProps) => {
	const labelProps = props["aria-label"] ? { role: "img" as const } : { "aria-hidden": true as const }

	return (
		<svg fill="none" viewBox="0 0 88 48" xmlns="http://www.w3.org/2000/svg" {...labelProps} {...props}>
			{props["aria-label"] && <title>{props["aria-label"]}</title>}
			<path d="M7 7h21l9 9-9 9H7V7Z" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="3" />
			<path d="M7 23h21l9 9-9 9H7V23Z" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter" strokeWidth="3" />
			<path d="M49 7h32M49 23h24M49 39h32" stroke={accentColor} strokeLinecap="square" strokeWidth="3" />
			<path d="M49 7v32" opacity="0.35" stroke={accentColor} strokeWidth="1" />
			<rect fill={accentColor} height="6" width="6" x="49" y="20" />
		</svg>
	)
}

