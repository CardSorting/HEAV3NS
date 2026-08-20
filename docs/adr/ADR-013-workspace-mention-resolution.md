# ADR-013: Workspace Mention Resolution (`codemarie`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing workspace prompt context `@mention` parsing and context block expansion from teacher package `/Users/bozoegg/Downloads/pi-main/packages/codemarie/src/core/mentions` into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Pass 9).

---

## 1. Context & Motivation (The Why)

Users and AI agents reference files (`@file:<path>`), folders (`@folder:<path>`), code symbols (`@symbol:<name>`), git working state (`@git:staged`), and terminal logs (`@terminal`) inside prompts.

Before turn execution, these mention tokens must be parsed and expanded into structured context blocks (`<file_content>`, `<folder_content>`, `<symbol_context>`, `<git_context>`, `<terminal_context>`) to enrich prompt composition without requiring manual file reading steps.

---

## 2. Architectural Decision (The What)

### Non-Destructive Mention Subdirectory Architecture (`ADR-012`)

Following our **Non-Destructive Class Extension & Mutation Directory Architecture (`ADR-012`)**:
1. Created `MentionResolver` in `src/agents/extensions/mentions/mention-resolver.ts`.
2. `MentionResolver` scans prompts for `@file:<path>`, `@folder:<path>`, `@symbol:<name>`, `@git:staged`, and `@terminal` tokens.
3. Uses `Eyes` (`readFile`, `listDirectory`), `AstPerceptionEyes` (`searchSymbols`), and `AnchoredHands` (`runCommand`) to generate structured XML context blocks.
4. Composed directly in `MonolithFactory` and `LumiMonolith`.

---

## 3. Technical Implementation (The How)

```typescript
export class MentionResolver {
  async resolveMentions(
    prompt: string,
    cwd: string,
    eyes: Eyes,
    hands?: AnchoredHands
  ): Promise<MentionResolutionResult> {
    // 1. Matches @file, @folder, @symbol, @git, @terminal
    // 2. Generates <file_content>, <symbol_context>, <git_context> blocks
    // 3. Returns parsedPrompt, expandedContextBlocks, resolvedMentions
  }
}
```

---

## 4. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean resolution of `@file:package.json` and `@symbol:LumiMonolith` during frame tick smoke test.
