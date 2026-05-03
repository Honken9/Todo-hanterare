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

- `src/types.ts` — `Profile`, `Todo`, and `Filter` types shared across modules. A `Todo` carries `createdBy` (profiles.id, nullable on cascade), `assignedTo: string | null` (null = open / "till alla"), `dueAt: number | null`, and `archivedAt: number | null` (epoch ms).
- `src/todos.ts` / `src/profiles.ts` — pure helper functions. `applyFilter`, `cloneAsActive`, `findProfile`, `profileLabel`. Used for client-side filtering and rendering. Mutations go through Supabase, not these helpers.
- `src/lib/supabase.ts` — Supabase client singleton. Reads env vars and throws if missing. Exports `ProfileRow` / `TodoRow` types matching the DB schema.
- `src/api.ts` — async data layer. `fetchProfiles`, `fetchMyProfile`, `updateProfile`, `deleteProfile`, `fetchTodos`, `insertTodo`, `updateTodo`, `deleteTodo`, `subscribeChanges`. Translates between snake_case DB rows and camelCase app types (and between ISO timestamps and epoch ms).
- `src/Auth.tsx` — magic link login screen. Calls `supabase.auth.signInWithOtp` and shows a "check your inbox" message.
- `src/App.tsx` — top-level component. Listens to `supabase.auth.onAuthStateChange`; if no session, renders `<Auth />`, otherwise `<Workspace session={...}>`. `Workspace` fetches the current user's profile + the global lists, subscribes to real-time changes, and uses optimistic updates that revert on API errors.
- `supabase/migrations/0001_initial_schema.sql` — original people/todos schema (superseded).
- `supabase/migrations/0002_profiles_and_roles.sql` — current schema. Drops the old people table, creates `profiles` 1:1 with `auth.users`, an admin role flag, an auto-create trigger on signup (first user is admin), and a per-row visibility model in RLS.

## Auth, profiles, and visibility

- Each authenticated user has exactly one row in `profiles` (auto-created by the `on_auth_user_created` trigger).
- `is_admin` boolean controls who can edit other people's profiles, delete profiles, and see/edit all todos.
- Todos are visible to: the assignee, the creator, anyone if `assigned_to is null` (open / "till alla"), or any admin. RLS enforces this — the client only filters what's already authorized.
- "Take" is just a normal `updateTodo({ assignedTo: me.id })`. RLS allows updates on `assigned_to is null` rows so anyone can claim.
- New sign-ups are blocked in Supabase Auth settings; admins invite via the Supabase dashboard (Authentication → Users → Invite user). The trigger then provisions a profile.

## Real-time

`subscribeChanges` opens a single Supabase channel that listens to `postgres_changes` on both `profiles` and `todos`. Any change refetches the relevant table — simple but keeps state correct without complex diffing.

## Deployment

Vercel auto-detects Vite. `vercel.json` only contains a SPA rewrite so client-side routes work. Push to the deployed branch (currently `claude/summarize-project-docs-oj4UC`) to trigger a deploy.

## Conventions

- Pure logic stays in `src/todos.ts` / `src/profiles.ts` and is unit-tested.
- App-level tests use `vi.mock('./lib/supabase', ...)` because the real client requires env vars and network.
- UI strings are in Swedish (matches the project name).
- Profile ids come from `auth.users.id` (Supabase). Todo ids come from `gen_random_uuid()`; on the client we use `crypto.randomUUID()` only inside the pure `cloneAsActive` helper (which builds a payload that gets sent through `insertTodo` — the DB then assigns the real id).
