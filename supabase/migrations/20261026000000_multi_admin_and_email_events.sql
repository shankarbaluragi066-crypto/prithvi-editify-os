-- ============================================================================
-- PRITHVI EDITIFY — INCREMENTAL MIGRATION: SECOND ADMIN & EMAIL AUDIT LOGS
-- ============================================================================
-- Safely adds prithvieditify.official@gmail.com alongside existing administrator
-- shankarbaluragi066@gmail.com without deleting or downgrading any existing data.
-- ============================================================================

create table if not exists public.admin_allowlist (
  email text primary key,
  label text not null default 'Studio Administrator',
  receive_notifications boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

insert into public.admin_allowlist (email, label, receive_notifications, active)
values
  ('shankarbaluragi066@gmail.com', 'Primary Studio Owner (Shankar Baluragi)', true, true),
  ('prithvieditify.official@gmail.com', 'Official Studio Admin (Prithvi Editify)', true, true)
on conflict (email) do update
set active = true,
    receive_notifications = true;

-- Upgrade any existing profile for either authorized admin to role = 'admin'
update public.profiles
set role = 'admin',
    status = 'active',
    updated_at = now()
where lower(email) in ('shankarbaluragi066@gmail.com', 'prithvieditify.official@gmail.com');

create table if not exists public.email_audit_logs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_type text not null,
  recipient_email text not null,
  subject text not null default '',
  delivery_status text not null default 'queued',
  provider text not null default 'server',
  error_message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_audit_logs_event on public.email_audit_logs(event_type);
create index if not exists idx_email_audit_logs_recipient on public.email_audit_logs(recipient_email);
alter table public.email_audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'shankarbaluragi066@gmail.com',
      'prithvieditify.official@gmail.com'
    ) then true
    when exists (
      select 1
      from public.admin_allowlist a
      where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and a.active = true
    ) then true
    else exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and status = 'active'
    )
  end;
$$;

grant execute on function public.is_admin() to public, anon, authenticated, service_role;

drop policy if exists "admin_allowlist_admin_read" on public.admin_allowlist;
create policy "admin_allowlist_admin_read" on public.admin_allowlist
  for select to authenticated using (public.is_admin());

drop policy if exists "email_audit_logs_admin_all" on public.email_audit_logs;
create policy "email_audit_logs_admin_all" on public.email_audit_logs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  normalized_email text;
begin
  normalized_email := lower(coalesce(new.email, ''));
  if normalized_email in ('shankarbaluragi066@gmail.com', 'prithvieditify.official@gmail.com')
     or exists (select 1 from public.admin_allowlist a where lower(a.email) = normalized_email and a.active = true) then
    assigned_role := 'admin';
  else
    assigned_role := 'client';
  end if;

  insert into public.profiles (id, email, display_name, role, status, phone, company_name)
  values (
    new.id,
    normalized_email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Client'), '@', 1)),
    assigned_role,
    'active',
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      role = case
        when lower(excluded.email) in ('shankarbaluragi066@gmail.com', 'prithvieditify.official@gmail.com') then 'admin'
        else public.profiles.role
      end,
      updated_at = now();

  return new;
end;
$$;

NOTIFY pgrst, 'reload schema';
