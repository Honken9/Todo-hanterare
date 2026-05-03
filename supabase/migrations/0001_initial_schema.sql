-- Initial schema for Todo-hanterare
-- Run this in the Supabase SQL Editor (or via supabase CLI).

create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.people(id) on delete set null,
  assigned_to uuid references public.people(id) on delete set null,
  due_at timestamptz,
  archived_at timestamptz
);

create index on public.todos (archived_at);
create index on public.todos (done);

alter table public.people enable row level security;
alter table public.todos enable row level security;

create policy "auth read people"   on public.people for select to authenticated using (true);
create policy "auth insert people" on public.people for insert to authenticated with check (true);
create policy "auth update people" on public.people for update to authenticated using (true);
create policy "auth delete people" on public.people for delete to authenticated using (true);

create policy "auth read todos"    on public.todos for select to authenticated using (true);
create policy "auth insert todos"  on public.todos for insert to authenticated with check (true);
create policy "auth update todos"  on public.todos for update to authenticated using (true);
create policy "auth delete todos"  on public.todos for delete to authenticated using (true);

alter publication supabase_realtime add table public.people;
alter publication supabase_realtime add table public.todos;
