import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from "react-router-dom";
import { Images, Plus, Upload, X } from "lucide-react";
import { EmptyState } from "../components/Common";
import { money } from "../components/Storefront";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  orderStatusLabels,
  type Category,
  type OrderStatus,
  type Product,
} from "../types";

const ORDER_STATUSES = Object.entries(orderStatusLabels) as [
  OrderStatus,
  string,
][];
type AdminOrder = {
  id: string;
  order_number: number;
  status: OrderStatus;
  payment_status: string;
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

async function uploadImage(file: File, folder: string) {
  if (!supabase) throw new Error("تعذر الاتصال بمخزن الصور.");

  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${fileName}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw new Error(`تعذر رفع الصورة: ${error.message}`);

  return {
    path,
    url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
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
    <main className="page-main admin-page">
      <div className="page-title">
        <p className="eyebrow">إدارة متجر الحلم</p>
        <h1>لوحة التحكم</h1>
      </div>
      <nav className="admin-tabs">
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
  );
}

function Dashboard() {
  const [stats, setStats] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("orders").select("id,status,total"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]).then(([orders, customers, products]) => {
      if (orders.error || customers.error || products.error) {
        setError(
          `تعذر تحميل الإحصائيات: ${orders.error?.message || customers.error?.message || products.error?.message}`,
        );
        return;
      }
      const all = orders.data ?? [];
      setStats([
        {
          label: "إجمالي المبيعات",
          value: money(
            all
              .filter((item) => item.status === "delivered")
              .reduce((sum, item) => sum + Number(item.total), 0),
          ),
        },
        { label: "كل الطلبات", value: String(all.length) },
        {
          label: "تحتاج متابعة",
          value: String(
            all.filter((item) =>
              ["received", "awaiting_deposit_review"].includes(item.status),
            ).length,
          ),
        },
        { label: "العملاء", value: String(customers.count ?? 0) },
        { label: "المنتجات المنشورة", value: String(products.count ?? 0) },
      ]);
    });
  }, []);
  return (
    <>
      <div className="stats-grid">
        {stats.map((item) => (
          <section className="admin-card stat-card" key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </section>
        ))}
      </div>
      {error && <p className="form-message">{error}</p>}
      <section className="admin-card">
        <h2>متابعة سريعة</h2>
        <p className="muted-copy">
          استخدمي أقسام لوحة التحكم لإدارة المنتجات والأقسام ومراجعة الطلبات
          وإيصالات العربون.
        </p>
        <Link className="button button-dark" to="/admin/orders">
          عرض الطلبات
        </Link>
      </section>
    </>
  );
}

