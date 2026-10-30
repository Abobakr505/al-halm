import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpLeft, Check, Heart, Instagram, Search, ShoppingBag, Truck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { readCart, writeCart } from '../lib/cart'
import type { Category, Product } from '../types'
import { EmptyState, InfoPage } from './Common'

export const money = (value: number) => `${new Intl.NumberFormat('ar').format(value)} ر.س`

export function categoryFallback(index: number) {
  return [
    'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80',
    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=80',
  ][index % 4]
}

function SectionHeading({ eyebrow, title, action, actionText }: { eyebrow: string; title: string; action: string; actionText: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><Link className="text-link" to={action}>{actionText} <ArrowLeft size={16} /></Link></div>
}

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (!supabase) return
    let active = true
    Promise.all([
      supabase.from('products').select('*, category:categories(name,slug), images:product_images(image_url,alt_text,position)').eq('is_active', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(4),
      supabase.from('categories').select('id,name,slug,description,image_url').eq('is_active', true).order('position'),
    ]).then(([productResult, categoryResult]) => {
      if (!active) return
      if (productResult.error) console.error('تعذر تحميل المنتجات المميزة:', productResult.error.message)
      else setProducts((productResult.data ?? []) as Product[])
      if (categoryResult.error) console.error('تعذر تحميل الأقسام:', categoryResult.error.message)
      else setCategories(categoryResult.data ?? [])
    })
    return () => { active = false }
  }, [])

  return <main>
    <section className="hero">
      <div className="hero-content">
        <p className="eyebrow"><span /> مجموعة الحلم الجديدة</p>
        <h1>أناقةٌ تشبهك،<br /><em>وتحكي حكايتك.</em></h1>
        <p className="hero-copy">عبايات خليجية صُممت لترافقك في كل لحظة، بتفاصيل متقنة وأناقة لا تحتاج إلى مناسبة.</p>
        <Link className="button button-dark" to="/products">اكتشفي المجموعة <ArrowLeft size={17} /></Link>
        <div className="hero-note"><span className="note-line" /> تصاميم مختارة بعناية</div>
      </div>
      <div className="hero-image">
        <img src="https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=1400&q=85" alt="إطلالة أنيقة بعباية سوداء" />
        <div className="hero-stamp"><span>أناقتك</span><b>تبدأ</b><span>من هنا</span></div>
        <span className="image-caption">مجموعة الحلم</span>
      </div>
      <span className="hero-vertical">الحلم · صُنعت بحب</span>
    </section>
    <section className="trust-row">
      <div><Truck /><span><b>توصيل بكل عناية</b><small>إلى باب منزلك</small></span></div>
      <div><Check /><span><b>خامات مختارة</b><small>جودة تلمسينها</small></span></div>
      <div><ShoppingBag /><span><b>عربون مرن</b><small>والباقي عند الاستلام</small></span></div>
      <div><Heart /><span><b>تفاصيل تحبينها</b><small>صنعت لأجلك</small></span></div>
    </section>
    <section className="section categories-section">
      <SectionHeading eyebrow="اختاري ما يشبهك" title="لكل لحظة، حكاية" action="/categories" actionText="كل الأقسام" />
      {categories.length ? <div className="category-grid">{categories.slice(0, 4).map((category, index) => <Link className="category-card" to={`/products?category=${category.slug}`} key={category.id}><img src={category.image_url || categoryFallback(index)} alt={category.name} /><span>{category.name}</span><ArrowUpLeft size={18} /></Link>)}</div> : <EmptyState title="أقسامنا في انتظارك" message="ستظهر الأقسام هنا بمجرد إضافتها من لوحة الإدارة." />}
    </section>
    <section className="section featured-section">
      <SectionHeading eyebrow="اختيارات الحلم" title="قطع تستحق أن تُرى" action="/products" actionText="تصفحي العبايات" />
      <ProductGrid products={products} />
    </section>
    <section className="story-section" id="story"><div className="story-image"><img src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1100&q=85" alt="أناقة العباية الخليجية" /></div><div className="story-copy"><p className="eyebrow">من القلب إلى خزانة أناقتك</p><h2>كل تفصيلة<br />لها <em>حكاية.</em></h2><p>في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة أيامك الجميلة، وتفصيلاً يشبهك أنتِ.</p><Link className="text-link" to="/about">اكتشفي حكايتنا <ArrowLeft size={16} /></Link><span className="story-number">01 / 03</span></div></section>
    <section className="newsletter"><span>رسائلٌ من الحلم</span><h2>كوني أول من يعرف <em>حكايتنا القادمة.</em></h2><p>تابعينا لتصلك جديد مجموعاتنا وإلهاماتنا.</p><a className="button button-outline" href="https://www.instagram.com/" target="_blank" rel="noreferrer"><Instagram size={17} /> تابعي الحلم</a></section>
  </main>
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [fabric, setFabric] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [discounted, setDiscounted] = useState(false)
  const [availability, setAvailability] = useState('')
  const [sort, setSort] = useState('newest')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    const url = new URLSearchParams(window.location.search)
    let request = supabase.from('products').select('*, category:categories(name,slug), images:product_images(image_url,alt_text,position), variants:product_variants(id,size,color,stock)').eq('is_active', true).order('created_at', { ascending: false })
    if (url.has('category')) request = request.eq('category.slug', url.get('category')!)
    request.then(({ data, error: resultError }) => {
      if (!active) return
      if (resultError) setError('تعذر تحميل العبايات الآن. حاولي مرة أخرى لاحقًا.')
      else setProducts((data ?? []) as Product[])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const sizes = [...new Set(products.flatMap((product) => product.variants?.map((variant) => variant.size) || []))].sort()
  const colors = [...new Set(products.flatMap((product) => product.variants?.map((variant) => variant.color) || []))].sort()
  const fabrics = [...new Set(products.map((product) => product.fabric).filter((value): value is string => Boolean(value)))].sort()
  const visible = products.filter((product) =>
    product.name.includes(query.trim()) &&
    (!fabric || product.fabric === fabric) &&
    (!minPrice || product.price >= Number(minPrice)) &&
    (!maxPrice || product.price <= Number(maxPrice)) &&
    (!discounted || Boolean(product.compare_at_price && product.compare_at_price > product.price)) &&
    (!size && !color || product.variants?.some((variant) =>
      (!size || variant.size === size) && (!color || variant.color === color) && variant.stock > 0,
    )) &&
    (!availability || (availability === 'available' ? product.variants?.some((variant) => variant.stock > 0) : product.variants?.every((variant) => variant.stock === 0))),
  ).sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : 0)
  return <main className="page-main"><div className="page-title"><p className="eyebrow">من مجموعتنا إليكِ</p><h1>العبايات</h1><p>اكتشفي قطعًا صُممت لتكون جزءًا من حكايتك.</p></div><div className="toolbar"><span>{loading ? 'جارٍ التحميل…' : `${visible.length} عباية`}</span><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحثي عن عباية" /></label><select aria-label="المقاس" value={size} onChange={(event) => setSize(event.target.value)}><option value="">كل المقاسات</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="اللون" value={color} onChange={(event) => setColor(event.target.value)}><option value="">كل الألوان</option>{colors.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="نوع القماش" value={fabric} onChange={(event) => setFabric(event.target.value)}><option value="">كل الخامات</option>{fabrics.map((item) => <option key={item}>{item}</option>)}</select><label className="price-filter">من<input aria-label="أقل سعر" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label><label className="price-filter">إلى<input aria-label="أعلى سعر" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label><label className="discount-filter"><input type="checkbox" checked={discounted} onChange={(event) => setDiscounted(event.target.checked)} /> عروض</label><select aria-label="التوفر" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">كل المنتجات</option><option value="available">متوفر</option><option value="unavailable">نفد المخزون</option></select><select aria-label="ترتيب المنتجات" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">الأحدث</option><option value="price-asc">السعر: الأقل أولًا</option><option value="price-desc">السعر: الأعلى أولًا</option></select></div>{error ? <EmptyState title="حدث خطأ" message={error} /> : loading ? <div className="loading-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}</div> : <ProductGrid products={visible} />}</main>
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <EmptyState title="مساحة تنتظر عبايتك القادمة" message={isSupabaseConfigured ? 'لا توجد منتجات منشورة في هذا القسم حاليًا.' : 'بعد ربط Supabase وإضافة المنتجات، ستجدينها هنا.'} />
  return <div className="product-grid">{products.map((product) => <Link className="product-card" to={`/products/${product.slug}`} key={product.id}><div className="product-photo">{product.images?.[0]?.image_url ? <img src={product.images[0].image_url} alt={product.images[0].alt_text || product.name} loading="lazy" /> : <div className="no-image">الحلم</div>}<span className="product-badge">{product.is_featured ? 'اختيار الحلم' : 'من مجموعتنا'}</span><FavoriteButton productId={product.id} /><ProductStock product={product} /></div><div className="product-meta"><span>{product.category?.name || 'عبايات الحلم'}</span><span>{product.variants?.length ? 'مقاسات متعددة' : 'تفاصيل أنيقة'}</span></div><h3>{product.name}</h3><div className="product-price">{money(product.price)}{product.compare_at_price && product.compare_at_price > product.price && <del>{money(product.compare_at_price)}</del>}</div></Link>)}</div>
}

