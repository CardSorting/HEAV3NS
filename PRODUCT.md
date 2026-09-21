# Product

<!-- impeccable:product-schema 1 -->

## Platform

cli

## Users

Developers working in a terminal, especially during long, multi-step coding sessions where they need fast context, safe execution, and clear control over an AI coding partner.

## Product Purpose

HEAV3NS is a local-first CLI coding agent. It helps developers understand code, plan work, make changes, run tools, and recover safely while keeping the developer in control.

## Positioning

The product combines conversational terminal coding with explicit execution states, previews, approvals, recovery paths, worktrees, MCP tools, and long-session ergonomics instead of treating an agent turn as an opaque request and response.

## Operating Context

The primary surface is an interactive terminal UI used alongside an editor, browser, and source-control workflow. Users scan the interface frequently, switch between tasks, and need important decisions and recovery states to remain legible in a terminal.

## Capabilities and Constraints

- The supported distribution is the CLI agent and its terminal UI.
- Preserve existing product behavior, accessibility affordances, keyboard navigation, and stable CLI command/configuration identifiers.
- HEAV3NS is the visible product name.
- The new visual identity must replace the previous orb/companion visual language rather than extending it.
- The project no longer packages or ships an editor extension.

## Brand Commitments

HEAV3NS is the active product name. The visible identity should feel atmospheric, precise, capable, and native to a developer workspace without using an orb, face, or radial companion glow as its primary mark.

## Evidence on Hand

- `package.json` and `README.md` describe the CLI agent and its workflows.
- `src/index.ts` contains the CLI composition root and terminal entrypoint.

## Product Principles

- Keep the developer oriented: state, next action, and control should be visible at a glance.
- Make powerful execution feel reversible and inspectable.
- Favor calm focus over attention-seeking motion.
- Treat narrow-space ergonomics and keyboard access as first-class product quality.

## Accessibility & Inclusion

Preserve visible focus, keyboard access, readable contrast, and clear loading, error, empty, and disabled states across the terminal UI.
