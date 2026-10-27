-- =====================================================================
--  Daddy's Sizzlers (Ateellen) — Supabase schema
--  Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
--  Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Common helpers
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;

create or replace function public.set_updated_date()
returns trigger language plpgsql as $$
begin
  new.updated_date = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Profiles (one row per auth user) + role system
--    roles: admin | user | pending
--    pending = signed up but NOT yet approved by an admin → no data access
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  full_name    text,
  role         text not null default 'pending',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text
);

-- Emails that an admin pre-approved from the "Invite User" button.
create table if not exists public.user_invites (
  email        text primary key,
  role         text not null default 'user',
  created_date timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','user'));
$$;

-- Auto-create a profile when someone signs up.
--   • the very first account becomes admin
--   • invited emails get the role chosen in the invite
--   • everybody else is 'pending' until an admin approves them (Users page)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  invited_role text;
  has_admin    boolean;
begin
  select exists (select 1 from public.profiles where role = 'admin') into has_admin;
  select role into invited_role from public.user_invites where lower(email) = lower(new.email);

  insert into public.profiles (id, email, full_name, role, created_by)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
             nullif(new.raw_user_meta_data ->> 'name', ''),
             split_part(new.email, '@', 1)),
    case when not has_admin then 'admin'
         when invited_role is not null then invited_role
         else 'pending' end,
    new.email
  )
  on conflict (id) do nothing;

  delete from public.user_invites where lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill profiles for any users that already exist (first one → admin).
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1
                 and not exists (select 1 from public.profiles where role = 'admin')
            then 'admin' else 'pending' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------
-- 2. Business tables
--    id is TEXT on purpose: the menu uses readable ids like 'sizzlers'
--    and 'sizzler-pork-sisig'.
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  slug         text,
  description  text,
  sort_order   numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);

create table if not exists public.products (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  category_id   text,
  category_name text,
  description   text,
  price         numeric,                       -- NULL = "price not listed" (made-to-order)
  variants      jsonb not null default '[]'::jsonb,
  image_url     text,
  active        boolean not null default true,
  sort_order    numeric not null default 0,
  serves_with   text,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by    text default (auth.jwt() ->> 'email')
);

create table if not exists public.app_settings (
  id              text primary key default gen_random_uuid()::text,
  restaurant_name text not null default 'Daddy''s Sizzlers',
  logo_url        text,
  address         text,
  phone           text,
  email           text,
  facebook_page   text,
  business_hours  text,
  currency        text default 'PHP',
  timezone        text default 'Asia/Manila',
  created_date    timestamptz not null default now(),
  updated_date    timestamptz not null default now(),
  created_by      text default (auth.jwt() ->> 'email')
);

create table if not exists public.restaurant_tables (
  id                   text primary key default gen_random_uuid()::text,
  table_number         text not null,
  seats                numeric not null default 4,
  status               text not null default 'available',
  current_order_id     text,
  current_order_number text,
  current_amount       numeric not null default 0,
  time_occupied        timestamptz,
  customers            numeric not null default 0,
  location             text,
  created_date         timestamptz not null default now(),
  updated_date         timestamptz not null default now(),
  created_by           text default (auth.jwt() ->> 'email')
);

create table if not exists public.orders (
  id               text primary key default gen_random_uuid()::text,
  order_number     text not null,
  order_type       text not null default 'dine_in',
  status           text not null default 'new',
  table_number     text,
  customer_name    text,
  customer_phone   text,
  delivery_address text,
  delivery_notes   text,
  notes            text,
  items            jsonb not null default '[]'::jsonb,
  subtotal         numeric not null default 0,
  discount_id      text,
  discount_name    text,
  discount_amount  numeric not null default 0,
  total            numeric not null default 0,
  payment_method   text not null default 'cash',
  amount_paid      numeric not null default 0,
  "change"         numeric not null default 0,
  payment_status   text not null default 'unpaid',
  cashier_id       text,
  cashier_name     text,
  source           text not null default 'pos',
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now(),
  created_by       text default (auth.jwt() ->> 'email')
);

create table if not exists public.customers (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  phone          text,
  email          text,
  address        text,
  notes          text,
  total_orders   numeric not null default 0,
  total_spending numeric not null default 0,
  created_date   timestamptz not null default now(),
  updated_date   timestamptz not null default now(),
  created_by     text default (auth.jwt() ->> 'email')
);

create table if not exists public.discounts (
  id               text primary key default gen_random_uuid()::text,
  name             text not null,
  type             text not null default 'percentage',
  value            numeric not null default 0,
  start_date       date,
  end_date         date,
  minimum_purchase numeric not null default 0,
  maximum_discount numeric not null default 0,
  active           boolean not null default true,
  created_date     timestamptz not null default now(),
  updated_date     timestamptz not null default now(),
  created_by       text default (auth.jwt() ->> 'email')
);

create table if not exists public.expenses (
  id           text primary key default gen_random_uuid()::text,
  expense_date date not null default current_date,
  category     text not null default 'other',
  amount       numeric not null default 0,
  description  text,
  paid_by      text,
  receipt_url  text,
  notes        text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);

create table if not exists public.suppliers (
  id                text primary key default gen_random_uuid()::text,
  name              text not null,
  contact_person    text,
  phone             text,
  email             text,
  address           text,
  products_supplied text,
  notes             text,
  created_date      timestamptz not null default now(),
  updated_date      timestamptz not null default now(),
  created_by        text default (auth.jwt() ->> 'email')
);

