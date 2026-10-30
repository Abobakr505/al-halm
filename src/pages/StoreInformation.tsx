
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Heart, Instagram, Mail, Phone, Sparkles } from 'lucide-react'
import { EmptyState, InfoPage } from '../components/Common'
import { supabase } from '../lib/supabase'

type StoreSettings = {
  store_name: string | null
  about_text: string | null
  contact_phone: string | null
  contact_email: string | null
  instagram_url: string | null
  return_policy: string | null
  privacy_policy: string | null
}

type StoreInformationProps = {
  page: 'about' | 'contact' | 'policies'
}

const DEFAULT_STORE_NAME = 'متجر الحلم'
const DEFAULT_ABOUT_TEXT =
  'في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة أيامك الجميلة.'

function AboutPage({ storeName, storyText }: { storeName: string; storyText?: string | null }) {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-hero-image">
          <img
            src="/about.jpg"
            alt="إطلالة أنيقة تعبّر عن أسلوب الحلم"
          />
          <span>أناقة تبدأ من إحساسك</span>
        </div>
        <div className="about-hero-copy">
          <p className="eyebrow">{storeName} · حكايتنا</p>
          <h1>لكل امرأة حكاية،<br /><em>ولكل حكاية إطلالة.</em></h1>
          <p>
            وُلد الحلم من فكرة بسيطة: أن تكون العباية أكثر من قطعة جميلة؛ أن تمنحك
            راحة وثقة، وأن تشبهك في تفاصيل يومك ومناسباتك.
          </p>
          <Link className="button button-dark" to="/products">
            اكتشفي تصاميمنا <ArrowLeft size={17} />
          </Link>
          <div className="about-hero-note"><span /> تفاصيل تُختار بعناية، لترافق لحظاتك</div>
        </div>
      </section>

      <section className="about-story" id="our-story">
        <div className="about-story-heading">
          <p className="eyebrow">حكاية بدأت بالشغف</p>
          <h2>من فكرة صغيرة،<br /><em>إلى تفاصيل تليق بك.</em></h2>
        </div>
        <div className="about-story-copy">
          <p>{storyText || DEFAULT_ABOUT_TEXT}</p>
          <p>
            نؤمن أن الأناقة الحقيقية لا تحتاج إلى مبالغة. لذلك نهتم بانسيابية القصّة،
            ونعومة التفاصيل، والتوازن بين الجمال والراحة؛ لتختاري ما يناسبك أنتِ،
            لا ما يفرضه عليكِ أحد.
          </p>
          <p>
            في كل مجموعة، نبحث عن لمسة تجعل القطعة قريبة منك: عباية ترافق صباحك،
            وأخرى تمنح مناسبتك حضورًا هادئًا. ويبقى اختيارك الشخصي هو أجمل ما يكملها.
          </p>
        </div>
      </section>

      <section className="about-values">
        <div className="about-section-heading">
          <p className="eyebrow">ما نؤمن به</p>
          <h2>جمالٌ في التفاصيل، وراحةٌ في كل يوم.</h2>
        </div>
        <div className="about-values-grid">
          <article>
            <span><Sparkles size={21} /></span>
            <h3>تفاصيل مدروسة</h3>
            <p>من اختيار القماش إلى اللمسات الأخيرة، نبحث عن تناغم يجعل التصميم أنيقًا وسهل الارتداء.</p>
          </article>
          <article>
            <span><Heart size={21} /></span>
            <h3>أسلوب يشبهك</h3>
            <p>نحتفي باختلاف ذوقك، ونقدم خيارات تمنحك مساحة لتعبّري عن أناقتك بطريقتك الخاصة.</p>
          </article>
          <article>
            <span><span className="about-value-mark">ح</span></span>
            <h3>عناية من القلب</h3>
            <p>نحرص أن تكون تجربتك واضحة ولطيفة، من لحظة اختيار القطعة وحتى وصولها إليك.</p>
          </article>
        </div>
      </section>

      <section className="about-quote">
        <p>«قطعتك الأجمل هي التي تشبهك، وتجعلك تشعرين بأنك أنتِ.»</p>
        <span>بكل حب، {storeName}</span>
      </section>

      <section className="about-cta">
        <p className="eyebrow">حكايتك معنا تبدأ الآن</p>
        <h2>اختاري ما يشبهك.</h2>
        <p>تصفحي مجموعتنا واكتشفي القطعة التي سترافق حكايتك القادمة.</p>
        <Link className="button button-dark" to="/products">
          تصفحي المجموعة <ArrowLeft size={17} />
        </Link>
      </section>
    </main>
  )
}

