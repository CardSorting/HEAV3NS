/** Compact signal readout — the execution state stays visible without a mascot. */
export const LumiProgressIndicator = () => (
	<span aria-hidden className="heav3ns-progress-signal">
		<span className="heav3ns-progress-tick [animation-delay:0ms]" />
		<span className="heav3ns-progress-tick [animation-delay:180ms]" />
		<span className="heav3ns-progress-tick [animation-delay:360ms]" />
	</span>
)
