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

- `src/types.ts` — `Todo`, `Person`, and `Filter` types shared across modules. A `Todo` carries `createdBy` (immutable, the person id who added it), `assignedTo: string | null` (responsible person), `dueAt: number | null` (epoch ms deadline), and `archivedAt: number | null` (epoch ms when archived; null while live).
- `src/todos.ts` — pure functions for todo operations (`createTodo`, `toggle`, `remove`, `rename`, `setAssignee`, `setDueAt`, `clearAssignee`, `archive`, `unarchive`, `archiveDone`, `cloneAsActive`, `applyFilter`). All return new arrays; no mutation. `clearAssignee` exists so the App can null-out assignments when a person is deleted. Done todos are archived (not deleted) so history is preserved; `cloneAsActive` reuses an archived todo's text + assignee in a fresh active one.
- `src/people.ts` — pure functions for the person list (`createPerson`, `removePerson`, `findPerson`).
- `src/storage.ts` — three independent `localStorage` slots:
  - `todo-hanterare:todos:v2` — todo array; bump suffix when `Todo` shape changes (v1 was the pre-people shape and is intentionally not migrated). The loader normalizes optional fields like `archivedAt` (treats missing as `null`) so older v2 data without the field still loads.
  - `todo-hanterare:people:v1` — person array.
  - `todo-hanterare:me:v1` — id of the current user (the "Du är" picker). Persisted so the choice survives reloads.
  Each loader validates entries and silently drops malformed data — corrupt storage must never crash the app.
- `src/App.tsx` — single component. Holds `todos`, `people`, and `me` in `useState`, persists each via its own `useEffect`. All mutations route through the pure functions in `todos.ts` / `people.ts`. Adding a todo is gated on `me !== null`. Removing a person also calls `clearAssignee` and clears `me` if it pointed at them.
- `src/main.tsx` — React entry, mounts `<App />` into `#root`.

`<input type="datetime-local">` is the source of truth for deadlines in the UI. App.tsx has small `dueToInputValue` / `inputValueToDue` helpers that convert between the input's local-time string and epoch ms.

Two config files exist on purpose: `vite.config.ts` is used by the dev server and `tsc -b`, while `vitest.config.ts` is used only by Vitest. Keeping them split avoids a known type conflict between Vite's types and the nested copy of Vite that ships inside Vitest. Don't merge them back into one file unless the underlying versions are aligned.

`tsconfig.node.json` deliberately excludes `vitest.config.ts` for the same reason — `tsc -b` only type-checks `vite.config.ts`.

## Conventions

- Keep todo logic pure in `src/todos.ts` and unit-test it there. UI-level behaviour (filtering tabs, persistence wiring) is covered in `src/App.test.tsx`.
- UI strings are in Swedish (matches the project name).
- IDs come from `crypto.randomUUID()` — assume a modern browser; no polyfill.
