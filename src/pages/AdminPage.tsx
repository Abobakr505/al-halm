import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from "react-router-dom";
import { ExternalLink, Images, Percent, Plus, Trash2, Upload, X } from "lucide-react";
import { EmptyState, ToastMessage } from "../components/Common";
import { money } from "../components/Storefront";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  orderStatusLabels,
  type Category,
  type OrderStatus,
  type Product,
} from "../types";
import { GOVERNORATES } from "../lib/governorates";
const ORDER_STATUSES = Object.entries(orderStatusLabels) as [
  OrderStatus,
  string,
][];
type AdminOrder = {
  id: string;
  order_number: number;
  status: OrderStatus;
  payment_status: string;
  subtotal?: number;
  discount_amount?: number;
  delivery_fee?: number;
  total: number;
  deposit_amount: number;
  remaining_amount: number;
  created_at: string;
  customer_note: string | null;
  internal_note: string | null;
  address_snapshot: Record<string, string>;
  profiles: { full_name: string; phone: string } | null;
  items: {
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  payment_receipts: {
    id: string;
    storage_path: string;
    review_note: string | null;
    created_at: string;
  }[];
};
type VariantInput = { size: string; color: string; stock: string };
type AdminCategory = Category & { position: number; is_active: boolean };
type AdminImage = {
  id: string;
  image_url: string;
  storage_path: string | null;
  position: number;
};

const IMAGE_BUCKET = "product-images";
const AdminDeleteContext = createContext<((name: string) => Promise<boolean>) | null>(null);

function useAdminDeleteConfirmation() {
  const confirmDelete = useContext(AdminDeleteContext);
  if (!confirmDelete) throw new Error("تأكيد الحذف متاح داخل لوحة التحكم فقط.");
  return confirmDelete;
}

async function uploadImage(file: File, folder: string, bucket = IMAGE_BUCKET) {
  if (!supabase) throw new Error("تعذر الاتصال بمخزن الصور.");

  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${fileName}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw new Error(`تعذر رفع الصورة: ${error.message}`);

  return {
    path,
    url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
  };
}

function PendingProductImage({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="image-preview-card">
      {previewUrl && <img src={previewUrl} alt={`معاينة ${file.name}`} />}
      <span className="pending-image-name" title={file.name}>
        {file.name}
      </span>
      <button
        className="image-remove-button"
        type="button"
        onClick={onRemove}
        aria-label={`إزالة ${file.name}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function CategoryImagePicker({
  file,
  onChange,
  onClear,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  onClear: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="category-image-picker">
      <span className="image-upload-heading">
        <Images size={17} /> صورة القسم
      </span>
      <label className="image-upload-button">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            onChange(event.target.files?.[0] || null);
            event.target.value = "";
          }}
        />
        {previewUrl ? (
          <img
            className="category-image-preview"
            src={previewUrl}
            alt={`معاينة ${file?.name || "صورة القسم"}`}
          />
        ) : (
          <span className="image-upload-icon">
            <Upload size={19} />
          </span>
        )}
        <span className="image-upload-label-copy">
          <b>{file ? "اختيار صورة أخرى" : "اختاري صورة للقسم"}</b>
          <small>JPG أو PNG أو WebP · بحد أقصى 20 ميجابايت</small>
        </span>
        <span className="image-upload-action">
          <Plus size={16} /> استعراض
        </span>
      </label>
      {file && (
        <div className="category-image-selection">
          <span className="pending-image-name" title={file.name}>
            {file.name}
          </span>
          <button
            className="category-image-clear"
            type="button"
            onClick={onClear}
          >
            <X size={14} /> إزالة الصورة المختارة
          </button>
        </div>
      )}
    </div>
  );
}

function AdminLayout({
  children,
  active,
}: {
  children: React.ReactNode;
  active: string;
}) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    name: string;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const requestDeleteConfirmation = (name: string) =>
    new Promise<boolean>((resolve) => setDeleteTarget({ name, resolve }));
  const finishDeleteConfirmation = (confirmed: boolean) => {
    deleteTarget?.resolve(confirmed);
    setDeleteTarget(null);
  };
  useEffect(() => {
    if (!deleteTarget) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishDeleteConfirmation(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleteTarget]);
  useEffect(() => {
    if (!supabase) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc("is_admin").then(({ data, error: resultError }) => {
      if (resultError) {
        setError(`تعذر التحقق من الصلاحيات: ${resultError.message}`);
        setIsAdmin(false);
      } else setIsAdmin(Boolean(data));
    });
  }, []);
  if (isAdmin === null)
    return (
      <main className="page-main">
        <EmptyState
          title="جارٍ التحقق من الصلاحيات"
          message="يتم التحقق من حساب الإدارة بأمان."
        />
      </main>
    );
  if (!isAdmin)
    return (
      <main className="page-main">
        <EmptyState
          title="هذه الصفحة للإدارة فقط"
          message={
            error ||
            (isSupabaseConfigured
              ? "سجلي الدخول بحساب مخول للإدارة."
              : "اربط Supabase ثم عيّن دور المدير من قاعدة البيانات.")
          }
          action="/login"
          actionText="تسجيل الدخول"
        />
      </main>
    );
  return (
    <AdminDeleteContext.Provider value={requestDeleteConfirmation}>
      <>
    <main className="page-main admin-page">
      <div className="page-title">
        <p className="eyebrow">إدارة متجر الحلم</p>
        <h1>لوحة التحكم</h1>
      </div>
      <nav className="admin-tabs" aria-label="أقسام لوحة التحكم">
        <Link className={active === "dashboard" ? "active" : ""} to="/admin">
          نظرة عامة
        </Link>
        <Link
          className={active === "products" ? "active" : ""}
          to="/admin/products"
        >
          المنتجات
        </Link>
        <Link
          className={active === "categories" ? "active" : ""}
          to="/admin/categories"
        >
          الأقسام
        </Link>
        <Link
          className={active === "promotions" ? "active" : ""}
          to="/admin/promotions"
        >
          العروض
        </Link>
        <Link
          className={active === "orders" ? "active" : ""}
          to="/admin/orders"
        >
          الطلبات
        </Link>
        <Link
          className={active === "customers" ? "active" : ""}
          to="/admin/customers"
        >
          العملاء
        </Link>
        <Link
          className={active === "settings" ? "active" : ""}
          to="/admin/settings"
        >
          الإعدادات
        </Link>
      </nav>
      {children}
    </main>
    {deleteTarget && (
      <div
        className="admin-confirm-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) finishDeleteConfirmation(false);
        }}
      >
        <section
          className="admin-confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-delete-title"
          aria-describedby="admin-delete-description"
        >
          <span className="admin-confirm-icon"><Trash2 size={22} /></span>
          <p className="eyebrow">تأكيد الحذف</p>
          <h2 id="admin-delete-title">هل تريدين حذف هذا العنصر؟</h2>
          <p id="admin-delete-description">
            سيتم حذف <b>{deleteTarget.name}</b> نهائيًا، ولا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="admin-confirm-actions">
            <button type="button" className="admin-confirm-cancel" onClick={() => finishDeleteConfirmation(false)}>تراجُع</button>
            <button type="button" className="admin-confirm-delete" onClick={() => finishDeleteConfirmation(true)}><Trash2 size={15} /> نعم، احذف</button>
          </div>
        </section>
      </div>
    )}
      </>
    </AdminDeleteContext.Provider>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<{ label: string; value: string; note: string }[]>([]);
  const [statusCounts, setStatusCounts] = useState<{ status: OrderStatus; count: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<{ id: string; order_number: number; status: OrderStatus; total: number; created_at: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError("إعدادات Supabase غير متاحة.");
      return;
    }
    const client = supabase;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const monthOrdersPromise = async () => {
        const rows: { status: OrderStatus; total: number; created_at: string }[] = [];
        for (let offset = 0; ; offset += 1000) {
          const result = await client.from("orders").select("status,total,created_at")
            .gte("created_at", monthStart.toISOString())
            .order("created_at", { ascending: false })
            .range(offset, offset + 999);
          if (result.error) return { data: null, error: result.error };
          rows.push(...(result.data ?? []) as typeof rows);
          if ((result.data ?? []).length < 1000) return { data: rows, error: null };
        }
      };
      const [monthOrders, recent, allOrders, customers, products, variants, promotions] = await Promise.all([
        monthOrdersPromise(),
        client.from("orders").select("id,order_number,status,total,created_at").order("created_at", { ascending: false }).limit(8),
        client.from("orders").select("id", { count: "exact", head: true }),
        client.from("profiles").select("id", { count: "exact", head: true }),
        client.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        client.from("product_variants").select("id", { count: "exact", head: true }).gt("stock", 0).lte("stock", 3),
        client.from("promotions").select("id", { count: "exact", head: true }).eq("is_active", true).lte("starts_at", new Date().toISOString()).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`),
      ]);
      const failed = [monthOrders, recent, allOrders, customers, products, variants, promotions].find((result) => result.error);
      if (!active) return;
      if (failed?.error) {
        setError(`تعذر تحميل تقارير النظرة العامة: ${failed.error.message}`);
        setLoading(false);
        return;
      }

      const ordersThisMonth = monthOrders.data ?? [];
      const deliveredThisMonth = ordersThisMonth.filter((order) => order.status === "delivered");
      const salesThisMonth = deliveredThisMonth.reduce((sum, order) => sum + Number(order.total), 0);
      const salesThisWeek = deliveredThisMonth
        .filter((order) => new Date(order.created_at) >= weekStart)
        .reduce((sum, order) => sum + Number(order.total), 0);
      const reviewCount = ordersThisMonth.filter((order) => order.status === "awaiting_deposit_review").length;
      const waitingCount = ordersThisMonth.filter((order) => order.status === "received").length;
      const lowStockVariants = variants.count ?? 0;
      const statusSummary = ORDER_STATUSES.map(([status]) => ({
        status,
        count: ordersThisMonth.filter((order) => order.status === status).length,
      })).filter((item) => item.count > 0);

      setStats([
        { label: "مبيعات الشهر", value: money(salesThisMonth), note: "للطلبات التي تم تسليمها" },
        { label: "مبيعات آخر 7 أيام", value: money(salesThisWeek), note: "من الطلبات المسلّمة" },
        { label: "طلبات هذا الشهر", value: String(ordersThisMonth.length), note: "منذ بداية الشهر" },
        { label: "إجمالي الطلبات", value: String(allOrders.count ?? 0), note: "كل الطلبات المسجلة" },
        { label: "بانتظار مراجعة رسوم التوصيل", value: String(reviewCount), note: "تحتاج مراجعة الإيصال" },
        { label: "طلبات جديدة", value: String(waitingCount), note: "تحتاج بدء المعالجة" },
        { label: "العملاء", value: String(customers.count ?? 0), note: "حسابات مسجلة" },
        { label: "المنتجات المنشورة", value: String(products.count ?? 0), note: "منتجات ظاهرة بالمتجر" },
        { label: "خيارات منخفضة المخزون", value: String(lowStockVariants), note: "المخزون 3 قطع أو أقل" },
        { label: "عروض سارية", value: String(promotions.count ?? 0), note: "عروض مفعّلة الآن" },
      ]);
      setStatusCounts(statusSummary);
      setRecentOrders((recent.data ?? []) as typeof recentOrders);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div className="dashboard-content">
      {error && <ToastMessage message={error} />}
      {loading && <p className="muted-copy">جارٍ تحميل التقارير…</p>}
      <div className="stats-grid">
        {stats.map((item) => (
          <section className="admin-card stat-card" key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
            <small>{item.note}</small>
          </section>
        ))}
      </div>
      <div className="dashboard-report-grid">
        <section className="admin-card dashboard-status-card">
          <div className="dashboard-card-heading"><div><p className="eyebrow">حركة الشهر</p><h2>حالة الطلبات</h2></div><Link to="/admin/orders">كل الطلبات</Link></div>
          {statusCounts.length ? <div className="dashboard-status-list">{statusCounts.map(({ status, count }) => {
            const total = statusCounts.reduce((sum, item) => sum + item.count, 0);
            return <div className="dashboard-status-row" key={status}>
              <span>{orderStatusLabels[status]}</span>
              <div><i style={{ width: `${total ? Math.max(5, count / total * 100) : 0}%` }} /></div>
              <b>{count}</b>
            </div>;
          })}</div> : <p className="muted-copy">لا توجد طلبات مسجلة هذا الشهر.</p>}
        </section>
        <section className="admin-card dashboard-shortcuts">
          <p className="eyebrow">إدارة المتجر</p><h2>وصول سريع</h2>
          <Link to="/admin/orders">مراجعة الطلبات <span>›</span></Link>
          <Link to="/admin/products">إدارة المنتجات <span>›</span></Link>
          <Link to="/admin/promotions">إدارة العروض <span>›</span></Link>
        </section>
      </div>
      <section className="admin-card dashboard-recent-orders">
        <div className="dashboard-card-heading"><div><p className="eyebrow">أحدث النشاطات</p><h2>آخر الطلبات</h2></div><Link to="/admin/orders">عرض الكل <span>←</span></Link></div>
        {recentOrders.length ? <div className="dashboard-order-list">{recentOrders.map((order) => <Link className="dashboard-order-row" to={`/admin/orders/${order.id}`} key={order.id}>
          <b>طلب #{order.order_number}</b>
          <span>{new Date(order.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className={`dashboard-order-status status-${order.status}`}>{orderStatusLabels[order.status]}</span>
          <strong>{money(Number(order.total))}</strong>
        </Link>)}</div> : <p className="muted-copy">لا توجد طلبات حتى الآن.</p>}
      </section>
    </div>
  );
}

function ProductManagement() {
  const confirmDelete = useAdminDeleteConfirmation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    fabric: "",
    price: "",
    compare_at_price: "",
    category_id: "",
    is_featured: false,
  });
  const [variants, setVariants] = useState<VariantInput[]>([
    { size: "56", color: "أسود", stock: "0" },
  ]);
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<AdminImage[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sizes = [...new Set(variants.map((variant) => variant.size.trim()).filter(Boolean))];
  const colors = [...new Set(variants.map((variant) => variant.color.trim()).filter(Boolean))];
  const variantKeys = new Set(variants.map((variant) => `${variant.size.trim()}\u0000${variant.color.trim()}`));
  const missingVariants = sizes.flatMap((size) =>
    colors
      .filter((color) => !variantKeys.has(`${size}\u0000${color}`))
      .map((color) => ({ size, color })),
  );

  const load = async () => {
    if (!supabase) return;
    const [productResult, categoryResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,slug,price,is_active,is_featured,category_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id,name,slug,description,image_url")
        .order("position"),
    ]);
    if (productResult.error || categoryResult.error)
      setMessage(
        `تعذر تحميل بيانات الإدارة: ${productResult.error?.message || categoryResult.error?.message}`,
      );
    else {
      setProducts((productResult.data ?? []) as Product[]);
      setCategories((categoryResult.data ?? []) as AdminCategory[]);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      fabric: "",
      price: "",
      compare_at_price: "",
      category_id: "",
      is_featured: false,
    });
    setVariants([{ size: "56", color: "أسود", stock: "0" }]);
    setNewSize("");
    setNewColor("");
    setImages([]);
    setExistingImages([]);
  };

  const edit = async (product: Product) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("products")
      .select(
        "*,variants:product_variants(size,color,stock),images:product_images(id,image_url,storage_path,position)",
      )
      .eq("id", product.id)
      .single();
    if (error) {
      setMessage(`تعذر تحميل المنتج للتعديل: ${error.message}`);
      return;
    }
    setEditing(product.id);
    setForm({
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      fabric: data.fabric || "",
      price: String(data.price),
      compare_at_price: data.compare_at_price
        ? String(data.compare_at_price)
        : "",
      category_id: data.category_id || "",
      is_featured: data.is_featured,
    });
    setVariants(
      data.variants.length
        ? data.variants.map((item: VariantInput) => ({
            size: item.size,
            color: item.color,
            stock: String(item.stock),
          }))
        : [],
    );
    setNewSize("");
    setNewColor("");
    setExistingImages(data.images || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addSize = () => {
    const size = newSize.trim();
    if (!size || sizes.includes(size)) return;
    const nextColors = colors.length ? colors : ["أسود"];
    setVariants((current) => [
      ...current,
      ...nextColors.map((color) => ({ size, color, stock: "0" })),
    ]);
    setNewSize("");
  };

  const addColor = () => {
    const color = newColor.trim();
    if (!color || colors.includes(color)) return;
    const nextSizes = sizes.length ? sizes : ["56"];
    setVariants((current) => [
      ...current,
      ...nextSizes.map((size) => ({ size, color, stock: "0" })),
    ]);
    setNewColor("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const slug = form.slug
      .trim()
      .toLocaleLowerCase("ar")
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "");
    if (!slug) {
      setMessage("أدخلي رابطًا نصيًا صالحًا للمنتج.");
      return;
    }
    const usableVariants = variants.filter(
      (item) => item.size.trim() && item.color.trim(),
    );
    if (!usableVariants.length) {
      setMessage("أضيفي خيار مقاس ولون واحدًا على الأقل.");
      return;
    }
    if (
      new Set(
        usableVariants.map(
          (item) => `${item.size.trim()}\u0000${item.color.trim()}`,
        ),
      ).size !== usableVariants.length
    ) {
      setMessage("لا تكرري نفس المقاس واللون.");
      return;
    }
    if (
      variants.some(
        (item) =>
          item.stock.trim() &&
          (!Number.isInteger(Number(item.stock)) || Number(item.stock) < 0),
      )
    ) {
      setMessage("المخزون يجب أن يكون عددًا صحيحًا غير سالب.");
      return;
    }
    if (
      images.some(
        (image) =>
          image.size > 20 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(image.type),
      )
    ) {
      setMessage(
        "صور المنتجات يجب أن تكون JPG أو PNG أو WebP وبحجم أقصى 20 ميجابايت.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    const productValues = {
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      fabric: form.fabric.trim() || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price
        ? Number(form.compare_at_price)
        : null,
      category_id: form.category_id || null,
      is_featured: form.is_featured,
    };

    const result = editing
      ? await supabase
          .from("products")
          .update(productValues)
          .eq("id", editing)
          .select("id")
          .single()
      : await supabase
          .from("products")
          .insert(productValues)
          .select("id")
          .single();
    if (result.error) {
      setBusy(false);
      setMessage(`تعذر حفظ المنتج: ${result.error.message}`);
      return;
    }
    const productId = result.data.id;
    const { error: variantError } = await supabase
      .from("product_variants")
      .upsert(
        usableVariants.map((item) => ({
          product_id: productId,
          size: item.size.trim(),
          color: item.color.trim(),
          stock: Math.max(0, Number(item.stock) || 0),
        })),
        { onConflict: "product_id,size,color" },
      );
    if (variantError) {
      setBusy(false);
      setMessage(
        `حُفظ المنتج لكن تعذر حفظ المقاسات والمخزون: ${variantError.message}`,
      );
      return;
    }
    if (editing) {
      const { data: savedVariants, error: savedVariantError } = await supabase
        .from("product_variants")
        .select("id,size,color")
        .eq("product_id", productId);
      if (savedVariantError) {
        setBusy(false);
        setMessage(
          `حُفظت الخيارات لكن تعذر التحقق منها: ${savedVariantError.message}`,
        );
        return;
      }
      const selectedKeys = new Set(
        usableVariants.map(
          (item) => `${item.size.trim()}\u0000${item.color.trim()}`,
        ),
      );
      const retiredIds = (savedVariants ?? [])
        .filter((item) => !selectedKeys.has(`${item.size}\u0000${item.color}`))
        .map((item) => item.id);
      if (retiredIds.length) {
        const { error } = await supabase
          .from("product_variants")
          .delete()
          .in("id", retiredIds);
        if (error) {
          setBusy(false);
          setMessage(
            `حُفظت الخيارات لكن تعذر حذف التركيبات المحذوفة: ${error.message}`,
          );
          return;
        }
      }
    }

for (const [index, image] of images.entries()) {
  setMessage(
    `جارٍ رفع الصورة ${index + 1} من ${images.length}: ${image.name}`
  )

  try {
    const uploaded = await uploadImage(image, productId)

    const { error: imageError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        image_url: uploaded.url,
        storage_path: uploaded.path,
        alt_text: form.name.trim(),
        position: existingImages.length + index,
      })

    if (imageError) {
      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([uploaded.path])

      throw new Error(
        `تم رفع الصورة لكن فشل حفظ بياناتها: ${imageError.message}`
      )
    }

  } catch (error) {
    setBusy(false)

    setMessage(
      error instanceof Error
        ? error.message
        : 'حدث خطأ غير معروف أثناء رفع الصورة.'
    )

    return
  }
}

    setBusy(false);
    setMessage(
      editing
        ? "تم تحديث المنتج."
        : "تم إنشاء المنتج كمسودة. ارفعيه من قائمة المنتجات.",
    );
    reset();
    await load();
  };

  const removeProduct = async (product: Product) => {
    if (!supabase || !(await confirmDelete(product.name))) return;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);
    if (error) setMessage(`تعذر حذف المنتج: ${error.message}`);
    else {
      setMessage("تم حذف المنتج.");
      await load();
    }
  };
  const toggleProduct = async (product: Product) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (error) setMessage(`تعذر تحديث حالة المنتج: ${error.message}`);
    else await load();
  };
  const removeProductImage = async (image: AdminImage) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("product_images")
      .delete()
      .eq("id", image.id);
    if (error) {
      setMessage(`تعذر حذف الصورة: ${error.message}`);
      return;
    }
    if (image.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .remove([image.storage_path]);
      if (storageError)
        setMessage(
          `تم حذف الصورة من المنتج لكن تعذر حذف ملف التخزين: ${storageError.message}`,
        );
    }
    setExistingImages(existingImages.filter((item) => item.id !== image.id));
  };

  return (
    <>
      <section className="admin-card product-editor-card">
        <h2>{editing ? "تعديل منتج" : "إضافة منتج"}</h2>
        <form className="product-admin-form" onSubmit={save}>
          <label>
            اسم المنتج
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                  slug: editing
                    ? form.slug
                    : event.target.value.trim().replace(/\s+/g, "-"),
                })
              }
            />
          </label>
          <label>
            الرابط النصي
            <input
              required
              value={form.slug}
              onChange={(event) =>
                setForm({ ...form, slug: event.target.value })
              }
            />
          </label>
          <label>
            السعر (ج.م)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
            />
          </label>
          <label>
            السعر قبل الخصم (ج.م)
            <input
              type="number"
              min={form.price || 0}
              step="0.01"
              value={form.compare_at_price}
              onChange={(event) =>
                setForm({ ...form, compare_at_price: event.target.value })
              }
            />
          </label>
          <label>
            القسم
            <select
              value={form.category_id}
              onChange={(event) =>
                setForm({ ...form, category_id: event.target.value })
              }
            >
              <option value="">بدون قسم</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            الوصف
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <label>
            نوع القماش
            <input
              value={form.fabric}
              onChange={(event) =>
                setForm({ ...form, fabric: event.target.value })
              }
            />
          </label>

