# ADR-040: Phase 23 Web URL Content Fetcher & Language Syntax Parser (Passes 79–81)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing web content fetching & markdown conversion (`UrlContentFetcher` from `packages/codemarie/src/services/browser`), AST language syntax parsing (`LanguageSyntaxParser` from `packages/codemarie/src/services/tree-sitter`), and performing Phase 23 master subsystem synthesis (Passes 79–81) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 23 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 79**: Web URL content fetcher and markdown converter (`UrlContentFetcher`).
2. **Pass 80**: Fast multi-language AST syntax symbol parser (`LanguageSyntaxParser`).
3. **Pass 81**: Phase 23 master subsystem synthesis verification.

---

## 2. Architectural Decision (The What)

Following **ADR-012**:
- `src/tooling/extensions/perception/url-content-fetcher.ts` (`UrlContentFetcher`)
- `src/tooling/extensions/perception/language-syntax-parser.ts` (`LanguageSyntaxParser`)
- `src/index.ts` (`LumiMonolith` master composition root)
