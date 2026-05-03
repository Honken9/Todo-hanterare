-- 0002: Auth-tied profiles, admin role, and visibility model.
--
-- After running this migration:
--   1. Sign in to the app with your email (this creates your profile via the trigger).
--   2. The first user becomes admin automatically. If you want to (re)promote a
--      specific user manually:
--        update public.profiles set is_admin = true
--        where id = (select id from auth.users where email = 'you@example.com');
--
-- This migration drops the previous people/todos tables — any data in them is lost.

drop table if exists public.todos;
drop table if exists public.people;

-- Profiles are 1:1 with auth.users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a new auth user is created. The first user becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean;
begin
  select count(*) = 0 into first_user from public.profiles;
  insert into public.profiles (id, display_name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    first_user
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist before this migration.
-- The earliest-created existing user becomes admin.
insert into public.profiles (id, display_name, is_admin)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.id = (select id from auth.users order by created_at asc limit 1)
from auth.users u
on conflict (id) do nothing;

-- Todos
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  archived_at timestamptz
);

create index on public.todos (archived_at);
create index on public.todos (done);
create index on public.todos (assigned_to);

-- Helper: is the current user admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.todos enable row level security;

-- profiles: every authenticated user can read all profiles (so we can show names)
create policy "auth read profiles" on public.profiles for select to authenticated using (true);
-- a user can update their own display_name (but cannot change is_admin)
create policy "user update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()));
-- admins can update anyone (including is_admin flag)
create policy "admin update profile" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- admins can delete profiles
create policy "admin delete profile" on public.profiles for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

-- todos
-- select: assigned_to me, created_by me, unassigned (open / "till alla"), or admin
create policy "select visible todos" on public.todos for select to authenticated using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or assigned_to is null
  or public.is_admin()
);
-- insert: created_by must equal me
create policy "insert own todos" on public.todos for insert to authenticated with check (
  created_by = auth.uid()
);
-- update: creator, current assignee, anyone if currently unassigned (so anyone can take), or admin
create policy "update todos" on public.todos for update to authenticated using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or assigned_to is null
  or public.is_admin()
);
-- delete: creator or admin
create policy "delete own todos" on public.todos for delete to authenticated using (
  created_by = auth.uid()
  or public.is_admin()
);

-- Realtime
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.todos;