<div className="wide-field product-image-uploader">
  <span className="image-upload-heading">
    <Images size={17} /> صور المنتج
  </span>

  <input
    ref={imageInputRef}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    hidden
    onChange={(event) => {
      const selected = Array.from(event.target.files || [])
      const invalid = selected.find((file) =>
        file.size > 20 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
      if (invalid) {
        setMessage(`الصورة ${invalid.name} غير صالحة أو أكبر من 20 ميجابايت.`)
        event.target.value = ''
        return
      }

      setImages((current) => [...current, ...selected])
      setMessage(selected.length ? `تم اختيار ${selected.length} صورة.` : '')
      event.target.value = ''
    }}
  />

  <button
    type="button"
    className="image-upload-button"
    onClick={() => imageInputRef.current?.click()}
    disabled={busy}
  >
    <span className="image-upload-icon">
      <Upload size={19} />
    </span>

    <span className="image-upload-label-copy">
      <b>اختاري صور المنتج</b>
      <small>يمكنك اختيار عدة صور · JPG أو PNG أو WebP</small>
    </span>

    <span className="image-upload-action">
      <Plus size={16} /> استعراض
    </span>
  </button>

  {images.length > 0 && (
    <>
      <p className="image-selection-count">
        تم اختيار {images.length} صورة
      </p>

      <div className="existing-images pending-images">
        {images.map((image, index) => (
          <PendingProductImage
            key={`${image.name}-${image.lastModified}-${index}`}
            file={image}
            onRemove={() =>
              setImages((current) =>
                current.filter((_, i) => i !== index)
              )
            }
          />
        ))}
      </div>
    </>
  )}
</div>

          {existingImages.length > 0 && (
            <div className="existing-images wide-field">
              {existingImages.map((image) => (
                <div key={image.id}>
                  <img src={image.image_url} alt="صورة المنتج" />
                  <button
                    type="button"
                    onClick={() => void removeProductImage(image)}
                  >
                    حذف الصورة
                  </button>
                </div>
              ))}
            </div>
          )}
          <section className="variant-editor wide-field" aria-label="خيارات المنتج والمخزون">
            <header className="variant-editor-heading">
              <div>
                <b>المقاسات والألوان والمخزون</b>
                <small>أضيفي المقاسات والألوان أولًا، ثم حددي مخزون كل تركيبة.</small>
              </div>
              <span>{variants.filter((item) => item.size.trim() && item.color.trim()).length} تركيبة</span>
            </header>
            <div className="variant-option-groups">
              <section className="variant-option-section">
                <div className="variant-option-title"><b>المقاسات</b><small>{sizes.length} مقاس</small></div>
                <div className="variant-tags">
                  {sizes.map((size) => (
                    <span className="variant-tag" key={size}>
                      {size}
                      <button type="button" aria-label={`حذف المقاس ${size}`} onClick={() => setVariants((current) => current.filter((item) => item.size.trim() !== size))}><X size={13} /></button>
                    </span>
                  ))}
                  {!sizes.length && <span className="variant-empty">لم تتم إضافة مقاسات بعد.</span>}
                </div>
                <div className="variant-option-add">
                  <input aria-label="مقاس جديد" placeholder="مثال: 56" value={newSize} onChange={(event) => setNewSize(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSize(); } }} />
                  <button type="button" className="button button-outline" onClick={addSize} disabled={!newSize.trim() || sizes.includes(newSize.trim())}><Plus size={15} /> إضافة مقاس</button>
                </div>
              </section>
              <section className="variant-option-section">
                <div className="variant-option-title"><b>الألوان</b><small>{colors.length} لون</small></div>
                <div className="variant-tags">
                  {colors.map((color) => (
                    <span className="variant-tag" key={color}>
                      {color}
                      <button type="button" aria-label={`حذف اللون ${color}`} onClick={() => setVariants((current) => current.filter((item) => item.color.trim() !== color))}><X size={13} /></button>
                    </span>
                  ))}
                  {!colors.length && <span className="variant-empty">لم تتم إضافة ألوان بعد.</span>}
                </div>
                <div className="variant-option-add">
                  <input aria-label="لون جديد" placeholder="مثال: أسود" value={newColor} onChange={(event) => setNewColor(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addColor(); } }} />
                  <button type="button" className="button button-outline" onClick={addColor} disabled={!newColor.trim() || colors.includes(newColor.trim())}><Plus size={15} /> إضافة لون</button>
                </div>
              </section>
            </div>
            <section className="variant-stock-section">
              <div className="variant-option-title"><b>مخزون كل تركيبة</b><small>المخزون مستقل لكل لون ومقاس</small></div>
              {variants.length ? (
                <div className="variant-stock-list">
                  {variants.map((variant, index) => (
                    <div className="variant-stock-row" key={`${variant.size}-${variant.color}-${index}`}>
                      <span className="variant-stock-name">{variant.color} <span>·</span> مقاس {variant.size}</span>
                      <label>الكمية المتاحة
                        <input aria-label={`مخزون ${variant.color} مقاس ${variant.size}`} type="number" min="0" value={variant.stock} onChange={(event) => setVariants((current) => current.map((item, row) => row === index ? { ...item, stock: event.target.value } : item))} />
                      </label>
                      <button type="button" className="variant-stock-remove" aria-label={`حذف تركيبة ${variant.color} مقاس ${variant.size}`} onClick={() => setVariants((current) => current.filter((_, row) => row !== index))}><X size={15} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="variant-empty">أضيفي مقاسًا ولونًا لبدء تحديد المخزون.</p>
              )}
              {missingVariants.length > 0 && (
                <div className="variant-missing-combinations">
                  <small>تركيبات غير مضافة:</small>
                  {missingVariants.map(({ size, color }) => (
                    <button
                      type="button"
                      key={`${size}-${color}`}
                      onClick={() => setVariants((current) => [...current, { size, color, stock: "0" }])}
                    >
                      <Plus size={13} /> {color} · {size}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </section>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(event) =>
                setForm({ ...form, is_featured: event.target.checked })
              }
            />{" "}
            منتج مميز
          </label>
          <div className="wide-field form-actions">
            <button className="button button-dark" disabled={busy}>
              {busy
                ? "جارٍ الحفظ…"
                : editing
                  ? "حفظ التعديلات"
                  : "إنشاء كمسودة"}
            </button>
            {editing && (
              <button
                type="button"
                className="button button-outline"
                onClick={reset}
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
        {message && <ToastMessage message={message} />}
      </section>
      <section className="admin-card product-list-card">
        <div className="admin-section-heading"><div><p className="eyebrow">كتالوج المتجر</p><h2>المنتجات</h2></div><span>{products.length} منتج</span></div>
        {products.length ? (
          <div className="admin-product-list">{products.map((product) => (
            <div className="admin-row product-admin-row" key={product.id}>
              <span>{product.name}</span>
              <span>{money(product.price)}</span>
              <span className={`admin-visibility ${product.is_active ? "is-published" : "is-draft"}`}>{product.is_active ? "منشور" : "مسودة"}</span>
              <button className="admin-row-edit" onClick={() => void edit(product)}>تعديل</button>
              <button className="admin-row-toggle" onClick={() => void toggleProduct(product)}>
                {product.is_active ? "إخفاء" : "نشر"}
              </button>
              <button className="admin-row-delete" onClick={() => void removeProduct(product)}>حذف</button>
            </div>
          ))}</div>
        ) : (
          <p className="muted-copy">لا توجد منتجات بعد.</p>
        )}
      </section>
    </>
  );
}

function CategoryManagement() {
  const confirmDelete = useAdminDeleteConfirmation();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingImagePath, setEditingImagePath] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    image_url: "",
    position: "0",
  });
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("categories")
      .select(
        "id,name,slug,description,image_url,image_path,position,is_active",
      )
      .order("position");
    if (error) setMessage(`تعذر تحميل الأقسام: ${error.message}`);
    else setCategories((data ?? []) as AdminCategory[]);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const slug = form.slug
      .trim()
      .toLocaleLowerCase("ar")
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "");
    if (
      imageFile &&
      (imageFile.size > 20 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type))
    ) {
      setMessage(
        "الصورة يجب أن تكون JPG أو PNG أو WebP وبحجم أقصى 20 ميجابايت.",
      );
      return;
    }
    let uploadedPath: string | null = null;
    let imageUrl = form.image_url.trim() || null;

if (imageFile) {
  try {
    const uploaded = await uploadImage(imageFile, 'categories')

    uploadedPath = uploaded.path
    imageUrl = uploaded.url

  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : 'تعذر رفع صورة القسم.'
    )

    return
  }
}

    const values = {
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      image_url: imageUrl,
      image_path: uploadedPath || editingImagePath,
      position: Number(form.position) || 0,
    };
    const result = editing
      ? await supabase.from("categories").update(values).eq("id", editing)
      : await supabase.from("categories").insert(values);
    if (result.error) {
      if (uploadedPath)
        await supabase.storage.from("product-images").remove([uploadedPath]);
      setMessage(`تعذر حفظ القسم: ${result.error.message}`);
    } else {
      if (uploadedPath && editingImagePath) {
        const { error: removeError } = await supabase.storage
          .from("product-images")
          .remove([editingImagePath]);
        if (removeError)
          setMessage(
            `تم حفظ القسم لكن تعذر حذف الصورة القديمة: ${removeError.message}`,
          );
      } else setMessage("تم حفظ القسم.");
      setEditing(null);
      setEditingImagePath(null);
      setImageFile(null);
      setForm({
        name: "",
        slug: "",
        description: "",
        image_url: "",
        position: "0",
      });
      await load();
    }
  };
  return (
    <>
      <section className="admin-card admin-orders-card">
        <h2>{editing ? "تعديل القسم" : "إضافة قسم"}</h2>
        <form className="admin-form category-admin-form" onSubmit={save}>
          <label>
            اسم القسم
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                  slug: editing
                    ? form.slug
                    : event.target.value.trim().replace(/\s+/g, "-"),
                })
              }
            />
          </label>
          <label>
            الرابط النصي
            <input
              required
              value={form.slug}
              onChange={(event) =>
                setForm({ ...form, slug: event.target.value })
              }
            />
          </label>
          <label>
            ترتيب العرض
            <input
              type="number"
              value={form.position}
              onChange={(event) =>
                setForm({ ...form, position: event.target.value })
              }
            />
          </label>
          <label>
            رابط صورة القسم
            <input
              type="url"
              value={form.image_url}
              onChange={(event) =>
                setForm({ ...form, image_url: event.target.value })
              }
            />
          </label>
          <div className="wide-field">
            <CategoryImagePicker
              file={imageFile}
              onChange={setImageFile}
              onClear={() => setImageFile(null)}
            />
          </div>
          <label className="wide-field">
            الوصف
            <input
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <div className="category-form-actions">
            <button className="button button-dark">حفظ القسم</button>
            {editing && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setEditing(null);
                  setEditingImagePath(null);
                  setImageFile(null);
                  setForm({
                    name: "",
                    slug: "",
                    description: "",
                    image_url: "",
                    position: "0",
                  });
                }}
              >
                إلغاء
              </button>
            )}
          </div>
        </form>
        {message && <ToastMessage message={message} />}
      </section>
      <section className="admin-card">
        <h2>الأقسام</h2>
        {categories.map((category) => (
          <div className="admin-row" key={category.id}>
            <span>{category.name}</span>
            <span>{category.slug}</span>
            <span>{category.is_active ? "منشور" : "مخفي"}</span>
            <button
              onClick={() => {
                setEditing(category.id);
                setEditingImagePath(category.image_path || null);
                setImageFile(null);
                setForm({
                  name: category.name,
                  slug: category.slug,
                  description: category.description || "",
                  image_url: category.image_url || "",
                  position: String(category.position || 0),
                });
              }}
            >
              تعديل
            </button>
            <button
              onClick={async () => {
                if (!supabase) return;
                const { error } = await supabase
                  .from("categories")
                  .update({ is_active: !category.is_active })
                  .eq("id", category.id);
                if (error) setMessage(error.message);
                else await load();
              }}
            >
              {category.is_active ? "إخفاء" : "نشر"}
            </button>
            <button
              onClick={async () => {
                if (!supabase || !(await confirmDelete(category.name)))
                  return;
                const { error } = await supabase
                  .from("categories")
                  .delete()
                  .eq("id", category.id);
                if (error) setMessage(error.message);
                else {
                  if (category.image_path)
                    await supabase.storage
                      .from("product-images")
                      .remove([category.image_path]);
                  await load();
                }
              }}
            >
              حذف
            </button>
          </div>
        ))}
      </section>
    </>
  );
}

