-- Locks down the accounts table.
--
-- Before this, the table had INSERT/UPDATE/SELECT policies applied to `public`,
-- which meant anyone holding the public anon key (it ships in the client code)
-- could read every account and set any role to admin - and the edge functions
-- then treat that role as authorization.
--
-- After this:
--   * a signed-in user can read only their own row (admins read all)
--   * there are no client INSERT/UPDATE/DELETE policies at all
--   * column privileges remove client writes entirely
--   * account writes happen only in the account-admin edge function (service role)
--
-- Run in the Supabase SQL editor.

-- 1. Helper used by the policies. SECURITY DEFINER so the lookup is not blocked
--    by the accounts policies themselves (it would otherwise recurse).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from accounts a
    where a.auth_user_id::text = (auth.uid())::text
      and a.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2. RLS must be on for the policies below to apply at all.
alter table accounts enable row level security;

-- 3. Remove the open policies.
drop policy if exists accounts_insert on accounts;
drop policy if exists accounts_update on accounts;
drop policy if exists accounts_select on accounts;

-- 4. Reads: own row, or every row for admins (admin roster + exports).
create policy accounts_select_own_or_admin
  on accounts
  for select
  to authenticated
  using (auth_user_id::text = (auth.uid())::text or public.is_admin());

-- 5. No client writes. Without these policies there is no row a client could
--    update even if it tried, and the grants below remove the table privilege.
--    (Admins manage accounts through the account-admin edge function, and the
--    crew portal links its own employee_id through the same function.)

-- 6. Column privileges: read-only for signed-in users, nothing for anon.
revoke all on accounts from anon;
revoke insert, update, delete on accounts from authenticated;
grant select on accounts to authenticated;

-- Verify afterwards: no policy should remain for anon, and the only SELECT
-- policy should be accounts_select_own_or_admin.
-- select policyname, cmd, roles, qual from pg_policies where tablename = 'accounts';
