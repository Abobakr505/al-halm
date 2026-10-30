alter table public.store_settings
  add column if not exists facebook_url text not null default '';