function OrderManagement() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    if (!supabase) return;
    const { data, error: resultError } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,payment_status,total,deposit_amount,remaining_amount,created_at,profiles(full_name,phone)",
      )
      .order("created_at", { ascending: false });
    if (resultError) setError(`تعذر تحميل الطلبات: ${resultError.message}`);
    else setOrders((data ?? []) as unknown as AdminOrder[]);
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="admin-card">
      <h2>كل الطلبات</h2>
      {error && <ToastMessage message={error} />}
      {orders.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>التاريخ</th>
                <th>الإجمالي</th>
                <th>المدفوع مقدمًا</th>
                <th>الدفع</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>
                    {order.profiles?.full_name ||
                      order.profiles?.phone ||
                      "عميل"}
                  </td>
                  <td>
                    {new Date(order.created_at).toLocaleDateString("ar-SA")}
                  </td>
                  <td>{money(order.total)}</td>
                  <td>{money(order.deposit_amount)}</td>
                  <td>
                    {order.payment_status === "deposit_confirmed"
                      ? "مؤكد"
                      : order.payment_status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </td>
                  <td>{orderStatusLabels[order.status]}</td>
                  <td>
                    <Link to={`/admin/orders/${order.id}`}>التفاصيل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-copy">لا توجد طلبات حتى الآن.</p>
      )}
    </section>
  );
}

