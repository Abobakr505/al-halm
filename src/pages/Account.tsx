
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CalendarDays, Heart, LogOut, MapPin, PackageCheck, Sparkles, Trash2, Truck, UserRound } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { orderStatusLabels, type OrderStatus } from '../types'
import { EmptyState, ToastMessage } from '../components/Common'
import { money, categoryFallback } from '../components/Storefront'
import { promotionPercent, promotionPrice } from '../lib/promotions'

type Address = {
  id: string
  recipient_name: string
  phone: string
  region: string
  city: string
  address_line: string
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
  const [profile, setProfile] = useState({
    email: '',
    full_name: '',
    phone: ''
  })

  const [addresses, setAddresses] = useState<Address[]>([])
  const [accountOrders, setAccountOrders] = useState<CustomerOrder[]>([])
  const [accountLoading, setAccountLoading] = useState(true)

  const [address, setAddress] = useState({
    recipient_name: '',
    phone: '',
    region: '',
    city: '',
    address_line: '',
    notes: ''
  })

  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadAccount = async () => {
    if (!supabase) return

    const { data: userData, error: userError } =
      await supabase.auth.getUser()

    if (userError || !userData.user) {
      setMessage('تعذر التحقق من الحساب.')
      setAccountLoading(false)
      return
    }

    const [profileResult, addressResult, ordersResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('email,full_name,phone')
        .eq('id', userData.user.id)
        .single(),

      supabase
        .from('addresses')
        .select('id,recipient_name,phone,region,city,address_line,notes,is_default')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('orders')
        .select('id,order_number,status,payment_status,total,deposit_amount,remaining_amount,created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
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
    setAccountLoading(false)
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
      await loadAccount()
    }
  }

  const removeAddress = async (id: string) => {
    if (!supabase) return

    if (!window.confirm('هل تريدين حذف هذا العنوان؟')) return

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(`تعذر حذف العنوان: ${error.message}`)
    } else {
      await loadAccount()
    }
  }

  const signOut = async () => {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage(`تعذر تسجيل الخروج: ${error.message}`)
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
            <span>{new Date(accountOrders[0].created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })} · {money(Number(accountOrders[0].total))}</span>
          </div>
          <Link to={`/orders/${accountOrders[0].id}`}>تفاصيل الطلب <ArrowLeft size={15} /></Link>
        </section>}

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
                  ['region', 'المنطقة'],
                  ['city', 'المدينة'],
                  ['address_line', 'العنوان بالتفصيل'],
                  ['notes', 'ملاحظات']
                ] as const
              ).map(([field, label]) => (
                <label key={field}>
                  {label}
                  <input
                    required={field !== 'notes'}
                    value={address[field]}
                    onChange={(event) =>
                      setAddress({
                        ...address,
                        [field]: event.target.value
                      })
                    }
                  />
                </label>
              ))}

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
                          notes: item.notes || ''
                        })
                      }}
                    >
                      تعديل
                    </button>

                    <button onClick={() => void removeAddress(item.id)}>
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
            <Link className="account-orders-link" to="/orders"><PackageCheck size={16} /> عرض جميع طلباتي <ArrowLeft size={15} /></Link>
            <button className="text-link account-signout" onClick={() => void signOut()}>
              <LogOut size={15} />
              تسجيل الخروج
            </button>

            {message && <ToastMessage message={message} />}
          </div>
        </div>
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
                  <small><CalendarDays size={13} /> {new Date(order.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</small>
                </div>
                <div className="order-row-payment"><small>إجمالي الطلب</small><b>{money(Number(order.total))}</b><span>العربون {money(Number(order.deposit_amount))}</span></div>
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
  const [products, setProducts] = useState<
    {
      id: string
      name: string
      slug: string
      price: number
      images: { image_url: string }[]
      category: { promotions: { discount_percent: number }[] | null }[] | null
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
        'product:products(id,name,slug,price,category:categories(promotions(discount_percent)),images:product_images(image_url,position))'
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
                      <strong>{money(promotionPrice(product.price, product.category?.[0]?.promotions))}</strong>
                      {promotionPercent(product.category?.[0]?.promotions) > 0 && <del>{money(product.price)}</del>}
                    </span>
                    {promotionPercent(product.category?.[0]?.promotions) > 0 && <span className="favorite-discount">خصم {promotionPercent(product.category?.[0]?.promotions)}%</span>}
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
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [signupCooldown, setSignupCooldown] = useState(0)

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

    if (currentMode === 'signup') {
      if (!name.trim() || !phone.trim()) {
        setMessage('أدخلي الاسم الكامل ورقم الهاتف.')
        return
      }

      if (password.length < 8) {
        setMessage('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.')
        return
      }
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
              phone: phone.trim()
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
        navigate(
          (location.state as { from?: string } | null)?.from || '/account',
          { replace: true }
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
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  disabled={busy}
                />
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
        setMessage('تم تحديث كلمة المرور بنجاح.')
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

  const cancelOrder = async () => {
    if (!supabase || !id || busy) return

    if (!window.confirm('هل تريدين إلغاء هذا الطلب؟')) return

    setBusy(true)

    try {
      const { error } = await supabase.rpc('cancel_my_order', {
        p_order_id: id
      })

      if (error) {
        setMessage(`تعذر إلغاء الطلب: ${error.message}`)
      } else {
        setMessage('تم إلغاء الطلب.')
        await loadOrder()
      }
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
                {new Date(order.created_at).toLocaleString('ar-SA')}
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
                          {new Date(item.created_at).toLocaleString('ar-SA')}
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
                    <span>العربون</span>
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
                        ? 'تم تأكيد العربون'
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
                    <label>
                      ارفعي إيصالًا جديدًا

                      <input
                        required
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) =>
                          setReceipt(event.target.files?.[0] || null)
                        }
                      />
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

                {order.customer_note && (
                  <p>ملاحظات: {order.customer_note}</p>
                )}

                {['received', 'awaiting_deposit_review'].includes(
                  order.status
                ) && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => void cancelOrder()}
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
    </AuthGate>
  )
}
