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
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');  -- ADMIN-ONLY system
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
-- =====================================================================
--  Order tracking + Add-ons (extra rice, etc.)
--  Run ONCE in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

-- 1) Add-ons table (managed in Admin → Menu → Add-ons)
create table if not exists public.addons (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  price        numeric not null default 0,
  active       boolean not null default true,
  sort_order   numeric not null default 0,
  category_ids jsonb not null default '[]'::jsonb,   -- [] = shows on every dish
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by   text default (auth.jwt() ->> 'email')
);

drop trigger if exists trg_addons_updated on public.addons;
create trigger trg_addons_updated before update on public.addons
  for each row execute function public.set_updated_date();

alter table public.addons enable row level security;

drop policy if exists "addons read"  on public.addons;
drop policy if exists "addons write" on public.addons;
create policy "addons read"  on public.addons for select to anon, authenticated
  using (active or public.is_staff());
create policy "addons write" on public.addons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.addons to anon, authenticated;

-- starter add-on (change the price in Admin → Menu → Add-ons)
insert into public.addons (id, name, price, sort_order)
values ('extra-rice', 'Extra Rice', 25, 0)
on conflict (id) do nothing;

-- 2) Customer order tracking.
--    Visitors can NOT read the orders table, so this function returns ONE order
--    (limited fields only) when they know either:
--      • the order's secret id (from the tracking link), or
--      • the order number + the phone number used when ordering.
create or replace function public.track_order(
  p_id     text default null,
  p_number text default null,
  p_phone  text default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.orders;
  phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if p_id is not null and length(trim(p_id)) > 0 then
    select * into r from public.orders where id = trim(p_id);
  elsif p_number is not null and length(phone_digits) >= 7 then
    select * into r from public.orders
     where upper(order_number) = upper(trim(p_number))
       and regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g') = phone_digits
     order by created_date desc limit 1;
  end if;

  if r.id is null then return null; end if;

  return jsonb_build_object(
    'id', r.id, 'order_number', r.order_number, 'status', r.status,
    'order_type', r.order_type, 'table_number', r.table_number,
    'items', r.items, 'subtotal', r.subtotal, 'total', r.total,
    'payment_status', r.payment_status,
    'created_date', r.created_date, 'updated_date', r.updated_date
  );
end $$;

grant execute on function public.track_order(text, text, text) to anon, authenticated;
-- =====================================================================
--  GO-LIVE PACK  —  run ONCE in Supabase → SQL Editor (safe to re-run)
--  Run AFTER schema.sql, admin_only.sql and tracking_addons.sql.
--
--  1. Open/Closed switch + store hours
--  2. "Sold out" per dish
--  3. Anti-spam / anti-tampering for online orders (server re-prices everything)
--  4. Delivery fee, minimum order
--  5. Manual GCash / Maya payment (reference number)
--  6. Customer can cancel while order is still "new"
--  7. Privacy consent
--  8. Auto-deduct inventory (recipes) + low-stock alerts
--  9. Cashier role (POS / Orders / Kitchen / Tables only)
-- =====================================================================

-- ---------- columns -------------------------------------------------
alter table public.app_settings
  add column if not exists online_ordering_enabled boolean not null default true,
  add column if not exists auto_schedule           boolean not null default false,
  add column if not exists open_time               text default '10:00',
  add column if not exists close_time              text default '22:00',
  add column if not exists closed_message          text,
  add column if not exists estimated_time          text default '15–25 mins',
  add column if not exists delivery_fee            numeric not null default 0,
  add column if not exists free_delivery_over      numeric not null default 0,
  add column if not exists min_order_amount        numeric not null default 0,
  add column if not exists delivery_areas          text,
  add column if not exists gcash_number            text,
  add column if not exists gcash_name              text,
  add column if not exists gcash_qr_url            text,
  add column if not exists maya_number             text,
  add column if not exists maya_name               text;

alter table public.products
  add column if not exists sold_out boolean not null default false,
  add column if not exists recipe   jsonb   not null default '[]'::jsonb;   -- [{item_id, qty}] per 1 serving

alter table public.orders
  add column if not exists delivery_fee      numeric not null default 0,
  add column if not exists payment_reference text,
  add column if not exists cancel_reason     text,
  add column if not exists privacy_consent   boolean not null default false,
  add column if not exists stock_deducted    boolean not null default false;

-- ---------- 1. open / closed ----------------------------------------
create or replace function public.is_ordering_open()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  s public.app_settings;
  t time; o time; c time;
begin
  select * into s from public.app_settings order by created_date desc limit 1;
  if s.id is null then return true; end if;
  if not coalesce(s.online_ordering_enabled, true) then return false; end if;
  if coalesce(s.auto_schedule, false) then
    t := (now() at time zone coalesce(nullif(s.timezone, ''), 'Asia/Manila'))::time;
    o := coalesce(nullif(s.open_time, ''),  '10:00')::time;
    c := coalesce(nullif(s.close_time, ''), '22:00')::time;
    if o <= c then return t >= o and t < c;
    else return t >= o or t < c;           -- overnight hours, e.g. 18:00 → 02:00
    end if;
  end if;
  return true;
end $$;
grant execute on function public.is_ordering_open() to anon, authenticated;

-- ---------- 3/4/5/7. guard every ONLINE order -----------------------
-- Visitors can only INSERT online orders. This trigger re-checks everything on
-- the server: prices come from the database (not the browser), sold-out dishes
-- are refused, delivery fee is added, spam is throttled, order number is assigned.
create or replace function public.orders_online_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.app_settings;
  it jsonb; ad jsonb; v jsonb;
  prod public.products; addon public.addons;
  new_items jsonb := '[]'::jsonb; line_addons jsonb;
  qty int; aq int; unit numeric; base numeric; sub numeric := 0; seq int;
  ph text := regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g');
  today text := to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD');
begin
  if new.source is distinct from 'online' then return new; end if;

  select * into s from public.app_settings order by created_date desc limit 1;

  if not public.is_ordering_open() then
    raise exception '%', coalesce(nullif(s.closed_message, ''), 'Sorry, we are not accepting online orders right now.');
  end if;

  if not coalesce(new.privacy_consent, false) then
    raise exception 'Please agree to the Privacy Notice to place your order.';
  end if;

  if jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) = 0
     or jsonb_array_length(new.items) > 40 then
    raise exception 'Your cart is empty or too large.';
  end if;

  if new.order_type not in ('dine_in', 'takeout', 'delivery') then new.order_type := 'takeout'; end if;
  if new.order_type <> 'dine_in' and (length(ph) < 7 or length(ph) > 15) then
    raise exception 'Please enter a valid contact number.';
  end if;
  if new.order_type = 'delivery' and length(trim(coalesce(new.delivery_address, ''))) < 5 then
    raise exception 'Please enter your delivery address.';
  end if;
  if new.order_type = 'dine_in' and length(trim(coalesce(new.table_number, ''))) = 0 then
    raise exception 'Please select a table.';
  end if;

  new.customer_name    := left(coalesce(new.customer_name, ''), 100);
  new.delivery_address := left(coalesce(new.delivery_address, ''), 300);
  new.delivery_notes   := left(coalesce(new.delivery_notes, ''), 300);
  new.notes            := left(coalesce(new.notes, ''), 300);

  -- anti-spam: serialize so counters are exact
  perform pg_advisory_xact_lock(hashtext('online_order_guard'));

  if length(ph) >= 7 and (
       select count(*) from public.orders
        where source = 'online' and created_date > now() - interval '1 hour'
          and regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g') = ph) >= 5 then
    raise exception 'Too many orders from this number. Please wait a while or call us.';
  end if;
  if (select count(*) from public.orders
       where source = 'online' and created_date > now() - interval '10 minutes') >= 60 then
    raise exception 'We are very busy right now. Please try again in a few minutes.';
  end if;
  if new.order_type = 'dine_in' and (
       select count(*) from public.orders
        where source = 'online' and order_type = 'dine_in' and table_number = new.table_number
          and created_date > now() - interval '10 minutes') >= 3 then
    raise exception 'This table already has several pending orders. Please ask our staff.';
  end if;

  -- re-price every line from the database
  for it in select value from jsonb_array_elements(new.items) loop
    qty := greatest(1, least(50, coalesce(nullif(it ->> 'quantity', '')::int, 1)));
    select * into prod from public.products where id = it ->> 'product_id';
    if prod.id is null or not prod.active then
      raise exception 'An item in your cart is no longer available. Please refresh the page.';
    end if;
    if prod.sold_out then raise exception '% is sold out.', prod.name; end if;

    base := null;
    if coalesce(it ->> 'variant', '') <> '' then
      select (x ->> 'price')::numeric into base
        from jsonb_array_elements(prod.variants) x where x ->> 'name' = it ->> 'variant' limit 1;
      if base is null then raise exception 'Invalid size selected for %.', prod.name; end if;
    else
      base := prod.price;
      if base is null then raise exception '% cannot be ordered online. Please ask in store.', prod.name; end if;
    end if;

    unit := base;
    line_addons := '[]'::jsonb;
    for ad in select value from jsonb_array_elements(coalesce(it -> 'addons', '[]'::jsonb)) loop
      aq := greatest(0, least(10, coalesce(nullif(ad ->> 'quantity', '')::int, 0)));
      continue when aq = 0;
      select * into addon from public.addons where id = ad ->> 'id' and active;
      if addon.id is null then raise exception 'An add-on is no longer available. Please refresh the page.'; end if;
      unit := unit + addon.price * aq;
      line_addons := line_addons || jsonb_build_object('id', addon.id, 'name', addon.name, 'price', addon.price, 'quantity', aq);
    end loop;

    new_items := new_items || jsonb_build_object(
      'key', left(coalesce(it ->> 'key', ''), 200),
      'product_id', prod.id,
      'name', prod.name || case when coalesce(it ->> 'variant', '') <> '' then ' (' || (it ->> 'variant') || ')' else '' end,
      'price', unit, 'quantity', qty,
      'variant', coalesce(it ->> 'variant', ''),
      'addons', line_addons,
      'notes', left(coalesce(it ->> 'notes', ''), 200),
      'subtotal', unit * qty);
    sub := sub + unit * qty;
  end loop;

  if coalesce(s.min_order_amount, 0) > sub then
    raise exception 'Minimum order is ₱%.', s.min_order_amount;
  end if;

  new.delivery_fee := case
    when new.order_type = 'delivery'
         and not (coalesce(s.free_delivery_over, 0) > 0 and sub >= s.free_delivery_over)
    then coalesce(s.delivery_fee, 0) else 0 end;

  new.items := new_items;
  new.subtotal := sub;
  new.discount_id := null; new.discount_name := null; new.discount_amount := 0;
  new.total := sub + new.delivery_fee;
  new.status := 'new'; new.payment_status := 'unpaid';
  new.amount_paid := 0; new."change" := 0;
  new.cashier_id := null; new.cashier_name := null;

  if new.payment_method not in ('cash', 'gcash', 'maya') then new.payment_method := 'cash'; end if;
  new.payment_reference := left(trim(coalesce(new.payment_reference, '')), 60);
  if new.payment_method in ('gcash', 'maya') and length(new.payment_reference) < 4 then
    raise exception 'Please enter the % reference number of your payment.', upper(new.payment_method);
  end if;

  -- order number assigned by the server (no duplicates)
  select coalesce(max(nullif(substring(order_number from '-(\d+)$'), '')::int), 0) + 1 into seq
    from public.orders where order_number like 'ORD-' || today || '-%';
  new.order_number := 'ORD-' || today || '-' || lpad(seq::text, 4, '0');

  return new;
end $$;

drop trigger if exists trg_orders_online_guard on public.orders;
create trigger trg_orders_online_guard before insert on public.orders
  for each row execute function public.orders_online_guard();

-- notify staff (server-side, so visitors never need write access to notifications)
create or replace function public.orders_notify_new()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'online' then
    insert into public.app_notifications (type, title, message, module, related_id)
    values ('new_order', 'New online order',
            new.order_number || ' · ' || coalesce(nullif(new.customer_name, ''), 'Table ' || coalesce(new.table_number, '?')),
            'kitchen', new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_notify_new on public.orders;
create trigger trg_orders_notify_new after insert on public.orders
  for each row execute function public.orders_notify_new();

-- visitors no longer insert notifications themselves
drop policy if exists "notif public insert" on public.app_notifications;

-- ---------- 6. customer cancel (only while still "new") -------------
create or replace function public.cancel_order(p_id text, p_reason text default 'Cancelled by customer')
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.orders;
begin
  update public.orders
     set status = 'cancelled', cancel_reason = left(coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer'), 200)
   where id = trim(p_id) and status = 'new'
   returning * into r;
  if r.id is null then return false; end if;
  insert into public.app_notifications (type, title, message, module, related_id)
  values ('order_cancelled', 'Order cancelled by customer', r.order_number || ' was cancelled', 'orders', r.id);
  return true;
end $$;
grant execute on function public.cancel_order(text, text) to anon, authenticated;

-- tracking now also returns payment + fee + cancel reason
create or replace function public.track_order(p_id text default null, p_number text default null, p_phone text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r public.orders;
  phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if p_id is not null and length(trim(p_id)) > 0 then
    select * into r from public.orders where id = trim(p_id);
  elsif p_number is not null and length(phone_digits) >= 7 then
    select * into r from public.orders
     where upper(order_number) = upper(trim(p_number))
       and regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g') = phone_digits
     order by created_date desc limit 1;
  end if;
  if r.id is null then return null; end if;
  return jsonb_build_object(
    'id', r.id, 'order_number', r.order_number, 'status', r.status,
    'order_type', r.order_type, 'table_number', r.table_number,
    'items', r.items, 'subtotal', r.subtotal, 'delivery_fee', r.delivery_fee, 'total', r.total,
    'payment_status', r.payment_status, 'payment_method', r.payment_method,
    'cancel_reason', r.cancel_reason,
    'created_date', r.created_date, 'updated_date', r.updated_date);
end $$;
grant execute on function public.track_order(text, text, text) to anon, authenticated;

-- ---------- 8. auto-deduct inventory when cooking starts ------------
create or replace function public.orders_deduct_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  it jsonb; rec jsonb; prod public.products; inv public.inventory_items;
  need numeric; qty numeric; newstock numeric;
begin
  if new.status in ('preparing', 'ready', 'served', 'completed') and not coalesce(new.stock_deducted, false) then
    for it in select value from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      qty := coalesce(nullif(it ->> 'quantity', '')::numeric, 1);
      select * into prod from public.products where id = it ->> 'product_id';
      continue when prod.id is null;
      for rec in select value from jsonb_array_elements(coalesce(prod.recipe, '[]'::jsonb)) loop
        need := coalesce(nullif(rec ->> 'qty', '')::numeric, 0) * qty;
        continue when need <= 0;
        select * into inv from public.inventory_items where id = rec ->> 'item_id' for update;
        continue when inv.id is null;
        newstock := greatest(0, inv.current_stock - need);
        update public.inventory_items
           set current_stock = newstock,
               status = case when newstock <= 0 then 'out_of_stock'
                             when newstock <= minimum_stock then 'low_stock' else 'in_stock' end
         where id = inv.id;
        insert into public.inventory_transactions (item_id, item_name, type, quantity, unit, reason, user_name)
        values (inv.id, inv.name, 'stock_out', need, inv.unit, 'Order ' || new.order_number, 'System');
        if newstock <= inv.minimum_stock then
          insert into public.app_notifications (type, title, message, module)
          values ('low_stock', 'Low stock alert', inv.name || ' at ' || newstock || ' ' || coalesce(inv.unit, ''), 'inventory');
        end if;
      end loop;
    end loop;
    new.stock_deducted := true;
  end if;
  return new;
end $$;
drop trigger if exists trg_orders_deduct_stock on public.orders;
create trigger trg_orders_deduct_stock before insert or update on public.orders
  for each row execute function public.orders_deduct_stock();

-- ---------- 9. cashier role -----------------------------------------
create or replace function public.is_cashier()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'cashier');
$$;
create or replace function public.is_ops()      -- admin OR cashier
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'cashier'));
$$;

do $$
declare t text;
begin
  foreach t in array array['orders','restaurant_tables','customers','cashier_shifts','audit_logs','app_notifications'] loop
    execute format('drop policy if exists "staff all" on public.%I', t);
    execute format('drop policy if exists "ops all" on public.%I', t);
    execute format('create policy "ops all" on public.%I for all to authenticated using (public.is_ops()) with check (public.is_ops())', t);
  end loop;
end $$;

drop policy if exists "discounts cashier read" on public.discounts;
create policy "discounts cashier read" on public.discounts for select to authenticated using (public.is_cashier());

grant execute on function public.is_cashier() to authenticated;
grant execute on function public.is_ops() to authenticated;
