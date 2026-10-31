alter table public.addresses
  add column if not exists map_url text;