function AdminOrderDetails({ orderId }: { orderId: string }) {
  const id = orderId;
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [status, setStatus] = useState<OrderStatus>("received");
  const [internalNote, setInternalNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    if (!supabase || !id) return;
    setLoading(true);
    setMessage("");
    setReceiptUrl("");
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          "id,user_id,order_number,status,payment_status,subtotal,discount_amount,delivery_fee,total,deposit_amount,remaining_amount,created_at,customer_note,internal_note,address_snapshot",
        )
        .eq("id", id)
        .maybeSingle();
      if (orderError) {
        setMessage(`تعذر تحميل الطلب: ${orderError.message}`);
        return;
      }
      if (!orderData) {
        setMessage("لم نعثر على الطلب.");
        return;
      }

      const baseOrder = {
        ...orderData,
        profiles: null,
        items: [],
        payment_receipts: [],
      } as unknown as AdminOrder;
      setOrder(baseOrder);
      setStatus(baseOrder.status);
      setInternalNote(baseOrder.internal_note || "");

      const [profileResult, itemsResult, receiptsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,phone")
          .eq("id", orderData.user_id)
          .maybeSingle(),
        supabase
          .from("order_items")
          .select("product_name,size,color,quantity,unit_price,line_total")
          .eq("order_id", id),
        supabase
          .from("payment_receipts")
          .select("id,storage_path,review_note,created_at")
          .eq("order_id", id)
          .order("created_at", { ascending: false }),
      ]);

      const result = {
        ...orderData,
        profiles: profileResult.error ? null : profileResult.data,
        items: itemsResult.data ?? [],
        payment_receipts: receiptsResult.data ?? [],
      } as unknown as AdminOrder;
      setOrder(result);
      setStatus(result.status);
      setInternalNote(result.internal_note || "");

      const relatedErrors = [
        profileResult.error && `بيانات العميل: ${profileResult.error.message}`,
        itemsResult.error && `منتجات الطلب: ${itemsResult.error.message}`,
        receiptsResult.error &&
          `إيصالات الدفع: ${receiptsResult.error.message}`,
      ].filter(Boolean);
      if (relatedErrors.length)
        setMessage(
          `ظهرت بيانات الطلب، لكن تعذر تحميل بعض التفاصيل — ${relatedErrors.join("؛ ")}`,
        );

      if (result.payment_receipts[0]) {
        const { data: signed, error: signedError } = await supabase.storage
          .from("payment-receipts")
          .createSignedUrl(result.payment_receipts[0].storage_path, 120);
        if (signedError)
          setMessage(
            (current) =>
              `${current ? `${current}؛ ` : ""}تعذر فتح الإيصال: ${signedError.message}`,
          );
        else setReceiptUrl(signed.signedUrl);
      }
    } catch (cause) {
      setMessage(
        `تعذر تحميل تفاصيل الطلب: ${cause instanceof Error ? cause.message : "حدث خطأ غير معروف."}`,
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setOrder(null);
    void load();
  }, [id]);
  const updateOrder = async (
    values: Record<string, unknown>,
    success: string,
  ) => {
    if (!supabase || !id) return;
    const { error } = await supabase.from("orders").update(values).eq("id", id);
    if (error) setMessage(`تعذر تحديث الطلب: ${error.message}`);
    else {
      setMessage(success);
      await load();
    }
  };
  const reviewReceipt = async (accepted: boolean) => {
    if (!order) return;
    const receipt = order.payment_receipts?.[0];
    if (accepted && !receipt) {
      setMessage("لا يمكن تأكيد رسوم التوصيل قبل إرفاق الإيصال.");
      return;
    }
    if (receipt && supabase) {
      const { error } = await supabase
        .from("payment_receipts")
        .update({
          review_note:
            reviewNote.trim() ||
            (accepted
              ? "تم قبول الإيصال"
              : "الإيصال غير واضح، يرجى إعادة الرفع"),
        })
        .eq("id", receipt.id);
      if (error) {
        setMessage(`تعذر تسجيل مراجعة الإيصال: ${error.message}`);
        return;
      }
    }
    await updateOrder(
      {
        payment_status: accepted ? "deposit_confirmed" : "rejected",
        status: accepted ? "deposit_confirmed" : "awaiting_deposit_review",
      },
      accepted
        ? "تم تأكيد دفع رسوم التوصيل."
        : "تم رفض الإيصال وإشعار العميل بإعادة رفعه.",
    );
  };
  if (loading && !order)
    return <section className="admin-card">جارٍ تحميل تفاصيل الطلب…</section>;
  if (!order)
    return (
      <section className="admin-card">
        <ToastMessage message={message || "تعذر تحميل تفاصيل الطلب."} />
        <Link to="/admin/orders">العودة إلى الطلبات</Link>
      </section>
    );
  return (
    <div className="admin-order-details">
      {message && <ToastMessage message={message} />}
      <section className="admin-card admin-order-overview">
        <div className="order-detail-heading">
          <h2>طلب رقم {order.order_number}</h2>
          <span className="status-pill">{orderStatusLabels[order.status]}</span>
        </div>
        <p>
          {order.profiles?.full_name || "العميل"} ·{" "}
          {order.profiles?.phone || "لا يوجد هاتف مسجل"} ·{" "}
          {new Date(order.created_at).toLocaleString("ar-SA")}
        </p>
        <h3>العنوان</h3>
        <p>
          {order.address_snapshot.recipient_name} ·{" "}
          {order.address_snapshot.phone}
          <br />
          {order.address_snapshot.region}، {order.address_snapshot.city}
          <br />
          {order.address_snapshot.address_line}
        </p>
        {order.address_snapshot.map_url && <a className="address-map-link" href={order.address_snapshot.map_url} target="_blank" rel="noopener noreferrer">فتح الموقع على الخريطة <ExternalLink size={13} /></a>}
        {order.customer_note && <p>ملاحظة العميل: {order.customer_note}</p>}
      </section>
      <section className="admin-card admin-order-items">
        <h2>المنتجات والمبالغ</h2>
        {order.items?.length ? (
          order.items.map((item, index) => (
            <div className="order-item-row" key={index}>
              <span>
                {item.product_name} · {item.color} · {item.size} ×{" "}
                {item.quantity}
              </span>
              <b>{money(item.line_total)}</b>
            </div>
          ))
        ) : (
          <p className="muted-copy">لا توجد تفاصيل منتجات مسجلة لهذا الطلب.</p>
        )}
        <div className="order-summary-lines">
          <div>
            <span>قيمة المنتجات قبل الخصم</span>
            <b>{money(Number(order.subtotal || 0) + Number(order.discount_amount || 0))}</b>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="order-discount-line">
              <span>خصم العروض</span>
              <b>− {money(Number(order.discount_amount))}</b>
            </div>
          )}
          <div>
            <span>قيمة المنتجات بعد الخصم</span>
            <b>{money(Number(order.subtotal || 0))}</b>
          </div>
          <div>
            <span>التوصيل</span>
            <b>{money(Number(order.delivery_fee || 0))}</b>
          </div>
          <div>
            <span>الإجمالي</span>
            <b>{money(order.total)}</b>
          </div>
          <div>
            <span>المدفوع مقدمًا</span>
            <b>{money(order.deposit_amount)}</b>
          </div>
          <div>
            <span>المتبقي</span>
            <b>{money(order.remaining_amount)}</b>
          </div>
          <div>
            <span>حالة الدفع</span>
            <b>
              {order.payment_status === "deposit_confirmed"
                ? "تم تأكيد رسوم التوصيل"
                : order.payment_status === "rejected"
                  ? "إيصال رسوم التوصيل مرفوض"
                  : order.payment_status === "paid"
                    ? "تم السداد"
                    : "بانتظار إيصال رسوم التوصيل"}
            </b>
          </div>
        </div>
      </section>
      <section className="admin-card admin-receipt-review">
        <h2>مراجعة رسوم التوصيل</h2>
        {receiptUrl ? (
          <a href={receiptUrl} target="_blank" rel="noreferrer">
            فتح الإيصال المرفق
          </a>
        ) : (
          <p className="muted-copy">لا يوجد إيصال مرفق حاليًا.</p>
        )}
        {order.payment_receipts?.[0]?.review_note && (
          <p className="muted-copy">
            ملاحظة سابقة: {order.payment_receipts[0].review_note}
          </p>
        )}
        <label className="admin-label">
          ملاحظة المراجعة
          <input
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="تظهر للعميل عند الرفض"
          />
        </label>
        <div className="form-actions">
          <button
            className="button button-dark"
            disabled={!order.payment_receipts?.length}
            onClick={() => void reviewReceipt(true)}
          >
            قبول الإيصال
          </button>
          <button
            className="button button-outline"
            disabled={!order.payment_receipts?.length}
            onClick={() => void reviewReceipt(false)}
          >
            رفض الإيصال
          </button>
        </div>
      </section>
      <section className="admin-card admin-order-update">
        <h2>تحديث حالة الطلب</h2>
        <div className="admin-form">
          <label>
            حالة الطلب
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus)}
            >
              {ORDER_STATUSES.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ملاحظة داخلية
            <input
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
            />
          </label>
          <button
            className="button button-dark"
            onClick={() =>
              void updateOrder(
                { status, internal_note: internalNote },
                "تم تحديث الطلب.",
              )
            }
          >
            حفظ التحديث
          </button>
        </div>
        {message && <ToastMessage message={message} />}
      </section>
    </div>
  );
}

