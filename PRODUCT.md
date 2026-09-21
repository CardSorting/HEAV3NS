# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers working inside VS Code, especially during long, multi-step coding sessions where they need fast context, safe execution, and clear control over an AI coding partner.

## Product Purpose

HEAV3NS is an AI coding companion delivered through a VS Code sidebar and companion CLI. It helps developers understand code, plan work, make changes, run tools, and recover safely while keeping the developer in control.

## Positioning

The product combines conversational coding with explicit execution states, previews, approvals, recovery paths, worktrees, MCP tools, and long-session ergonomics instead of treating an agent turn as an opaque request and response.

## Operating Context

The primary surface is a narrow, persistent VS Code webview used alongside an editor, terminal, browser, and source-control workflow. Users scan the interface frequently, switch between tasks, and need important decisions and recovery states to remain legible at sidebar widths.

## Capabilities and Constraints

- The frontend is a React/Vite VS Code webview with VS Code webview toolkit components.
- Preserve existing product behavior, accessibility affordances, keyboard navigation, and stable extension command/configuration identifiers.
- HEAV3NS is the visible product name.
- The new visual identity must replace the previous orb/companion visual language rather than extending it.
- This pass improves source branding and frontend identity; it does not package or create a VSIX.

## Brand Commitments

HEAV3NS is the active product name. The visible identity should feel atmospheric, precise, capable, and native to a developer workspace without using an orb, face, or radial companion glow as its primary mark.

## Evidence on Hand

- `package.json` and `README.md` describe the coding companion and its workflows.
- `webview-ui/src/` contains the current React surface, copy, components, and interaction states.
- `webview-ui/src/theme.css` and `webview-ui/src/index.css` contain the incumbent visual tokens and responsive rules.

## Product Principles

- Keep the developer oriented: state, next action, and control should be visible at a glance.
- Make powerful execution feel reversible and inspectable.
- Favor calm focus over attention-seeking motion.
- Treat narrow-space ergonomics and keyboard access as first-class product quality.

## Accessibility & Inclusion

Preserve visible focus, semantic landmarks, keyboard access, reduced-motion behavior, readable contrast, and clear loading, error, empty, and disabled states across the narrow sidebar surface.