function ProductStock({ product }: { product: Product }) {
  if (!product.variants) return null
  const total = product.variants.reduce((sum, item) => sum + item.stock, 0)
  return total <= 0 ? <span className="sold-out-badge">نفد المخزون</span> : null
}

function FavoriteButton({ productId }: { productId: string }) {
  const [favorite, setFavorite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    const check = async () => {
      if (!supabase) return
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data } = await supabase.from('favorites').select('product_id').eq('product_id', productId).maybeSingle()
      if (active) setFavorite(Boolean(data))
    }
    void check()
    return () => { active = false }
  }, [productId])
  const toggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation()
    if (!supabase) return
    setBusy(true); setMessage('')
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) { setMessage('سجلي الدخول لحفظ المفضلة.'); setBusy(false); return }
    const result = favorite
      ? await supabase.from('favorites').delete().eq('user_id', userData.user.id).eq('product_id', productId)
      : await supabase.from('favorites').insert({ user_id: userData.user.id, product_id: productId })
    setBusy(false)
    if (result.error) setMessage(`تعذر تحديث المفضلة: ${result.error.message}`)
    else setFavorite(!favorite)
  }
  return <><button className={favorite ? 'favorite-button is-favorite' : 'favorite-button'} aria-label={favorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'} disabled={busy} onClick={(event) => void toggle(event)}><Heart size={17} fill={favorite ? 'currentColor' : 'none'} /></button>{message && <span className="favorite-message">{message}</span>}</>
}

