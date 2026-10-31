import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Heart,
  Instagram,
  Percent,
  Search,
  ShoppingBag,
  Truck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { setPageMetadata } from "../lib/seo";
import { addCartVariant } from "../lib/cart";
import type { Category, Product } from "../types";
import {
  categoryPromotions,
  promotionPercent,
  promotionPrice,
  type Promotion,
} from "../lib/promotions";
import { EmptyState, InfoPage, useToast } from "./Common";

export const money = (value: number) =>
  `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value)} ج.م`;

const normalizeFilterValue = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");

function uniqueFilterValues(values: (string | null | undefined)[]) {
  const unique = new Map<string, string>();
  values.forEach((value) => {
    const label = value?.trim();
    if (!label) return;
    const key = normalizeFilterValue(label);
    if (!unique.has(key)) unique.set(key, label);
  });
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "ar"));
}

function normalizeProductCategory(product: Product): Product {
  const category = product.category as
    | Product["category"]
    | NonNullable<Product["category"]>[];
  return {
    ...product,
    category: Array.isArray(category) ? category[0] ?? null : category,
  };
}

export function categoryFallback(index: number) {
  return [
    "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=80",
  ][index % 4];
}

function SectionHeading({
  eyebrow,
  title,
  action,
  actionText,
}: {
  eyebrow: string;
  title: string;
  action: string;
  actionText: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <Link className="text-link" to={action}>
        {actionText} <ArrowLeft size={16} />
      </Link>
    </div>
  );
}

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [socialLinks, setSocialLinks] = useState<{ instagram: string; facebook: string }>({
    instagram: "",
    facebook: "",
  });
  const [promotions, setPromotions] = useState<
    (Promotion & { category_id: string })[]
  >([]);
  const [promotionError, setPromotionError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.all([
      supabase
        .from("products")
        .select(
          "*, category:categories(name,slug,description,promotions(id,title,description,discount_percent,image_url)), images:product_images(image_url,alt_text,position), variants:product_variants(id,size,color,stock)",
        )
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("categories")
        .select("id,name,slug,description,image_url")
        .eq("is_active", true)
        .order("position"),
      supabase
        .from("promotions")
        .select("id,title,description,discount_percent,image_url,category_id")
        .eq("is_active", true)
        .lte("starts_at", new Date().toISOString())
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("store_settings")
        .select("instagram_url,facebook_url")
        .eq("id", true)
        .maybeSingle(),
    ]).then(([productResult, categoryResult, promotionResult, settingsResult]) => {
      if (!active) return;
      if (productResult.error)
        console.error(
          "تعذر تحميل المنتجات المميزة:",
          productResult.error.message,
        );
      else setProducts(((productResult.data ?? []) as Product[]).map(normalizeProductCategory));
      if (categoryResult.error)
        console.error("تعذر تحميل الأقسام:", categoryResult.error.message);
      else setCategories(categoryResult.data ?? []);
      if (promotionResult.error) {
        console.error("تعذر تحميل العروض:", promotionResult.error.message);
        setPromotionError(promotionResult.error.message);
      } else {
        setPromotionError("");
        setPromotions(
          (promotionResult.data ?? []) as (Promotion & {
            category_id: string;
          })[],
        );
      }
      if (settingsResult.error) {
        console.error("تعذر تحميل روابط التواصل للرئيسية:", settingsResult.error.message);
      } else {
        setSocialLinks({
          instagram: settingsResult.data?.instagram_url || "",
          facebook: settingsResult.data?.facebook_url || "",
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">
            <span /> مجموعة الحلم الجديدة
          </p>
          <h1>
            أناقةٌ تشبهك،
            <br />
            <em>وتحكي حكايتك.</em>
          </h1>
          <p className="hero-copy">
            عبايات خليجية صُممت لترافقك في كل لحظة، بتفاصيل متقنة وأناقة لا
            تحتاج إلى مناسبة.
          </p>
          <Link className="button button-dark" to="/products">
            اكتشفي المجموعة <ArrowLeft size={17} />
          </Link>
          <div className="hero-note">
            <span className="note-line" /> تصاميم مختارة بعناية
          </div>
        </div>
        <div className="hero-image">
          <img src="/home.webp" alt="إطلالة أنيقة بعباية سوداء" />
          <div className="hero-stamp">
            <span>أناقتك</span>
            <b>تبدأ</b>
            <span>من هنا</span>
          </div>
          <span className="image-caption">مجموعة الحلم</span>
        </div>
        <span className="hero-vertical">الحلم · صُنعت بحب</span>
      </section>
      <section className="trust-row">
        <div>
          <Truck />
          <span>
            <b>توصيل بكل عناية</b>
            <small>إلى باب منزلك</small>
          </span>
        </div>
        <div>
          <Check />
          <span>
            <b>خامات مختارة</b>
            <small>جودة تلمسينها</small>
          </span>
        </div>
        <div>
          <ShoppingBag />
          <span>
            <b>رسوم توصيل واضحة</b>
            <small>قيمة المنتجات عند الاستلام</small>
          </span>
        </div>
        <div>
          <Heart />
          <span>
            <b>تفاصيل تحبينها</b>
            <small>صنعت لأجلك</small>
          </span>
        </div>
      </section>
      {promotionError ? (
        <section className="section promotions-section">
          <div className="promotion-load-error">
            <b>تعذر تحميل العروض الآن</b>
            <span>
              تأكدي من تطبيق تحديث العروض في قاعدة بيانات Supabase ثم أعيدي
              تحميل الصفحة.
            </span>
            <small>{promotionError}</small>
          </div>
        </section>
      ) : (
        <section className="section promotions-section">
          <SectionHeading
            eyebrow="اختيارات مميزة لفترة محدودة"
            title="عروض الحلم"
            action="/products"
            actionText="كل العبايات"
          />
          {promotions.length > 0 ? (
            <div className="promotion-grid">
              {promotions.map((promotion) => {
                const category = categories.find(
                  (item) => item.id === promotion.category_id,
                );
                if (!category) return null;
                return (
                  <Link
                    className="promotion-card"
                    to={`/products?category=${encodeURIComponent(category.slug)}&offer=${encodeURIComponent(promotion.id)}`}
                    key={promotion.id}
                  >
                    {promotion.image_url ? (
                      <img
                        src={promotion.image_url}
                        alt={promotion.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="promotion-card-placeholder">
                        <Percent size={30} />
                      </div>
                    )}
                    <span className="promotion-card-badge">
                      خصم {promotion.discount_percent}%
                    </span>
                    <div className="promotion-card-copy">
                      <small>{category.name}</small>
                      <h3>{promotion.title}</h3>
                      {promotion.description && <p>{promotion.description}</p>}
                      <span>
                        اكتشفي العرض <ArrowLeft size={15} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="muted-copy">
              لا توجد عروض سارية الآن. ستظهر العروض هنا تلقائيًا عند تفعيلها
              وتحديد فترة سريانها.
            </p>
          )}
        </section>
      )}
      <section className="section categories-section">
        <SectionHeading
          eyebrow="اختاري ما يشبهك"
          title="لكل لحظة، حكاية"
          action="/categories"
          actionText="كل الأقسام"
        />
        {categories.length ? (
          <div className="category-grid">
            {categories.slice(0, 4).map((category, index) => (
              <Link
                className="category-card"
                to={`/products?category=${category.slug}`}
                key={category.id}
              >
                <img
                  src={category.image_url || categoryFallback(index)}
                  alt={category.name}
                />
                <span>{category.name}</span>
                <ArrowUpLeft size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="أقسامنا في انتظارك"
            message="ستظهر الأقسام هنا بمجرد إضافتها من لوحة الإدارة."
          />
        )}
      </section>
      <section className="section featured-section">
        <SectionHeading
          eyebrow="اختيارات الحلم"
          title="قطع تستحق أن تُرى"
          action="/products"
          actionText="تصفحي العبايات"
        />
        <ProductGrid products={products} />
      </section>
      <section className="story-section" id="story">
        <div className="story-image">
          <img src="/story.jpg" alt="أناقة العباية الخليجية" />
        </div>
        <div className="story-copy">
          <p className="eyebrow">من القلب إلى خزانة أناقتك</p>
          <h2>
            كل تفصيلة
            <br />
            لها <em>حكاية.</em>
          </h2>
          <p>
            في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة
            أيامك الجميلة، وتفصيلاً يشبهك أنتِ.
          </p>
          <Link className="text-link" to="/about">
            اكتشفي حكايتنا <ArrowLeft size={16} />
          </Link>
        </div>
      </section>
      <section className="newsletter">
        <span>رسائلٌ من الحلم</span>
        <h2>
          كوني أول من يعرف <em>حكايتنا القادمة.</em>
        </h2>
        <p>تابعينا لتصلك جديد مجموعاتنا وإلهاماتنا.</p>
        {(socialLinks.instagram || socialLinks.facebook) && <div className="newsletter-actions">
          {socialLinks.instagram && <a className="button button-outline" href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
            <Instagram size={17} /> تابعي الحلم على إنستغرام
          </a>}
          {socialLinks.facebook && <a className="button button-outline" href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
            <Facebook size={17} /> تابعي الحلم على فيسبوك
          </a>}
        </div>}
      </section>
    </main>
  );
}

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get("category")?.trim() || "";
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryInfo, setCategoryInfo] = useState<{
    name: string;
    description: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [fabric, setFabric] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [discounted, setDiscounted] = useState(false);
  const [availability, setAvailability] = useState("");
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    let active = true;
    const loadProducts = async () => {
      const productRequest = client
        .from("products")
        .select(
          "*, category:categories(name,slug,description,promotions(id,title,description,discount_percent,image_url)), images:product_images(image_url,alt_text,position), variants:product_variants(id,size,color,stock)",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const categoryRequest = categorySlug
        ? client
            .from("categories")
            .select("name,description")
            .eq("slug", categorySlug)
            .eq("is_active", true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [productResult, categoryResult] = await Promise.all([
        productRequest,
        categoryRequest,
      ]);
      if (!active) return;
      if (productResult.error)
        setError("تعذر تحميل العبايات الآن. حاولي مرة أخرى لاحقًا.");
      else setProducts((productResult.data ?? []) as Product[]);
      if (categoryResult.error)
        setError("تعذر تحميل بيانات القسم الآن. حاولي مرة أخرى لاحقًا.");
      else setCategoryInfo(categoryResult.data);
      setLoading(false);
    };

    setLoading(true);
    setError("");
    setCategoryInfo(null);
    setProducts([]);
    setQuery("");
    setSize("");
    setColor("");
    setFabric("");
    setMinPrice("");
    setMaxPrice("");
    setDiscounted(false);
    setAvailability("");
    void loadProducts();
    return () => {
      active = false;
    };
  }, [categorySlug]);

  const sizes = uniqueFilterValues(
    products.flatMap(
      (product) => product.variants?.map((variant) => variant.size) || [],
    ),
  );
  const colors = uniqueFilterValues(
    products.flatMap(
      (product) => product.variants?.map((variant) => variant.color) || [],
    ),
  );
  const fabrics = uniqueFilterValues(products.map((product) => product.fabric));
  const visible = products
    .filter(
      (product) =>
        (!categorySlug ||
          normalizeFilterValue(product.category?.slug || "") ===
            normalizeFilterValue(categorySlug)) &&
        product.name.includes(query.trim()) &&
        (!fabric ||
          normalizeFilterValue(product.fabric || "") ===
            normalizeFilterValue(fabric)) &&
        (!minPrice ||
          promotionPrice(product.price, categoryPromotions(product.category)) >=
            Number(minPrice)) &&
        (!maxPrice ||
          promotionPrice(product.price, categoryPromotions(product.category)) <=
            Number(maxPrice)) &&
        (!discounted ||
          promotionPercent(categoryPromotions(product.category)) > 0 ||
          Boolean(
            product.compare_at_price &&
            product.compare_at_price > product.price,
          )) &&
        ((!size && !color) ||
          product.variants?.some(
            (variant) =>
              (!size ||
                normalizeFilterValue(variant.size) ===
                  normalizeFilterValue(size)) &&
              (!color ||
                normalizeFilterValue(variant.color) ===
                  normalizeFilterValue(color)) &&
              variant.stock > 0,
          )) &&
        (!availability ||
          (availability === "available"
            ? product.variants?.some((variant) => variant.stock > 0)
            : product.variants?.every((variant) => variant.stock === 0))),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? promotionPrice(a.price, categoryPromotions(a.category)) -
          promotionPrice(b.price, categoryPromotions(b.category))
        : sort === "price-desc"
          ? promotionPrice(b.price, categoryPromotions(b.category)) -
            promotionPrice(a.price, categoryPromotions(a.category))
          : 0,
    );
  const activeFilterCount = [
    query,
    size,
    color,
    fabric,
    minPrice,
    maxPrice,
    discounted ? "discounted" : "",
    availability,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setQuery("");
    setSize("");
    setColor("");
    setFabric("");
    setMinPrice("");
    setMaxPrice("");
    setDiscounted(false);
    setAvailability("");
    setSort("newest");
  };
  return (
    <main className="page-main products-page">
      <div className="page-title products-hero">
        <p className="eyebrow">من مجموعتنا إليكِ</p>
        <h1>
          {categorySlug ? categoryInfo?.name || "منتجات القسم" : "العبايات"}
        </h1>
        <p>
          {categorySlug
            ? categoryInfo?.description ||
              "تصفحي منتجات هذا القسم واختاري ما يناسبك."
            : "اكتشفي قطعًا صُممت لتكون جزءًا من حكايتك."}
        </p>
        {categorySlug && (
          <Link className="text-link category-filter-reset" to="/products">
            عرض كل المنتجات <ArrowLeft size={15} />
          </Link>
        )}
        <span className="products-hero-seal"><ShoppingBag size={18} /><small>أناقة<br />تليق بكِ</small></span>
      </div>
      <div className="products-toolbar-heading">
        <div><p className="eyebrow">اختاري إطلالتك</p><h2>تصفحي المجموعة</h2></div>
        <span className="products-count">{loading ? "جارٍ التحميل…" : `${visible.length} قطعة`}</span>
      </div>
      <div className="toolbar product-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحثي عن عباية"
          />
        </label>
        <select
          aria-label="المقاس"
          value={size}
          onChange={(event) => setSize(event.target.value)}
        >
          <option value="">كل المقاسات</option>
          {sizes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="اللون"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        >
          <option value="">كل الألوان</option>
          {colors.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="نوع القماش"
          value={fabric}
          onChange={(event) => setFabric(event.target.value)}
        >
          <option value="">كل الخامات</option>
          {fabrics.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <label className="price-filter">
          من
          <input
            aria-label="أقل سعر"
            type="number"
            min="0"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
          />
        </label>
        <label className="price-filter">
          إلى
          <input
            aria-label="أعلى سعر"
            type="number"
            min="0"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </label>
        <label className="discount-filter">
          <input
            type="checkbox"
            checked={discounted}
            onChange={(event) => setDiscounted(event.target.checked)}
          />{" "}
          عروض
        </label>
        <select
          aria-label="التوفر"
          value={availability}
          onChange={(event) => setAvailability(event.target.value)}
        >
          <option value="">كل المنتجات</option>
          <option value="available">متوفر</option>
          <option value="unavailable">نفد المخزون</option>
        </select>
        <select
          aria-label="ترتيب المنتجات"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="newest">الأحدث</option>
          <option value="price-asc">السعر: الأقل أولًا</option>
          <option value="price-desc">السعر: الأعلى أولًا</option>
        </select>
        {activeFilterCount > 0 && <button className="clear-product-filters" type="button" onClick={clearFilters}><X size={14} /> مسح الفلاتر ({activeFilterCount})</button>}
      </div>
      {error ? (
        <EmptyState title="حدث خطأ" message={error} />
      ) : loading ? (
        <div className="loading-grid">
          {[1, 2, 3, 4].map((item) => (
            <div className="skeleton" key={item} />
          ))}
        </div>
      ) : (
        <ProductGrid products={visible} />
      )}
    </main>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length)
    return (
      <EmptyState
        title="مساحة تنتظر عبايتك القادمة"
        message={
          isSupabaseConfigured
            ? "لا توجد منتجات منشورة في هذا القسم حاليًا."
            : "بعد ربط Supabase وإضافة المنتجات، ستجدينها هنا."
        }
      />
    );
  return (
    <div className="product-grid">
      {products.map((product) => (
        <article className="product-card" key={product.id}>
          <div className="product-photo">
            <Link
              to={`/products/${product.slug}`}
              aria-label={`تفاصيل ${product.name}`}
            >
              {product.images?.[0]?.image_url ? (
                <img
                  src={product.images[0].image_url}
                  alt={product.images[0].alt_text || product.name}
                  loading="lazy"
                />
              ) : (
                <div className="no-image">الحلم</div>
              )}
              <span className="product-badge">
                {product.is_featured ? "اختيار الحلم" : "من مجموعتنا"}
              </span>
            </Link>
            <FavoriteButton productId={product.id} />
            <ProductStock product={product} />
          </div>
          <Link className="product-card-info" to={`/products/${product.slug}`}>
            <div className="product-meta">
              <span>{product.category?.name || "عبايات الحلم"}</span>
              <span>
                {product.variants?.length ? "مقاسات متعددة" : "تفاصيل أنيقة"}
              </span>
            </div>
            <h3>{product.name}</h3>
            <ProductPrice product={product} />
          </Link>
          <ProductQuickAdd product={product} />
        </article>
      ))}
    </div>
  );
}

function ProductPrice({ product }: { product: Product }) {
  const promotions = categoryPromotions(product.category);
  const discount = promotionPercent(promotions);
  const price = promotionPrice(product.price, promotions);
  return (
    <div className="product-price">
      {money(price)}
      {discount > 0 ? (
        <>
          <del>{money(product.price)}</del>
          <span className="discount-price-badge">خصم {discount}%</span>
        </>
      ) : (
        product.compare_at_price &&
        product.compare_at_price > product.price && (
          <del>{money(product.compare_at_price)}</del>
        )
      )}
    </div>
  );
}

function ProductQuickAdd({ product }: { product: Product }) {
  const notify = useToast();
  const availableVariants =
    product.variants?.filter((variant) => variant.stock > 0) ?? [];

  if (availableVariants.length !== 1) {
    return availableVariants.length === 0 ? (
      <button className="quick-add" disabled>
        نفد المخزون
      </button>
    ) : (
      <Link className="quick-add" to={`/products/${product.slug}`}>
        اختاري اللون والمقاس <ArrowLeft size={15} />
      </Link>
    );
  }

  const add = () => {
    try {
      const result = addCartVariant(availableVariants[0]);
      if (result === "added") notify("تمت الإضافة إلى السلة.");
      else if (result === "stock-limit")
        notify(`الكمية المتاحة ${availableVariants[0].stock} فقط`);
      else notify("نفد المخزون");
    } catch (error) {
      notify(
        error instanceof Error
          ? `تعذر حفظ السلة: ${error.message}`
          : "تعذر حفظ السلة.",
      );
    }
  };

  return (
    <div className="quick-add-wrap">
      <button className="quick-add" onClick={add}>
        <ShoppingBag size={15} /> أضيفي إلى السلة
      </button>
    </div>
  );
}

function ProductStock({ product }: { product: Product }) {
  if (!product.variants) return null;
  const total = product.variants.reduce((sum, item) => sum + item.stock, 0);
  return total <= 0 ? (
    <span className="sold-out-badge">نفد المخزون</span>
  ) : null;
}

function FavoriteButton({ productId }: { productId: string }) {
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("product_id", productId)
        .maybeSingle();
      if (active) setFavorite(Boolean(data));
    };
    void check();
    return () => {
      active = false;
    };
  }, [productId]);
  const toggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!supabase) return;
    setBusy(true);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      notify("سجلي الدخول لحفظ المفضلة.");
      setBusy(false);
      return;
    }
    const result = favorite
      ? await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userData.user.id)
          .eq("product_id", productId)
      : await supabase
          .from("favorites")
          .insert({ user_id: userData.user.id, product_id: productId });
    setBusy(false);
    if (result.error) notify(`تعذر تحديث المفضلة: ${result.error.message}`);
    else {
      setFavorite(!favorite);
      notify(favorite ? "أزيلت من المفضلة." : "أضيفت للمفضلة.");
    }
  };
  return (
    <button
      className={favorite ? "favorite-button is-favorite" : "favorite-button"}
      aria-label={favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      disabled={busy}
      onClick={(event) => void toggle(event)}
    >
      <Heart size={17} fill={favorite ? "currentColor" : "none"} />
    </button>
  );
}

export function ProductDetailsPage() {
  const { slug } = useParams();
  const notify = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [loadError, setLoadError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [mobileLensEnabled, setMobileLensEnabled] = useState(false);
  const [lens, setLens] = useState({
    visible: false,
    left: 0,
    top: 0,
    backgroundX: 0,
    backgroundY: 0,
  });
  const touchStartX = useRef<number | null>(null);
  const lastGallerySwipe = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!product) return;
    const description =
      product.description?.trim() ||
      `اكتشفي ${product.name} من عبايات متجر الحلم. تصميم أنيق بخامات وتفاصيل مختارة بعناية.`;
    setPageMetadata({
      title: `${product.name} | متجر الحلم`,
      description: description.slice(0, 300),
      url: `${window.location.origin}/products/${product.slug}`,
      image: product.images?.[0]?.image_url,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description,
        image: product.images?.map((image) => image.image_url).filter(Boolean),
        category: product.category?.name || "عبايات",
        offers: {
          "@type": "Offer",
          priceCurrency: "EGP",
          price: promotionPrice(product.price, categoryPromotions(product.category)),
          availability: product.variants?.some((variant) => variant.stock > 0)
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${window.location.origin}/products/${product.slug}`,
        },
      },
    });
  }, [product]);

  useEffect(() => {
    if (!supabase || !slug) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    setProduct(null);
    setImageIndex(0);

    void (async () => {
      try {
        const { data, error: resultError } = await supabase
          .from("products")
          .select(
            "*, category:categories(name,slug,description,promotions(id,title,description,discount_percent,image_url)), images:product_images(id,image_url,alt_text,position), variants:product_variants(id,size,color,stock)",
          )
          .eq("slug", slug)
          .eq("is_active", true)
          .order("position", { referencedTable: "images" })
          .maybeSingle();

        if (!active) return;
        if (resultError)
          setLoadError(`تعذر تحميل تفاصيل العباية: ${resultError.message}`);
        else setProduct(data ? normalizeProductCategory(data as Product) : null);
      } catch (cause) {
        if (!active) return;
        setLoadError(
          `تعذر تحميل تفاصيل العباية: ${cause instanceof Error ? cause.message : "حدث خطأ غير معروف."}`,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!zoomOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomOpen(false);
      const imageCount = product?.images?.length ?? 0;
      if (imageCount < 1) return;
      if (event.key === "ArrowRight")
        setImageIndex((index) => (index + imageCount - 1) % imageCount);
      if (event.key === "ArrowLeft")
        setImageIndex((index) => (index + 1) % imageCount);
    };
    document.body.classList.add("image-viewer-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("image-viewer-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [zoomOpen, product?.images?.length]);

  if (!isSupabaseConfigured)
    return (
      <InfoPage
        title="تفاصيل عبايتك"
        text="أضيفي بيانات اتصال Supabase لعرض المنتجات."
      />
    );
  if (loadError) return <InfoPage title="تعذر تحميل المنتج" text={loadError} />;
  if (loading)
    return (
      <main className="page-main">
        <div className="loading-message">جارٍ تحميل تفاصيل العباية…</div>
      </main>
    );
  if (!product)
    return (
      <InfoPage
        title="عبايتك في الطريق"
        text="لم نعثر على هذه العباية أو أنها غير متاحة حاليًا."
      />
    );
  const colors = [
    ...new Set((product.variants ?? []).map((variant) => variant.color)),
  ];
  const sizes = [
    ...new Set(
      (product.variants ?? [])
        .filter((variant) => !color || variant.color === color)
        .map((variant) => variant.size),
    ),
  ];
  const promotions = categoryPromotions(product.category);
  const discount = promotionPercent(promotions);
  const displayPrice = promotionPrice(
    product.price,
    promotions,
  );
  const addToCart = () => {
    if (!color || !size) {
      notify("اختاري اللون والمقاس أولًا.");
      return;
    }

    const variant = product.variants?.find(
      (item) => item.size === size && item.color === color,
    );
    if (!variant) {
      notify("هذا الخيار غير متاح حاليًا.");
      return;
    }

    if (variant.stock < 1) {
      notify("نفد مخزون هذا الخيار.");
      return;
    }

    try {
      const result = addCartVariant(variant);
      if (result === "stock-limit") {
        notify(`الكمية المتاحة من هذا الخيار هي ${variant.stock} فقط.`);
        return;
      }
      if (result === "unavailable") {
        notify("نفد مخزون هذا الخيار.");
        return;
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? `تعذر حفظ السلة: ${error.message}`
          : "تعذر حفظ السلة.",
      );
      return;
    }

    notify("تمت الإضافة إلى السلة.");
    navigate("/cart");
  };
  const images = product.images || [];
  const showImage = (index: number) =>
    setImageIndex((index + images.length) % images.length);
  const handleGalleryTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleGalleryTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (mobileLensEnabled) return;
    if (startX === null || endX === undefined || Math.abs(endX - startX) < 45)
      return;
    lastGallerySwipe.current = Date.now();
    showImage(imageIndex + (endX > startX ? -1 : 1));
  };
  const openImageZoom = () => {
    if (mobileLensEnabled) return;
    if (Date.now() - lastGallerySwipe.current < 500) return;
    if (images[imageIndex]) {
      setZoomScale(1);
      setZoomOpen(true);
    }
  };
  const updateLensPosition = (
    clientX: number,
    clientY: number,
    frame: HTMLDivElement,
  ) => {
    const bounds = frame.getBoundingClientRect();
    const lensSize = 160;
    const x = Math.max(
      lensSize / 2,
      Math.min(bounds.width - lensSize / 2, clientX - bounds.left),
    );
    const y = Math.max(
      lensSize / 2,
      Math.min(bounds.height - lensSize / 2, clientY - bounds.top),
    );
    setLens({
      visible: true,
      left: x - lensSize / 2,
      top: y - lensSize / 2,
      backgroundX:
        bounds.width > lensSize
          ? ((x - lensSize / 2) / (bounds.width - lensSize)) * 100
          : 50,
      backgroundY:
        bounds.height > lensSize
          ? ((y - lensSize / 2) / (bounds.height - lensSize)) * 100
          : 50,
    });
  };
  const handleLensMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && !mobileLensEnabled) return;
    updateLensPosition(event.clientX, event.clientY, event.currentTarget);
  };
  const handleLensTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!mobileLensEnabled) return;
    const touch = event.touches[0];
    if (touch)
      updateLensPosition(touch.clientX, touch.clientY, event.currentTarget);
  };
  const changeZoom = (direction: number) => {
    setZoomScale((scale) =>
      Math.min(3, Math.max(1, Number((scale + direction).toFixed(1)))),
    );
  };
  return (
    <main className="page-main details-layout">
      <div className="product-gallery">
        <div
          className={`detail-image-frame${mobileLensEnabled ? " mobile-lens-active" : ""}`}
          onPointerMove={handleLensMove}
          onTouchMove={handleLensTouchMove}
          onPointerLeave={() =>
            setLens((current) =>
              mobileLensEnabled ? current : { ...current, visible: false },
            )
          }
        >
          <button
            className="detail-photo"
            aria-label="تكبير الصورة"
            onClick={openImageZoom}
            onTouchStart={handleGalleryTouchStart}
            onTouchEnd={handleGalleryTouchEnd}
          >
            {images[imageIndex]?.image_url ? (
              <img
                key={imageIndex}
                src={images[imageIndex].image_url}
                alt={images[imageIndex].alt_text || product.name}
              />
            ) : (
              <div className="no-image">الحلم</div>
            )}
          </button>
          {lens.visible && images[imageIndex]?.image_url && (
            <div
              className="image-magnifier"
              style={{
                left: lens.left,
                top: lens.top,
                backgroundImage: `url("${images[imageIndex].image_url}")`,
                backgroundPosition: `${lens.backgroundX}% ${lens.backgroundY}%`,
              }}
              aria-hidden="true"
            />
          )}
          <span className="image-zoom-hint">
            <ZoomIn size={14} /> اضغطي للتكبير
          </span>
          <button
            type="button"
            className={`mobile-lens-toggle${mobileLensEnabled ? " active" : ""}`}
            aria-pressed={mobileLensEnabled}
            onClick={() => {
              setMobileLensEnabled((enabled) => !enabled);
              setLens((current) => ({ ...current, visible: false }));
            }}
          >
            <ZoomIn size={16} />
            {mobileLensEnabled ? "إيقاف العدسة" : "عدسة التفاصيل"}
          </button>
          {images.length > 1 && (
            <>
              <button
                className="gallery-arrow gallery-arrow-previous"
                type="button"
                aria-label="الصورة السابقة"
                onClick={() => showImage(imageIndex - 1)}
              >
                <ChevronRight size={20} />
              </button>
              <button
                className="gallery-arrow gallery-arrow-next"
                type="button"
                aria-label="الصورة التالية"
                onClick={() => showImage(imageIndex + 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="gallery-counter" aria-live="polite">
                {imageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="detail-thumbnails">
            {images.map((image, index) => (
              <button
                className={index === imageIndex ? "selected" : ""}
                key={image.id || image.image_url}
                onClick={() => showImage(index)}
                aria-label={`عرض الصورة ${index + 1}`}
                aria-pressed={index === imageIndex}
              >
                <img
                  src={image.image_url}
                  alt={image.alt_text || `${product.name} ${index + 1}`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="detail-copy">
        <p className="eyebrow">{product.category?.name || "عبايات الحلم"}</p>
        <h1>{product.name}</h1>
        <p className="detail-price">
          {money(displayPrice)}{" "}
          {discount > 0 ? (
            <>
              <del>{money(product.price)}</del>
              <span className="discount-price-badge">خصم {discount}%</span>
            </>
          ) : (
            product.compare_at_price &&
            product.compare_at_price > product.price && (
              <del>{money(product.compare_at_price)}</del>
            )
          )}
        </p>
        {product.fabric && (
          <p className="fabric-label">الخامة: {product.fabric}</p>
        )}
        <p>
          {product.description ||
            "اختيرت تفاصيل هذه العباية بعناية لتمنحك إطلالة أنيقة ومريحة."}
        </p>
        <div className="choice-group">
          <b>اللون</b>
          <div>
            {colors.map((item) => (
              <button
                aria-pressed={color === item}
                className={color === item ? "choice selected" : "choice"}
                key={item}
                onClick={() => {
                  setColor(item);
                  setSize("");
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="choice-group">
          <b>المقاس</b>
          <div>
            {sizes.map((item) => {
              const variant = product.variants?.find(
                (entry) =>
                  entry.size === item && (!color || entry.color === color),
              );
              const outOfStock = !variant || variant.stock < 1;
              return (
                <button
                  aria-pressed={size === item}
                  aria-label={
                    outOfStock ? `${item}، نفد المخزون` : `المقاس ${item}`
                  }
                  className={`choice${size === item ? " selected" : ""}${outOfStock ? " out-of-stock" : ""}`}
                  disabled={!variant}
                  key={item}
                  onClick={() => setSize(item)}
                >
                  {item}
                  {outOfStock && <small>نفد</small>}
                </button>
              );
            })}
          </div>
          <small>
            اختاري المقاس، وستظهر المقاسات غير المتوفرة بعلامة «نفد».
          </small>
        </div>
        <button className="button button-dark full-button" onClick={addToCart}>
          أضيفي إلى السلة <ShoppingBag size={17} />
        </button>
        <div className="delivery-note">
          <Truck size={18} /> تُدفع رسوم التوصيل فقط عند الطلب، وقيمة المنتجات عند الاستلام.
        </div>
      </div>
      {zoomOpen && (
        <div
          className="image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="عارض صور المنتج"
          onClick={() => setZoomOpen(false)}
        >
          <button
            className="image-modal-close"
            type="button"
            aria-label="إغلاق الصورة"
            onClick={() => setZoomOpen(false)}
          >
            <X size={21} />
          </button>
          <div
            className="image-modal-toolbar"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="تصغير"
              disabled={zoomScale <= 1}
              onClick={() => changeZoom(-0.25)}
            >
              <ZoomOut size={18} />
            </button>
            <span>{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              aria-label="تكبير"
              disabled={zoomScale >= 3}
              onClick={() => changeZoom(0.25)}
            >
              <ZoomIn size={18} />
            </button>
          </div>
          <button
            className="image-modal-arrow image-modal-previous"
            type="button"
            aria-label="الصورة السابقة"
            disabled={images.length < 2}
            onClick={(event) => {
              event.stopPropagation();
              showImage(imageIndex - 1);
              setZoomScale(1);
            }}
          >
            <ChevronRight />
          </button>
          <div
            className="image-modal-stage"
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => {
              event.preventDefault();
              changeZoom(event.deltaY < 0 ? 0.15 : -0.15);
            }}
          >
            <img
              style={{ transform: `scale(${zoomScale})` }}
              src={images[imageIndex]?.image_url}
              alt={images[imageIndex]?.alt_text || product.name}
              draggable={false}
            />
          </div>
          <button
            className="image-modal-arrow image-modal-next"
            type="button"
            aria-label="الصورة التالية"
            disabled={images.length < 2}
            onClick={(event) => {
              event.stopPropagation();
              showImage(imageIndex + 1);
              setZoomScale(1);
            }}
          >
            <ChevronLeft />
          </button>
          <span className="image-modal-counter">
            {imageIndex + 1} / {images.length}
          </span>
          <p className="image-modal-hint">
            استخدمي عجلة الفأرة أو الأزرار للتكبير والتصغير
          </p>
        </div>
      )}
    </main>
  );
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!supabase) {
      setLoading(false);
      return () => { active = false; };
    }
    supabase
        .from("categories")
        .select("id,name,slug,description,image_url")
        .eq("is_active", true)
        .order("position")
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setError(`تعذر تحميل الأقسام: ${error.message}`);
          else setCategories(data ?? []);
          setLoading(false);
        });
    return () => { active = false; };
  }, []);
  return (
    <main className="page-main categories-store-page">
      <div className="page-title categories-store-hero">
        <p className="eyebrow">تصفحي كما تحبين</p>
        <h1>أقسام الحلم</h1>
        <p>لكل إطلالة حكاية، ولكل مناسبة اختيار يليق بكِ. اكتشفي مجموعاتنا بعناية.</p>
        <span className="categories-hero-mark"><ShoppingBag size={20} /><small>اختاري<br />حكايتك</small></span>
      </div>
      <div className="categories-page-heading">
        <div><p className="eyebrow">مجموعات مختارة</p><h2>تسوقي حسب القسم</h2></div>
        {!loading && !error && <span>{categories.length} أقسام</span>}
      </div>
      {error ? (
        <EmptyState title="تعذر تحميل الأقسام" message={error} />
      ) : loading ? (
        <div className="categories-loading-grid" aria-label="جارٍ تحميل الأقسام">
          {[1, 2, 3, 4].map((item) => <span key={item} />)}
        </div>
      ) : categories.length ? (
        <div className="category-grid category-page categories-store-grid">
          {categories.map((category, index) => (
            <Link
              className="category-card category-store-card"
              to={`/products?category=${category.slug}`}
              key={category.id}
            >
              <img
                src={category.image_url || categoryFallback(index)}
                alt={category.name}
                loading="lazy"
              />
              <span className="category-card-content">
                <small>اكتشفي مجموعتنا</small>
                <b>{category.name}</b>
                <i>تصفحي القسم <ArrowLeft size={15} /></i>
              </span>
              <span className="category-card-index">{String(index + 1).padStart(2, "0")}</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="الأقسام تُرتب الآن"
          message="ستظهر هنا الأقسام المنشورة من إدارة المتجر."
        />
      )}
    </main>
  );
}
