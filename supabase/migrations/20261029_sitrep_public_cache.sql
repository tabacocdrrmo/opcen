-- Cache for the public SITREP board.
--
-- `sitrep-public` writes the aggregate JSON here and reads it back, so a burst
-- of visitors (or a cold start) cannot hit the Apps Script backend more than
-- once every fifteen minutes. The row holds counts only: no names, contact
-- numbers, addresses, narratives or photo ids.
--
-- Locked down: RLS is on, there are no policies, and every client grant is
-- revoked, so anon and authenticated cannot read or write it even with the
-- public anon key. Only the service role used by the edge function can.
--
-- Run in the Supabase SQL editor.

create table if not exists public.sitrep_public_cache (
    id integer primary key,
    payload jsonb not null default '{}'::jsonb,
    -- Epoch means "never refreshed", so the first request claims the slot.
    updated_at timestamptz not null default to_timestamp(0)
);

comment on table public.sitrep_public_cache is
    'Aggregate-only cache for the public SITREP edge function. Service role only.';

alter table public.sitrep_public_cache enable row level security;
alter table public.sitrep_public_cache force row level security;

revoke all on table public.sitrep_public_cache from anon, authenticated, public;
grant select, insert, update, delete on table public.sitrep_public_cache to service_role;

-- Exactly one row: the function updates id = 1 in place.
alter table public.sitrep_public_cache
    drop constraint if exists sitrep_public_cache_single_row;
alter table public.sitrep_public_cache
    add constraint sitrep_public_cache_single_row check (id = 1);

insert into public.sitrep_public_cache (id, payload, updated_at)
values (1, '{}'::jsonb, to_timestamp(0))
on conflict (id) do nothing;
