import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Heart, Instagram, Menu, Moon, Search, ShoppingBag, Sun, UserRound, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { readCart, subscribeToCart } from '../lib/cart'

export function SiteHeader() {
  const [dark, setDark] = useState(() => localStorage.getItem('al-hulm-theme') === 'dark')
  const [cartCount, setCartCount] = useState(() => readCart().reduce((total, item) => total + item.quantity, 0))
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('al-hulm-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => subscribeToCart(() => setCartCount(readCart().reduce((total, item) => total + item.quantity, 0))), [])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return <>
    <div className="announcement">تفاصيل صغيرة، أناقة تدوم <span>✦</span> شحن لجميع مناطق المملكة</div>
    <header className="site-header">
      <button className="icon-button mobile-menu" aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <Link className="brand" to="/" aria-label="متجر الحلم الرئيسية" onClick={closeMenu}><span className="Zain brand-mark">ح</span><span className="Zain brand-name">الحلم<small>عبايات بتفاصيل تليق بك</small></span></Link>
      <nav id="primary-navigation" className={menuOpen ? 'main-nav open' : 'main-nav'}>
        <Link to="/" onClick={closeMenu}>الرئيسية</Link><Link to="/products" onClick={closeMenu}>العبايات</Link><Link to="/categories" onClick={closeMenu}>الأقسام</Link><Link to="/about" onClick={closeMenu}>قصتنا</Link>
      </nav>
      <div className="header-actions">
        <Link className="icon-button" to="/search" aria-label="البحث"><Search /></Link>
        <Link className="icon-button favorite-link" to="/favorites" aria-label="المفضلة"><Heart /></Link>
        <Link className="icon-button account-link" to="/account" aria-label="حسابي"><UserRound /></Link>
        <button className="icon-button" onClick={() => setDark(!dark)} aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}>{dark ? <Sun /> : <Moon />}</button>
        <Link className="icon-button bag-button" to="/cart" aria-label="سلة التسوق"><ShoppingBag />{cartCount > 0 && <span className="bag-count">{cartCount}</span>}</Link>
      </div>
    </header>
    {!isSupabaseConfigured && <div className="config-banner">اربط المشروع بـ Supabase لإظهار المنتجات وتفعيل الطلبات والحسابات. <a href="/README.md" target="_blank" rel="noreferrer">طريقة الإعداد</a></div>}
  </>
}

export function SiteFooter() {
  const [contact, setContact] = useState<{ phone: string; email: string; instagram: string } | null>(null)
  useEffect(() => {
    if (!supabase) return
    supabase.from('store_settings').select('contact_phone,contact_email,instagram_url').eq('id', true).single().then(({ data, error }) => {
      if (error) console.error('تعذر تحميل بيانات التواصل في التذييل:', error.message)
      else setContact({ phone: data.contact_phone, email: data.contact_email, instagram: data.instagram_url })
    })
  }, [])
  return <footer className="site-footer"><div className="footer-main">
    <div className="footer-brand"><Link className="brand" to="/"><span className="brand-mark">ح</span><span className="brand-name">الحلم<small>عبايات بتفاصيل تليق بك</small></span></Link><p>أناقة خليجية، بتفاصيل مختارة من القلب.</p></div>
    <div><b>تصفحي</b><Link to="/products">كل العبايات</Link><Link to="/categories">الأقسام</Link><Link to="/about">قصتنا</Link></div>
    <div><b>مساعدتك</b><Link to="/contact">تواصلي معنا</Link><Link to="/policies">الشحن والاستبدال</Link><Link to="/account">حسابي</Link></div>
    <div><b>تابعينا</b>{contact?.instagram && <a href={contact.instagram} target="_blank" rel="noreferrer"><Instagram size={16} /> إنستغرام</a>}{contact?.phone && <a href={`tel:${contact.phone}`}>هاتف المتجر</a>}{contact?.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{!contact?.instagram && !contact?.phone && !contact?.email && <span className="muted-copy">بيانات التواصل قريبًا</span>}</div>
  </div><div className="footer-bottom"><span>© متجر الحلم — جميع الحقوق محفوظة</span><span>صُنعت بحب وأناقة <Heart size={13} /></span></div></footer>
}

export function EmptyState({ title, message, action, actionText }: { title: string; message: string; action?: string; actionText?: string }) {
  return <div className="empty-state"><span className="empty-mark">ح</span><h3>{title}</h3><p>{message}</p>{action && <Link className="button button-dark" to={action}>{actionText || 'متابعة'} <ArrowLeft size={16} /></Link>}</div>
}

export function InfoPage({ title, text }: { title: string; text: string }) {
  return <main className="page-main narrow-page"><div className="page-title"><p className="eyebrow">متجر الحلم</p><h1>{title}</h1><p>{text}</p></div><Link className="text-link" to="/products">تصفحي العبايات <ArrowLeft size={16} /></Link></main>
}
