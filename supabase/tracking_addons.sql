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