function CustomerManagement() {
  const [customers, setCustomers] = useState<
    {
      id: string;
      email: string;
      full_name: string;
      phone: string;
      orders: {
        id: string;
        order_number: number;
        total: number;
        status: OrderStatus;
      }[];
    }[]
  >([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("profiles")
      .select("id,email,full_name,phone,orders(id,order_number,total,status)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage(`تعذر تحميل العملاء: ${error.message}`);
        else setCustomers((data ?? []) as unknown as typeof customers);
      });
  }, []);
  return (
    <section className="admin-card">
      <h2>العملاء</h2>
      {message && <ToastMessage message={message} />}
      {customers.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الهاتف</th>
                <th>عدد الطلبات</th>
                <th>قيمة الطلبات</th>
                <th>الطلبات السابقة</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.full_name || "—"}</td>
                  <td>{customer.email || "—"}</td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.orders.length}</td>
                  <td>
                    {money(
                      customer.orders.reduce(
                        (sum, order) => sum + Number(order.total),
                        0,
                      ),
                    )}
                  </td>
                  <td>
                    {customer.orders.map((order) => (
                      <div key={order.id}>
                        <Link to={`/admin/orders/${order.id}`}>
                          #{order.order_number} ·{" "}
                          {orderStatusLabels[order.status]}
                        </Link>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted-copy">لا توجد حسابات عملاء.</p>
      )}
    </section>
  );
}

