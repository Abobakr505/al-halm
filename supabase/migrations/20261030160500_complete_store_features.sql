alter table public.profiles
  add column if not exists email text not null default '';

alter table public.products
  add column if not exists fabric text;

alter table public.categories
  add column if not exists image_path text;

alter table public.product_images
  add column if not exists storage_path text;

alter table public.store_settings
  add column if not exists store_name text not null default 'متجر الحلم',
  add column if not exists about_text text not null default 'في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة أيامك الجميلة.',
  add column if not exists contact_email text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists return_policy text not null default 'للاستفسار عن الاستبدال والاسترجاع، تواصلي مع المتجر قبل إعادة المنتج. يجب أن يكون المنتج بحالته الأصلية.',
  add column if not exists privacy_policy text not null default 'نستخدم بياناتك لمعالجة الطلبات والتواصل بشأن التوصيل فقط. لا نبيع بيانات العملاء أو نشاركها لأغراض تسويقية.';

update public.profiles profile
set email = coalesce(auth_user.email, '')
from auth.users auth_user
where auth_user.id = profile.id;

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
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;
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

drop trigger if exists profile_email_is_managed_by_auth on public.profiles;
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
    update public.profiles
      set email = coalesce(new.email, '')
      where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure public.sync_profile_email();

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
