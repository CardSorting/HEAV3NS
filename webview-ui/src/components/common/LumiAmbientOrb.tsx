import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** @deprecated The name remains only as a compatibility type for older consumers. */
export type LumiOrbMood = "idle" | "waiting" | "success" | "still" | "held"
export type LumiCalmTier = "normal" | "long" | "night"

interface LumiAmbientOrbProps {
	children: ReactNode
	className?: string
	mood?: LumiOrbMood
	calmTier?: LumiCalmTier
}

const OPACITY_BY_MOOD: Record<LumiOrbMood, string> = {
	idle: "opacity-100",
	waiting: "opacity-95",
	success: "opacity-100",
	still: "opacity-70",
	held: "opacity-60",
}

/**
 * Legacy component name with a signal-frame implementation.
 * The visual is now a quiet readout rail rather than a companion orb.
 */
export const LumiAmbientOrb = ({ children, className, mood = "idle", calmTier = "normal" }: LumiAmbientOrbProps) => (
	<div
		className={cn(
			"heav3ns-signal-frame relative transition-opacity duration-500 ease-out",
			OPACITY_BY_MOOD[mood],
			calmTier === "long" && mood === "waiting" && "opacity-90",
			calmTier === "night" && "opacity-45",
			calmTier === "night" && mood === "still" && "opacity-35",
			className,
		)}
		data-calm-tier={calmTier}
		data-mood={mood}
		data-signal-mode={mood}>
		<div className="heav3ns-signal-frame-line" aria-hidden="true" />
		<div className="relative">{children}</div>
		</div>
)
