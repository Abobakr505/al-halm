
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, BellRing, CalendarDays, ExternalLink, Heart, LogOut, MapPin, PackageCheck, Sparkles, Trash2, Truck, Upload, UserRound } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { orderStatusLabels, type OrderStatus } from '../types'
import { EmptyState, ToastMessage, useToast } from '../components/Common'
import { money, categoryFallback } from '../components/Storefront'
import { promotionPercent, promotionPrice, type PromotionSchedule, usePromotionClock } from '../lib/promotions'
import { GOVERNORATES } from '../lib/governorates'
import { validateSignup } from '../lib/validation'
type Address = {
  id: string
  recipient_name: string
  phone: string
  region: string
  city: string
  address_line: string
  map_url: string | null
  notes: string | null
  is_default: boolean
}

type CustomerOrder = {
  id: string
  order_number: number
  status: OrderStatus
  payment_status: string
  total: number
  deposit_amount: number
  remaining_amount: number
  created_at: string
}

type StockAlert = {
  id: string
  notified_at: string
  variant: {
    size: string
    color: string
    product: { name: string; slug: string } | { name: string; slug: string }[] | null
  } | {
    size: string
    color: string
    product: { name: string; slug: string } | { name: string; slug: string }[] | null
  }[] | null
}

// ==============================
// Customer Session
// ==============================

