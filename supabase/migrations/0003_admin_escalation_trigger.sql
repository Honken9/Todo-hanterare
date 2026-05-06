-- 0003: Replace the subtle WITH CHECK subquery with an explicit trigger
-- that prevents non-admins from changing is_admin on any row, including
-- their own.
--
-- Run this in the Supabase SQL Editor.

-- 1. Drop the old policy and replace with a clearer one.
drop policy if exists "user update own profile" on public.profiles;
create policy "user update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Trigger that explicitly forbids non-admins from changing is_admin.
create or replace function public.prevent_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_admin is distinct from OLD.is_admin and not public.is_admin() then
    raise exception 'Endast admin kan ändra admin-status'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_admin_escalation_check on public.profiles;
create trigger profiles_admin_escalation_check
  before update of is_admin on public.profiles
  for each row execute function public.prevent_admin_escalation();
