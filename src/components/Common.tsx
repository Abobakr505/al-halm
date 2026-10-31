import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Facebook,
  Heart,
  Home,
  Instagram,
  Layers2,
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { readCart, subscribeToCart } from "../lib/cart";

export function TikTokIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.6 6.7a5.6 5.6 0 0 1-3.4-1.9A5.6 5.6 0 0 1 14.9 2h-3.3v13.3a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V9.3a6.1 6.1 0 1 0 5.2 6V9.1a8.9 8.9 0 0 0 5.2 1.7V7.5c-.2 0-.3-.1-.5-.8Z" />
    </svg>
  );
}

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };
type ToastContextValue = {
  notify: (message: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

function toastKind(message: string): ToastKind {
  if (
    /تعذر|خطأ|نفد|لا يمكن|يسمح|يجب|أدخلي|أضيفي|ارفقي|سجلي|لم يتم|فشل|الكمية المتاحة|غير متاح/.test(
      message,
    )
  )
    return "error";
  if (/^(تم|حُفظ|أضيف|أزيل|قُبل|رُفض|نجح)/.test(message)) return "success";
  return "info";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const lastToast = useRef({ message: "", time: 0 });

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message: string) => {
      if (!message) return;
      const now = Date.now();
      if (
        lastToast.current.message === message &&
        now - lastToast.current.time < 500
      )
        return;
      lastToast.current = { message, time: now };

      const id = ++nextToastId;
      setToasts((items) => [
        ...items.slice(-3),
        { id, message, kind: toastKind(message) },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 5000),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        className="toast-viewport"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            className={`toast toast-${toast.kind}`}
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
          >
            <span className="toast-icon">
              {toast.kind === "success" ? (
                <CheckCircle2 size={19} />
              ) : toast.kind === "error" ? (
                <AlertCircle size={19} />
              ) : (
                <span aria-hidden="true">✦</span>
              )}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              aria-label="إغلاق التنبيه"
              onClick={() => dismiss(toast.id)}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function ToastMessage({ message }: { message: string }) {
  const toast = useContext(ToastContext);
  if (!toast)
    throw new Error("ToastMessage must be rendered inside ToastProvider.");
  useEffect(() => {
    toast.notify(message);
  }, [message, toast.notify]);
  return null;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider.");
  return toast.notify;
}

export function SiteHeader() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("al-hulm-theme") === "dark",
  );
  const [cartCount, setCartCount] = useState(() =>
    readCart().reduce((total, item) => total + item.quantity, 0),
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("al-hulm-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(
    () =>
      subscribeToCart(() =>
        setCartCount(
          readCart().reduce((total, item) => total + item.quantity, 0),
        ),
      ),
    [],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <div className="announcement">
        تفاصيل صغيرة، أناقة تدوم <span>✦</span> شحن لجميع مناطق مصر
      </div>
      <header className="site-header">
        <button
          className="icon-button mobile-menu"
          aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <Link
          className="brand"
          to="/"
          aria-label="متجر الحلم الرئيسية"
          onClick={closeMenu}
        >
          <span className="Zain brand-mark">
            <img className="brand-icon rounded-full" src="/logo.webp" alt="" />
          </span>
          <span className="Zain brand-name">
            الحلم<small>عبايات بتفاصيل تليق بك</small>
          </span>
        </Link>
        <nav
          id="primary-navigation"
          className={menuOpen ? "main-nav open" : "main-nav"}
          aria-label="القائمة الرئيسية"
        >
          <div className="mobile-nav-heading">
            <div>
              <span>تصفحي الحلم</span>
              <small>اختاري وجهتكِ التالية</small>
            </div>
            <button
              type="button"
              aria-label="إغلاق القائمة"
              onClick={closeMenu}
            >
              <X size={18} />
            </button>
          </div>
          <Link to="/" onClick={closeMenu}>
            <span className="mobile-nav-icon">
              <Home size={18} />
            </span>
            <span className="mobile-nav-copy">
              <b>الرئيسية</b>
              <small>بداية حكايتكِ مع الحلم</small>
            </span>
            <ArrowLeft className="mobile-nav-arrow" size={16} />
          </Link>
          <Link to="/products" onClick={closeMenu}>
            <span className="mobile-nav-icon">
              <ShoppingBag size={18} />
            </span>
            <span className="mobile-nav-copy">
              <b>العبايات</b>
              <small>اكتشفي مجموعتنا</small>
            </span>
            <ArrowLeft className="mobile-nav-arrow" size={16} />
          </Link>
          <Link to="/categories" onClick={closeMenu}>
            <span className="mobile-nav-icon">
              <Layers2 size={18} />
            </span>
            <span className="mobile-nav-copy">
              <b>الأقسام</b>
              <small>تسوقي حسب اختياركِ</small>
            </span>
            <ArrowLeft className="mobile-nav-arrow" size={16} />
          </Link>
          <Link to="/about" onClick={closeMenu}>
            <span className="mobile-nav-icon">
              <BookOpen size={18} />
            </span>
            <span className="mobile-nav-copy">
              <b>قصتنا</b>
              <small>تعرفي على حكاية الحلم</small>
            </span>
            <ArrowLeft className="mobile-nav-arrow" size={16} />
          </Link>
          <Link to="/contact" onClick={closeMenu}>
            <span className="mobile-nav-icon">
              <MessageCircle size={18} />
            </span>
            <span className="mobile-nav-copy">
              <b>تواصلي معنا</b>
              <small>نحن هنا لمساعدتكِ</small>
            </span>
            <ArrowLeft className="mobile-nav-arrow" size={16} />
          </Link>
          <div className="mobile-nav-footer">
            <Heart size={14} /> تفاصيل صغيرة، أناقة تدوم
          </div>
        </nav>
        {menuOpen && (
          <button
            className="mobile-nav-backdrop"
            type="button"
            aria-label="إغلاق القائمة"
            onClick={closeMenu}
          />
        )}
        <div className="header-actions">
          <Link
            className="icon-button favorite-link"
            to="/favorites"
            aria-label="المفضلة"
          >
            <Heart />
          </Link>
          <Link
            className="icon-button account-link"
            to="/account"
            aria-label="حسابي"
          >
            <UserRound />
          </Link>
          <button
            className="icon-button"
            onClick={() => setDark(!dark)}
            aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          <Link
            className="icon-button bag-button"
            to="/cart"
            aria-label={`سلة التسوق، ${cartCount} منتجات`}
          >
            <ShoppingBag />
            {cartCount > 0 && (
              <span className="bag-count" aria-hidden="true">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>
      {!isSupabaseConfigured && (
        <div className="config-banner">
          اربط المشروع بـ Supabase لإظهار المنتجات وتفعيل الطلبات والحسابات.{" "}
          <a href="/README.md" target="_blank" rel="noreferrer">
            طريقة الإعداد
          </a>
        </div>
      )}
    </>
  );
}

export function SiteFooter() {
  const [contact, setContact] = useState<{
    phone: string;
    email: string;
    instagram: string;
  } | null>(null);
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("store_settings")
      .select("contact_phone,contact_email,instagram_url")
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error)
          console.error("تعذر تحميل بيانات التواصل في التذييل:", error.message);
        else
          setContact({
            phone: data.contact_phone,
            email: data.contact_email,
            instagram: data.instagram_url,
          });
      });
    supabase
      .from("store_settings")
      .select("facebook_url,tiktok_url")
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (error)
          console.error(
            "تعذر تحميل روابط فيسبوك وتيك توك. تحققي من تطبيق migration:",
            error.message,
          );
        else {
          setFacebookUrl(data.facebook_url);
          setTiktokUrl(data.tiktok_url);
        }
      });
  }, []);
  const whatsappNumber = contact?.phone
    .replace(/\D/g, "")
    .replace(/^00/, "")
    .replace(/^0/, "20");
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}`
    : "/contact";
  return (
    <>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand" to="/">
              <span className="brand-mark">
                <img
                  className="brand-icon rounded-full"
                  src="/logo.webp"
                  alt=""
                />
              </span>
              <span className="brand-name">
                الحلم<small>عبايات بتفاصيل تليق بك</small>
              </span>
            </Link>
            <p>أناقة خليجية، بتفاصيل مختارة من القلب.</p>
          </div>
          <div>
            <b>تصفحي</b>
            <Link to="/products">كل العبايات</Link>
            <Link to="/categories">الأقسام</Link>
            <Link to="/about">قصتنا</Link>
          </div>
          <div>
            <b>مساعدتك</b>
            <Link to="/contact">تواصلي معنا</Link>
            <Link to="/policies">الشحن والاستبدال</Link>
            <Link to="/account">حسابي</Link>
          </div>
          <div>
            <b>تابعينا</b>
            {(contact?.instagram || facebookUrl || tiktokUrl) && (
              <div className="social-links">
                {contact?.instagram && (
                  <a
                    href={contact.instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="إنستغرام"
                  >
                    <Instagram size={17} /> إنستغرام
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="فيسبوك"
                  >
                    <Facebook size={17} /> فيسبوك
                  </a>
                )}
                {tiktokUrl && (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="تيك توك"
                  >
                    <TikTokIcon size={17} /> تيك توك
                  </a>
                )}
              </div>
            )}
            {contact?.phone && <a href={`tel:${contact.phone}`}>هاتف المتجر</a>}
            {contact?.email && (
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            )}
            {!contact?.instagram &&
              !facebookUrl &&
              !tiktokUrl &&
              !contact?.phone &&
              !contact?.email && (
                <span className="muted-copy">بيانات التواصل قريبًا</span>
              )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© متجر الحلم — جميع الحقوق محفوظة</span>
          <span className="footer-credit">
            تطوير{" "}
            <a
              href="https://bakrhasan.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ابوبكر حسن
            </a>{" "}
            <Heart size={13} />
          </span>
        </div>
      </footer>
      <a
        className="whatsapp-float"
        href={whatsappHref}
        target={whatsappNumber ? "_blank" : undefined}
        rel={whatsappNumber ? "noopener noreferrer" : undefined}
        aria-label={
          whatsappNumber
            ? "تواصلي معنا عبر واتساب"
            : "تواصلي مع المتجر لإعداد واتساب"
        }
      >
        {" "}
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 .8A15.1 15.1 0 0 0 3 23.6L.9 31l7.6-2A15.2 15.2 0 1 0 16 .8Zm0 27.5a12.3 12.3 0 0 1-6.3-1.7l-.5-.3-4.5 1.2 1.2-4.4-.3-.5A12.4 12.4 0 1 1 16 28.3Zm6.8-9.3c-.4-.2-2.2-1.1-2.6-1.2-.4-.2-.6-.2-.9.2-.3.4-1 1.2-1.2 1.4-.2.3-.5.3-.9.1-.4-.2-1.6-.6-3-1.8-1.1-.9-1.8-2.1-2-2.5-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.7.1-.2 0-.5 0-.7-.1-.2-.9-2-1.2-2.7-.3-.7-.6-.6-.9-.6h-.8c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.8c.2.3 2.6 4 6.2 5.4 3.6 1.4 3.6.9 4.3.8.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.7.2-1.8-.1-.2-.4-.3-.8-.5Z" />
        </svg>
        <span className="whatsapp-float-label">واتساب</span>
      </a>
    </>
  );
}

export function EmptyState({
  title,
  message,
  action,
  actionText,
}: {
  title: string;
  message: string;
  action?: string;
  actionText?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark">ح</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && (
        <Link className="button button-dark" to={action}>
          {actionText || "متابعة"} <ArrowLeft size={16} />
        </Link>
      )}
    </div>
  );
}

export function InfoPage({ title, text }: { title: string; text: string }) {
  return (
    <main className="page-main narrow-page">
      <div className="page-title">
        <p className="eyebrow">متجر الحلم</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <Link className="text-link" to="/products">
        تصفحي العبايات <ArrowLeft size={16} />
      </Link>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-art" aria-hidden="true">
        <span className="not-found-orbit not-found-orbit-one" />
        <span className="not-found-orbit not-found-orbit-two" />
        <span className="not-found-number">404</span>
        <span className="not-found-mark">
          <img className="brand-icon rounded-full" src="/logo.webp" alt="" />
        </span>
      </div>
      <div className="not-found-copy">
        <p className="eyebrow">يبدو أننا تهنا قليلًا</p>
        <h1>
          هذه الصفحة
          <br />
          <em>ليست ضمن الحكاية.</em>
        </h1>
        <p>
          الرابط الذي تبحثين عنه غير موجود أو ربما تغيّر. لا بأس، مجموعتنا ما
          زالت هنا بانتظارك.
        </p>
        <div className="not-found-actions">
          <Link className="button button-dark" to="/">
            <Home size={17} /> العودة للرئيسية
          </Link>
          <Link className="text-link" to="/products">
            اكتشفي العبايات <Search size={16} />
          </Link>
        </div>
      </div>
    </main>
  );
}