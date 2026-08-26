# ADR-147: GALX AI Provider Integration & Auxiliary Provider Consolidation

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-26
- **Technical Story**: Integrate the complete enterprise GALX AI wholesale compute provider and transport substrate while consolidating all auxiliary LLM provider integrations into three focused, first-class backends: OpenRouter, Codex (OpenAI), and GALX.

---

## 1. Context & Motivation (The Why)

### Problem Statement
LUMI previously maintained an overly fragmented ecosystem of legacy auxiliary LLM providers (Anthropic direct, Google Gemini direct, DeepSeek direct, Groq, Cerebras, xAI, Qwen, ZAI, Cloudflare Workers AI, and multiple local daemon interfaces). This caused significant maintenance overhead, divergent auth schemas, redundant network transport logic, and cognitive bloat in the model selection and setup wizards.

Furthermore, access to wholesale GPU compute clearinghouses with transparent sub-cent pricing, cryptographic delivery receipts, and RFC-compliant transport security required a first-class integration for **GALX AI** (`https://galx.ai/v1`).

### Drivers & Objectives
- **Enterprise GALX Integration**: Complete port of the GALX AI provider engine, Broccoli transport substrate (Write-Ahead Ledger, Merkle hash chaining, RFC 9449 DPoP proofs, HKDF AES-256-GCM envelope crypto), and hardened transport client (RFC 9530 digests, RFC 9421 HMAC-SHA256 signatures, 3-state circuit breaker, AIMD governor).
- **Streamlined Provider Scoping**: Cleanly restrict active provider registries and resolvers to exactly three core pillars:
  1. `openai-codex`: ChatGPT Subscription OAuth PKCE + direct OpenAI API Key.
  2. `galx`: GALX Wholesale Compute Clearinghouse (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`).
  3. `openrouter`: Unified OpenRouter gateway for all external frontier models.
- **Zero Barrel Imports Invariant (ADR-012)**: Preserve direct subpath imports without intermediate index barrels across `src/integrations/galx/`.
- **Optimal Monolith Cohesion**: Ensure all 593 runtime components bind seamlessly into `GrandMonolithSynthesizer` with 100% test coverage.

---

## 2. Architectural Decisions (The What)

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      GALX AI & STREAMLINED PROVIDER TOPOLOGY                      │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Presentation & Interactive TUI Layer                                     │
│   ├── ModelSelectModal ([1] ALL, [2] CODEX OAUTH, [3] GALX WHOLESALE, [4] OPENROUTER)│
│   ├── GuidedSetupWalkthroughModal (Codex OAuth, GALX Wholesale, OpenRouter, OpenAI)│
│   └── SetupWizard & CLI (/providers, --setup, login, whoami)                      │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Model Resolution & Provider Engines Layer                                │
│   ├── GalxProviderEngine (Attribution Headers, Model Normalization, Turn Cost)    │
│   ├── ModelCatalog (Scoped to openai-codex, galx, openrouter, custom)            │
│   ├── CodexProviderBridge (Provider name resolution, default endpoints, auth)     │
│   └── EnvironmentKeyResolver (OPENAI_API_KEY, GALX_API_KEY, OPENROUTER_API_KEY)  │
├───────────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Hardened Transport & Clearinghouse Layer                                 │
│   ├── GalxTransportClient (RFC 9530 Digest, RFC 9421 Sig, Circuit Breaker, AIMD) │
│   ├── BroccoliTransportSubstrate (WAL, Merkle Hash Chain, DPoP, Envelope Crypto) │
│   └── UniversalToolCallAdapter (OpenAI, OpenRouter, GALX, Anthropic, Gemini wire) │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Core Decisions

1. **Contracts & Default Models (`src/core/contracts/galx.contracts.ts`)**:
   - Canonical Base URL: `https://galx.ai/v1`.
   - Clearinghouse URL: `https://galx.ai`.
   - Default Model: `gpt-5.6-sol` (alias `galx`, `galx-sol`, `sol`).
   - Standard Fleet: `gpt-5.6-sol` ($3.75/1M in, $15.00/1M out), `gpt-5.6-terra` ($0.45/1M in, $1.80/1M out), `gpt-5.6-luna` ($0.15/1M in, $0.60/1M out).

2. **Broccoli Transport Substrate (`src/integrations/galx/BroccoliTransportSubstrate.ts`)**:
   - Write-Ahead Ledger (`.broccolidb/galx/wal.json`) with atomic file writes and `0o600` permissions.
   - Merkle hash-chained delivery receipts (`sha256(prevHash::correlationId::idempotencyKey::status::duration::timestamp)`).
   - DPoP RFC 9449 JWT proofs with `ath` (access-token SHA-256 hash binding).
   - Symmetric Envelope Encryption: HKDF-derived AES-256-GCM authenticated cipher.

3. **Hardened Transport Client (`src/integrations/galx/GalxTransportClient.ts`)**:
   - Dual Content-Digest: Base64 `Digest` (RFC 9530) and Hex `X-Digest-SHA256` (RFC 3230).
   - HTTP Message Signatures (RFC 9421): `@method`, `@path`, `@authority`, `content-digest`.
   - 3-State Circuit Breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) with cooldown timing.
   - AIMD Concurrency Throttle & Client-Side Token Bucket Rate Limiter.

4. **Model Catalog & Resolver Scoping**:
   - Removed direct auxiliary provider drivers.
   - `ModelSpecs.provider` restricted to `"openrouter" | "openai-codex" | "galx" | "custom"`.
   - Model resolver recognizes GALX prefixes (`galx/gpt-5.6-sol`) and aliases.

---

## 3. Consequences & Trade-offs (The Impact)

### Positive
- **Clear Architecture**: A lean, reliable provider structure with no dead code or unmaintained vendor endpoints.
- **Wholesale Price Transparency**: Instant access to sub-cent GALX models with verifiable cryptographic SLA metrics.
- **Zero Barrel Imports Compliance**: Clean direct file paths complying with ADR-012.
- **Full Test Integrity**: 100% test pass rate across all 139 repository test suites.

### Negative & Mitigations
- *Removed legacy direct vendor endpoints*: Users connecting to Claude, Gemini, or DeepSeek now route seamlessly through OpenRouter, providing higher reliability, unified billing, and prompt caching.

---

## 4. Verification & Validation Plan

### Automated Test Suites
- Dedicated GALX Provider Test: `npx tsx scripts/validate-galx-provider.ts`
- Full Workspace Test Suite: `npm test`
- ADR Workspace Audit: `npm run validate:adr`
- TypeScript Static Verification: `npm run check`

### Verification Results
| Metric / Invariant | Required SLA | Measured Value | Status |
|---|---|---|---|
| GALX Provider Validation | 8 / 8 Phases | 8 / 8 Passed | PASS |
| Repository Test Suites | 139 / 139 | 139 / 139 Passed (46.89s) | PASS |
| TypeScript Type Safety | 0 Errors | 0 Errors | PASS |
| Monolith Component Count | 593 Components | 593 Components (OPTIMAL) | PASS |
| Zero Barrel Imports | 0 Barrels in `src/` | 0 Barrels | PASS |
