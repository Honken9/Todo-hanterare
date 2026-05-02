# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

React 18 + TypeScript + Vite. Tests with Vitest + Testing Library (jsdom). ESLint flat config. No backend — todos persist in `localStorage`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — type-check (`tsc -b`) then production bundle to `dist/`
- `npm run preview` — serve the built bundle
- `npm run lint` — ESLint over the repo
- `npm test` — Vitest one-shot run
- `npm run test:watch` — Vitest watch mode
- Single test: `npx vitest run src/todos.test.ts` (or `-t "<name pattern>"` to filter by test name)

## Architecture

- `src/types.ts` — `Todo` and `Filter` types shared across modules.
- `src/todos.ts` — pure functions for todo operations (`createTodo`, `toggle`, `remove`, `rename`, `clearDone`, `applyFilter`). All return new arrays; no mutation. This is where business logic lives and where unit tests target.
- `src/storage.ts` — `loadTodos` / `saveTodos` wrap `localStorage` under the key `todo-hanterare:todos:v1`. `loadTodos` validates each entry and silently drops malformed data (corrupt storage should never crash the app). Bump the key suffix when the `Todo` shape changes.
- `src/App.tsx` — single component. Holds state via `useState`, persists on every change via a `useEffect` that calls `saveTodos`. Calls into `src/todos.ts` for every mutation, so the component stays thin.
- `src/main.tsx` — React entry, mounts `<App />` into `#root`.

Two config files exist on purpose: `vite.config.ts` is used by the dev server and `tsc -b`, while `vitest.config.ts` is used only by Vitest. Keeping them split avoids a known type conflict between Vite's types and the nested copy of Vite that ships inside Vitest. Don't merge them back into one file unless the underlying versions are aligned.

`tsconfig.node.json` deliberately excludes `vitest.config.ts` for the same reason — `tsc -b` only type-checks `vite.config.ts`.

## Conventions

- Keep todo logic pure in `src/todos.ts` and unit-test it there. UI-level behaviour (filtering tabs, persistence wiring) is covered in `src/App.test.tsx`.
- UI strings are in Swedish (matches the project name).
- IDs come from `crypto.randomUUID()` — assume a modern browser; no polyfill.
