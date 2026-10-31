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
  v_regular_subtotal numeric(10,2) := 0;
  v_unit_prices jsonb := '{}'::jsonb;
  v_discount numeric(5,2);
  v_unit_price numeric(10,2);
  v_total numeric(10,2);
  v_delivery numeric(10,2);
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

    v_discount := 0;
    if v_product.category_id is not null then
      select promotion.discount_percent into v_discount
      from public.promotions promotion
      where promotion.category_id = v_product.category_id
        and promotion.is_active
        and promotion.starts_at <= now()
        and (promotion.ends_at is null or promotion.ends_at > now())
      order by promotion.discount_percent desc, promotion.created_at desc
      limit 1
      for share;
    end if;
    v_discount := coalesce(v_discount, 0);
    v_unit_price := round(v_product.price * (100 - v_discount) / 100, 2);
    v_unit_prices := v_unit_prices || jsonb_build_object(v_variant.id::text, v_unit_price);
    v_regular_subtotal := v_regular_subtotal + (v_product.price * v_qty);
    v_subtotal := v_subtotal + (v_unit_price * v_qty);
  end loop;

  v_delivery := v_setting.delivery_fee;
  v_total := v_subtotal + v_delivery;
  insert into public.orders (
    id, user_id, address_snapshot, subtotal, discount_amount, delivery_fee, total,
    deposit_amount, remaining_amount, customer_note, status, payment_status
  ) values (
    v_order_id, v_user_id, p_address, v_subtotal,
    v_regular_subtotal - v_subtotal, v_delivery, v_total,
    v_delivery, v_total - v_delivery, nullif(trim(p_customer_note), ''),
    case
      when v_delivery = 0 then 'received'::public.order_status
      else 'awaiting_deposit_review'::public.order_status
    end,
    case
      when v_delivery = 0 then 'deposit_confirmed'::public.payment_status
      else 'awaiting_receipt'::public.payment_status
    end
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    select * into v_variant from public.product_variants
      where id = (v_item ->> 'variant_id')::uuid for update;
    if not found or v_variant.stock < v_qty then raise exception 'المخزون غير كافٍ'; end if;
    select * into v_product from public.products
      where id = v_variant.product_id and is_active = true;
    if not found then raise exception 'المنتج غير متاح'; end if;

    v_unit_price := (v_unit_prices ->> v_variant.id::text)::numeric;
    if v_unit_price is null then raise exception 'تعذر التحقق من سعر المنتج'; end if;

    update public.product_variants set stock = stock - v_qty where id = v_variant.id;
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, size, color, unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.name, v_variant.size,
      v_variant.color, v_unit_price, v_qty, v_unit_price * v_qty
    );
  end loop;

  insert into public.order_status_history (order_id, status, changed_by)
    values (
      v_order_id,
      case
        when v_delivery = 0 then 'received'::public.order_status
        else 'awaiting_deposit_review'::public.order_status
      end,
      v_user_id
    );
  return v_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text) to authenticated;
