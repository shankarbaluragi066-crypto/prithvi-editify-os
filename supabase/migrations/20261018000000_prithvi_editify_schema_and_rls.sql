-- ============================================================================
-- PRITHVI EDITIFY FREELANCE CRM — SUPABASE POSTGRESQL SCHEMA & RLS MIGRATION
-- ============================================================================
-- Run this script in your Supabase SQL Editor (or via `supabase db push`).
-- Safe & idempotent: upgrades any pre-existing tables (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`),
-- creates all foreign keys, indexes, auth.users profile triggers, Storage buckets,
-- strict Row Level Security (RLS) policies, and reloads the PostgREST schema cache.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked 1:1 with auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default 'Client',
  role text not null default 'client',
  status text not null default 'active',
  phone text not null default '',
  company_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists display_name text not null default 'Client';
alter table public.profiles add column if not exists role text not null default 'client';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists company_name text not null default '';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);

-- Helper function: Securely check if current authenticated user is an admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'shankarbaluragi066@gmail.com' then true
    else exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
        and status = 'active'
    )
  end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant execute on function public.is_admin() to public, anon, authenticated, service_role;

-- Trigger to automatically create a profile row when a new user signs up in Supabase Auth
-- Assigns 'admin' role ONLY to verified studio owner email; everyone else gets 'client'
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  if lower(coalesce(new.email, '')) = 'shankarbaluragi066@gmail.com' then
    assigned_role := 'admin';
  else
    assigned_role := 'client';
  end if;

  insert into public.profiles (id, email, display_name, role, status, phone, company_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Client'), '@', 1)),
    assigned_role,
    'active',
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      role = case when lower(excluded.email) = 'shankarbaluragi066@gmail.com' then 'admin' else public.profiles.role end,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Prevent non-admin users from escalating their own role or status on profile updates
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ============================================================================
-- 2. CLIENTS TABLE
-- ============================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  company_name text not null default '',
  country text not null default 'India',
  preferred_contact text not null default 'WhatsApp',
  account_status text not null default 'active',
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.clients add column if not exists full_name text not null default '';
alter table public.clients add column if not exists email text not null default '';
alter table public.clients add column if not exists phone text not null default '';
alter table public.clients add column if not exists company_name text not null default '';
alter table public.clients add column if not exists country text not null default 'India';
alter table public.clients add column if not exists preferred_contact text not null default 'WhatsApp';
alter table public.clients add column if not exists account_status text not null default 'active';
alter table public.clients add column if not exists admin_notes text not null default '';
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.clients add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_clients_user_id on public.clients(user_id);
create index if not exists idx_clients_email on public.clients(email);

-- ============================================================================
-- 3. SERVICES TABLE (Safely upgrades pre-existing services table if present)
-- ============================================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null default '',
  category text not null default 'Graphic Design',
  description text not null default '',
  starting_price numeric(12,2) not null default 0,
  price_display text not null default '₹500/design',
  pricing_unit text not null default 'design',
  is_custom_quote boolean not null default false,
  deliverables_summary text not null default '',
  turnaround_time text not null default '24–48 hours',
  image_url text not null default '',
  published boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists title text not null default '';
alter table public.services add column if not exists slug text not null default '';
alter table public.services add column if not exists category text not null default 'Graphic Design';
alter table public.services add column if not exists description text not null default '';
alter table public.services add column if not exists starting_price numeric(12,2) not null default 0;
alter table public.services add column if not exists price_display text not null default '₹500/design';
alter table public.services add column if not exists pricing_unit text not null default 'design';
alter table public.services add column if not exists is_custom_quote boolean not null default false;
alter table public.services add column if not exists deliverables_summary text not null default '';
alter table public.services add column if not exists turnaround_time text not null default '24–48 hours';
alter table public.services add column if not exists image_url text not null default '';
alter table public.services add column if not exists published boolean not null default true;
alter table public.services add column if not exists sort_order integer not null default 1;
alter table public.services add column if not exists created_at timestamptz not null default now();
alter table public.services add column if not exists updated_at timestamptz not null default now();

-- Safely relax legacy NOT NULL constraints (e.g. `name`, `price`) on pre-existing tables
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'name'
  ) then
    execute 'alter table public.services alter column name set default ''''';
    execute 'alter table public.services alter column name drop not null';
    execute 'update public.services set title = coalesce(nullif(title, ''''), name) where title = '''' and name is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'price'
  ) then
    execute 'alter table public.services alter column price set default 0';
    execute 'alter table public.services alter column price drop not null';
  end if;
end $$;

create index if not exists idx_services_published_order on public.services(published, sort_order);

-- ============================================================================
-- 4. PORTFOLIO TABLE
-- ============================================================================
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null default '',
  category text not null default 'Graphic Design',
  description text not null default '',
  cover_image text not null default '',
  project_url text not null default '',
  featured boolean not null default false,
  published boolean not null default true,
  is_sample_content boolean not null default false,
  sort_order integer not null default 1,
  metrics_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio add column if not exists title text not null default '';
alter table public.portfolio add column if not exists slug text not null default '';
alter table public.portfolio add column if not exists category text not null default 'Graphic Design';
alter table public.portfolio add column if not exists description text not null default '';
alter table public.portfolio add column if not exists cover_image text not null default '';
alter table public.portfolio add column if not exists project_url text not null default '';
alter table public.portfolio add column if not exists featured boolean not null default false;
alter table public.portfolio add column if not exists published boolean not null default true;
alter table public.portfolio add column if not exists is_sample_content boolean not null default false;
alter table public.portfolio add column if not exists sort_order integer not null default 1;
alter table public.portfolio add column if not exists metrics_summary text not null default '';
alter table public.portfolio add column if not exists created_at timestamptz not null default now();
alter table public.portfolio add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_portfolio_published_order on public.portfolio(published, sort_order);

-- ============================================================================
-- 5. INQUIRIES TABLE
-- ============================================================================
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  company_name text not null default '',
  service_required text not null default '',
  budget_range text not null default '',
  preferred_deadline text not null default '',
  description text not null default '',
  reference_file_url text not null default '',
  privacy_consent boolean not null default true,
  status text not null default 'New',
  lead_source text not null default 'Website Inquiry Form',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inquiries add column if not exists full_name text not null default '';
alter table public.inquiries add column if not exists email text not null default '';
alter table public.inquiries add column if not exists phone text not null default '';
alter table public.inquiries add column if not exists company_name text not null default '';
alter table public.inquiries add column if not exists service_required text not null default '';
alter table public.inquiries add column if not exists budget_range text not null default '';
alter table public.inquiries add column if not exists preferred_deadline text not null default '';
alter table public.inquiries add column if not exists description text not null default '';
alter table public.inquiries add column if not exists reference_file_url text not null default '';
alter table public.inquiries add column if not exists privacy_consent boolean not null default true;
alter table public.inquiries add column if not exists status text not null default 'New';
alter table public.inquiries add column if not exists lead_source text not null default 'Website Inquiry Form';
alter table public.inquiries add column if not exists internal_notes text not null default '';
alter table public.inquiries add column if not exists created_at timestamptz not null default now();
alter table public.inquiries add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_inquiries_status_created on public.inquiries(status, created_at desc);

-- ============================================================================
-- 6. PROJECTS & ISOLATED INTERNAL NOTES TABLES
-- ============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  client_user_id uuid references public.profiles(id) on delete set null,
  client_name text not null default '',
  client_email text not null default '',
  title text not null default '',
  description text not null default '',
  service_type text not null default '',
  brief text not null default '',
  budget numeric(12,2) not null default 0,
  start_date text not null default '',
  deadline text not null default '',
  priority text not null default 'Medium',
  status text not null default 'Planned',
  progress integer not null default 0,
  latest_update text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists client_id uuid references public.clients(id) on delete cascade;
alter table public.projects add column if not exists client_user_id uuid references public.profiles(id) on delete set null;
alter table public.projects add column if not exists client_name text not null default '';
alter table public.projects add column if not exists client_email text not null default '';
alter table public.projects add column if not exists title text not null default '';
alter table public.projects add column if not exists description text not null default '';
alter table public.projects add column if not exists service_type text not null default '';
alter table public.projects add column if not exists brief text not null default '';
alter table public.projects add column if not exists budget numeric(12,2) not null default 0;
alter table public.projects add column if not exists start_date text not null default '';
alter table public.projects add column if not exists deadline text not null default '';
alter table public.projects add column if not exists priority text not null default 'Medium';
alter table public.projects add column if not exists status text not null default 'Planned';
alter table public.projects add column if not exists progress integer not null default 0;
alter table public.projects add column if not exists latest_update text not null default '';
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_projects_client_user_id on public.projects(client_user_id);
create index if not exists idx_projects_client_id on public.projects(client_id);

-- Isolated admin-only internal notes per project
create table if not exists public.project_internal_notes (
  project_id uuid primary key references public.projects(id) on delete cascade,
  notes text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 7. TASKS & MILESTONES TABLE
-- ============================================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_user_id uuid references public.profiles(id) on delete set null,
  title text not null default '',
  description text not null default '',
  status text not null default 'To Do',
  priority text not null default 'Medium',
  due_date text not null default '',
  visibility text not null default 'client',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.tasks add column if not exists client_user_id uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists title text not null default '';
alter table public.tasks add column if not exists description text not null default '';
alter table public.tasks add column if not exists status text not null default 'To Do';
alter table public.tasks add column if not exists priority text not null default 'Medium';
alter table public.tasks add column if not exists due_date text not null default '';
alter table public.tasks add column if not exists visibility text not null default 'client';
alter table public.tasks add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists created_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_client_visibility on public.tasks(client_user_id, visibility);

-- ============================================================================
-- 8. DELIVERABLE FILES TABLE
-- ============================================================================
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_user_id uuid references public.profiles(id) on delete set null,
  file_name text not null default '',
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  category text not null default 'Deliverable',
  download_url text not null default '',
  storage_path text not null default '',
  version_label text not null default 'v1.0',
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploader_name text not null default '',
  visibility text not null default 'client',
  created_at timestamptz not null default now()
);

alter table public.files add column if not exists project_id uuid references public.projects(id) on delete cascade;
alter table public.files add column if not exists client_user_id uuid references public.profiles(id) on delete set null;
alter table public.files add column if not exists file_name text not null default '';
alter table public.files add column if not exists file_type text not null default 'application/octet-stream';
alter table public.files add column if not exists file_size bigint not null default 0;
alter table public.files add column if not exists category text not null default 'Deliverable';
alter table public.files add column if not exists download_url text not null default '';
alter table public.files add column if not exists storage_path text not null default '';
alter table public.files add column if not exists version_label text not null default 'v1.0';
alter table public.files add column if not exists uploaded_by uuid references public.profiles(id) on delete set null;
alter table public.files add column if not exists uploader_name text not null default '';
alter table public.files add column if not exists visibility text not null default 'client';
alter table public.files add column if not exists created_at timestamptz not null default now();

create index if not exists idx_files_project_id on public.files(project_id);
create index if not exists idx_files_client_visibility on public.files(client_user_id, visibility);

-- ============================================================================
-- 9. INVOICES, LINE ITEMS & PAYMENTS TABLES
-- ============================================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_user_id uuid references public.profiles(id) on delete set null,
  client_name text not null default '',
  client_email text not null default '',
  project_id uuid references public.projects(id) on delete set null,
  project_title text not null default '',
  issue_date text not null default '',
  due_date text not null default '',
  items_summary text not null default '',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'Sent',
  payment_instructions text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invoices add column if not exists invoice_number text not null default '';
alter table public.invoices add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.invoices add column if not exists client_user_id uuid references public.profiles(id) on delete set null;
alter table public.invoices add column if not exists client_name text not null default '';
alter table public.invoices add column if not exists client_email text not null default '';
alter table public.invoices add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.invoices add column if not exists project_title text not null default '';
alter table public.invoices add column if not exists issue_date text not null default '';
alter table public.invoices add column if not exists due_date text not null default '';
alter table public.invoices add column if not exists items_summary text not null default '';
alter table public.invoices add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.invoices add column if not exists discount numeric(12,2) not null default 0;
alter table public.invoices add column if not exists tax_rate numeric(5,2) not null default 0;
alter table public.invoices add column if not exists tax_amount numeric(12,2) not null default 0;
alter table public.invoices add column if not exists total numeric(12,2) not null default 0;
alter table public.invoices add column if not exists amount_paid numeric(12,2) not null default 0;
alter table public.invoices add column if not exists balance_due numeric(12,2) not null default 0;
alter table public.invoices add column if not exists currency text not null default 'INR';
alter table public.invoices add column if not exists status text not null default 'Sent';
alter table public.invoices add column if not exists payment_instructions text not null default '';
alter table public.invoices add column if not exists notes text not null default '';
alter table public.invoices add column if not exists created_at timestamptz not null default now();
alter table public.invoices add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_invoices_client_user_id on public.invoices(client_user_id);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  client_user_id uuid references public.profiles(id) on delete set null,
  description text not null default '',
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 1
);

create index if not exists idx_invoice_line_items_invoice_id on public.invoice_line_items(invoice_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  invoice_number text not null default '',
  client_id uuid references public.clients(id) on delete set null,
  client_user_id uuid references public.profiles(id) on delete set null,
  client_name text not null default '',
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  method text not null default 'UPI',
  transaction_reference text not null default '',
  verification_mode text not null default 'Admin Recorded',
  payment_date text not null default '',
  notes text not null default '',
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_client_user_id on public.payments(client_user_id);

-- ============================================================================
-- 10. PROJECT MESSAGES, NOTIFICATIONS, SETTINGS & ACTIVITY LOGS
-- ============================================================================
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_user_id uuid references public.profiles(id) on delete set null,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null default '',
  sender_role text not null default 'client',
  content text not null default '',
  visibility text not null default 'client',
  read_by_admin boolean not null default false,
  read_by_client boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_messages_project_id on public.project_messages(project_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default '',
  title text not null default '',
  message text not null default '',
  link text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications(recipient_user_id, created_at desc);

create table if not exists public.public_settings (
  id text primary key default 'default' check (id = 'default'),
  business_name text not null default 'Prithvi Editify',
  owner_name text not null default 'Shankar Baluragi',
  tagline text not null default 'Professional design and video editing for brands, creators, and growing businesses.',
  business_email text not null default 'shankarbaluragi066@gmail.com',
  whatsapp_number text not null default '',
  whatsapp_default_message text not null default 'Hello Prithvi Editify, I would like to discuss a design or video editing project.',
  website_url text not null default '',
  business_address text not null default '',
  default_currency text not null default 'INR',
  portfolio_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.private_settings (
  id text primary key default 'default' check (id = 'default'),
  invoice_prefix text not null default 'PE-INV',
  default_payment_terms text not null default '50% advance to initiate project scope; 50% upon final review approval prior to master file handoff.',
  default_payment_instructions text not null default 'Pay via UPI or Bank Transfer (NEFT/IMPS). Share the UTR/Transaction Reference ID in your client portal or with Shankar Baluragi for verification.',
  default_tax_rate numeric(5,2) not null default 0,
  enable_email_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_uid uuid references public.profiles(id) on delete set null,
  actor_email text not null default '',
  action text not null default '',
  entity_type text not null default '',
  entity_id text not null default '',
  details text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 11. ENABLE ROW LEVEL SECURITY (RLS) & GRANT PERMISSIONS ON ALL TABLES
-- ============================================================================
grant usage on schema public to public, anon, authenticated, service_role;
grant execute on all functions in schema public to public, anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.portfolio enable row level security;
alter table public.inquiries enable row level security;
alter table public.projects enable row level security;
alter table public.project_internal_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.files enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments enable row level security;
alter table public.project_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.public_settings enable row level security;
alter table public.private_settings enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles Policies
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id and (role = 'client' or public.is_admin()));

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated using (auth.uid() = id or public.is_admin());

-- Clients Policies
drop policy if exists "clients_select_own_or_admin" on public.clients;
create policy "clients_select_own_or_admin" on public.clients
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "clients_admin_write" on public.clients;
create policy "clients_admin_write" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Services Policies (Public read published without invoking is_admin; Admin full CRUD)
drop policy if exists "services_public_read_published" on public.services;
create policy "services_public_read_published" on public.services
  for select using (published = true);

drop policy if exists "services_admin_write" on public.services;
create policy "services_admin_write" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Portfolio Policies (Public read published without invoking is_admin; Admin full CRUD)
drop policy if exists "portfolio_public_read_published" on public.portfolio;
create policy "portfolio_public_read_published" on public.portfolio
  for select using (published = true);

drop policy if exists "portfolio_admin_write" on public.portfolio;
create policy "portfolio_admin_write" on public.portfolio
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Inquiries Policies (Visitors can insert 'New' inquiries; only Admin can read/update/delete)
drop policy if exists "inquiries_public_insert" on public.inquiries;
create policy "inquiries_public_insert" on public.inquiries
  for insert with check (status = 'New' and privacy_consent = true);

drop policy if exists "inquiries_admin_all" on public.inquiries;
create policy "inquiries_admin_all" on public.inquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Projects Policies
drop policy if exists "projects_select_client_or_admin" on public.projects;
create policy "projects_select_client_or_admin" on public.projects
  for select to authenticated using (client_user_id = auth.uid() or public.is_admin());

drop policy if exists "projects_client_update_review" on public.projects;
create policy "projects_client_update_review" on public.projects
  for update to authenticated using (client_user_id = auth.uid() and status not in ('Completed', 'Cancelled'))
  with check (client_user_id = auth.uid() and status in ('Revision Requested', 'Completed', 'In Review'));

drop policy if exists "projects_admin_all" on public.projects;
create policy "projects_admin_all" on public.projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Project Internal Notes Policies (Strictly Admin Only)
drop policy if exists "project_internal_notes_admin_only" on public.project_internal_notes;
create policy "project_internal_notes_admin_only" on public.project_internal_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tasks Policies
drop policy if exists "tasks_select_client_visible_or_admin" on public.tasks;
create policy "tasks_select_client_visible_or_admin" on public.tasks
  for select to authenticated using ((client_user_id = auth.uid() and visibility = 'client') or public.is_admin());

drop policy if exists "tasks_admin_all" on public.tasks;
create policy "tasks_admin_all" on public.tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Deliverable Files Policies
drop policy if exists "files_select_client_visible_or_admin" on public.files;
create policy "files_select_client_visible_or_admin" on public.files
  for select to authenticated using ((client_user_id = auth.uid() and visibility = 'client') or public.is_admin());

drop policy if exists "files_client_insert_reference" on public.files;
create policy "files_client_insert_reference" on public.files
  for insert to authenticated with check (
    client_user_id = auth.uid()
    and uploaded_by = auth.uid()
    and category = 'Reference'
    and visibility = 'client'
  );

drop policy if exists "files_admin_all" on public.files;
create policy "files_admin_all" on public.files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Invoices & Line Items Policies
drop policy if exists "invoices_select_client_or_admin" on public.invoices;
create policy "invoices_select_client_or_admin" on public.invoices
  for select to authenticated using ((client_user_id = auth.uid() and status <> 'Draft') or public.is_admin());

drop policy if exists "invoices_admin_all" on public.invoices;
create policy "invoices_admin_all" on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "invoice_line_items_select_client_or_admin" on public.invoice_line_items;
create policy "invoice_line_items_select_client_or_admin" on public.invoice_line_items
  for select to authenticated using (client_user_id = auth.uid() or public.is_admin());

drop policy if exists "invoice_line_items_admin_all" on public.invoice_line_items;
create policy "invoice_line_items_admin_all" on public.invoice_line_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Payments Policies
drop policy if exists "payments_select_client_or_admin" on public.payments;
create policy "payments_select_client_or_admin" on public.payments
  for select to authenticated using (client_user_id = auth.uid() or public.is_admin());

drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Project Messages Policies
drop policy if exists "project_messages_select_client_or_admin" on public.project_messages;
create policy "project_messages_select_client_or_admin" on public.project_messages
  for select to authenticated using ((client_user_id = auth.uid() and visibility = 'client') or public.is_admin());

drop policy if exists "project_messages_client_insert" on public.project_messages;
create policy "project_messages_client_insert" on public.project_messages
  for insert to authenticated with check (
    client_user_id = auth.uid()
    and sender_id = auth.uid()
    and sender_role = 'client'
    and visibility = 'client'
  );

drop policy if exists "project_messages_admin_all" on public.project_messages;
create policy "project_messages_admin_all" on public.project_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifications Policies
drop policy if exists "notifications_select_recipient_or_admin" on public.notifications;
create policy "notifications_select_recipient_or_admin" on public.notifications
  for select to authenticated using (recipient_user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_update_recipient" on public.notifications;
create policy "notifications_update_recipient" on public.notifications
  for update to authenticated using (recipient_user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_authenticated" on public.notifications
  for insert to authenticated with check (auth.uid() is not null);

-- Settings Policies
drop policy if exists "public_settings_read_all" on public.public_settings;
create policy "public_settings_read_all" on public.public_settings
  for select using (true);

drop policy if exists "public_settings_admin_write" on public.public_settings;
create policy "public_settings_admin_write" on public.public_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "private_settings_admin_only" on public.private_settings;
create policy "private_settings_admin_only" on public.private_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Activity Logs Policies
drop policy if exists "activity_logs_admin_select" on public.activity_logs;
create policy "activity_logs_admin_select" on public.activity_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "activity_logs_admin_insert" on public.activity_logs;
create policy "activity_logs_admin_insert" on public.activity_logs
  for insert to authenticated with check (public.is_admin());

-- ============================================================================
-- 12. ADVANCED MEDIA ASSETS TABLE & EXTENDED MEDIA COLUMNS
-- ============================================================================
alter table public.services add column if not exists video_preview_url text not null default '';
alter table public.services add column if not exists media_urls jsonb not null default '[]'::jsonb;

alter table public.portfolio add column if not exists video_url text not null default '';
alter table public.portfolio add column if not exists media_type text not null default 'image';
alter table public.portfolio add column if not exists gallery_urls jsonb not null default '[]'::jsonb;
alter table public.portfolio add column if not exists tags text[] not null default '{}';

alter table public.files add column if not exists storage_bucket text not null default 'private-project-files';
alter table public.files add column if not exists description text not null default '';
alter table public.files add column if not exists tags text[] not null default '{}';

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  original_filename text not null default '',
  storage_bucket text not null default 'portfolio-media' check (
    storage_bucket in (
      'portfolio-media',
      'service-media',
      'private-project-files',
      'project-files',
      'public-assets',
      'inquiry-references'
    )
  ),
  storage_path text not null default '',
  public_url text not null default '',
  mime_type text not null default 'application/octet-stream',
  file_extension text not null default '',
  media_category text not null default 'image' check (
    media_category in ('image', 'video', 'pdf', 'document')
  ),
  file_size bigint not null default 0,
  width integer,
  height integer,
  duration_seconds numeric(10,2),
  description text not null default '',
  tags text[] not null default '{}',
  is_public boolean not null default true,
  service_id uuid references public.services(id) on delete set null,
  portfolio_id uuid references public.portfolio(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_user_id uuid references public.profiles(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploader_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_assets_bucket on public.media_assets(storage_bucket);
create index if not exists idx_media_assets_category on public.media_assets(media_category);
create index if not exists idx_media_assets_project on public.media_assets(project_id);
create index if not exists idx_media_assets_client_user on public.media_assets(client_user_id);
create index if not exists idx_media_assets_created_at on public.media_assets(created_at desc);

alter table public.media_assets enable row level security;
grant select, insert, update, delete on public.media_assets to anon, authenticated, service_role;

drop policy if exists "media_assets_public_read" on public.media_assets;
create policy "media_assets_public_read" on public.media_assets
  for select using (
    is_public = true
    and storage_bucket in ('portfolio-media', 'service-media', 'public-assets')
  );

drop policy if exists "media_assets_client_read_own" on public.media_assets;
create policy "media_assets_client_read_own" on public.media_assets
  for select to authenticated using (
    client_user_id = auth.uid() or public.is_admin()
  );

drop policy if exists "media_assets_admin_all" on public.media_assets;
create policy "media_assets_admin_all" on public.media_assets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- 13. SUPABASE STORAGE BUCKETS & STORAGE RLS POLICIES
-- ============================================================================
-- 1. portfolio-media: approved public portfolio media (public read, admin write)
-- 2. service-media: approved service images and examples (public read, admin write)
-- 3. private-project-files: private client documents and deliverables (private, signed URLs)
insert into storage.buckets (id, name, public)
values
  ('portfolio-media', 'portfolio-media', true),
  ('service-media', 'service-media', true),
  ('private-project-files', 'private-project-files', false),
  ('public-assets', 'public-assets', true),
  ('inquiry-references', 'inquiry-references', true),
  ('project-files', 'project-files', true)
on conflict (id) do update set
  public = excluded.public;

-- Portfolio Media Bucket Policies (Public Read, Admin Write/Update/Delete)
drop policy if exists "portfolio_media_public_read" on storage.objects;
create policy "portfolio_media_public_read" on storage.objects
  for select using (bucket_id = 'portfolio-media');

drop policy if exists "portfolio_media_admin_insert" on storage.objects;
create policy "portfolio_media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'portfolio-media' and public.is_admin());

drop policy if exists "portfolio_media_admin_update" on storage.objects;
create policy "portfolio_media_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'portfolio-media' and public.is_admin());

drop policy if exists "portfolio_media_admin_delete" on storage.objects;
create policy "portfolio_media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio-media' and public.is_admin());

-- Service Media Bucket Policies (Public Read, Admin Write/Update/Delete)
drop policy if exists "service_media_public_read" on storage.objects;
create policy "service_media_public_read" on storage.objects
  for select using (bucket_id = 'service-media');

drop policy if exists "service_media_admin_insert" on storage.objects;
create policy "service_media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'service-media' and public.is_admin());

drop policy if exists "service_media_admin_update" on storage.objects;
create policy "service_media_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'service-media' and public.is_admin());

drop policy if exists "service_media_admin_delete" on storage.objects;
create policy "service_media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'service-media' and public.is_admin());

-- Private Project Files Bucket Policies (Strictly Private — Admin & Authorized Authenticated Access)
drop policy if exists "private_project_files_select" on storage.objects;
create policy "private_project_files_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'private-project-files'
    and (
      public.is_admin()
      or exists (
        select 1 from public.files f
        where f.storage_path = storage.objects.name
          and f.client_user_id = auth.uid()
          and f.visibility = 'client'
      )
      or exists (
        select 1 from public.media_assets m
        where m.storage_path = storage.objects.name
          and m.client_user_id = auth.uid()
      )
    )
  );

drop policy if exists "private_project_files_admin_insert" on storage.objects;
create policy "private_project_files_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'private-project-files' and public.is_admin());

drop policy if exists "private_project_files_admin_update" on storage.objects;
create policy "private_project_files_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'private-project-files' and public.is_admin());

drop policy if exists "private_project_files_admin_delete" on storage.objects;
create policy "private_project_files_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'private-project-files' and public.is_admin());

-- Legacy Buckets Policies
drop policy if exists "public_assets_read" on storage.objects;
create policy "public_assets_read" on storage.objects
  for select using (bucket_id = 'public-assets');

drop policy if exists "public_assets_admin_write" on storage.objects;
create policy "public_assets_admin_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'public-assets' and public.is_admin());

drop policy if exists "inquiry_references_insert" on storage.objects;
create policy "inquiry_references_insert" on storage.objects
  for insert with check (bucket_id = 'inquiry-references');

drop policy if exists "inquiry_references_read" on storage.objects;
create policy "inquiry_references_read" on storage.objects
  for select using (bucket_id = 'inquiry-references');

drop policy if exists "project_files_authenticated_read" on storage.objects;
create policy "project_files_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id = 'project-files' and auth.uid() is not null);

drop policy if exists "project_files_authenticated_insert" on storage.objects;
create policy "project_files_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-files' and auth.uid() is not null);

drop policy if exists "project_files_admin_delete" on storage.objects;
create policy "project_files_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'project-files' and public.is_admin());

-- Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
