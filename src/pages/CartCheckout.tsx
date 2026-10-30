import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { readCart, writeCart } from '../lib/cart'
import type { Product } from '../types'
import { categoryFallback, money } from '../components/Storefront'
import { EmptyState, ToastMessage } from '../components/Common'

export function CartPage() {
  const [lines, setLines] = useState(readCart)
  const [items, setItems] = useState<{ variantId: string; product: Pick<Product, 'id' | 'name' | 'slug' | 'price'> & Pick<Product, 'images'>; size: string; color: string; stock: number; quantity: number }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase || lines.length === 0) { setItems([]); setError(''); setLoading(false); return }

    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const { data, error: resultError } = await supabase
          .from('product_variants')
          .select('id,size,color,stock,product:products(id,name,slug,price,images:product_images(image_url,alt_text,position))')
          .in('id', lines.map((line) => line.variantId))

        if (!active) return
        if (resultError) {
          setError(`تعذر تحميل السلة: ${resultError.message}`)
          setItems([])
        } else {
          setItems((data ?? []).flatMap((variant) => {
            const product = Array.isArray(variant.product) ? variant.product[0] : variant.product
            const line = lines.find((item) => item.variantId === variant.id)
            return product && line ? [{ variantId: variant.id, product, size: variant.size, color: variant.color, stock: variant.stock, quantity: line.quantity }] : []
          }))
        }
      } catch (cause) {
        if (!active) return
        setError(`تعذر تحميل السلة: ${cause instanceof Error ? cause.message : 'حدث خطأ غير معروف.'}`)
        setItems([])
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [lines])

  const updateQuantity = (variantId: string, quantity: number) => {
    const next = lines.map((line) => line.variantId === variantId ? { ...line, quantity } : line).filter((line) => line.quantity > 0)
    writeCart(next)
    setLines(next)
  }
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  return <main className="page-main narrow-page"><div className="page-title"><p className="eyebrow">اختياراتك</p><h1>سلة الحلم</h1></div>{error ? <EmptyState title="تعذر تحميل السلة" message={error} /> : loading ? <div className="loading-message">جارٍ تحميل محتويات السلة…</div> : items.length === 0 ? <EmptyState title="سلتك فارغة الآن" message={isSupabaseConfigured ? lines.length ? 'تعذر العثور على تفاصيل المنتجات المحفوظة في السلة. أزيلي العناصر القديمة ثم أضيفيها من جديد.' : 'القطعة المناسبة بانتظارك. اكتشفي مجموعتنا واختاري ما يشبهك.' : 'اربط Supabase ثم أضيفي خيارات المنتجات المتاحة إلى سلتك.'} action="/products" actionText="اكتشفي العبايات" /> : <><div className="cart-list">{items.map((item) => <div className="cart-item" key={item.variantId}><img src={item.product.images?.[0]?.image_url || categoryFallback(0)} alt={item.product.name} /><div className="cart-item-info"><h3>{item.product.name}</h3><span>{item.color} · مقاس {item.size}</span><b>{money(item.product.price)}</b><div className="quantity-control"><button aria-label="تقليل الكمية" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>−</button><span>{item.quantity}</span><button aria-label="زيادة الكمية" disabled={item.quantity >= item.stock} onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>+</button></div></div><button className="remove-line" onClick={() => updateQuantity(item.variantId, 0)}>حذف</button></div>)}</div><div className="cart-summary"><div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div><p>تُحسب تكلفة التوصيل والعربون عند إتمام الطلب.</p><Link className="button button-dark full-button" to="/checkout">إتمام الطلب <ArrowLeft size={16} /></Link></div></>}</main>
}

