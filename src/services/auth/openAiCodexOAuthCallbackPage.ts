import type { ServerResponse } from "node:http"

export type OpenAiCodexOAuthCallbackPageState = "success" | "cancelled" | "invalid" | "failed"

interface CallbackPageCopy {
	status: string
	title: string
	message: string
	nextStep: string
}

const PAGE_COPY: Record<OpenAiCodexOAuthCallbackPageState, CallbackPageCopy> = {
	success: {
		status: "SIGN-IN COMPLETE",
		title: "You’re connected",
		message: "Your ChatGPT sign-in is connected to HEAV3NS.",
		nextStep: "Close this tab and return to HEAV3NS to choose an OpenAI Codex model.",
	},
	cancelled: {
		status: "SIGN-IN CANCELLED",
		title: "Sign-in was cancelled",
		message: "This sign-in didn’t change your current connection.",
		nextStep: "Return to HEAV3NS and choose Continue with ChatGPT to try again.",
	},
	invalid: {
		status: "REQUEST NOT VERIFIED",
		title: "We couldn’t verify this sign-in",
		message: "For your security, this return link can only be used for the sign-in request that started it.",
		nextStep: "Return to HEAV3NS and start a new sign-in.",
	},
	failed: {
		status: "CONNECTION NOT COMPLETED",
		title: "We couldn’t finish connecting",
		message: "HEAV3NS received the sign-in return, but couldn’t complete the account connection.",
		nextStep: "Return to HEAV3NS and choose Continue with ChatGPT to try again.",
	},
}

