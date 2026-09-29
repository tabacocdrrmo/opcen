-- Locks down the app tables and the profile-picture bucket.
--
-- RLS is already enabled everywhere. This migration rewrites the policies that
-- are wrong rather than turning anything on:
--
--   1. Every app policy is TO public. The row conditions are fine, but anon has
--      no business being in the picture at all - these become TO authenticated.
--   2. employees_update lets any signed-in user edit their own row, which
--      includes position, status, employment_type, eligibility, date_of_joining
--      and employee_id. That is self-promotion on the roster. Fixed with a
--      trigger, because RLS cannot restrict columns.
--   3. employees_insert accepts any signed-in user, so anybody can fabricate a
--      roster entry for an employee id they do not own. Inserts are now
--      admin-only; crew onboarding goes through account-admin "self-register".
--   4. There is no employees_delete policy, so the admin panel's delete button
--      is silently blocked. Added back, admin only.
--   5. Storage has "Allow anon uploads" with check_expr = true: anyone holding
--      the anon key can upload any file to any bucket. Dropped. Profile picture
--      writes are now limited to your own "<employee_id>_" prefix.
--
-- Uses the existing is_admin() and current_employee_id() helpers.
-- Re-runnable: drops each policy before recreating it.
--
-- Run order: deploy the account-admin function (adds "self-register") BEFORE
-- running this, so crew onboarding keeps working.

-- ---------------------------------------------------------------------------
-- 1. Turn RLS on for every table in public and keep anon out entirely
-- ---------------------------------------------------------------------------
-- Both are already true for this project. Left in so the file states the
-- invariant and repairs it if a table is ever added without RLS.

do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. employees
-- ---------------------------------------------------------------------------

drop policy if exists employees_select on employees;
create policy employees_select on employees
  for select to authenticated
  using ((id = current_employee_id()) or is_admin());

-- Admin only. Crew onboarding uses account-admin "self-register", which also
-- links the new row to the caller's own account.
drop policy if exists employees_insert on employees;
create policy employees_insert on employees
  for insert to authenticated
  with check (is_admin());

drop policy if exists employees_update on employees;
create policy employees_update on employees
  for update to authenticated
  using ((id = current_employee_id()) or is_admin())
  with check ((id = current_employee_id()) or is_admin());

drop policy if exists employees_delete on employees;
create policy employees_delete on employees
  for delete to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- 3. emergency_contacts
-- ---------------------------------------------------------------------------

drop policy if exists emergency_contacts_select on emergency_contacts;
create policy emergency_contacts_select on emergency_contacts
  for select to authenticated
  using ((employee_id = current_employee_id()) or is_admin());

drop policy if exists emergency_contacts_insert on emergency_contacts;
create policy emergency_contacts_insert on emergency_contacts
  for insert to authenticated
  with check ((employee_id = current_employee_id()) or is_admin());

drop policy if exists emergency_contacts_update on emergency_contacts;
create policy emergency_contacts_update on emergency_contacts
  for update to authenticated
  using ((employee_id = current_employee_id()) or is_admin())
  with check ((employee_id = current_employee_id()) or is_admin());

-- No delete policy on purpose. Nothing in the app deletes these, so nobody
-- should be able to.

-- ---------------------------------------------------------------------------
-- 4. leave_requests
-- ---------------------------------------------------------------------------

drop policy if exists leave_requests_select on leave_requests;
create policy leave_requests_select on leave_requests
  for select to authenticated
  using ((employee_id = current_employee_id()) or is_admin());

-- with check is what stops anyone filing leave under someone else's id.
drop policy if exists leave_requests_insert on leave_requests;
create policy leave_requests_insert on leave_requests
  for insert to authenticated
  with check ((employee_id = current_employee_id()) or is_admin());

drop policy if exists leave_requests_update on leave_requests;
create policy leave_requests_update on leave_requests
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- No delete policy: leave history is a record, not something to remove.

-- ---------------------------------------------------------------------------
-- 5. Stop crew editing their own rank, status or hire date
-- ---------------------------------------------------------------------------
-- The employees_update policy has to let a user edit their own row so they can
-- fix their address or phone number. This trigger is what stops that same
-- access from being used to rewrite employment details.

create or replace function public.guard_employee_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (edge functions) and admins may change anything.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.employee_id is distinct from old.employee_id
     or new.status is distinct from old.status
     or new.position is distinct from old.position
     or new.employment_type is distinct from old.employment_type
     or new.eligibility is distinct from old.eligibility
     or new.date_of_joining is distinct from old.date_of_joining then
    raise exception 'Only an admin can change employment details.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_employee_privileged_columns on employees;
create trigger guard_employee_privileged_columns
  before update on employees
  for each row execute function public.guard_employee_privileged_columns();

-- ---------------------------------------------------------------------------
-- 6. Profile picture storage
-- ---------------------------------------------------------------------------
-- crew-portal.js and admin.js upload straight from the browser into the
-- "profile-pictures" bucket with upsert, named "<employees.id>_<timestamp>.jpg".
--
-- Revoking the table privilege is what actually closes the anon hole, so this
-- holds regardless of what the policy was called. Reads are untouched: the
-- bucket is public and the app serves these images by URL.

revoke insert, update, delete on storage.objects from anon;

drop policy if exists "Allow anon uploads" on storage.objects;

drop policy if exists "profile-pictures insert" on storage.objects;
create policy "profile-pictures insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and name ~* '\.(jpg|jpeg|png|webp)$'
    and (
      is_admin()
      or (
        current_employee_id() is not null
        and name like current_employee_id()::text || '_%'
      )
    )
  );

-- upsert means an overwrite arrives as an update as well as an insert, so both
-- sides have to be checked.
drop policy if exists "profile-pictures update" on storage.objects;
create policy "profile-pictures update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      is_admin()
      or (
        current_employee_id() is not null
        and name like current_employee_id()::text || '_%'
      )
    )
  )
  with check (
    bucket_id = 'profile-pictures'
    and name ~* '\.(jpg|jpeg|png|webp)$'
    and (
      is_admin()
      or (
        current_employee_id() is not null
        and name like current_employee_id()::text || '_%'
      )
    )
  );

drop policy if exists "profile-pictures delete" on storage.objects;
create policy "profile-pictures delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      is_admin()
      or (
        current_employee_id() is not null
        and name like current_employee_id()::text || '_%'
      )
    )
  );

-- "profile-pictures select" is left as it is: bucket check only, which is what
-- a public bucket needs.