create table if not exists public.inventory_items (
  id              text primary key default gen_random_uuid()::text,
  name            text not null,
  category        text,
  unit            text not null default 'pcs',
  current_stock   numeric not null default 0,
  minimum_stock   numeric not null default 0,
  cost_per_unit   numeric not null default 0,
  supplier        text,
  expiration_date date,
  status          text not null default 'in_stock',
  created_date    timestamptz not null default now(),
  updated_date    timestamptz not null default now(),
  created_by      text default (auth.jwt() ->> 'email')
);

create table if not exists public.inventory_transactions (
  id           text primary key default gen_random_uuid()::text,
  item_id      text,
  item_name    text not null,
  type         text not null default 'stock_in',
  quantity     numeric not null default 0,
  unit         text,
  reason       text,
  user_name    text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);

create table if not exists public.cashier_shifts (
  id            text primary key default gen_random_uuid()::text,
  cashier_name  text not null,
  opening_cash  numeric not null default 0,
  opened_at     timestamptz,
  closed_at     timestamptz,
  status        text not null default 'open',
  total_sales   numeric not null default 0,
  total_orders  numeric not null default 0,
  cash_sales    numeric not null default 0,
  digital_sales numeric not null default 0,
  expected_cash numeric not null default 0,
  actual_cash   numeric not null default 0,
  difference    numeric not null default 0,
  created_date  timestamptz not null default now(),
  updated_date  timestamptz not null default now(),
  created_by    text default (auth.jwt() ->> 'email')
);

create table if not exists public.audit_logs (
  id             text primary key default gen_random_uuid()::text,
  user_name      text,
  action         text not null,
  module         text not null,
  description    text,
  previous_value text,
  new_value      text,
  created_date   timestamptz not null default now(),
  updated_date   timestamptz not null default now(),
  created_by     text default (auth.jwt() ->> 'email')
);

create table if not exists public.app_notifications (
  id           text primary key default gen_random_uuid()::text,
  type         text not null,
  title        text not null,
  message      text,
  module       text,
  "read"       boolean not null default false,
  related_id   text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);

-- Indexes used by the dashboard / reports / kitchen screens
create index if not exists idx_orders_created   on public.orders (created_date desc);
create index if not exists idx_orders_status    on public.orders (status);
create index if not exists idx_orders_number    on public.orders (order_number);
create index if not exists idx_expenses_date    on public.expenses (expense_date);
create index if not exists idx_notif_read       on public.app_notifications ("read", created_date desc);
create index if not exists idx_products_cat     on public.products (category_id);

-- updated_date trigger on every table
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','products','app_settings','restaurant_tables','orders','customers',
    'discounts','expenses','suppliers','inventory_items','inventory_transactions',
    'cashier_shifts','audit_logs','app_notifications'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                    for each row execute function public.set_updated_date()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Order-number helper (works for the public /order page too, because
--    anonymous visitors are NOT allowed to read the orders table).
-- ---------------------------------------------------------------------
create or replace function public.count_orders_with_prefix(prefix text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.orders where order_number like prefix || '%';
$$;

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_invites','categories','products','app_settings','restaurant_tables','orders',
    'customers','discounts','expenses','suppliers','inventory_items','inventory_transactions',
    'cashier_shifts','audit_logs','app_notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: see yourself (admins see everyone); only admins change roles
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- invites: admins only
drop policy if exists "invites admin" on public.user_invites;
create policy "invites admin" on public.user_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- PUBLIC menu (landing page + online ordering page): anyone can read
drop policy if exists "categories read"  on public.categories;
drop policy if exists "categories write" on public.categories;
create policy "categories read"  on public.categories for select to anon, authenticated using (true);
create policy "categories write" on public.categories for all    to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "products read"  on public.products;
drop policy if exists "products write" on public.products;
create policy "products read"  on public.products for select to anon, authenticated
  using (active or public.is_staff());
create policy "products write" on public.products for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "settings read"  on public.app_settings;
drop policy if exists "settings write" on public.app_settings;
create policy "settings read"  on public.app_settings for select to anon, authenticated using (true);
create policy "settings write" on public.app_settings for all    to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- PUBLIC online ordering: visitors may only INSERT a brand-new unpaid online order
-- (they can never read, edit or delete orders).
drop policy if exists "orders public insert" on public.orders;
create policy "orders public insert" on public.orders for insert to anon, authenticated
  with check (source = 'online' and status = 'new' and payment_status = 'unpaid');

drop policy if exists "notif public insert" on public.app_notifications;
create policy "notif public insert" on public.app_notifications for insert to anon, authenticated
  with check (type = 'new_order');

-- STAFF (admin + approved user): full access to the operational tables
do $$
declare t text;
begin
  foreach t in array array[
    'orders','restaurant_tables','customers','discounts','expenses','suppliers',
    'inventory_items','inventory_transactions','cashier_shifts','audit_logs','app_notifications'
  ] loop
    execute format('drop policy if exists "staff all" on public.%I', t);
    execute format('create policy "staff all" on public.%I for all to authenticated
                    using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Grants + Realtime (Kitchen screen live updates)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on function public.count_orders_with_prefix(text) to anon, authenticated;

do $$ begin alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.app_notifications;
exception when duplicate_object then null; end $$;
