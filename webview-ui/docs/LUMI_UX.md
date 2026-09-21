# HEAV3NS UX — Webview Developer Reference

The sidebar presents as **HEAV3NS** to users. This file is a quick reference for engineers working in `webview-ui/`. Full documentation lives in the repo docs site:

- **[User Interface Design](../../docs/USER_INTERFACE_DESIGN.md)** — product philosophy, terminology, contributor guidelines
- **[HEAV3NS UX Implementation](../../docs/MIRA_UX_IMPLEMENTATION.md)** — APIs, file map, wiring checklist

---

## North star

> Can someone keep this open all day without feeling managed by it?

Secondary filter: **Does this interface reduce tension?**

---

## Scope

**Change:** user-facing copy, visuals, and microcopy in `webview-ui/`.

**Do not change** (unless explicitly requested): proto keys, internal type names, provider IDs, backend audit logic, filenames like `DietCodeLogo*.tsx`.

---

## Start here

| Task | File |
| :--- | :--- |
| Add conversational copy | `src/copy/heav3nsVoice.ts` |
| Placeholders / completion silence | `pickChatPlaceholder`, `pickCompletionPresentation` |
| Long-session behavior | `src/hooks/useHeav3nsSessionComfort.ts` |
| Signal presence | `src/assets/Heav3nsSignalMark.tsx`, `src/index.css` |
| Audit styling | `src/components/chat/audit/auditUiStyles.ts` |
| Theme / motion | `src/theme.css`, `src/index.css` |

---

## Copy rules

- **Stable placeholders** — no rotation
- **Approvals** — "Want me to…?" via `APPROVAL.*`
- **Tool results** — "I looked at…", not "Executed" / "Fetched"
- **Audit** — sentence case, amber whispers, notebook layout
- **Exports** — Project notes / Detailed notes / Tool report (not Markdown / Gate JSON / SARIF in UI)

---

## Session signals

```typescript
const { sessionMinutes, isNightDesk, isStill, serenityLevel, calmTier } = useHeav3nsSessionComfort()
```

- **90 min** → long session, placeholder "Still here."
- **15 min idle** → night desk, placeholder "…", signal surfaces quiet down
- **Serenity 0–3** → progressive `.lumi-serenity-fade` cooling

Layout attributes: `data-night-desk`, `data-serenity-level`.

---

## Signal modes

`idle` | `waiting` | `success` | `still` | `held`

Use `resolveOrbMood(companionMood, isStill)` — errors should set `held`.

---

## Verify

```bash
npx tsc --noEmit
npm run storybook
```

See [Storybook README](../.storybook/README.md#lumi-design-principles) for component development guidelines.