export function ProductDetailsPage() {
  const { slug } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [error, setError] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase || !slug) return
    supabase.from('products').select('*, category:categories(name,slug), images:product_images(id,image_url,alt_text,position), variants:product_variants(id,size,color,stock)').eq('slug', slug).eq('is_active', true).order('position', { foreignTable: 'product_images' }).maybeSingle().then(({ data, error: resultError }) => {
      if (resultError) setError('تعذر تحميل تفاصيل العباية.')
      else setProduct(data as Product | null)
    })
  }, [slug])

  if (!isSupabaseConfigured) return <InfoPage title="تفاصيل عبايتك" text="أضيفي بيانات اتصال Supabase لعرض المنتجات." />
  if (error) return <InfoPage title="تعذر تحميل المنتج" text={error} />
  if (!product) return <InfoPage title="عبايتك في الطريق" text="لم نعثر على هذه العباية أو أنها غير متاحة حاليًا." />
  const colors = [...new Set((product.variants ?? []).map((variant) => variant.color))]
  const sizes = [...new Set((product.variants ?? []).filter((variant) => !color || variant.color === color).map((variant) => variant.size))]
  const addToCart = () => {
    if (!size || !color) { setError('اختاري اللون والمقاس أولًا.'); return }
    const cart = readCart()
    const variantId = product.variants?.find((variant) => variant.size === size && variant.color === color)?.id
    if (!variantId) { setError('هذا الخيار غير متاح حاليًا.'); return }
    if ((product.variants?.find((variant) => variant.id === variantId)?.stock || 0) < 1) { setError('نفد مخزون هذا الخيار. اختاري مقاسًا أو لونًا آخر.'); return }
    const line = cart.find((item) => item.variantId === variantId)
    if (line) line.quantity += 1
    else cart.push({ variantId, quantity: 1 })
    writeCart(cart)
    navigate('/cart')
  }
  const images = product.images || []
  return <main className="page-main details-layout"><div className="product-gallery"><button className="detail-photo" aria-label="تكبير الصورة" onClick={() => images[imageIndex] && setZoomOpen(true)}>{images[imageIndex]?.image_url ? <img src={images[imageIndex].image_url} alt={images[imageIndex].alt_text || product.name} /> : <div className="no-image">الحلم</div>}</button>{images.length > 1 && <div className="detail-thumbnails">{images.map((image, index) => <button className={index === imageIndex ? 'selected' : ''} key={image.id || image.image_url} onClick={() => setImageIndex(index)} aria-label={`عرض الصورة ${index + 1}`}><img src={image.image_url} alt={image.alt_text || `${product.name} ${index + 1}`} /></button>)}</div>}</div><div className="detail-copy"><p className="eyebrow">{product.category?.name || 'عبايات الحلم'}</p><h1>{product.name}</h1><p className="detail-price">{money(product.price)} {product.compare_at_price && <del>{money(product.compare_at_price)}</del>}</p>{product.fabric && <p className="fabric-label">الخامة: {product.fabric}</p>}<p>{product.description || 'اختيرت تفاصيل هذه العباية بعناية لتمنحك إطلالة أنيقة ومريحة.'}</p><div className="choice-group"><b>اللون</b><div>{colors.map((item) => <button className={color === item ? 'choice selected' : 'choice'} key={item} onClick={() => { setColor(item); setSize('') }}>{item}</button>)}</div></div><div className="choice-group"><b>المقاس</b><div>{sizes.map((item) => { const variant = product.variants?.find((entry) => entry.size === item && (!color || entry.color === color)); return <button disabled={!variant || variant.stock < 1} className={size === item ? 'choice selected' : 'choice'} key={item} onClick={() => setSize(item)}>{item}</button> })}</div><small>المقاسات المتاحة حسب المخزون لكل لون.</small></div>{error && <p className="inline-error">{error}</p>}<button className="button button-dark full-button" onClick={addToCart}>أضيفي إلى السلة <ShoppingBag size={17} /></button><div className="delivery-note"><Truck size={18} /> عربون عند الطلب، والباقي عند الاستلام.</div></div>{zoomOpen && <div className="image-modal" role="dialog" aria-modal="true" aria-label="صورة المنتج المكبرة" onClick={() => setZoomOpen(false)}><button aria-label="إغلاق الصورة" onClick={() => setZoomOpen(false)}>×</button><img src={images[imageIndex]?.image_url} alt={product.name} /></div>}</main>
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  useEffect(() => { if (supabase) supabase.from('categories').select('id,name,slug,description,image_url').eq('is_active', true).order('position').then(({ data, error }) => { if (error) console.error('تعذر تحميل الأقسام:', error.message); else setCategories(data ?? []) }) }, [])
  return <main className="page-main"><div className="page-title"><p className="eyebrow">تصفحي كما تحبين</p><h1>أقسام الحلم</h1></div>{categories.length ? <div className="category-grid category-page">{categories.map((category, index) => <Link className="category-card" to={`/products?category=${category.slug}`} key={category.id}><img src={category.image_url || categoryFallback(index)} alt={category.name} /><span>{category.name}</span><ArrowUpLeft size={18} /></Link>)}</div> : <EmptyState title="الأقسام تُرتب الآن" message="ستظهر هنا الأقسام المنشورة من إدارة المتجر." />}</main>
}
