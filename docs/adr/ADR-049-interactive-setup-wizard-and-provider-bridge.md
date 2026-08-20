# ADR-049: Interactive Setup Wizard, Model Provider Resolution & OpenAI Codex OAuth

## Status
**Accepted**

## Context
As **LUMI-NEW** expanded to 105 evolutionary passes, managing authentication credentials across multiple LLM providers (Anthropic, OpenAI, Google Gemini, DeepSeek, Custom Proxies) and OpenAI Codex OAuth PKCE authentication required a unified, interactive setup interface. Users needed an easy CLI and REPL routine to audit, configure, exchange, and verify model credentials without manually editing JSON files or exporting shell environment variables.

## Decision
We implemented **SetupWizard** ([setup-wizard.ts](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/setup/setup-wizard.ts)) as a dedicated setup extension module, integrated directly into the `LUMI` CLI (`lumi --setup`) and interactive REPL session (`/setup` command).

### Key Architectural Components

1. **Provider Key & Credentials Audit**:
   - Audits active key status across system environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`), `AuthStorageVault`, `CodexOAuthManager` disk state (`~/.codex/auth.json`), and custom LLM proxy config.
   - Outputs a colorized status audit table showing active sources and masked keys.

2. **OpenAI Codex OAuth PKCE Flow & Callback Server**:
   - Generates PKCE challenge and authorization URL (`https://auth.openai.com/oauth/authorize`).
   - Launches a temporary HTTP callback server on `http://localhost:1455/auth/callback` to automatically capture the OAuth redirect code.
   - The fullscreen walkthrough attempts to open the system browser, renders a clickable and copyable authorization URL, supports `O` to retry, and accepts a pasted authorization code or callback URL when automatic capture is unavailable.
   - Exchanges code for access & refresh tokens, extracts `ChatGPT-Account-Id`, updates `AuthStorageVault`, and saves LUMI-managed credentials to `~/.lumi/config.json`. Existing Codex CLI auth is read when available and left unchanged.
   - Allows a user with valid existing credentials to keep them and activate the Codex default model without repeating login.

3. **Live LLM Provider Dispatch & Dynamic Fallback**:
   - Wires `CodexProviderBridge` and `LlmProxyGateway` into `AgentEngine` ([agent-engine.ts](file:///Users/bozoegg/Desktop/LUMI-NEW/src/agents/extensions/execution/agent-engine.ts)).
   - Performs live Codex OAuth dispatch through `@openai/codex-sdk` and API-key dispatch through the configured HTTP endpoint.
   - Returns actionable setup guidance when no credentials match the selected model.
   - Keeps the built-in HTML5 Frogger generator as an explicit `frogger` demo shortcut only; it is not a generic unauthenticated creation fallback.

4. **Connection Verification Diagnostics**:
   - Evaluates header resolution across modern models (`gpt-5.6-terra`, `claude-3-5-sonnet`, `gpt-4o`, `gemini-1.5-pro`, `deepseek-v3`).

## Consequences

### Positive
- Zero manual JSON editing needed to configure API keys or OAuth credentials.
- Automates PKCE authorization code capture via local HTTP callback server while retaining browser-launch and manual-paste fallbacks.
- Persists provider selection and supports live model dispatch with visible lifecycle activity.

### Negative
- Local HTTP callback server requires port `1455` to be available during OAuth login.

## Current Refinement: Model Selection and Activity

Provider configuration now activates and persists that provider's default model. The header, setup audit, and `/health` must be read together: process health alone does not prove that credentials resolve for the selected model. Authenticated Codex turns expose structured activity and cancellation according to [ADR-082](ADR-082-structured-agent-activity-streaming.md). Operational recovery steps are documented in the [Troubleshooting Guide](../../.wiki/agent/troubleshooting.md).