export function CheckoutPage() {
  const [session, setSession] = useState<boolean | null>(null)
  const [address, setAddress] = useState({ recipient_name: '', phone: '', region: '', city: '', address_line: '' })
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [settings, setSettings] = useState<{ deposit_type: string; deposit_value: number; delivery_fee: number; transfer_details: string } | null>(null)
  const [subtotal, setSubtotal] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const cart = readCart()

  useEffect(() => {
    if (!supabase) { setSession(false); return }
    supabase.auth.getSession().then(({ data, error }) => { if (error) setMessage(error.message); setSession(Boolean(data.session)) })
    supabase.from('store_settings').select('deposit_type,deposit_value,delivery_fee,transfer_details').eq('id', true).single().then(({ data, error }) => {
      if (error) setMessage(`تعذر تحميل إعدادات الدفع: ${error.message}`)
      else setSettings(data)
    })
    if (cart.length) supabase.from('product_variants').select('id,product:products(price)').in('id', cart.map((line) => line.variantId)).then(({ data, error }) => {
      if (error) setMessage(`تعذر تحميل ملخص الطلب: ${error.message}`)
      else setSubtotal((data ?? []).reduce((total, item) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product
        return total + Number(product?.price || 0) * (cart.find((line) => line.variantId === item.id)?.quantity || 0)
      }, 0))
    })
  }, [])

  if (!isSupabaseConfigured) return <EmptyState title="إتمام الطلب غير متاح" message="أضيفي إعدادات Supabase لإتمام الطلبات بأمان." />
  if (session === false) return <Navigate to="/login" state={{ from: '/checkout' }} replace />
  const total = subtotal + (settings?.delivery_fee || 0)
  const deposit = settings ? settings.deposit_type === 'percentage' ? Math.round(total * Math.min(settings.deposit_value, 100)) / 100 : Math.min(settings.deposit_value, total) : 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || cart.length === 0) { setMessage('سلتك فارغة. أضيفي عباية قبل إتمام الطلب.'); return }
    if (!receipt) { setMessage('ارفقي إيصال تحويل العربون لإرسال الطلب.'); return }
    if (!settings) { setMessage('إعدادات الدفع غير متاحة حاليًا.'); return }
    if (receipt.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(receipt.type)) {
      setMessage('يسمح بملفات JPG أو PNG أو WebP أو PDF بحجم أقصى 5 ميجابايت.')
      return
    }

    setBusy(true); setMessage('')
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', { p_address: address, p_items: cart.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })), p_customer_note: note })
    if (orderError || !orderId) { setBusy(false); setMessage(`تعذر إنشاء الطلب: ${orderError?.message || 'خطأ غير معروف'}`); return }
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) { setBusy(false); setMessage('تعذر التحقق من الحساب. سجلي الدخول مرة أخرى.'); return }
    const path = `${userData.user.id}/${orderId}/${crypto.randomUUID()}-${receipt.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage.from('payment-receipts').upload(path, receipt, { contentType: receipt.type, upsert: false })
    if (uploadError) { setBusy(false); setMessage(`تم إنشاء الطلب رقم ${orderId} لكن تعذر رفع الإيصال: ${uploadError.message}`); return }
    const { error: receiptError } = await supabase.from('payment_receipts').insert({ order_id: orderId, user_id: userData.user.id, storage_path: path })
    if (receiptError) { setBusy(false); setMessage(`تم حفظ الطلب لكن تعذر تسجيل الإيصال: ${receiptError.message}`); return }
    writeCart([])
    setBusy(false)
    navigate(`/orders/${orderId}`)
  }

  return <main className="page-main checkout-page"><div className="page-title"><p className="eyebrow">خطوة أخيرة</p><h1>إتمام الطلب</h1></div>{session === null ? <p>جارٍ التحقق من الحساب…</p> : <form className="checkout-layout" onSubmit={submit}><div className="admin-card checkout-fields"><h2>عنوان التوصيل</h2>{([['recipient_name', 'الاسم الكامل'], ['phone', 'رقم الهاتف'], ['region', 'المحافظة / المنطقة'], ['city', 'المدينة'], ['address_line', 'العنوان بالتفصيل']] as const).map(([field, label]) => <label className="checkout-label" key={field}>{label}<input required value={address[field]} onChange={(event) => setAddress({ ...address, [field]: event.target.value })} /></label>)}<label className="checkout-label">ملاحظات إضافية<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><h2>إيصال العربون</h2><p>{settings?.transfer_details || 'بيانات التحويل ستظهر هنا بعد إضافتها من إعدادات المتجر.'}</p><label className="checkout-label">ارفقي صورة أو ملف الإيصال<input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] || null)} /></label></div><aside className="admin-card order-summary"><h2>ملخص الطلب</h2><div><span>المجموع الفرعي</span><b>{money(subtotal)}</b></div><div><span>التوصيل</span><b>{money(settings?.delivery_fee || 0)}</b></div><div><span>إجمالي الطلب</span><b>{money(total)}</b></div><div><span>العربون المطلوب</span><b>{money(deposit)}</b></div><div><span>المتبقي عند الاستلام</span><b>{money(total - deposit)}</b></div>{message && <ToastMessage message={message} />}<button disabled={busy || cart.length === 0} className="button button-dark full-button">{busy ? 'جارٍ إرسال طلبك…' : 'تأكيد الطلب'}</button></aside></form>}</main>
}