function useCustomerSession() {
  const [session, setSession] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supabase) {
      setSession(false)
      return
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, current) => setSession(Boolean(current))
    )

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('تعذر التحقق من الجلسة:', error.message)
      setSession(Boolean(data.session))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return session
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const session = useCustomerSession()

  if (!isSupabaseConfigured) {
    return (
      <main className="page-main">
        <EmptyState
          title="الحسابات غير مفعلة بعد"
          message="أضيفي إعدادات Supabase لتفعيل هذه الصفحة."
        />
      </main>
    )
  }

  if (session === null) {
    return (
      <main className="page-main">
        <EmptyState
          title="جارٍ التحقق من الحساب"
          message="لحظات من فضلك."
        />
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

// ==============================
// Account Navigation
// ==============================

function AccountNavigation({ active }: { active: string }) {
  return (
    <nav className="account-tabs">
      <Link className={active === 'account' ? 'active' : ''} to="/account">
        البيانات والعناوين
      </Link>

      <Link className={active === 'orders' ? 'active' : ''} to="/orders">
        طلباتي
      </Link>

      <Link className={active === 'favorites' ? 'active' : ''} to="/favorites">
        المفضلة
      </Link>
    </nav>
  )
}

// ==============================
// Account Page
// ==============================

export function AccountPage() {
  const notify = useToast()
  const [profile, setProfile] = useState({
    email: '',
    full_name: '',
    phone: ''
  })

  const [addresses, setAddresses] = useState<Address[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [accountOrders, setAccountOrders] = useState<CustomerOrder[]>([])
  const [accountLoading, setAccountLoading] = useState(true)
const [zones, setZones] = useState<Record<string, number>>({})
  const [address, setAddress] = useState({
    recipient_name: '',
    phone: '',
    region: '',
    city: '',
    address_line: '',
    map_url: '',
    notes: ''
  })

  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null)
  const [deletingAddress, setDeletingAddress] = useState(false)
  const confirmCancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!logoutConfirm && !addressToDelete) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !signingOut && !deletingAddress) {
        setLogoutConfirm(false)
        setAddressToDelete(null)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    confirmCancelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [logoutConfirm, addressToDelete, signingOut, deletingAddress])
useEffect(() => {
  if (!supabase) return
  supabase
    .from('delivery_zones')
    .select('governorate,fee')
    .eq('is_active', true)
    .then(({ data }) =>
      setZones(Object.fromEntries((data ?? []).map((z) => [z.governorate, Number(z.fee)])))
    )
}, [])
  const loadAccount = async () => {
    if (!supabase) return

    const { data: userData, error: userError } =
      await supabase.auth.getUser()

    if (userError || !userData.user) {
      setMessage('تعذر التحقق من الحساب.')
      setAccountLoading(false)
      return
    }

    const [profileResult, addressResult, ordersResult, stockAlertsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('email,full_name,phone')
        .eq('id', userData.user.id)
        .single(),

      supabase
        .from('addresses')
        .select('id,recipient_name,phone,region,city,address_line,map_url,notes,is_default')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('orders')
        .select('id,order_number,status,payment_status,total,deposit_amount,remaining_amount,created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('stock_alerts')
        .select('id,notified_at,variant:product_variants(size,color,product:products(name,slug))')
        .not('notified_at', 'is', null)
        .order('notified_at', { ascending: false })
    ])

    if (profileResult.error) {
      setMessage(`تعذر تحميل بيانات الحساب: ${profileResult.error.message}`)
    } else {
      setProfile(profileResult.data)
    }

    if (addressResult.error) {
      setMessage(`تعذر تحميل العناوين: ${addressResult.error.message}`)
    } else {
      setAddresses(addressResult.data ?? [])
    }
    if (ordersResult.error) {
      setMessage(`تعذر تحميل ملخص الطلبات: ${ordersResult.error.message}`)
    } else {
      setAccountOrders(ordersResult.data ?? [])
    }
    if (stockAlertsResult.error) {
      setMessage(`تعذر تحميل تنبيهات المخزون: ${stockAlertsResult.error.message}`)
    } else {
      setStockAlerts((stockAlertsResult.data ?? []) as StockAlert[])
    }
    setAccountLoading(false)
  }

  const dismissStockAlert = async (id: string) => {
    if (!supabase) return
    try {
      const { error } = await supabase.from('stock_alerts').delete().eq('id', id)
      if (error) {
        setMessage(`تعذر إخفاء تنبيه المخزون: ${error.message}`)
        return
      }
      setStockAlerts((current) => current.filter((alert) => alert.id !== id))
      notify('تم إخفاء تنبيه توفر المقاس.')
    } catch (error) {
      setMessage(`تعذر إخفاء تنبيه المخزون: ${error instanceof Error ? error.message : 'حدث خطأ غير معروف.'}`)
    }
  }

  useEffect(() => {
    void loadAccount()
  }, [])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase || busy) return

    setBusy(true)
    setMessage('')

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError || !userData.user) {
        setMessage('تعذر التحقق من الحساب.')
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone
        })
        .eq('id', userData.user.id)

      setMessage(
        error
          ? `تعذر حفظ البيانات: ${error.message}`
          : 'تم حفظ بياناتك.'
      )
    } catch {
      setMessage('حدث خطأ أثناء حفظ البيانات.')
    } finally {
      setBusy(false)
    }
  }

  const addAddress = async (event: FormEvent) => {
    event.preventDefault()
const digits = address.phone
  .replace(/[\s-]/g, '')
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
if (address.recipient_name.trim().split(/\s+/).length < 2) {
  setMessage('اكتبي الاسم الأول والأخير على الأقل.')
  return
}
if (!/^01[0125]\d{8}$/.test(digits)) {
  setMessage('أدخلي رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01).')
  return
}
if (!GOVERNORATES.includes(address.region)) {
  setMessage('اختاري المحافظة من القائمة.')
  return
}
if (address.city.trim().length < 2) {
  setMessage('أدخلي اسم المدينة.')
  return
}
if (address.address_line.trim().length < 10) {
  setMessage('اكتبي العنوان بالتفصيل (10 أحرف على الأقل).')
  return
}
    if (!supabase || busy) return
    if (address.map_url.trim()) {
      try {
        const url = new URL(address.map_url.trim())
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
      } catch {
        setMessage('أدخلي رابط خرائط Google صحيحًا أو اتركي الحقل فارغًا.')
        return
      }
    }

    setBusy(true)
    setMessage('')

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError || !userData.user) {
        setMessage('تعذر التحقق من الحساب.')
        return
      }

      const result = editingAddress
        ? await supabase
            .from('addresses')
            .update(address)
            .eq('id', editingAddress)
            .eq('user_id', userData.user.id)
        : await supabase
            .from('addresses')
            .insert({
              ...address,
              user_id: userData.user.id,
              is_default: addresses.length === 0
            })

      if (result.error) {
        setMessage(`تعذر حفظ العنوان: ${result.error.message}`)
      } else {
        setAddress({
          recipient_name: '',
          phone: '',
          region: '',
          city: '',
          address_line: '',
          map_url: '',
          notes: ''
        })

        setEditingAddress(null)

        setMessage(
          editingAddress
            ? 'تم تحديث العنوان.'
            : 'تمت إضافة العنوان.'
        )

        await loadAccount()
      }
    } catch {
      setMessage('حدث خطأ أثناء حفظ العنوان.')
    } finally {
      setBusy(false)
    }
  }

  const makeDefault = async (id: string) => {
    if (!supabase) return

    const { error } = await supabase.rpc('set_default_address', {
      p_address_id: id
    })

    if (error) {
      setMessage(`تعذر تعيين العنوان الافتراضي: ${error.message}`)
    } else {
      notify('تم تعيين العنوان الافتراضي.')
      await loadAccount()
    }
  }

  const removeAddress = async () => {
    if (!supabase) return
    if (!addressToDelete || deletingAddress) return

    setDeletingAddress(true)
    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', addressToDelete.id)

      if (error) {
        setMessage(`تعذر حذف العنوان: ${error.message}`)
        setAddressToDelete(null)
      } else {
        setAddressToDelete(null)
        notify('تم حذف العنوان.')
        await loadAccount()
      }
    } catch (error) {
      setMessage(`تعذر حذف العنوان: ${error instanceof Error ? error.message : 'حدث خطأ غير معروف.'}`)
      setAddressToDelete(null)
    } finally {
      setDeletingAddress(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setSigningOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      notify('تم تسجيل الخروج بنجاح.')
      setLogoutConfirm(false)
    } catch (error) {
      setSigningOut(false)
      setMessage(`تعذر تسجيل الخروج: ${error instanceof Error ? error.message : 'حدث خطأ غير معروف.'}`)
      setLogoutConfirm(false)
    }
  }

  const deliveredOrders = accountOrders.filter((order) => order.status === 'delivered')
  const deliveredTotal = deliveredOrders.reduce((sum, order) => sum + Number(order.total), 0)
  const displayName = profile.full_name.trim().split(/\s+/)[0] || 'صديقتنا'
  const profileCompletion = [profile.full_name, profile.phone, profile.email].filter((value) => value.trim()).length

  return (
    <AuthGate>
      <main className="page-main account-page">
        <section className="account-welcome">
          <div className="account-welcome-copy">
            <p className="eyebrow"><Sparkles size={14} /> مساحتك الخاصة في الحلم</p>
            <h1>أهلًا بكِ، <em>{displayName}</em></h1>
            <p>من هنا يمكنك متابعة طلباتك، تحديث بياناتك، وإدارة عناوين التوصيل بكل سهولة.</p>
          </div>
          <div className="account-avatar" aria-hidden="true"><UserRound size={31} /></div>
        </section>

        <AccountNavigation active="account" />

        <section className="account-overview" aria-label="ملخص الحساب">
          <article><span className="account-overview-icon"><PackageCheck size={18} /></span><div><small>إجمالي الطلبات</small><b>{accountLoading ? '…' : accountOrders.length}</b></div></article>
          <article><span className="account-overview-icon"><BadgeCheck size={18} /></span><div><small>طلبات تم تسليمها</small><b>{accountLoading ? '…' : deliveredOrders.length}</b></div></article>
          <article><span className="account-overview-icon"><MapPin size={18} /></span><div><small>عناوين التوصيل</small><b>{accountLoading ? '…' : addresses.length}</b></div></article>
          <article className="account-spend-overview"><span className="account-overview-icon"><Sparkles size={18} /></span><div><small>قيمة مشترياتك المستلمة</small><b>{accountLoading ? '…' : money(deliveredTotal)}</b></div></article>
        </section>

        {!accountLoading && accountOrders[0] && <section className="account-latest-order">
          <span className="account-latest-icon"><Truck size={20} /></span>
          <div className="account-latest-copy">
            <small>آخر طلب لكِ · #{accountOrders[0].order_number}</small>
            <b>{orderStatusLabels[accountOrders[0].status]}</b>
            <span>{new Date(accountOrders[0].created_at).toLocaleDateString('ar-EG', { calendar: 'gregory', day: 'numeric', month: 'long', year: 'numeric' })} · {money(Number(accountOrders[0].total))}</span>
          </div>
          <Link to={`/orders/${accountOrders[0].id}`}>تفاصيل الطلب <ArrowLeft size={15} /></Link>
        </section>}

        {stockAlerts.length > 0 && (
          <section className="stock-alert-notifications" aria-labelledby="stock-alert-title">
            <div className="stock-alert-notifications-heading">
              <span><BellRing size={18} /></span>
              <div>
                <h2 id="stock-alert-title">مقاسات عادت للمخزون</h2>
                <p>القطع التي طلبتِ تنبيهكِ عند توفرها أصبحت متاحة الآن.</p>
              </div>
            </div>
            <div className="stock-alert-notification-list">
              {stockAlerts.map((alert) => {
                const variant = Array.isArray(alert.variant) ? alert.variant[0] : alert.variant
                const product = variant
                  ? Array.isArray(variant.product) ? variant.product[0] : variant.product
                  : null
                return (
                  <div className="stock-alert-notification" key={alert.id}>
                  <div>
                    <b>{product?.name || 'عباية'}</b>
                    <span>{variant?.color} · مقاس {variant?.size} متوفر الآن</span>
                  </div>
                  {product?.slug && (
                    <Link to={`/products/${product.slug}`}>تسوقيها <ArrowLeft size={14} /></Link>
                  )}
                  <button type="button" onClick={() => void dismissStockAlert(alert.id)}>إخفاء</button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="account-columns">
          <section className="admin-card">
            <div className="account-card-heading"><span className="account-card-icon"><UserRound size={18} /></span><div><h2>بياناتك الشخصية</h2><p>تأكدي من صحة بيانات التواصل لتسهيل متابعة طلباتك.</p></div></div>

            <form className="account-form" onSubmit={saveProfile}>
              <label>
                البريد الإلكتروني
                <input type="email" value={profile.email} readOnly />
              </label>

              <label>
                الاسم الكامل
                <input
                  required
                  value={profile.full_name}
                  onChange={(event) =>
                    setProfile({ ...profile, full_name: event.target.value })
                  }
                />
              </label>

              <label>
                رقم الهاتف
                <input
                  required
                  type="tel"
                  value={profile.phone}
                  onChange={(event) =>
                    setProfile({ ...profile, phone: event.target.value })
                  }
                />
              </label>

              <button className="button button-dark" disabled={busy}>
                {busy ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
              </button>
            </form>
            <div className="profile-completion">
              <span>اكتمال بيانات الحساب</span><b>{Math.round(profileCompletion / 3 * 100)}%</b>
              <div><i style={{ width: `${profileCompletion / 3 * 100}%` }} /></div>
            </div>
          </section>

          <section className="admin-card">
            <div className="account-card-heading"><span className="account-card-icon"><MapPin size={18} /></span><div><h2>{editingAddress ? 'تعديل عنوان التوصيل' : 'إضافة عنوان توصيل'}</h2><p>احفظي عنوانك لتسهيل إتمام الطلبات القادمة.</p></div></div>

            <form className="account-form address-form" onSubmit={addAddress}>
             {(
  [
    ['recipient_name', 'الاسم المستلم'],
    ['phone', 'رقم الهاتف'],
    ['region', 'المحافظة'],
    ['city', 'المدينة'],
    ['address_line', 'العنوان بالتفصيل'],
    ['map_url', 'رابط موقع Google Maps (اختياري)'],
    ['notes', 'ملاحظات']
  ] as const
).map(([field, label]) =>
  field === 'region' ? (
    <label key={field}>
      {label}
      <select
        required
        className="governorate-select"
        value={address.region}
        onChange={(event) => setAddress({ ...address, region: event.target.value })}
      >
        <option value="">اختاري المحافظة</option>
        {GOVERNORATES.filter((g) => !Object.keys(zones).length || g in zones).map((g) => (
          <option key={g} value={g}>
            {g}{zones[g] !== undefined ? ` — ${money(zones[g])}` : ''}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <label key={field}>
      {label}
      <input
        required={field !== 'notes' && field !== 'map_url'}
        type={field === 'map_url' ? 'url' : 'text'}
        placeholder={field === 'map_url' ? 'https://maps.google.com/…' : undefined}
        value={address[field]}
        onChange={(event) => setAddress({ ...address, [field]: event.target.value })}
      />
    </label>
  )
)}

              <button className="button button-dark" disabled={busy}>
                {busy
                  ? 'جارٍ الحفظ...'
                  : editingAddress
                    ? 'حفظ تعديلات العنوان'
                    : 'إضافة العنوان'}
              </button>

              {editingAddress && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => {
                    setEditingAddress(null)
                    setAddress({
                      recipient_name: '',
                      phone: '',
                      region: '',
                      city: '',
                      address_line: '',
                      map_url: '',
                      notes: ''
                    })
                  }}
                >
                  إلغاء التعديل
                </button>
              )}
            </form>
          </section>

          <section className="admin-card address-list">
            <div className="account-card-heading"><span className="account-card-icon"><MapPin size={18} /></span><div><h2>عناوين التوصيل</h2><p>{addresses.length ? `لديكِ ${addresses.length} ${addresses.length === 1 ? 'عنوان محفوظ' : 'عناوين محفوظة'}.` : 'أضيفي عنوانكِ لتسهيل طلبكِ القادم.'}</p></div></div>

            {addresses.length ? (
              addresses.map((item) => (
                <div className="address-row" key={item.id}>
                  <div>
                    <b>{item.recipient_name}</b>

                    {item.is_default && <small className="default-address-badge"><BadgeCheck size={13} /> العنوان الافتراضي</small>}

                    <p>
                      {item.phone} · {item.region}، {item.city}
                      <br />
                      {item.address_line}
                    </p>
                    {item.map_url && <a className="address-map-link" href={item.map_url} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> فتح الموقع على الخريطة <ExternalLink size={13} /></a>}
                  </div>

                  <div className="address-controls">
                    {!item.is_default && (
                      <button onClick={() => void makeDefault(item.id)}>
                        تعيين افتراضي
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingAddress(item.id)
                        setAddress({
                          recipient_name: item.recipient_name,
                          phone: item.phone,
                          region: item.region,
                          city: item.city,
                          address_line: item.address_line,
                          map_url: item.map_url || '',
                          notes: item.notes || ''
                        })
                      }}
                    >
                      تعديل
                    </button>

                    <button type="button" onClick={() => setAddressToDelete(item)}>
                      حذف
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted-copy">لم تضيفي عناوين بعد.</p>
            )}
          </section>

          <div className="account-actions">
            <Link className="account-orders-link" to="/orders"><PackageCheck size={17} /><span><b>طلباتي</b><small>تابعي حالة ومعلومات طلباتك</small></span><ArrowLeft size={16} /></Link>
            <button className="account-signout" onClick={() => setLogoutConfirm(true)}>
              <LogOut size={16} /><span>تسجيل الخروج</span>
            </button>

            {message && <ToastMessage message={message} />}
          </div>
        </div>
        {(logoutConfirm || addressToDelete) && createPortal(<div className="admin-confirm-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !signingOut && !deletingAddress) {
            setLogoutConfirm(false)
            setAddressToDelete(null)
          }
        }}>
          <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-confirm-title" aria-describedby="account-confirm-description">
            <span className="admin-confirm-icon">
              {addressToDelete ? <Trash2 size={22} /> : <LogOut size={22} />}
            </span>
            <p className="eyebrow">{addressToDelete ? 'تأكيد الحذف' : 'تأكيد تسجيل الخروج'}</p>
            <h2 id="account-confirm-title">
              {addressToDelete ? 'هل تريدين حذف هذا العنوان؟' : 'هل تريدين تسجيل الخروج؟'}
            </h2>
            <p id="account-confirm-description">
              {addressToDelete
                ? <>سيتم حذف عنوان <b>{addressToDelete.recipient_name}</b> نهائيًا من عناوين التوصيل المحفوظة.</>
                : 'يمكنكِ العودة إلى حسابكِ في أي وقت لمتابعة طلباتكِ ومفضّلتكِ.'}
            </p>
            <div className="admin-confirm-actions">
              <button ref={confirmCancelRef} className="admin-confirm-cancel" type="button" disabled={signingOut || deletingAddress} onClick={() => {
                setLogoutConfirm(false)
                setAddressToDelete(null)
              }}>تراجُع</button>
              <button type="button" className="admin-confirm-delete" disabled={signingOut || deletingAddress} onClick={() => {
                if (addressToDelete) void removeAddress()
                else void signOut()
              }}>
                {addressToDelete ? <Trash2 size={15} /> : <LogOut size={15} />}
                {deletingAddress
                  ? 'جارٍ حذف العنوان…'
                  : signingOut
                    ? 'جارٍ تسجيل الخروج…'
                    : addressToDelete
                      ? 'نعم، احذف'
                      : 'نعم، سجّلي الخروج'}
              </button>
            </div>
          </section>
        </div>, document.body)}
      </main>
    </AuthGate>
  )
}

// ==============================
// Orders Page
// ==============================

export function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase
      .from('orders')
      .select('id,order_number,status,payment_status,total,deposit_amount,remaining_amount,created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error: resultError }) => {
        if (resultError) {
          setError(`تعذر تحميل الطلبات: ${resultError.message}`)
        } else {
          setOrders(data ?? [])
        }
        setLoading(false)
      })
  }, [])

  return (
    <AuthGate>
      <main className="page-main account-page">
        <div className="page-title">
          <p className="eyebrow">رحلة كل طلب</p>
          <h1>طلباتي</h1>
        </div>

        <AccountNavigation active="orders" />

        {!error && !loading && orders.length > 0 && <section className="orders-overview">
          <div><span className="orders-overview-icon"><PackageCheck size={19} /></span><small>إجمالي الطلبات</small><b>{orders.length}</b></div>
          <div><span className="orders-overview-icon"><BadgeCheck size={19} /></span><small>تم تسليمها</small><b>{orders.filter((order) => order.status === 'delivered').length}</b></div>
          <div><span className="orders-overview-icon"><Truck size={19} /></span><small>قيد المتابعة</small><b>{orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length}</b></div>
          <div><span className="orders-overview-icon"><Sparkles size={19} /></span><small>إجمالي المشتريات</small><b>{money(orders.filter((order) => order.status === 'delivered').reduce((sum, order) => sum + Number(order.total), 0))}</b></div>
        </section>}

        {error ? (
          <EmptyState title="حدث خطأ" message={error} />
        ) : loading ? (
          <div className="orders-loading"><span /><span /><span /></div>
        ) : orders.length ? (
          <div className="orders-list">
            {orders.map((order) => {
              const statusTone = order.status === 'delivered'
                ? 'delivered'
                : order.status === 'cancelled'
                  ? 'cancelled'
                  : ['shipped', 'out_for_delivery'].includes(order.status)
                    ? 'shipping'
                    : ['deposit_confirmed', 'preparing'].includes(order.status)
                      ? 'processing'
                      : 'pending'
              return <Link className="order-row" key={order.id} to={`/orders/${order.id}`}>
                <span className={`order-row-icon order-tone-${statusTone}`}><PackageCheck size={21} /></span>
                <div className="order-row-main">
                  <div className="order-row-title"><b>طلب رقم #{order.order_number}</b><span className={`status-pill status-${statusTone}`}>{orderStatusLabels[order.status]}</span></div>
                  <small><CalendarDays size={13} /> {new Date(order.created_at).toLocaleDateString('ar-EG', { calendar: 'gregory', day: 'numeric', month: 'long', year: 'numeric' })}</small>
                </div>
                <div className="order-row-payment"><small>إجمالي الطلب</small><b>{money(Number(order.total))}</b><span>المدفوع مقدمًا {money(Number(order.deposit_amount))}</span></div>
                <span className="order-row-arrow"><ArrowLeft size={17} /></span>
              </Link>
            })}
          </div>
        ) : (
          <EmptyState
            title="لا توجد طلبات بعد"
            message="ستظهر طلباتك هنا بعد إتمام أول عملية شراء."
            action="/products"
            actionText="تصفحي العبايات"
          />
        )}
      </main>
    </AuthGate>
  )
}

// ==============================
// Favorites Page
// ==============================

export function FavoritesPage() {
  const notify = useToast()
  const promotionNow = usePromotionClock()
  const [products, setProducts] = useState<
    {
      id: string
      name: string
      slug: string
      price: number
      images: { image_url: string }[]
      category: { promotions: PromotionSchedule[] | null }[] | null
    }[]
  >([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const { data, error: resultError } = await supabase
      .from('favorites')
      .select(
        'product:products(id,name,slug,price,category:categories(promotions(discount_percent,starts_at,ends_at,is_active)),images:product_images(image_url,position))'
      )

    if (resultError) {
      setError(`تعذر تحميل المفضلة: ${resultError.message}`)
    } else {
      setProducts((data ?? []).flatMap((item) => item.product))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const remove = async (productId: string) => {
    if (!supabase || removingId) return

    setRemovingId(productId)
    const { error: resultError } = await supabase
      .from('favorites')
      .delete()
      .eq('product_id', productId)

    if (resultError) {
      setError(`تعذر حذف المنتج: ${resultError.message}`)
    } else {
      setProducts((current) => current.filter((product) => product.id !== productId))
      notify('تمت إزالة المنتج من المفضلة.')
    }
    setRemovingId(null)
  }

  return (
    <AuthGate>
      <main className="page-main account-page">
        <div className="page-title">
          <p className="eyebrow">قطع اخترتها بقلبك</p>
          <h1>المفضلة</h1>
        </div>

        <AccountNavigation active="favorites" />

        {error ? (
          <EmptyState title="حدث خطأ" message={error} />
        ) : loading ? (
          <div className="favorite-loading"><span /><span /><span /></div>
        ) : products.length ? (
          <div className="favorite-list">
            {products.map((product, index) => (
              <div className="favorite-row" key={product.id}>
                <Link className="favorite-product-link" to={`/products/${product.slug}`}>
                  <img
                    src={product.images[0]?.image_url || categoryFallback(index)}
                    alt={product.name}
                  />

                  <span className="favorite-product-copy">
                    <small className="favorite-kicker"><Heart size={12} fill="currentColor" /> محفوظة في المفضلة</small>
                    <b>{product.name}</b>
                    <span className="favorite-price">
                      <strong>{money(promotionPrice(product.price, product.category?.[0]?.promotions, promotionNow))}</strong>
                      {promotionPercent(product.category?.[0]?.promotions, promotionNow) > 0 && <del>{money(product.price)}</del>}
                    </span>
                    {promotionPercent(product.category?.[0]?.promotions, promotionNow) > 0 && <span className="favorite-discount">خصم {promotionPercent(product.category?.[0]?.promotions, promotionNow)}%</span>}
                    <span className="favorite-view">عرض التفاصيل <ArrowLeft size={14} /></span>
                  </span>
                </Link>

                <button className="favorite-remove" disabled={removingId === product.id} aria-label={`إزالة ${product.name} من المفضلة`} onClick={() => void remove(product.id)}>
                  <Trash2 size={16} /><span>{removingId === product.id ? 'جارٍ الإزالة' : 'إزالة'}</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="قائمة المفضلة فارغة"
            message="اضغطي على القلب بجانب أي عباية للاحتفاظ بها هنا."
            action="/products"
            actionText="اكتشفي العبايات"
          />
        )}
      </main>
    </AuthGate>
  )
}

// ==============================
// Authentication Page
// ==============================

export function AuthPage() {
  const notify = useToast()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [signupCooldown, setSignupCooldown] = useState(0)
const [confirm, setConfirm] = useState('')
const [errors, setErrors] = useState<Record<string, string>>({})
  // يمنع إرسال أكثر من طلب في نفس الوقت
  const submitLock = useRef(false)

  const location = useLocation()
  const navigate = useNavigate()

  // Countdown
  useEffect(() => {
    if (signupCooldown <= 0) return

    const timer = window.setTimeout(() => {
      setSignupCooldown((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [signupCooldown])

  // رسائل أخطاء المصادقة
  const friendlyAuthError = (
    error: { status?: number; code?: string; message: string },
    currentMode: 'login' | 'signup' | 'reset' = mode
  ) => {
    const code = error.code || ''
    const errorMessage = error.message.toLowerCase()

    if (
      error.status === 429 ||
      code === 'over_request_rate_limit' ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    ) {
      return 'تم تجاوز عدد المحاولات المسموح به. يرجى الانتظار قليلًا قبل المحاولة مجددًا. إذا استمر الخطأ، راجعي إعدادات Rate Limits في Supabase.'
    }

    if (
      code === 'email_not_confirmed' ||
      errorMessage.includes('email not confirmed')
    ) {
      return 'لم يتم تأكيد بريدك الإلكتروني بعد. افتحي رسالة التأكيد المرسلة من المتجر ثم حاولي تسجيل الدخول.'
    }

    if (
      code === 'invalid_credentials' ||
      code === 'invalid_grant'
    ) {
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة. تحققي من البيانات أو استخدمي استعادة كلمة المرور.'
    }

    if (
      code === 'user_already_exists' ||
      code === 'email_exists' ||
      errorMessage.includes('already registered') ||
      errorMessage.includes('user already registered')
    ) {
      return 'هذا البريد الإلكتروني مسجل بالفعل. سجلي الدخول بدلًا من إنشاء حساب جديد.'
    }

    if (
      code === 'weak_password' ||
      errorMessage.includes('password should be')
    ) {
      return 'كلمة المرور ضعيفة. اختاري كلمة مرور أقوى وتحتوي على 8 أحرف على الأقل.'
    }

    if (
      code === 'email_address_invalid' ||
      errorMessage.includes('invalid email')
    ) {
      return 'البريد الإلكتروني غير صحيح. تحققي من كتابته.'
    }

    if (currentMode === 'login' && error.status === 400) {
      return 'تعذر تسجيل الدخول. تحققي من البريد الإلكتروني وكلمة المرور، ثم حاولي مجددًا.'
    }

    if (currentMode === 'signup' && error.status === 400) {
      return `تعذر إنشاء الحساب: ${error.message}`
    }

    if (currentMode === 'reset' && error.status === 400) {
      return 'تعذر إرسال رابط الاستعادة. تحققي من البريد الإلكتروني وحاولي لاحقًا.'
    }

    return error.message || 'حدث خطأ غير متوقع. حاولي مرة أخرى.'
  }

  // تسجيل الدخول وإنشاء الحساب
  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (submitLock.current || busy) return

    if (mode === 'signup' && signupCooldown > 0) {
      setMessage(`انتظري ${signupCooldown} ثانية قبل المحاولة مجددًا.`)
      return
    }

    if (!supabase) {
      setMessage('إعدادات Supabase غير مكتملة. تعذر تفعيل الحسابات.')
      return
    }

    const currentMode = mode
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      setMessage('أدخلي البريد الإلكتروني وكلمة المرور.')
      return
    }

let cleanPhone = phone.trim()
if (currentMode === 'signup') {
  const check = validateSignup({ name, phone, email: cleanEmail, password, confirm })
  setErrors(check.errors)
  if (Object.keys(check.errors).length) {
    setMessage('راجعي الحقول المميزة وصحّحيها.')
    return
  }
  cleanPhone = check.phone
}
    // قفل فوري لمنع النقر المتكرر
    submitLock.current = true
    setBusy(true)
    setMessage('')

    try {
      let result

      if (currentMode === 'login') {
        // تسجيل الدخول فقط
        result = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        })
      } else {
        // إنشاء حساب فقط عند اختيار التسجيل
        result = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
  full_name: name.trim(),
  phone: cleanPhone
}
          }
        })
      }

      if (result.error) {
        console.error('Supabase Auth Error:', {
          mode: currentMode,
          status: result.error.status,
          code: result.error.code,
          message: result.error.message
        })

        setMessage(friendlyAuthError(result.error, currentMode))

        if (
          currentMode === 'signup' &&
          result.error.status === 429
        ) {
          // فترة انتظار محلية لمنع تكرار الطلبات
          setSignupCooldown(120)
        }

        return
      }

      if (
        currentMode === 'signup' &&
        !result.data.session
      ) {
        setMessage(
          'تم إرسال طلب إنشاء الحساب. تحققي من بريدك الإلكتروني واضغطي على رابط التأكيد لتفعيل حسابك.'
        )

        return
      }

      // نجاح تسجيل الدخول أو إنشاء الحساب
      if (result.data.session) {
        if (currentMode === 'login') {
          const metadataName = result.data.user?.user_metadata.full_name
          const firstName =
            typeof metadataName === 'string'
              ? metadataName.trim().split(/\s+/)[0]
              : ''
          notify(
            firstName
              ? `تم تسجيل الدخول بنجاح، مرحبًا بعودتكِ يا ${firstName}.`
              : 'تم تسجيل الدخول بنجاح، مرحبًا بعودتكِ.',
          )
        } else {
          notify('تم إنشاء حسابكِ بنجاح، أهلًا بكِ في الحلم.')
        }
        const returnState = location.state as {
          from?: string
          stockAlertVariantId?: string
        } | null
        navigate(
          returnState?.from || '/account',
          {
            replace: true,
            state: returnState?.stockAlertVariantId
              ? { stockAlertVariantId: returnState.stockAlertVariantId }
              : null,
          }
        )
      } else {
        setMessage('تمت العملية بنجاح، لكن لم يتم إنشاء جلسة دخول.')
      }
    } catch (error) {
      console.error('Auth Request Failed:', error)

      setMessage(
        error instanceof Error
          ? `تعذر الاتصال بخدمة الحسابات: ${error.message}`
          : 'تعذر الاتصال بخدمة الحسابات. تحققي من اتصال الإنترنت وحاولي مجددًا.'
      )
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  // استعادة كلمة المرور
  const resetPassword = async () => {
    if (submitLock.current || busy) return

    if (!supabase) {
      setMessage('إعدادات Supabase غير مكتملة.')
      return
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setMessage('أدخلي بريدك الإلكتروني أولًا.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMessage('أدخلي بريدًا إلكترونيًا صحيحًا.')
      return
    }

    submitLock.current = true
    setBusy(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      )

      if (error) {
        console.error('Password Reset Error:', error)

        setMessage(friendlyAuthError(error, 'reset'))
      } else {
        setMessage(
          'إذا كان البريد مسجلًا، ستصلك رسالة لاستعادة كلمة المرور. تحققي من صندوق الوارد والرسائل غير المرغوب فيها.'
        )
      }
    } catch (error) {
      console.error('Password Reset Failed:', error)

      setMessage(
        error instanceof Error
          ? `تعذر إرسال رسالة الاستعادة: ${error.message}`
          : 'تعذر إرسال رسالة الاستعادة. حاولي مجددًا لاحقًا.'
      )
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  // تغيير وضع الصفحة
  const switchMode = (nextMode: 'login' | 'signup') => {
    if (busy) return

    setMode(nextMode)
    setMessage('')
        setErrors({})
setConfirm('')
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">مساحتك الخاصة</p>

        <h1>
          {mode === 'login'
            ? 'أهلًا بعودتكِ'
            : 'ابدئي حكايتك معنا'}
        </h1>

        <p>
          سجلي الدخول لمتابعة طلباتك والاحتفاظ باختياراتك.
        </p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>
  الاسم الكامل
  <input
    required
    value={name}
    aria-invalid={Boolean(errors.name)}
    onChange={(event) => { setName(event.target.value); setErrors({ ...errors, name: '' }) }}
    autoComplete="name"
    disabled={busy}
  />
  {errors.name && <small className="field-error">{errors.name}</small>}
</label>

              <label>
                رقم الهاتف

                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  disabled={busy}
                />
                {errors.phone && <small className="field-error">{errors.phone}</small>}
              </label>
            </>
          )}

          <label>
            البريد الإلكتروني

            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={busy}
            />
          </label>

          <label>
            كلمة المرور

            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              disabled={busy}
            />
          </label>
{mode === 'signup' && (
  <label>
    تأكيد كلمة المرور
    <input
      required
      type="password"
      value={confirm}
      aria-invalid={Boolean(errors.confirm)}
      onChange={(event) => { setConfirm(event.target.value); setErrors({ ...errors, confirm: '' }) }}
      autoComplete="new-password"
      disabled={busy}
    />
    {errors.confirm && <small className="field-error">{errors.confirm}</small>}
  </label>
)}
          {message && <ToastMessage message={message} />}

          {signupCooldown > 0 && mode === 'signup' && (
            <p className="cooldown-message" role="status">
              يرجى الانتظار {signupCooldown} ثانية قبل إعادة المحاولة.
            </p>
          )}

          <button
            type="submit"
            className="button button-dark full-button"
            disabled={
              busy ||
              (mode === 'signup' && signupCooldown > 0)
            }
          >
            {busy
              ? 'لحظة من فضلك…'
              : mode === 'login'
                ? 'تسجيل الدخول'
                : 'إنشاء حساب'}
          </button>
        </form>

        <button
          type="button"
          className="text-link auth-switch"
          disabled={busy}
          onClick={() =>
            switchMode(mode === 'login' ? 'signup' : 'login')
          }
        >
          {mode === 'login'
            ? 'ليس لديكِ حساب؟ أنشئي حسابًا'
            : 'لديكِ حساب؟ سجلي الدخول'}
        </button>

        <button
          type="button"
          className="text-link auth-switch"
          disabled={busy}
          onClick={() => void resetPassword()}
        >
          نسيت كلمة المرور؟
        </button>
      </div>
    </main>
  )
}

// ==============================
// Reset Password Page
// ==============================

export function ResetPasswordPage() {
  const notify = useToast()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submitLock = useRef(false)
  const navigate = useNavigate()

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase || busy || submitLock.current) return

    if (password.length < 8) {
      setMessage('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.')
      return
    }

    submitLock.current = true
    setBusy(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) {
        setMessage(`تعذر تحديث كلمة المرور: ${error.message}`)
      } else {
        notify('تم تحديث كلمة المرور بنجاح.')
        navigate('/account')
      }
    } catch {
      setMessage('حدث خطأ أثناء تحديث كلمة المرور.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">استعادة الحساب</p>

        <h1>كلمة مرور جديدة</h1>

        <form onSubmit={submit}>
          <label>
            كلمة المرور الجديدة

            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
            />
          </label>

          {message && <ToastMessage message={message} />}

          <button
            type="submit"
            className="button button-dark full-button"
            disabled={busy}
          >
            {busy ? 'جارٍ التحديث...' : 'حفظ كلمة المرور'}
          </button>
        </form>
      </div>
    </main>
  )
}

// ==============================
// Order Types
// ==============================

type OrderItem = {
  id: string
  product_name: string
  size: string
  color: string
  unit_price: number
  quantity: number
  line_total: number
}

type OrderHistory = {
  status: OrderStatus
  note: string | null
  created_at: string
}

type OrderRecord = CustomerOrder & {
  subtotal: number
  discount_amount: number
  delivery_fee: number
  address_snapshot: Record<string, string>
  customer_note: string | null
  items: OrderItem[]
  history: OrderHistory[]
  payment_receipts: {
    id: string
    storage_path: string
    review_note: string | null
    created_at: string
  }[]
}

// ==============================
// Order Details Page
// ==============================

export function OrderDetailsPage() {
  const { id } = useParams()

  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const cancelDialogCancelRef = useRef<HTMLButtonElement>(null)

  const loadOrder = async () => {
    if (!supabase || !id) return

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id,order_number,status,payment_status,total,deposit_amount,remaining_amount,subtotal,discount_amount,delivery_fee,address_snapshot,customer_note,created_at,items:order_items(id,product_name,size,color,unit_price,quantity,line_total),history:order_status_history(status,note,created_at),payment_receipts(id,storage_path,created_at)'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      setMessage(`تعذر تحميل الطلب: ${error.message}`)
      return
    }

    if (!data) {
      setMessage('لم نعثر على الطلب.')
      return
    }

    const result = data as unknown as OrderRecord

    result.history.sort((first, second) =>
      first.created_at.localeCompare(second.created_at)
    )

    result.payment_receipts.sort((first, second) =>
      second.created_at.localeCompare(first.created_at)
    )

    setOrder(result)

    const currentReceipt = result.payment_receipts?.[0]

    if (currentReceipt) {
      const { data: signed, error: signedError } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(currentReceipt.storage_path, 120)

      if (signedError) {
        setMessage(`تعذر عرض إيصال الدفع: ${signedError.message}`)
      } else {
        setReceiptUrl(signed.signedUrl)
      }
    } else {
      setReceiptUrl('')
    }
  }

  useEffect(() => {
    void loadOrder()
  }, [id])

  useEffect(() => {
    if (!cancelConfirm) return

    cancelDialogCancelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setCancelConfirm(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelConfirm, busy])

  const cancelOrder = async () => {
    if (!supabase || !id || busy) return

    setBusy(true)

    try {
      const { error } = await supabase.rpc('cancel_my_order', {
        p_order_id: id
      })

      if (error) {
        setMessage(`تعذر إلغاء الطلب: ${error.message}`)
      } else {
        setCancelConfirm(false)
        setMessage('تم إلغاء الطلب.')
        await loadOrder()
      }
    } catch (error) {
      setMessage(`تعذر إلغاء الطلب: ${error instanceof Error ? error.message : 'حدث خطأ غير متوقع.'}`)
    } finally {
      setBusy(false)
    }
  }

  const uploadReceipt = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase || !id || !receipt || !order || busy) return

    if (
      receipt.size > 5 * 1024 * 1024 ||
      ![
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      ].includes(receipt.type)
    ) {
      setMessage(
        'يسمح بملفات JPG أو PNG أو WebP أو PDF بحجم أقصى 5 ميجابايت.'
      )
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError || !userData.user) {
        setMessage('تعذر التحقق من حسابك.')
        return
      }

      const path = `${userData.user.id}/${id}/${crypto.randomUUID()}-${receipt.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      )}`

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(path, receipt, {
          contentType: receipt.type
        })

      if (uploadError) {
        setMessage(`تعذر رفع الإيصال: ${uploadError.message}`)
        return
      }

      const { error } = await supabase
        .from('payment_receipts')
        .insert({
          order_id: id,
          user_id: userData.user.id,
          storage_path: path
        })

      if (error) {
        setMessage(`تعذر تسجيل الإيصال: ${error.message}`)
      } else {
        setReceipt(null)
        setMessage('تم رفع الإيصال.')
        await loadOrder()
      }
    } catch {
      setMessage('حدث خطأ أثناء رفع الإيصال.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthGate>
      <main className="page-main account-page">
        <div className="page-title">
          <p className="eyebrow">رحلة طلبك</p>
          <h1>تفاصيل الطلب</h1>
        </div>

        {message && <ToastMessage message={message} />}

        {order ? (
          <>
            <div className="order-detail-heading">
              <b>طلب رقم {order.order_number}</b>

              <span className="status-pill">
                {orderStatusLabels[order.status]}
              </span>

              <small>
                {new Date(order.created_at).toLocaleString('ar-SA', { calendar: 'gregory' })}
              </small>
            </div>

            <div className="order-detail-columns">
              <section className="admin-card">
                <h2>حالة الطلب</h2>

                <div className="timeline">
                  {order.history.map((item, index) => (
                    <div
                      className="timeline-item current"
                      key={`${item.created_at}-${index}`}
                    >
                      <span>✓</span>

                      <div>
                        <b>{orderStatusLabels[item.status]}</b>

                        <small>
                          {new Date(item.created_at).toLocaleString('ar-SA', { calendar: 'gregory' })}
                          {item.note ? ` · ${item.note}` : ''}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="admin-card">
                <h2>ملخص الدفع</h2>

                <div className="order-summary-lines">
                  <div>
                    <span>قيمة المنتجات قبل الخصم</span>
                    <b>{money(Number(order.subtotal) + Number(order.discount_amount || 0))}</b>
                  </div>

                  {Number(order.discount_amount) > 0 && (
                    <div className="order-discount-line">
                      <span>خصم العروض</span>
                      <b>− {money(order.discount_amount)}</b>
                    </div>
                  )}

                  <div>
                    <span>قيمة المنتجات بعد الخصم</span>
                    <b>{money(order.subtotal)}</b>
                  </div>

                  <div>
                    <span>التوصيل</span>
                    <b>{money(order.delivery_fee)}</b>
                  </div>

                  <div>
                    <span>إجمالي الطلب</span>
                    <b>{money(order.total)}</b>
                  </div>

                  <div>
                    <span>المدفوع مقدمًا</span>
                    <b>{money(order.deposit_amount)}</b>
                  </div>

                  <div>
                    <span>المتبقي عند الاستلام</span>
                    <b>{money(order.remaining_amount)}</b>
                  </div>

                  <div>
                    <span>حالة الدفع</span>

                    <b>
                      {order.payment_status === 'deposit_confirmed'
                        ? 'تم تأكيد رسوم التوصيل'
                        : order.payment_status === 'rejected'
                          ? 'الإيصال مرفوض'
                          : order.payment_status === 'paid'
                            ? 'تم السداد'
                            : 'بانتظار المراجعة'}
                    </b>
                  </div>
                </div>

                {receiptUrl && (
                  <a
                    className="text-link"
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    عرض إيصال الدفع <ArrowLeft size={15} />
                  </a>
                )}

                {order.payment_receipts?.[0]?.review_note && (
                  <p className="muted-copy">
                    ملاحظة على الإيصال:{' '}
                    {order.payment_receipts[0].review_note}
                  </p>
                )}

                {order.payment_status === 'rejected' && (
                  <form className="receipt-form" onSubmit={uploadReceipt}>
                    <label className="checkout-receipt-upload">
                      <input
                        required
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) => setReceipt(event.target.files?.[0] || null)}
                      />
                      <span className="checkout-upload-icon"><Upload size={19} /></span>
                      <span className="checkout-upload-copy"><b>{receipt?.name || 'ارفعي إيصالًا جديدًا'}</b><small>{receipt ? 'تم اختيار الملف بنجاح' : 'صورة أو PDF · بحد أقصى 5 ميجابايت'}</small></span>
                      <span className="checkout-upload-action">{receipt ? 'تغيير الملف' : 'اختيار ملف'}</span>
                    </label>

                    <button
                      className="button button-dark"
                      disabled={busy}
                    >
                      {busy ? 'جارٍ الرفع...' : 'رفع الإيصال'}
                    </button>
                  </form>
                )}
              </section>

              <section className="admin-card order-items">
                <h2>المنتجات</h2>

                {order.items.map((item) => (
                  <div className="order-item-row" key={item.id}>
                    <span>
                      {item.product_name} · {item.color} · {item.size}
                    </span>

                    <span>
                      {item.quantity} × {money(item.unit_price)}
                    </span>

                    <b>{money(item.line_total)}</b>
                  </div>
                ))}
              </section>

              <section className="admin-card">
                <h2>عنوان التوصيل</h2>

                <p>
                  {order.address_snapshot.recipient_name}
                  <br />
                  {order.address_snapshot.phone}
                  <br />
                  {order.address_snapshot.region}،{' '}
                  {order.address_snapshot.city}
                  <br />
                  {order.address_snapshot.address_line}
                </p>
                {order.address_snapshot.map_url && <a className="address-map-link" href={order.address_snapshot.map_url} target="_blank" rel="noopener noreferrer"><MapPin size={14} /> فتح الموقع على الخريطة <ExternalLink size={13} /></a>}

                {order.customer_note && (
                  <p>ملاحظات: {order.customer_note}</p>
                )}

                {['received', 'awaiting_deposit_review'].includes(
                  order.status
                ) && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => setCancelConfirm(true)}
                  >
                    إلغاء الطلب
                  </button>
                )}
              </section>
            </div>
          </>
        ) : (
          <EmptyState
            title="تعذر العثور على الطلب"
            message={message || 'لحظات من فضلك.'}
            action="/orders"
            actionText="العودة إلى طلباتي"
          />
        )}
      </main>
      {cancelConfirm && createPortal(
        <div
          className="admin-confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setCancelConfirm(false)
            }
          }}
        >
          <section
            className="admin-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            aria-describedby="cancel-order-description"
          >
            <span className="admin-confirm-icon"><Trash2 size={22} /></span>
            <p className="eyebrow">تأكيد إلغاء الطلب</p>
            <h2 id="cancel-order-title">هل تريدين إلغاء الطلب رقم {order?.order_number}؟</h2>
            <p id="cancel-order-description">
              لا يمكن إعادة تفعيل الطلب بعد إلغائه. هل أنتِ متأكدة من المتابعة؟
            </p>
            <div className="admin-confirm-actions">
              <button
                ref={cancelDialogCancelRef}
                className="admin-confirm-cancel"
                type="button"
                disabled={busy}
                onClick={() => setCancelConfirm(false)}
              >
                تراجُع
              </button>
              <button
                type="button"
                className="admin-confirm-delete"
                disabled={busy}
                onClick={() => void cancelOrder()}
              >
                <Trash2 size={15} />
                {busy ? 'جارٍ إلغاء الطلب…' : 'نعم، ألغِ الطلب'}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </AuthGate>
  )
}