export function renderOpenAiCodexOAuthCallbackPage(state: OpenAiCodexOAuthCallbackPageState): string {
	const copy = PAGE_COPY[state]
	const isSuccess = state === "success"
	const statusIcon = isSuccess
		? '<path d="m7 12.5 3.3 3.3L17.5 8.6" />'
		: '<path d="M12 7.5v5m0 3.5h.01" />'

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="color-scheme" content="dark light" />
		<meta name="theme-color" content="#080c11" />
		<title>${copy.title} · HEAV3NS</title>
		<style>
			:root {
				color-scheme: dark;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				font-synthesis: none;
				text-rendering: optimizeLegibility;
				--page: #080c11;
				--panel: #101820;
				--text: #eef2e8;
				--muted: #a2afb1;
				--border: #2a3942;
				--accent: #d8ff5e;
				--signal: #77e6ff;
				--error: #ffb9a8;
				--error-surface: #2a1c1a;
			}

			* { box-sizing: border-box; }
			body {
				min-width: 280px;
				min-height: 100vh;
				margin: 0;
				background: var(--page);
				color: var(--text);
			}

			::selection { background: var(--accent); color: #080c11; }

			.page {
				min-height: 100vh;
				display: flex;
				flex-direction: column;
				justify-content: center;
				padding: 40px 20px;
			}

			.content { width: min(100%, 520px); margin: 0 auto; }

			.brand {
				display: flex;
				align-items: center;
				gap: 12px;
				margin: 0 0 20px 2px;
			}

			.brand-mark { display: block; width: 44px; height: 24px; color: var(--text); flex: 0 0 auto; }
			.brand-rails { stroke: var(--accent); }
			.wordmark { font-size: 12px; font-weight: 720; letter-spacing: .17em; }
			.divider { width: 1px; height: 18px; margin: 0 3px; background: var(--border); }
			.provider { color: var(--muted); font-size: 13px; }

			.panel {
				padding: clamp(24px, 6vw, 38px);
				border: 1px solid var(--border);
				border-radius: 14px;
				background: var(--panel);
			}

			.status {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				min-height: 30px;
				padding: 5px 10px;
				border: 1px solid rgba(216, 255, 94, .3);
				border-radius: 999px;
				background: rgba(216, 255, 94, .08);
				color: var(--accent);
				font-size: 10px;
				font-weight: 700;
				letter-spacing: .09em;
			}

			.status-icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: square; stroke-linejoin: miter; stroke-width: 1.8; }
			.panel--error .status {
				border-color: rgba(255, 185, 168, .32);
				background: var(--error-surface);
				color: var(--error);
			}

			h1 {
				margin: 22px 0 10px;
				font-size: clamp(1.8rem, 7vw, 2.2rem);
				font-weight: 650;
				letter-spacing: -.025em;
				line-height: 1.12;
				text-wrap: balance;
			}

			.message {
				max-width: 48ch;
				margin: 0;
				color: var(--muted);
				font-size: 15px;
				line-height: 1.65;
			}

			.next-step {
				display: flex;
				align-items: flex-start;
				gap: 12px;
				margin-top: 26px;
				padding-top: 20px;
				border-top: 1px solid var(--border);
				color: var(--text);
				font-size: 13px;
				line-height: 1.55;
			}

			.next-mark {
				width: 20px;
				height: 20px;
				margin-top: 1px;
				flex: 0 0 auto;
				color: var(--signal);
			}

			@media (prefers-color-scheme: light) {
				:root {
					color-scheme: light;
					--page: #f2f5ef;
					--panel: #ffffff;
					--text: #15201b;
					--muted: #52635b;
					--border: #d3ddd5;
					--accent: #526d00;
					--signal: #08778a;
					--error: #873e31;
					--error-surface: #fff0eb;
				}
				.status { border-color: #a8bd59; background: #f3f8df; }
				.panel--error .status { border-color: #e0b0a5; }
			}

			@media (max-width: 420px) {
				.page { padding: 24px 14px; }
				.brand { gap: 9px; margin-bottom: 16px; }
				.brand-mark { width: 38px; height: 21px; }
				.wordmark { font-size: 11px; }
				.provider { font-size: 12px; }
				.panel { padding: 24px 20px; }
				.message { font-size: 14px; }
			}

			@media (forced-colors: active) {
				.panel, .status, .next-step { border: 1px solid CanvasText; }
				.status { color: CanvasText; }
			}
		</style>
	</head>
	<body>
		<main class="page">
			<div class="content">
				<header class="brand" aria-label="HEAV3NS OpenAI Codex sign-in">
					<svg class="brand-mark" aria-hidden="true" fill="none" viewBox="0 0 88 48" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 7h21l9 9-9 9H7V7Z" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" />
						<path d="M7 23h21l9 9-9 9H7V23Z" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" />
						<path class="brand-rails" d="M49 7h32M49 23h24M49 39h32" stroke-linecap="square" stroke-width="3" />
						<path class="brand-rails" d="M49 7v32" opacity=".35" stroke-width="1" />
						<rect class="brand-rails" height="6" width="6" x="49" y="20" />
					</svg>
					<span class="wordmark">HEAV3NS</span>
					<span class="divider" aria-hidden="true"></span>
					<span class="provider">OpenAI Codex</span>
				</header>
				<section class="panel ${isSuccess ? "panel--success" : "panel--error"}" aria-labelledby="page-title">
					<div class="status" role="status" aria-live="polite">
						<svg class="status-icon" aria-hidden="true" viewBox="0 0 24 24">${statusIcon}</svg>
						<span>${copy.status}</span>
					</div>
					<h1 id="page-title">${copy.title}</h1>
					<p class="message">${copy.message}</p>
					<div class="next-step">
						<svg class="next-mark" aria-hidden="true" fill="none" viewBox="0 0 24 24">
							<path d="M4 12h14m-5-5 5 5-5 5" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter" stroke-width="1.7" />
						</svg>
						<span>${copy.nextStep}</span>
					</div>
				</section>
			</div>
		</main>
	</body>
</html>`
}

export function writeOpenAiCodexOAuthCallbackResponse(
	response: ServerResponse,
	statusCode: number,
	state: OpenAiCodexOAuthCallbackPageState,
): void {
	response.writeHead(statusCode, {
		"Cache-Control": "no-store, max-age=0",
		"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
		"Content-Type": "text/html; charset=utf-8",
		"Pragma": "no-cache",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
	})
	response.end(renderOpenAiCodexOAuthCallbackPage(state))
}
