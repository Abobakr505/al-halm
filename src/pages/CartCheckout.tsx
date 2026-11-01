import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CreditCard,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { readCart, writeCart } from "../lib/cart";
import type { Product } from "../types";
import { categoryFallback, money } from "../components/Storefront";
import { EmptyState, ToastMessage, useToast } from "../components/Common";
import {
  categoryPromotions,
  promotionPercent,
  promotionPrice,
} from "../lib/promotions";
import { GOVERNORATES } from "../lib/governorates";
type CartProduct = Pick<
  Product,
  "id" | "name" | "slug" | "price" | "images"
> & {
  category?:
    | NonNullable<Product["category"]>
    | NonNullable<Product["category"]>[]
    | null;
};
type CartItem = {
  variantId: string;
  product: CartProduct;
  size: string;
  color: string;
  stock: number;
  quantity: number;
};

export function CartPage() {
  const [lines, setLines] = useState(readCart);
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || lines.length === 0) {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const { data, error: resultError } = await supabase
          .from("product_variants")
          .select(
            "id,size,color,stock,product:products(id,name,slug,price,category:categories(name,slug,description,promotions(id,title,description,discount_percent,image_url)),images:product_images(image_url,alt_text,position))",
          )
          .in(
            "id",
            lines.map((line) => line.variantId),
          );

        if (!active) return;
        if (resultError) {
          setError(`تعذر تحميل السلة: ${resultError.message}`);
          setItems([]);
        } else {
          setItems(
            (data ?? []).flatMap((variant) => {
              const product = Array.isArray(variant.product)
                ? variant.product[0]
                : variant.product;
              const line = lines.find((item) => item.variantId === variant.id);
              return product && line
                ? [
                    {
                      variantId: variant.id,
                      product,
                      size: variant.size,
                      color: variant.color,
                      stock: variant.stock,
                      quantity: line.quantity,
                    },
                  ]
                : [];
            }),
          );
        }
      } catch (cause) {
        if (!active) return;
        setError(
          `تعذر تحميل السلة: ${cause instanceof Error ? cause.message : "حدث خطأ غير معروف."}`,
        );
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [lines]);

  const updateQuantity = (variantId: string, quantity: number) => {
    const next = lines
      .map((line) =>
        line.variantId === variantId ? { ...line, quantity } : line,
      )
      .filter((line) => line.quantity > 0);
    writeCart(next);
    setLines(next);
  };
  const subtotal = items.reduce(
    (total, item) =>
      total +
      promotionPrice(
        item.product.price,
        categoryPromotions(item.product.category),
      ) *
        item.quantity,
    0,
  );
  const discountTotal = items.reduce(
    (total, item) =>
      total +
      (item.product.price -
        promotionPrice(
          item.product.price,
          categoryPromotions(item.product.category),
        )) *
        item.quantity,
    0,
  );
  const regularSubtotal = subtotal + discountTotal;

  return (
    <main className="page-main narrow-page cart-page">
      <div className="page-title cart-page-title">
        <p className="eyebrow">اختياراتك بكل حب</p>
        <h1>سلة الحلم</h1>
        {items.length > 0 && (
          <span className="cart-item-count">
            <ShoppingBag size={15} />{" "}
            {items.reduce((count, item) => count + item.quantity, 0)} قطع مختارة
          </span>
        )}
      </div>
      {error ? (
        <EmptyState title="تعذر تحميل السلة" message={error} />
      ) : loading ? (
        <div className="loading-message">جارٍ تحميل محتويات السلة…</div>
      ) : items.length === 0 ? (
        <EmptyState
          title="سلتك فارغة الآن"
          message={
            isSupabaseConfigured
              ? lines.length
                ? "تعذر العثور على تفاصيل المنتجات المحفوظة في السلة. أزيلي العناصر القديمة ثم أضيفيها من جديد."
                : "القطعة المناسبة بانتظارك. اكتشفي مجموعتنا واختاري ما يشبهك."
              : "اربط Supabase ثم أضيفي خيارات المنتجات المتاحة إلى سلتك."
          }
          action="/products"
          actionText="اكتشفي العبايات"
        />
      ) : (
        <div className="cart-content">
          <div className="cart-list">
            {items.map((item) => {
              const promotions = categoryPromotions(item.product.category);
              const price = promotionPrice(item.product.price, promotions);
              const discount = promotionPercent(promotions);
              return (
                <article className="cart-item" key={item.variantId}>
                  <Link
                    className="cart-item-image"
                    to={`/products/${item.product.slug}`}
                    aria-label={`عرض ${item.product.name}`}
                  >
                    <img
                      src={
                        item.product.images?.[0]?.image_url ||
                        categoryFallback(0)
                      }
                      alt={item.product.name}
                    />
                  </Link>
                  <div className="cart-item-info">
                    <Link
                      to={`/products/${item.product.slug}`}
                      className="cart-item-name"
                    >
                      {item.product.name}
                    </Link>
                    <span className="cart-item-variant">
                      <span>{item.color}</span>
                      <i /> مقاس {item.size}
                    </span>
                    <b className="cart-item-price">
                      {money(price)}
                      {discount > 0 && <del>{money(item.product.price)}</del>}
                    </b>
                    <div className="cart-item-actions">
                      <div
                        className="quantity-control"
                        aria-label="تعديل الكمية"
                      >
                        <button
                          aria-label="تقليل الكمية"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity - 1)
                          }
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label="زيادة الكمية"
                          disabled={item.quantity >= item.stock}
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="remove-line"
                        onClick={() => updateQuantity(item.variantId, 0)}
                      >
                        <Trash2 size={14} /> إزالة
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="cart-summary">
            <h2>ملخص السلة</h2>
            <div className="cart-summary-line">
              <span>عدد القطع</span>
              <b>{items.reduce((count, item) => count + item.quantity, 0)}</b>
            </div>
            <div className="cart-summary-line">
              <span>المجموع قبل الخصم</span>
              <b>{money(regularSubtotal)}</b>
            </div>
            {discountTotal > 0 && (
              <div className="cart-summary-line cart-savings">
                <span>وفرتِ مع عروض الحلم</span>
                <b>− {money(discountTotal)}</b>
              </div>
            )}
            <div className="cart-summary-total">
              <span>الإجمالي بعد الخصم</span>
              <b>{money(subtotal)}</b>
            </div>
            <p>
              تُحسب تكلفة التوصيل في الخطوة التالية، وتُدفع قيمة المنتجات عند
              الاستلام.
            </p>
            <Link className="button button-dark full-button" to="/checkout">
              متابعة لإتمام الطلب <ArrowLeft size={16} />
            </Link>
            <Link className="cart-continue-link" to="/products">
              متابعة التسوق
            </Link>
            <div className="cart-safe-note">
              <ShieldCheck size={16} />
              <span>بياناتك وطلبك في أمان</span>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
  type SavedAddress = {
  id: string
  recipient_name: string
  phone: string
  region: string
  city: string
  address_line: string
  map_url: string | null
  is_default: boolean
}
export function CheckoutPage() {
  const notify = useToast();

const [saved, setSaved] = useState<SavedAddress[]>([])
const [selectedAddress, setSelectedAddress] = useState('')

  const [session, setSession] = useState<boolean | null>(null);
  const [address, setAddress] = useState({
    recipient_name: "",
    phone: "",
    region: "",
    city: "",
    address_line: "",
    map_url: "",
  });
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [settings, setSettings] = useState<{
    delivery_fee: number;
    transfer_details: string;
  } | null>(null);
  const [subtotal, setSubtotal] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const cart = readCart();
  const [zones, setZones] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
useEffect(() => {
  if (!supabase) {
    setSession(false);
    return;
  }

  supabase.auth.getSession().then(({ data, error }) => {
    if (error) setMessage(error.message);
    setSession(Boolean(data.session));
  });

  supabase
    .from("store_settings")
    .select("delivery_fee,transfer_details")
    .eq("id", true)
    .single()
    .then(({ data, error }) => {
      if (error) setMessage(`تعذر تحميل إعدادات الدفع: ${error.message}`);
      else setSettings(data);
    });

  supabase
    .from("delivery_zones")
    .select("governorate,fee")
    .eq("is_active", true)
    .then(({ data, error }) => {
      if (error) setMessage(`تعذر تحميل أسعار التوصيل: ${error.message}`);
      else
        setZones(
          Object.fromEntries(
            (data ?? []).map((z) => [z.governorate, Number(z.fee)]),
          ),
        );
    });

  supabase
    .from("addresses")
    .select("id,recipient_name,phone,region,city,address_line,map_url,is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .then(({ data }) => {
      const list = (data ?? []) as SavedAddress[];
      setSaved(list);
      if (list[0]) applySaved(list[0]);
    });

  if (cart.length)
    supabase
      .from("product_variants")
      .select(
        "id,product:products(price,category:categories(name,slug,description,promotions(id,title,description,discount_percent,image_url)))",
      )
      .in(
        "id",
        cart.map((line) => line.variantId),
      )
      .then(({ data, error }) => {
        if (error) setMessage(`تعذر تحميل ملخص الطلب: ${error.message}`);
        else {
          let regularSubtotal = 0;
          let discountedSubtotal = 0;
          for (const item of data ?? []) {
            const product = Array.isArray(item.product)
              ? item.product[0]
              : item.product;
            const quantity =
              cart.find((line) => line.variantId === item.id)?.quantity || 0;
            const price = Number(product?.price || 0);
            regularSubtotal += price * quantity;
            discountedSubtotal +=
              promotionPrice(price, categoryPromotions(product?.category)) *
              quantity;
          }
          setSubtotal(discountedSubtotal);
          setDiscountTotal(regularSubtotal - discountedSubtotal);
        }
      });
}, []);

  if (!isSupabaseConfigured)
    return (
      <EmptyState
        title="إتمام الطلب غير متاح"
        message="أضيفي إعدادات Supabase لإتمام الطلبات بأمان."
      />
    );
  if (session === false)
    return <Navigate to="/login" state={{ from: "/checkout" }} replace />;
  const regionSelected = Boolean(address.region);
  const deliveryFee = regionSelected
    ? (zones[address.region] ?? settings?.delivery_fee ?? 0)
    : 0;
  const total = subtotal + deliveryFee;
const validate = () => {
  const e: Record<string, string> = {}
  const digits = address.phone.replace(/[\s-]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  if (address.recipient_name.trim().split(/\s+/).length < 2) e.recipient_name = 'اكتبي الاسم الأول والأخير على الأقل.'
  if (!/^01[0125]\d{8}$/.test(digits)) e.phone = 'أدخلي رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).'
  if (!address.region) e.region = 'اختاري المحافظة.'
  else if (!(address.region in zones)) e.region = 'التوصيل غير متاح لهذه المحافظة حاليًا.'
  if (address.city.trim().length < 2) e.city = 'أدخلي اسم المدينة.'
  if (address.address_line.trim().length < 10) e.address_line = 'اكتبي العنوان بالتفصيل (10 أحرف على الأقل).'
  if (address.map_url && !/^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(address.map_url))
    e.map_url = 'الرابط لازم يكون من Google Maps.'
  setErrors(e)
  return { ok: Object.keys(e).length === 0, phone: digits }
}
const applySaved = (item: SavedAddress) => {
  setSelectedAddress(item.id)
  setAddress({
    recipient_name: item.recipient_name,
    phone: item.phone,
    region: item.region,
    city: item.city,
    address_line: item.address_line,
    map_url: item.map_url || '',
  })
  setErrors({})
}
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const check = validate()
if (!check.ok) { setMessage('راجعي الحقول المميزة وصحّحيها.'); return }
    if (!supabase || cart.length === 0) {
      setMessage("سلتك فارغة. أضيفي عباية قبل إتمام الطلب.");
      return;
    }
    if (!settings) {
      setMessage("إعدادات الدفع غير متاحة حاليًا.");
      return;
    }
    if (deliveryFee > 0 && !receipt) {
      setMessage("ارفقي إيصال تحويل رسوم التوصيل لإرسال الطلب.");
      return;
    }
    if (
      receipt &&
      (receipt.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          receipt.type,
        ))
    ) {
      setMessage("يسمح بملفات JPG أو PNG أو WebP أو PDF بحجم أقصى 5 ميجابايت.");
      return;
    }

    setBusy(true);
    setMessage("");
    const { data: orderId, error: orderError } = await supabase.rpc(
      "create_order",
      {
        p_address: address,
        p_items: cart.map((line) => ({
          variant_id: line.variantId,
          quantity: line.quantity,
        })),
        p_customer_note: note,
      },
    );
    if (orderError || !orderId) {
      setBusy(false);
      setMessage(`تعذر إنشاء الطلب: ${orderError?.message || "خطأ غير معروف"}`);
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setBusy(false);
      setMessage("تعذر التحقق من الحساب. سجلي الدخول مرة أخرى.");
      return;
    }
    if (receipt) {
      const path = `${userData.user.id}/${orderId}/${crypto.randomUUID()}-${receipt.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(path, receipt, { contentType: receipt.type, upsert: false });
      if (uploadError) {
        setBusy(false);
        setMessage(
          `تم إنشاء الطلب رقم ${orderId} لكن تعذر رفع الإيصال: ${uploadError.message}`,
        );
        return;
      }
      const { error: receiptError } = await supabase
        .from("payment_receipts")
        .insert({
          order_id: orderId,
          user_id: userData.user.id,
          storage_path: path,
        });
      if (receiptError) {
        setBusy(false);
        setMessage(
          `تم حفظ الطلب لكن تعذر تسجيل الإيصال: ${receiptError.message}`,
        );
        return;
      }
    }
    writeCart([]);
    setBusy(false);
    notify(`تم تأكيد طلبك رقم ${orderId} بنجاح.`);
    navigate(`/orders/${orderId}`);
  };

  return (
    <main className="page-main checkout-page">
      <div className="page-title">
        <p className="eyebrow">خطوة أخيرة</p>
        <h1>إتمام الطلب</h1>
        <p>
          أكملي بياناتك لتأكيد الطلب؛ رسوم التوصيل فقط تُدفع الآن وقيمة المنتجات
          عند الاستلام.
        </p>
      </div>
      <div className="checkout-steps" aria-label="خطوات الطلب">
        <span className="checkout-step-done">
          <i>
            <Check size={13} />
          </i>{" "}
          السلة
        </span>
        <span className="checkout-step-line" />
        <span className="checkout-step-active">
          <i>٢</i> بيانات الطلب
        </span>
        <span className="checkout-step-line" />
        <span>
          <i>٣</i> التأكيد
        </span>
      </div>
      {session === null ? (
        <p>جارٍ التحقق من الحساب…</p>
      ) : (
        <form className="checkout-layout" onSubmit={submit}>
          <div className="admin-card checkout-fields">
            <div className="checkout-section-heading">
              <span>
                <MapPin size={18} />
              </span>
              <div>
                <h2>عنوان التوصيل</h2>
                <p>أين نرسل طلبك؟</p>
              </div>
            </div>
            {saved.length > 0 && (
  <label className="checkout-label">
    اختاري من عناوينك المحفوظة
    <select
      className="governorate-select"
      value={selectedAddress}
      onChange={(event) => {
        const item = saved.find((entry) => entry.id === event.target.value)
        if (item) applySaved(item)
        else {
          setSelectedAddress('')
          setAddress({ recipient_name: '', phone: '', region: '', city: '', address_line: '', map_url: '' })
        }
      }}
    >
      {saved.map((item) => (
        <option key={item.id} value={item.id}>
          {item.recipient_name} — {item.region}، {item.city}{item.is_default ? ' (الافتراضي)' : ''}
        </option>
      ))}
      <option value="">عنوان جديد</option>
    </select>
  </label>
)}
{([['recipient_name', 'الاسم الكامل'], ['phone', 'رقم الهاتف'], ['city', 'المدينة'], ['address_line', 'العنوان بالتفصيل']] as const).map(([field, label]) => (
  <label className="checkout-label" key={field}>
    {label}
    <input
      required
      inputMode={field === 'phone' ? 'tel' : undefined}
      aria-invalid={Boolean(errors[field])}
      value={address[field]}
      onChange={(event) => { setAddress({ ...address, [field]: event.target.value }); setErrors({ ...errors, [field]: '' }) }}
    />
    {errors[field] && <small className="field-error">{errors[field]}</small>}
  </label>
))}
<label className="checkout-label">
  المحافظة
  <select
    required
    aria-invalid={Boolean(errors.region)}
    value={address.region}
    onChange={(event) => { setAddress({ ...address, region: event.target.value }); setErrors({ ...errors, region: '' }) }}
  >
    <option value="">اختاري المحافظة</option>
    {GOVERNORATES.filter((g) => g in zones).map((g) => (
      <option key={g} value={g}>{g} — {money(zones[g])}</option>
    ))}
  </select>
  {errors.region && <small className="field-error">{errors.region}</small>}
</label>
            <label className="checkout-label checkout-map-label">
              رابط موقع Google Maps{" "}
              <small>اختياري — يساعدنا في الوصول إليكِ بدقة</small>
              <input
                type="url"
                placeholder="https://maps.google.com/…"
                value={address.map_url}
                onChange={(event) =>
                  setAddress({ ...address, map_url: event.target.value })
                }
              />
            </label>
            <label className="checkout-label checkout-note-label">
              ملاحظات إضافية
              <textarea
                placeholder="تفاصيل تساعدنا في توصيل طلبك…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            {deliveryFee > 0 && (
              <>
                <div className="checkout-section-heading checkout-payment-heading">
                  <span>
                    <CreditCard size={18} />
                  </span>
                  <div>
                    <h2>إيصال رسوم التوصيل</h2>
                    <p>ادفعي رسوم التوصيل فقط، وقيمة المنتجات عند الاستلام</p>
                  </div>
                </div>
                <div className="transfer-details">
                  <CreditCard size={17} />
                  <p>
                    {settings?.transfer_details ||
                      "بيانات تحويل رسوم التوصيل ستظهر هنا بعد إضافتها من إعدادات المتجر."}
                  </p>
                </div>
                <label className="checkout-receipt-upload">
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) =>
                      setReceipt(event.target.files?.[0] || null)
                    }
                  />
                  <span className="checkout-upload-icon">
                    <Upload size={19} />
                  </span>
                  <span className="checkout-upload-copy">
                    <b>{receipt?.name || "ارفقي إيصال تحويل رسوم التوصيل"}</b>
                    <small>
                      {receipt
                        ? "تم اختيار الملف بنجاح"
                        : "JPG أو PNG أو WebP أو PDF · بحد أقصى 5 ميجابايت"}
                    </small>
                  </span>
                  <span className="checkout-upload-action">
                    {receipt ? "تغيير الملف" : "اختيار ملف"}
                  </span>
                </label>
              </>
            )}
          </div>
          <aside className="admin-card order-summary">
            <div className="order-summary-title">
              <span>
                <ShoppingBag size={18} />
              </span>
              <h2>ملخص الطلب</h2>
            </div>
            <div>
              <span>المجموع قبل الخصم</span>
              <b>{money(subtotal + discountTotal)}</b>
            </div>
            {discountTotal > 0 && (
              <div className="discount-summary">
                <span>خصم العروض</span>
                <b>− {money(discountTotal)}</b>
              </div>
            )}
            <div>
              <span>المجموع بعد الخصم</span>
              <b>{money(subtotal)}</b>
            </div>
            <div><span>التوصيل</span><b>{regionSelected ? money(deliveryFee) : 'اختاري المحافظة'}</b></div>
            <div className="checkout-grand-total">
              <span>إجمالي الطلب</span>
              <b>{money(total)}</b>
            </div>
            <div className="checkout-deposit">
              <span>المطلوب دفعه الآن (التوصيل)</span>
              <b>{money(deliveryFee)}</b>
            </div>
            <div className="checkout-remaining">
              <span>قيمة المنتجات عند الاستلام</span>
              <b>{money(subtotal)}</b>
            </div>
            <div className="checkout-delivery-note">
              <Truck size={16} />
              <span>
                تُدفع رسوم التوصيل فقط الآن، وباقي قيمة الطلب عند الاستلام.
              </span>
            </div>
            {message && <ToastMessage message={message} />}
            <button
              disabled={busy || cart.length === 0}
              className="button button-dark full-button"
            >
              {busy ? "جارٍ إرسال طلبك…" : "تأكيد الطلب"}{" "}
              <ArrowLeft size={16} />
            </button>
            <p className="checkout-secure-note">
              <ShieldCheck size={15} />{" "}
              {deliveryFee > 0
                ? "إرفاق إيصال رسوم التوصيل مطلوب لتأكيد الطلب"
                : "التوصيل مجاني — ادفعي قيمة المنتجات عند الاستلام"}
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}