type PromotionRecord = {
  id: string;
  title: string;
  description: string | null;
  category_id: string;
  discount_percent: number;
  image_url: string | null;
  storage_path: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
};

function localDateTimeValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function PromotionManagement() {
  const confirmDelete = useAdminDeleteConfirmation();
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    discount_percent: "10",
    starts_at: localDateTimeValue(new Date()),
    ends_at: "",
    is_active: true,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!supabase) return;
    const [offerResult, categoryResult] = await Promise.all([
      supabase
        .from("promotions")
        .select("id,title,description,category_id,discount_percent,image_url,storage_path,starts_at,ends_at,is_active")
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id,name,slug,description,image_url")
        .eq("is_active", true)
        .order("position"),
    ]);
    if (offerResult.error || categoryResult.error) {
      setMessage(`تعذر تحميل العروض: ${offerResult.error?.message || categoryResult.error?.message}`);
      return;
    }
    setPromotions((offerResult.data ?? []) as PromotionRecord[]);
    setCategories((categoryResult.data ?? []) as AdminCategory[]);
  };

  useEffect(() => { void load(); }, []);

  const reset = () => {
    setEditing(null);
    setImage(null);
    setForm({
      title: "",
      description: "",
      category_id: "",
      discount_percent: "10",
      starts_at: localDateTimeValue(new Date()),
      ends_at: "",
      is_active: true,
    });
  };

  const edit = (promotion: PromotionRecord) => {
    setEditing(promotion.id);
    setImage(null);
    setForm({
      title: promotion.title,
      description: promotion.description || "",
      category_id: promotion.category_id,
      discount_percent: String(promotion.discount_percent),
      starts_at: localDateTimeValue(new Date(promotion.starts_at)),
      ends_at: promotion.ends_at ? localDateTimeValue(new Date(promotion.ends_at)) : "",
      is_active: promotion.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    const discount = Number(form.discount_percent);
    const startsAt = new Date(form.starts_at);
    const endsAt = form.ends_at ? new Date(form.ends_at) : null;
    if (!form.title.trim() || !form.category_id || !Number.isFinite(discount) || discount <= 0 || discount > 100) {
      setMessage("أدخلي عنوان العرض، واختاري القسم، وحددي خصمًا من 1% إلى 100%.");
      return;
    }
    if (!Number.isFinite(startsAt.getTime()) || endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)) {
      setMessage("تحققي من تاريخ بداية العرض ونهايته.");
      return;
    }
    if (image && (image.size > 20 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      setMessage("صورة العرض يجب أن تكون JPG أو PNG أو WebP وبحجم أقصى 20 ميجابايت.");
      return;
    }

    setBusy(true);
    setMessage("");
    const current = promotions.find((promotion) => promotion.id === editing);
    let uploadedPath: string | null = null;
    let imageUrl = current?.image_url || null;
    try {
      if (image) {
        const uploaded = await uploadImage(image, "offers", "promotion-images");
        uploadedPath = uploaded.path;
        imageUrl = uploaded.url;
      }
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "تعذر رفع صورة العرض.");
      return;
    }

    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id,
      discount_percent: discount,
      image_url: imageUrl,
      storage_path: uploadedPath || current?.storage_path || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from("promotions").update(values).eq("id", editing)
      : await supabase.from("promotions").insert(values);
    if (result.error) {
      let cleanupMessage = "";
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from("promotion-images")
          .remove([uploadedPath]);
        if (cleanupError) cleanupMessage = `تعذر حذف الصورة المرفوعة غير المستخدمة: ${cleanupError.message}`;
      }
      setBusy(false);
      setMessage(`تعذر حفظ العرض: ${result.error.message}${cleanupMessage ? ` · ${cleanupMessage}` : ""}`);
      return;
    }

    if (uploadedPath && current?.storage_path) {
      const { error } = await supabase.storage.from("promotion-images").remove([current.storage_path]);
      if (error) setMessage(`تم حفظ العرض لكن تعذر حذف صورته القديمة: ${error.message}`);
    } else {
      setMessage(editing ? "تم تحديث العرض." : "تمت إضافة العرض.");
    }
    setBusy(false);
    reset();
    await load();
  };

  const toggle = async (promotion: PromotionRecord) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("promotions")
      .update({ is_active: !promotion.is_active, updated_at: new Date().toISOString() })
      .eq("id", promotion.id);
    if (error) setMessage(`تعذر تحديث العرض: ${error.message}`);
    else await load();
  };

  const remove = async (promotion: PromotionRecord) => {
    if (!supabase || !(await confirmDelete(promotion.title))) return;
    const { error } = await supabase.from("promotions").delete().eq("id", promotion.id);
    if (error) {
      setMessage(`تعذر حذف العرض: ${error.message}`);
      return;
    }
    if (promotion.storage_path) {
      const { error: imageError } = await supabase.storage
        .from("promotion-images")
        .remove([promotion.storage_path]);
      if (imageError) setMessage(`حُذف العرض لكن تعذر حذف صورته: ${imageError.message}`);
    }
    await load();
  };

  return (
    <>
      <section className="admin-card">
        <h2>{editing ? "تعديل العرض" : "إضافة عرض خصم"}</h2>
        <p className="muted-copy">اختاري قسمًا ونسبة خصم، وسيُطبّق العرض تلقائيًا على منتجاته خلال مدته.</p>
        <form className="promotion-form" onSubmit={(event) => void save(event)}>
          <label>عنوان العرض<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>القسم<select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">اختاري القسم</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label>نسبة الخصم (%)<span className="promotion-percent-input"><input required type="number" min="1" max="100" step="0.01" value={form.discount_percent} onChange={(event) => setForm({ ...form, discount_percent: event.target.value })} /><Percent size={15} /></span></label>
          <label>بداية العرض<input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
          <label>نهاية العرض <small>(اختياري)</small><input type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
          <div className="promotion-image-field">
            <span>صورة العرض</span>
            <label className="admin-image-upload">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} />
              {!image && editing && promotions.find((promotion) => promotion.id === editing)?.image_url && <img className="admin-image-current" src={promotions.find((promotion) => promotion.id === editing)?.image_url || undefined} alt="صورة العرض الحالية" />}
              <span className="admin-image-upload-icon"><Upload size={18} /></span>
              <span className="admin-image-upload-copy"><b>{image?.name || (editing ? "استبدال صورة العرض (اختياري)" : "أضيفي صورة جذابة للعرض")}</b><small>{image ? "تم اختيار الصورة" : editing && promotions.find((promotion) => promotion.id === editing)?.image_url ? "الصورة الحالية محفوظة ما لم تختاري صورة بديلة" : "JPG أو PNG أو WebP · بحد أقصى 20 ميجابايت"}</small></span>
              <span className="admin-image-upload-action">{image ? "تغيير الصورة" : "اختيار صورة"}</span>
            </label>
          </div>
          <label className="wide-field">وصف العرض<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="promotion-active-field"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> تفعيل العرض في موعده</label>
          <div className="promotion-actions wide-field">
            <button className="button button-dark" disabled={busy}>{busy ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "إضافة العرض"}</button>
            {editing && <button className="button button-outline" type="button" onClick={reset}>إلغاء</button>}
          </div>
        </form>
        {message && <ToastMessage message={message} />}
      </section>
      <section className="admin-card">
        <h2>العروض</h2>
        {promotions.length ? <div className="promotion-admin-list">{promotions.map((promotion) => (
          <article className="promotion-admin-row" key={promotion.id}>
            {promotion.image_url ? <img src={promotion.image_url} alt="" /> : <span className="promotion-admin-placeholder"><Percent /></span>}
            <div className="promotion-admin-copy">
              <b>{promotion.title}</b>
              <span>{categories.find((category) => category.id === promotion.category_id)?.name || "قسم غير متاح"} · خصم {promotion.discount_percent}%</span>
              <small>{promotion.is_active ? "مفعّل" : "متوقف"} · يبدأ {new Date(promotion.starts_at).toLocaleString("ar-EG")}{promotion.ends_at ? ` · ينتهي ${new Date(promotion.ends_at).toLocaleString("ar-EG")}` : ""}</small>
            </div>
            <button type="button" onClick={() => edit(promotion)}>تعديل</button>
            <button type="button" onClick={() => void toggle(promotion)}>{promotion.is_active ? "إيقاف" : "تفعيل"}</button>
            <button type="button" aria-label={`حذف ${promotion.title}`} onClick={() => void remove(promotion)}><Trash2 size={15} /></button>
          </article>
        ))}</div> : <p className="muted-copy">لم تتم إضافة عروض بعد.</p>}
      </section>
    </>
  );
}