function ProductManagement() {
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
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<AdminImage[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    setExistingImages(data.images || []);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          .update({ stock: 0 })
          .in("id", retiredIds);
        if (error) {
          setBusy(false);
          setMessage(
            `حُفظت الخيارات لكن تعذر إيقاف المقاسات المحذوفة: ${error.message}`,
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
    if (!supabase || !window.confirm(`حذف المنتج «${product.name}»؟`)) return;
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
      <section className="admin-card">
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
          <div className="variant-editor wide-field">
            <b>المقاسات والألوان والمخزون</b>
            {variants.map((variant, index) => (
              <div className="variant-row" key={index}>
                <input
                  aria-label="المقاس"
                  placeholder="المقاس"
                  value={variant.size}
                  onChange={(event) =>
                    setVariants(
                      variants.map((item, row) =>
                        row === index
                          ? { ...item, size: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label="اللون"
                  placeholder="اللون"
                  value={variant.color}
                  onChange={(event) =>
                    setVariants(
                      variants.map((item, row) =>
                        row === index
                          ? { ...item, color: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label="المخزون"
                  type="number"
                  min="0"
                  placeholder="المخزون"
                  value={variant.stock}
                  onChange={(event) =>
                    setVariants(
                      variants.map((item, row) =>
                        row === index
                          ? { ...item, stock: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setVariants(variants.filter((_, row) => row !== index))
                  }
                >
                  حذف
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setVariants([...variants, { size: "", color: "", stock: "0" }])
              }
            >
              إضافة خيار مقاس ولون
            </button>
          </div>
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
        {message && <p className="form-message">{message}</p>}
      </section>
      <section className="admin-card">
        <h2>المنتجات</h2>
        {products.length ? (
          products.map((product) => (
            <div className="admin-row" key={product.id}>
              <span>{product.name}</span>
              <span>{money(product.price)}</span>
              <span>{product.is_active ? "منشور" : "مسودة"}</span>
              <button onClick={() => void edit(product)}>تعديل</button>
              <button onClick={() => void toggleProduct(product)}>
                {product.is_active ? "إخفاء" : "نشر"}
              </button>
              <button onClick={() => void removeProduct(product)}>حذف</button>
            </div>
          ))
        ) : (
          <p className="muted-copy">لا توجد منتجات بعد.</p>
        )}
      </section>
    </>
  );
}

function CategoryManagement() {
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
      <section className="admin-card">
        <h2>{editing ? "تعديل القسم" : "إضافة قسم"}</h2>
        <form className="admin-form" onSubmit={save}>
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
        </form>
        {message && <p className="form-message">{message}</p>}
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
                if (!supabase || !window.confirm(`حذف القسم ${category.name}؟`))
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
      {error && <p className="form-message">{error}</p>}
      {orders.length ? (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>التاريخ</th>
                <th>الإجمالي</th>
                <th>العربون</th>
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
          "id,user_id,order_number,status,payment_status,total,deposit_amount,remaining_amount,created_at,customer_note,internal_note,address_snapshot",
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
      setMessage("لا يمكن تأكيد العربون قبل إرفاق الإيصال.");
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
        ? "تم قبول العربون."
        : "تم رفض الإيصال وإشعار العميل بإعادة رفعه.",
    );
  };
  if (loading && !order)
    return <section className="admin-card">جارٍ تحميل تفاصيل الطلب…</section>;
  if (!order)
    return (
      <section className="admin-card">
        <p className="form-message">{message || "تعذر تحميل تفاصيل الطلب."}</p>
        <Link to="/admin/orders">العودة إلى الطلبات</Link>
      </section>
    );
  return (
    <>
      {message && (
        <section className="admin-card">
          <p className="form-message">{message}</p>
        </section>
      )}
      <section className="admin-card">
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
        {order.customer_note && <p>ملاحظة العميل: {order.customer_note}</p>}
      </section>
      <section className="admin-card">
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
            <span>الإجمالي</span>
            <b>{money(order.total)}</b>
          </div>
          <div>
            <span>العربون</span>
            <b>{money(order.deposit_amount)}</b>
          </div>
          <div>
            <span>المتبقي</span>
            <b>{money(order.remaining_amount)}</b>
          </div>
          <div>
            <span>حالة الدفع</span>
            <b>{order.payment_status}</b>
          </div>
        </div>
      </section>
      <section className="admin-card">
        <h2>مراجعة العربون</h2>
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
      <section className="admin-card">
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
        {message && <p className="form-message">{message}</p>}
      </section>
    </>
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
      {message && <p className="form-message">{message}</p>}
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

function StoreSettings() {
  const [settings, setSettings] = useState({
    store_name: "متجر الحلم",
    about_text: "",
    deposit_type: "percentage",
    deposit_value: "20",
    delivery_fee: "0",
    transfer_details: "",
    contact_phone: "",
    contact_email: "",
    instagram_url: "",
    facebook_url: "",
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
        "store_name,about_text,deposit_type,deposit_value,delivery_fee,transfer_details,contact_phone,contact_email,instagram_url,facebook_url,return_policy,privacy_policy",
      )
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage(`تعذر تحميل الإعدادات: ${error.message}`);
        else
          setSettings({
            store_name: data.store_name,
            about_text: data.about_text,
            deposit_type: data.deposit_type,
            deposit_value: String(data.deposit_value),
            delivery_fee: String(data.delivery_fee),
            transfer_details: data.transfer_details,
            contact_phone: data.contact_phone,
            contact_email: data.contact_email,
            instagram_url: data.instagram_url,
            facebook_url: data.facebook_url,
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
        deposit_type: settings.deposit_type,
        deposit_value: Number(settings.deposit_value),
        delivery_fee: Number(settings.delivery_fee),
        transfer_details: settings.transfer_details,
        contact_phone: settings.contact_phone,
        contact_email: settings.contact_email,
        instagram_url: settings.instagram_url,
        facebook_url: settings.facebook_url,
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
          نوع العربون
          <select
            value={settings.deposit_type}
            onChange={(event) =>
              setSettings({ ...settings, deposit_type: event.target.value })
            }
          >
            <option value="percentage">نسبة مئوية</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
        </label>
        <label>
          {settings.deposit_type === "percentage"
            ? "نسبة العربون %"
            : "مبلغ العربون"}
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={settings.deposit_value}
            onChange={(event) =>
              setSettings({ ...settings, deposit_value: event.target.value })
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
          بيانات تحويل العربون
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
      {message && <p className="form-message">{message}</p>}
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
      ) : active === "orders" ? (
        <OrderManagement />
      ) : active === "customers" ? (
        <CustomerManagement />
      ) : active === "settings" ? (
        <StoreSettings />
      ) : (
        <Dashboard />
      )}
    </AdminLayout>
  );
}
