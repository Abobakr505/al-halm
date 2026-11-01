create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (user_id, variant_id)
);

create index stock_alerts_variant_pending_idx
  on public.stock_alerts (variant_id)
  where notified_at is null;

alter table public.stock_alerts enable row level security;

grant select, insert, update, delete on public.stock_alerts to authenticated;

create policy "Customers view own stock alerts"
  on public.stock_alerts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Customers subscribe to unavailable variants"
  on public.stock_alerts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and notified_at is null
    and exists (
      select 1
      from public.product_variants variant
      join public.products product on product.id = variant.product_id
      where variant.id = variant_id
        and variant.stock = 0
        and product.is_active
    )
  );

create policy "Customers renew own stock alerts"
  on public.stock_alerts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and notified_at is null
    and exists (
      select 1
      from public.product_variants variant
      join public.products product on product.id = variant.product_id
      where variant.id = variant_id
        and variant.stock = 0
        and product.is_active
    )
  );

create policy "Customers dismiss own stock alerts"
  on public.stock_alerts for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.notify_stock_alerts_on_restock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.stock = 0 and new.stock > 0 then
    update public.stock_alerts
      set notified_at = now()
      where variant_id = new.id
        and notified_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_stock_alerts_on_restock() from public;

create trigger product_variant_restock_notifies_customers
  after update of stock on public.product_variants
  for each row
  when (old.stock = 0 and new.stock > 0)
  execute function public.notify_stock_alerts_on_restock();
