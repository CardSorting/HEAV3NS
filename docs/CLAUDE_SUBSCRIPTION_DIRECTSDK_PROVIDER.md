# Claude Subscription DirectSDK Provider

LUMI can use the local Hermes `claude-subscription-directsdk-experimental` plugin as an external provider. The provider drives the official Claude Code CLI with the user's existing Claude subscription; it does not turn the subscription into an Anthropic API key or vendor the plugin into LUMI.

## Quick start

The downloaded plugin is auto-discovered at `~/Downloads/hermes-plugin-claude-subscription-directsdk-main`. To use another extraction directory, set the explicit path:

```bash
claude auth login
export LUMI_PROVIDER=claude-subscription-directsdk-experimental
export LUMI_CLAUDE_SUBSCRIPTION_DIRECTSDK_PLUGIN_DIR=/absolute/path/to/hermes-plugin-claude-subscription-directsdk-main

# Development entry point
npx tsx src/index.ts "Inspect the repository and explain the highest-risk issue"

# Built CLI
node dist/index.js --provider claude-subscription-directsdk-experimental "Run the test suite and summarize failures"
```

The provider-specific model can be selected with `LUMI_MODEL_ID` or the interactive model picker:

```bash
export LUMI_MODEL_ID=claude-sonnet-5[1m]
npx tsx src/index.ts --provider claude-subscription-directsdk-experimental "Review the auth boundary"
```

Run `heav3ns doctor` or use `/providers` in the TUI to verify the plugin, Claude Code executable, and local login state. The guided setup flow also exposes the provider without presenting an API-key field.

## Model discovery and supported routes

The model picker follows a two-level strategy modeled on mature provider clients:

1. When Claude Code is installed and signed in, LUMI asks the external plugin for its native account picker. Those account-scoped routes are authoritative and are cached for five minutes.
2. When the local CLI is unavailable, signed out, or the picker handshake fails, LUMI clearly labels the selector as a fallback and shows the plugin's verified bootstrap routes. It never substitutes an OpenAI route into a Claude session.

The offline fallback mirrors the plugin's pinned native routes:

- `claude-sonnet-5[1m]`
- `claude-haiku-4-5-20251001`
- `claude-opus-5[1m]`
- `claude-opus-4-8[1m]`
- `claude-fable-5-1[1m]`

`sonnet`, `haiku`, `opus`, and `fable` are accepted as provider-local aliases. The `[1m]` suffix is meaningful: the bridge passes the long-context selection through to the native CLI.

Use `heav3ns models --refresh` while Claude is active to force a fresh account-picker lookup. In the TUI, `Alt+M` opens the grouped model selector; its status line says whether the list is live account data or a verified fallback.

## Boundary and safety contract

The implementation follows the same boundary patterns used by mature local-provider integrations:

1. LUMI owns provider selection, context compaction, tools, approvals, scheduling, cancellation, and the outer turn budget.
2. A small stdlib-only Python bridge loads the user-selected plugin for one JSON request and one JSON response. The bridge is copied into builds, so packaged LUMI does not depend on the source checkout.
3. Model discovery is a separate bridge action from completion. The upstream `directsdk_setup.discover_models()` path uses Claude Code's own initialization picker and rejects the result if it makes an upstream Messages request.
4. The bridge validates the plugin manifest and required files before loading Python code. An explicitly configured invalid path fails closed.
5. The plugin's own OAuth and admission safeguards remain authoritative. LUMI passes the inherited environment through so conflicting API-key/backend overrides are rejected by the plugin instead of silently changing billing or auth.
6. Native tool identifiers are mapped to deterministic ASCII names of at most 50 characters and mapped back only after validating the returned name.
7. The request is executed in a detached process group with a bounded timeout, bounded stdout/stderr diagnostics, and abort propagation. Claude subscription turns are never automatically retried because a retry could duplicate a paid or quota-counted turn.

LUMI reports native usage metadata when the plugin returns it, but zero catalog pricing means “provider-billed/subscription-accounted,” not a promise of unlimited or free usage.

## Configuration

| Variable | Purpose |
|---|---|
| `LUMI_PROVIDER` | Selects `claude-subscription-directsdk-experimental` by default for the process. |
| `LUMI_MODEL_ID` | Selects a provider model route. |
| `LUMI_CLAUDE_SUBSCRIPTION_DIRECTSDK_PLUGIN_DIR` | Absolute plugin directory; recommended for CI, packaged apps, or nonstandard Downloads locations. |
| `LUMI_CLAUDE_SUBSCRIPTION_DIRECTSDK_PYTHON` | Python executable, default `python3` on macOS/Linux. |
| `CLAUDE_SUBSCRIPTION_DIRECTSDK_COMMAND` | Optional Claude Code executable override. |
| `LUMI_CLAUDE_SUBSCRIPTION_DIRECTSDK_TIMEOUT_MS` | Outer request budget, clamped to 5 seconds–15 minutes; default 180 seconds. |

If `claude` is installed under a Node version that can launch the binary but is
not compatible with that Claude Code release, point the command override at a
known-good runtime and the CLI entry point. The bridge accepts shell-style
arguments and uses the same command for auth, model discovery, and completion:

```bash
export CLAUDE_SUBSCRIPTION_DIRECTSDK_COMMAND="/path/to/node /opt/homebrew/bin/claude"
```

`doctor` distinguishes a runtime crash from an ordinary signed-out state, so a
Node failure will recommend the runtime override while an auth failure will
only recommend `claude auth login`.

The bridge also honors the plugin's `CLAUDE_SUBSCRIPTION_DIRECTSDK_CONFIG_DIR` behavior through the child environment. Do not set `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, or native Bedrock/Vertex/Foundry switches while using the OAuth transport; the plugin intentionally rejects those conflicting modes.

## Build and verification

```bash
npm run compile
npx tsc --noEmit -p tsconfig.unit-test.json
npx mocha --grep "Claude subscription DirectSDK provider boundary"
```

The provider tests use a fake plugin and never contact Anthropic. A live check requires a working Claude Code installation and an authenticated subscription. If the native CLI is incompatible with the installed Node runtime, `doctor` reports the failure and the turn remains fail-closed.

The upstream plugin is experimental and remains an external MIT-licensed dependency. Review its release and compatibility changes before upgrading the extracted directory.
