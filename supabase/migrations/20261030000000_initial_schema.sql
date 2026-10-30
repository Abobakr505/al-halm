create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'admin');
create type public.order_status as enum (
  'received', 'awaiting_deposit_review', 'deposit_confirmed', 'preparing',
  'shipped', 'out_for_delivery', 'delivered', 'cancelled'
);
create type public.payment_status as enum ('awaiting_receipt', 'under_review', 'deposit_confirmed', 'rejected', 'paid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  fabric text,
  image_url text,
  image_path text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= price),
  category_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text,
  position integer not null default 0
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, size, color)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  region text not null,
  city text not null,
  address_line text not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'متجر الحلم',
  about_text text not null default 'في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة أيامك الجميلة.',
  deposit_type text not null default 'percentage' check (deposit_type in ('percentage', 'fixed')),
  deposit_value numeric(10,2) not null default 20 check (deposit_value >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  transfer_details text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  instagram_url text not null default '',
  return_policy text not null default 'للاستفسار عن الاستبدال والاسترجاع، تواصلي مع المتجر قبل إعادة المنتج. يجب أن يكون المنتج بحالته الأصلية.',
  privacy_policy text not null default 'نستخدم بياناتك لمعالجة الطلبات والتواصل بشأن التوصيل فقط. لا نبيع بيانات العملاء أو نشاركها لأغراض تسويقية.',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (true) on conflict (id) do nothing;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id),
  address_snapshot jsonb not null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  deposit_amount numeric(10,2) not null check (deposit_amount >= 0 and deposit_amount <= total),
  remaining_amount numeric(10,2) not null check (remaining_amount >= 0),
  status public.order_status not null default 'awaiting_deposit_review',
  payment_status public.payment_status not null default 'awaiting_receipt',
  customer_note text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  size text not null,
  color text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  review_note text,
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index products_category_active_idx on public.products (category_id, is_active, created_at desc);
create index product_variants_product_idx on public.product_variants (product_id);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index receipts_order_idx on public.payment_receipts (order_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;

create or replace function public.prevent_profile_email_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
    and coalesce(current_setting('app.profile_email_sync', true), '') <> 'true'
    and not (select public.is_admin()) then
    raise exception 'حدّثي البريد الإلكتروني من إعدادات الحساب الآمنة';
  end if;
  return new;
end;
$$;

create trigger profile_email_is_managed_by_auth
  before update on public.profiles
  for each row execute procedure public.prevent_profile_email_change();

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.profile_email_sync', 'true', true);
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure public.sync_profile_email();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'cancelled'::public.order_status
    and new.status is distinct from old.status then
    raise exception 'لا يمكن إعادة فتح طلب ملغى';
  end if;
  if new.status = 'cancelled'::public.order_status
    and old.status = 'delivered'::public.order_status then
    raise exception 'لا يمكن إلغاء طلب تم تسليمه';
  end if;
  if new.status = 'cancelled'::public.order_status
    and old.status is distinct from 'cancelled'::public.order_status then
    update public.product_variants variant
      set stock = variant.stock + item.quantity
      from (
        select variant_id, sum(quantity)::integer as quantity
        from public.order_items
        where order_id = old.id and variant_id is not null
        group by variant_id
      ) item
      where item.variant_id = variant.id;
  end if;
  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, (select auth.uid()));
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger order_status_changed
  before update on public.orders
  for each row execute procedure public.record_order_status_change();

