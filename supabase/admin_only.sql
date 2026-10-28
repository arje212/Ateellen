-- Run this once if you already ran schema.sql earlier.
-- Makes the system ADMIN-ONLY: only profiles with role = 'admin' can read/write data.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