export default function StoreInformation({
  page,
}: StoreInformationProps) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadSettings = async () => {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error: resultError } = await supabase
        .from('store_settings')
        .select(
          'store_name,about_text,contact_phone,contact_email,instagram_url,return_policy,privacy_policy'
        )
        .eq('id', true)
        .maybeSingle()

      if (!mounted) return

      if (resultError) {
        setError(resultError.message)
      } else if (data) {
        setSettings(data as StoreSettings)
      } else {
        setSettings({
          store_name: DEFAULT_STORE_NAME,
          about_text: '',
          contact_phone: '',
          contact_email: '',
          instagram_url: '',
          return_policy: '',
          privacy_policy: '',
        })
      }

      setLoading(false)
    }

    void loadSettings()

    return () => {
      mounted = false
    }
  }, [])

  if (!supabase) {
    if (page === 'about') {
      return <AboutPage storeName={DEFAULT_STORE_NAME} storyText={DEFAULT_ABOUT_TEXT} />
    }

    const fallbackText =
      page === 'contact'
        ? 'تواصلي معنا للاستفسار عن المنتجات والطلبات.'
        : 'تُضبط سياسات الخصوصية والاستبدال من إعدادات المتجر.'

    return (
      <InfoPage
        title={
          page === 'contact'
            ? 'يسعدنا تواصلك'
            : 'سياسات المتجر'
        }
        text={fallbackText}
      />
    )
  }

  if (loading) {
    return (
      <main className="page-main">
        <EmptyState
          title="جارٍ تحميل المحتوى"
          message="لحظات من فضلك."
        />
      </main>
    )
  }

  if (error) {
    return (
      <main className="page-main">
        <EmptyState
          title="تعذر تحميل بيانات المتجر"
          message={error}
        />
      </main>
    )
  }

  const storeName = settings?.store_name || DEFAULT_STORE_NAME

  if (page === 'about') {
    return <AboutPage storeName={storeName} storyText={settings?.about_text} />
  }

  if (page === 'contact') {
    const hasContact =
      settings?.contact_phone ||
      settings?.contact_email ||
      settings?.instagram_url

    return (
      <main className="page-main narrow-page">
        <div className="page-title">
          <p className="eyebrow">{storeName}</p>
          <h1>يسعدنا تواصلك</h1>
          <p>
            فريق الحلم هنا لمساعدتك في اختيار عبايتك ومتابعة طلبك.
          </p>
        </div>

        {hasContact ? (
          <div className="contact-details">
            {settings?.contact_phone && (
              <a href={`tel:${settings.contact_phone}`}>
                <Phone size={18} />
                <span>{settings.contact_phone}</span>
              </a>
            )}

            {settings?.contact_email && (
              <a href={`mailto:${settings.contact_email}`}>
                <Mail size={18} />
                <span>{settings.contact_email}</span>
              </a>
            )}

            {settings?.instagram_url && (
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram size={18} />
                <span>حساب الحلم على إنستغرام</span>
              </a>
            )}
          </div>
        ) : (
          <div className="admin-card">
            <AlertCircle size={22} />
            <p className="muted-copy">
              لم تُضف بيانات التواصل بعد. يمكنك تحديثها من لوحة الإدارة.
            </p>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="page-main narrow-page">
      <div className="page-title">
        <p className="eyebrow">{storeName}</p>
        <h1>سياسات المتجر</h1>
      </div>

      <section className="admin-card policy-section">
        <h2>الاستبدال والاسترجاع</h2>
        <p>
          {settings?.return_policy || 'سيتم الإعلان عن سياسة الاستبدال والاسترجاع قريبًا.'}
        </p>
      </section>

      <section className="admin-card policy-section">
        <h2>الخصوصية</h2>
        <p>
          {settings?.privacy_policy || 'سيتم الإعلان عن سياسة الخصوصية قريبًا.'}
        </p>
      </section>
    </main>
  )
}