create or replace function public.create_order(
  p_address jsonb,
  p_items jsonb,
  p_customer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(10,2) := 0;
  v_total numeric(10,2);
  v_delivery numeric(10,2);
  v_deposit numeric(10,2);
  v_setting public.store_settings%rowtype;
begin
  if v_user_id is null then raise exception 'يجب تسجيل الدخول لإنشاء الطلب'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'السلة فارغة';
  end if;
  if jsonb_typeof(p_address) <> 'object'
    or nullif(trim(p_address ->> 'recipient_name'), '') is null
    or nullif(trim(p_address ->> 'phone'), '') is null
    or nullif(trim(p_address ->> 'region'), '') is null
    or nullif(trim(p_address ->> 'city'), '') is null
    or nullif(trim(p_address ->> 'address_line'), '') is null then
    raise exception 'بيانات عنوان التوصيل غير مكتملة';
  end if;

  select * into v_setting from public.store_settings where id = true;
  if not found then raise exception 'إعدادات المتجر غير مهيأة'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 20 then raise exception 'كمية المنتج غير صالحة'; end if;
    select * into v_variant
      from public.product_variants
      where id = (v_item ->> 'variant_id')::uuid
      for update;
    if not found or v_variant.stock < v_qty then raise exception 'المخزون غير كافٍ'; end if;
    select * into v_product
      from public.products
      where id = v_variant.product_id and is_active = true;
    if not found then raise exception 'المنتج غير متاح'; end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  v_delivery := v_setting.delivery_fee;
  v_total := v_subtotal + v_delivery;
  v_deposit := case
    when v_setting.deposit_type = 'percentage'
      then round(v_total * least(v_setting.deposit_value, 100) / 100, 2)
    else least(v_setting.deposit_value, v_total)
  end;
  insert into public.orders (
    id, user_id, address_snapshot, subtotal, delivery_fee, total,
    deposit_amount, remaining_amount, customer_note
  ) values (
    v_order_id, v_user_id, p_address, v_subtotal, v_delivery, v_total,
    v_deposit, v_total - v_deposit, nullif(trim(p_customer_note), '')
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    select * into v_variant from public.product_variants
      where id = (v_item ->> 'variant_id')::uuid for update;
    if not found or v_variant.stock < v_qty then raise exception 'المخزون غير كافٍ'; end if;
    select * into v_product from public.products
      where id = v_variant.product_id and is_active = true;
    if not found then raise exception 'المنتج غير متاح'; end if;
    update public.product_variants set stock = stock - v_qty where id = v_variant.id;
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, size, color, unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.size,
      v_variant.color, v_product.price, v_qty, v_product.price * v_qty
    );
  end loop;

  insert into public.order_status_history (order_id, status, changed_by)
    values (v_order_id, 'awaiting_deposit_review', v_user_id);
  return v_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text) to authenticated;

create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
    where id = p_order_id and user_id = (select auth.uid())
    for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if v_order.status not in ('received', 'awaiting_deposit_review') then
    raise exception 'لا يمكن إلغاء الطلب في حالته الحالية';
  end if;
  if v_order.payment_status = 'deposit_confirmed' then
    raise exception 'تواصلي مع المتجر لإلغاء طلب تم تأكيد عربونه';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

revoke all on function public.cancel_my_order(uuid) from public;
grant execute on function public.cancel_my_order(uuid) to authenticated;

create or replace function public.set_default_address(p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.addresses
    where id = p_address_id and user_id = (select auth.uid())
  ) then
    raise exception 'العنوان غير موجود';
  end if;
  update public.addresses
    set is_default = (id = p_address_id)
    where user_id = (select auth.uid());
end;
$$;

revoke all on function public.set_default_address(uuid) from public;
grant execute on function public.set_default_address(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.addresses enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.order_status_history enable row level security;
alter table public.favorites enable row level security;

create policy "Profiles are visible to their owner or admins" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Customers update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Roles visible to owner or admins" on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Active categories are public" on public.categories for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "Admins manage categories" on public.categories for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Active products are public" on public.products for select to anon, authenticated using ((is_active and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and c.is_active))) or (select public.is_admin()));
create policy "Admins manage products" on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Images of visible products are public" on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or (select public.is_admin()))));
create policy "Admins manage product images" on public.product_images for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Variants of visible products are public" on public.product_variants for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.is_active or (select public.is_admin()))));
create policy "Admins manage product variants" on public.product_variants for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Users manage own addresses" on public.addresses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Store settings public read" on public.store_settings for select to anon, authenticated using (true);
create policy "Admins update store settings" on public.store_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Customers view own orders" on public.orders for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins update orders" on public.orders for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Customers view own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Admins manage order items" on public.order_items for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Users view own receipts" on public.payment_receipts for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Users attach own receipt to own order" on public.payment_receipts for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
      and o.payment_status in ('awaiting_receipt', 'rejected')
  )
);
create policy "Admins review receipts" on public.payment_receipts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Users view own order history" on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Admins manage order history" on public.order_status_history for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Users manage own favorites" on public.favorites for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "Anyone reads product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "Admins upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and (select public.is_admin())) with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Owners upload receipts" on storage.objects for insert to authenticated with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(name))[2]
      and o.user_id = (select auth.uid())
      and o.payment_status in ('awaiting_receipt', 'rejected')
  )
);
create policy "Owners and admins read receipts" on storage.objects for select to authenticated using (
  bucket_id = 'payment-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
  )
);
create policy "Owners replace own receipt" on storage.objects for update to authenticated using (
  bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Owners and admins delete receipts" on storage.objects for delete to authenticated using (
  bucket_id = 'payment-receipts'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);