function StoreSettings() {
const [settings, setSettings] = useState({
  store_name: "متجر الحلم",
  about_text: "",
  delivery_fee: "0",
  transfer_details: "",
  contact_phone: "",
  contact_email: "",
  instagram_url: "",
  facebook_url: "",
  tiktok_url: "",          // ← جديد
  return_policy: "",
  privacy_policy: "",
});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("store_settings")
      .select(
  "store_name,about_text,delivery_fee,transfer_details,contact_phone,contact_email,instagram_url,facebook_url,tiktok_url,return_policy,privacy_policy",
)
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage(`تعذر تحميل الإعدادات: ${error.message}`);
        else
          setSettings({
            store_name: data.store_name,
            about_text: data.about_text,
            delivery_fee: String(data.delivery_fee),
            transfer_details: data.transfer_details,
            contact_phone: data.contact_phone,
            contact_email: data.contact_email,
            instagram_url: data.instagram_url,
            facebook_url: data.facebook_url,
            tiktok_url: data.tiktok_url,
            return_policy: data.return_policy,
            privacy_policy: data.privacy_policy,
          });
      });
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase
      .from("store_settings")
      .update({
        store_name: settings.store_name,
        about_text: settings.about_text,
        delivery_fee: Number(settings.delivery_fee),
        transfer_details: settings.transfer_details,
        contact_phone: settings.contact_phone,
        contact_email: settings.contact_email,
        instagram_url: settings.instagram_url,
        facebook_url: settings.facebook_url,
        tiktok_url: settings.tiktok_url,
        return_policy: settings.return_policy,
        privacy_policy: settings.privacy_policy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setBusy(false);
    setMessage(
      error ? `تعذر حفظ الإعدادات: ${error.message}` : "تم حفظ إعدادات المتجر.",
    );
  };
  return (
    <section className="admin-card">
      <h2>إعدادات المتجر</h2>
      <form className="settings-form" onSubmit={save}>
        <label>
          اسم المتجر
          <input
            required
            value={settings.store_name}
            onChange={(event) =>
              setSettings({ ...settings, store_name: event.target.value })
            }
          />
        </label>
        <label>
          رقم التواصل
          <input
            value={settings.contact_phone}
            onChange={(event) =>
              setSettings({ ...settings, contact_phone: event.target.value })
            }
          />
        </label>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            value={settings.contact_email}
            onChange={(event) =>
              setSettings({ ...settings, contact_email: event.target.value })
            }
          />
        </label>
        <label>
          رابط إنستغرام
          <input
            type="url"
            value={settings.instagram_url}
            onChange={(event) =>
              setSettings({ ...settings, instagram_url: event.target.value })
            }
          />
        </label>
        <label>
          رابط فيسبوك
          <input
            type="url"
            value={settings.facebook_url}
            onChange={(event) =>
              setSettings({ ...settings, facebook_url: event.target.value })
            }
          />
        </label>
        <label>
  رابط تيك توك
  <input
    type="url"
    placeholder="https://www.tiktok.com/@yourstore"
    value={settings.tiktok_url}
    onChange={(event) =>
      setSettings({ ...settings, tiktok_url: event.target.value })
    }
  />
</label>
        <label>
          تكلفة التوصيل
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={settings.delivery_fee}
            onChange={(event) =>
              setSettings({ ...settings, delivery_fee: event.target.value })
            }
          />
        </label>
        <label className="wide-field">
          بيانات تحويل رسوم التوصيل
          <textarea
            value={settings.transfer_details}
            onChange={(event) =>
              setSettings({ ...settings, transfer_details: event.target.value })
            }
          />
        </label>
        <label className="wide-field">
          عن متجر الحلم
          <textarea
            value={settings.about_text}
            onChange={(event) =>
              setSettings({ ...settings, about_text: event.target.value })
            }
          />
        </label>
        <label className="wide-field">
          سياسة الاستبدال والاسترجاع
          <textarea
            value={settings.return_policy}
            onChange={(event) =>
              setSettings({ ...settings, return_policy: event.target.value })
            }
          />
        </label>
        <label className="wide-field">
          سياسة الخصوصية
          <textarea
            value={settings.privacy_policy}
            onChange={(event) =>
              setSettings({ ...settings, privacy_policy: event.target.value })
            }
          />
        </label>
        <button className="button button-dark" disabled={busy}>
          حفظ الإعدادات
        </button>
      </form>
      {message && <ToastMessage message={message} />}
    </section>
  );
}
function DeliveryZones() {
  const [rows, setRows] = useState<Record<string, { fee: string; active: boolean }>>({});
  const [bulk, setBulk] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("delivery_zones")
      .select("governorate,fee,is_active")
      .then(({ data, error }) => {
        if (error) {
          setMessage(`تعذر تحميل أسعار التوصيل: ${error.message}`);
          return;
        }
        const next: Record<string, { fee: string; active: boolean }> = {};
        GOVERNORATES.forEach((g) => (next[g] = { fee: "0", active: true }));
        (data ?? []).forEach((r) => {
          next[r.governorate] = { fee: String(r.fee), active: r.is_active };
        });
        setRows(next);
      });
  }, []);

  const applyToAll = () => {
    if (bulk === "" || Number(bulk) < 0 || !Number.isFinite(Number(bulk))) {
      setMessage("أدخلي سعرًا صحيحًا (0 أو أكثر).");
      return;
    }
    setRows((current) =>
      Object.fromEntries(
        Object.entries(current).map(([g, r]) => [g, { ...r, fee: bulk }]),
      ),
    );
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const invalid = GOVERNORATES.find((g) => {
      const v = rows[g]?.fee;
      return v === "" || !Number.isFinite(Number(v)) || Number(v) < 0;
    });
    if (invalid) {
      setMessage(`أدخلي سعر توصيل صحيح (0 أو أكثر) لمحافظة ${invalid}.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("delivery_zones").upsert(
      GOVERNORATES.map((g) => ({
        governorate: g,
        fee: Number(rows[g].fee),
        is_active: rows[g].active,
      })),
      { onConflict: "governorate" },
    );
    setBusy(false);
    setMessage(
      error
        ? `تعذر حفظ أسعار التوصيل: ${error.message}`
        : "تم حفظ أسعار التوصيل.",
    );
  };

  return (
    <section className="admin-card">
      <h2>أسعار التوصيل حسب المحافظة</h2>
      <p className="muted-copy">
        حددي سعرًا مختلفًا لكل محافظة. اكتبي 0 للتوصيل المجاني، وأوقفي المحافظة
        إذا كنتِ لا توصلين إليها.
      </p>
      <div className="zones-bulk">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="سعر موحد"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
        />
        <button type="button" className="button button-outline" onClick={applyToAll}>
          تطبيق على كل المحافظات
        </button>
      </div>
      <form onSubmit={save}>
        <div className="zones-grid">
          {GOVERNORATES.map((g) => (
            <div className={`zone-row${rows[g]?.active === false ? " is-off" : ""}`} key={g}>
              <b>{g}</b>
              <div className="zone-fee">
                <input
                  aria-label={`سعر التوصيل ${g}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rows[g]?.fee ?? ""}
                  onChange={(event) =>
                    setRows({ ...rows, [g]: { ...rows[g], fee: event.target.value } })
                  }
                />
                <span>ج.م</span>
              </div>
              <label className="zone-active">
                <input
                  type="checkbox"
                  checked={rows[g]?.active ?? true}
                  onChange={(event) =>
                    setRows({ ...rows, [g]: { ...rows[g], active: event.target.checked } })
                  }
                />
                متاح
              </label>
            </div>
          ))}
        </div>
        <button className="button button-dark" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ أسعار التوصيل"}
        </button>
      </form>
      {message && <ToastMessage message={message} />}
    </section>
  );
}
export default function AdminPage() {
  const location = useLocation();
  const path = location.pathname.replace(/\/+$/, "");
  const id = path.match(/^\/admin\/orders\/([^/]+)$/)?.[1];
  if (id)
    return (
      <AdminLayout active="orders">
        <AdminOrderDetails key={id} orderId={id} />
      </AdminLayout>
    );
  const active =
    path === "/admin" ? "dashboard" : path.split("/")[2] || "dashboard";
  return (
    <AdminLayout active={active}>
      {active === "products" ? (
        <ProductManagement />
      ) : active === "categories" ? (
        <CategoryManagement />
      ) : active === "promotions" ? (
        <PromotionManagement />
      ) : active === "orders" ? (
        <OrderManagement />
      ) : active === "customers" ? (
        <CustomerManagement />
     ) : active === "settings" ? (
  <>
    <StoreSettings />
    <DeliveryZones />
  </>
) : (
        <Dashboard />
      )}
    </AdminLayout>
  );
}
