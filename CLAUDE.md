# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

React 18 + TypeScript + Vite. Tests with Vitest + Testing Library (jsdom). ESLint flat config. **Supabase** for auth + data + real-time. Hosted on Vercel.

## Commands

- `npm run dev` — Vite dev server (needs `.env.local` with Supabase config)
- `npm run build` — type-check (`tsc -b`) then production bundle to `dist/`
- `npm run preview` — serve the built bundle
- `npm run lint` — ESLint over the repo
- `npm test` — Vitest one-shot run
- `npm run test:watch` — Vitest watch mode
- Single test: `npx vitest run src/todos.test.ts` (or `-t "<name pattern>"` to filter by test name)

## Environment

`.env.local` (gitignored, copy from `.env.example`):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

In Vercel, set the same two variables under **Settings → Environment Variables**.

## Architecture

- `src/types.ts` — `Todo`, `Person`, and `Filter` types shared across modules. A `Todo` carries `createdBy` (people.id), `assignedTo: string | null`, `dueAt: number | null` (epoch ms), and `archivedAt: number | null` (epoch ms).
- `src/todos.ts` / `src/people.ts` — pure helper functions. `applyFilter`, `cloneAsActive`, etc. Used for client-side filtering and constructing payloads. Mutations go through Supabase, not these helpers.
- `src/lib/supabase.ts` — Supabase client singleton. Reads env vars and throws if missing. Exports `PersonRow` / `TodoRow` types matching the DB schema.
- `src/api.ts` — async data layer. `fetchPeople`, `fetchTodos`, `insertPerson`, `insertTodo`, `updateTodo`, `deletePerson`, `deleteTodo`, and `subscribeChanges`. Translates between snake_case DB rows and camelCase app types (and between ISO timestamps and epoch ms).
- `src/storage.ts` — only `loadMe` / `saveMe` for the per-device "Du är" choice (kept in `localStorage`). All other persistence is in Supabase.
- `src/Auth.tsx` — magic link login screen. Calls `supabase.auth.signInWithOtp` and shows a "check your inbox" message.
- `src/App.tsx` — top-level component. Listens to `supabase.auth.onAuthStateChange`; if no session, renders `<Auth />`, otherwise `<Workspace />`. `Workspace` fetches data on mount, subscribes to real-time changes, and uses optimistic updates that revert on API errors.
- `supabase/migrations/0001_initial_schema.sql` — DB schema (people, todos), RLS policies, realtime publication.

## Auth & RLS model

All authenticated users share one workspace — there is no per-user filtering. RLS policies are simply `to authenticated using (true)`. To restrict access, disable open sign-up in Supabase Auth settings and invite users manually.

## Real-time

`subscribeChanges` opens a single Supabase channel that listens to `postgres_changes` on both `people` and `todos`. Any change refetches the relevant table — simple but keeps state correct without complex diffing.

## Deployment

Vercel auto-detects Vite. `vercel.json` only contains a SPA rewrite so client-side routes work. Push to the deployed branch (currently `claude/summarize-project-docs-oj4UC`) to trigger a deploy.

## Conventions

- Pure logic stays in `src/todos.ts` / `src/people.ts` and is unit-tested.
- App-level tests use `vi.mock('./lib/supabase', ...)` because the real client requires env vars and network.
- UI strings are in Swedish (matches the project name).
- IDs come from `crypto.randomUUID()` on the client when needed; the DB also generates them via `gen_random_uuid()`.
