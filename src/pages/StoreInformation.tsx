
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Facebook, Heart, Instagram, Mail, MessageCircle, Phone, Sparkles } from 'lucide-react'
import { EmptyState, InfoPage } from '../components/Common'
import { supabase } from '../lib/supabase'

type StoreSettings = {
  store_name: string | null
  about_text: string | null
  contact_phone: string | null
  contact_email: string | null
  instagram_url: string | null
  facebook_url: string | null
  return_policy: string | null
  privacy_policy: string | null
}

type StoreInformationProps = {
  page: 'about' | 'contact' | 'policies'
}

const DEFAULT_STORE_NAME = 'متجر الحلم'
const DEFAULT_ABOUT_TEXT =
  'في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة أيامك الجميلة.'

function ContactFaqs() {
  const [openQuestions, setOpenQuestions] = useState<number[]>([])
  const questions = [
    ['كيف أختار المقاس واللون المناسب؟', 'افتحي صفحة العباية واختاري اللون والمقاس من الخيارات المتاحة قبل إضافتها إلى السلة.'],
    ['كيف أستفيد من عروض الخصم؟', 'تُطبّق عروض القسم المفعّلة تلقائيًا على المنتجات المشمولة، ويظهر السعر بعد الخصم في صفحة المنتج والسلة.'],
    ['كيف أتابع حالة طلبي؟', 'سجّلي الدخول إلى حسابك ثم افتحي صفحة الطلبات لمراجعة حالة الطلب وتفاصيله.'],
    ['كيف أعرف تفاصيل الاستبدال والاسترجاع؟', 'راجعي صفحة سياسات المتجر، وإذا احتجتِ إلى توضيح إضافي تواصلي معنا عبر إحدى القنوات أعلاه.'],
    ['هل يمكنني الاستفسار عن منتج قبل الطلب؟', 'نعم، أرسلي لنا رابط المنتج أو اسمه عبر الهاتف أو واتساب أو البريد أو حساباتنا الاجتماعية.'],
  ]

  const toggleQuestion = (index: number) => {
    setOpenQuestions((current) =>
      current.includes(index)
        ? current.filter((question) => question !== index)
        : [...current, index],
    )
  }

  return (
    <section className="contact-faq">
      <div className="section-heading"><div><p className="eyebrow">نجيب عن استفساراتك</p><h2>الأسئلة الشائعة</h2></div></div>
      <div className="faq-list">
        {questions.map(([question, answer], index) => {
          const isOpen = openQuestions.includes(index)
          const answerId = `contact-faq-answer-${index}`
          return (
            <div className={`faq-item${isOpen ? ' open' : ''}`} key={question}>
              <button
                className="faq-question"
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => toggleQuestion(index)}
              >
                {question}
              </button>
              <div className="faq-answer" id={answerId} aria-hidden={!isOpen}>
                <div><p>{answer}</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

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
          'store_name,about_text,contact_phone,contact_email,instagram_url,facebook_url,return_policy,privacy_policy'
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
          facebook_url: '',
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

    if (page === 'contact') {
      return <main className="page-main contact-page"><section className="contact-hero"><div className="contact-hero-copy"><p className="eyebrow">{DEFAULT_STORE_NAME} · نحن هنا لأجلك</p><h1>يسعدنا <em>تواصلك</em></h1><p>فريق الحلم هنا لمساعدتك في اختيار عبايتك ومتابعة طلبك. اختاري الطريقة الأقرب إليك.</p></div><div className="contact-hero-mark" aria-hidden="true"><MessageCircle /><span>بكل حب</span></div></section><div className="contact-empty admin-card"><AlertCircle size={22} /><p className="muted-copy">تُضاف روابط التواصل من إعدادات المتجر بعد ربط قاعدة البيانات.</p></div><ContactFaqs /></main>
    }

    return (
      <InfoPage
        title="سياسات المتجر"
        text="تُضبط سياسات الخصوصية والاستبدال من إعدادات المتجر."
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

  if (error && page !== 'contact') {
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
    const whatsappNumber = settings?.contact_phone?.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '20')
    const hasContact =
      settings?.contact_phone ||
      settings?.contact_email ||
      settings?.instagram_url ||
      settings?.facebook_url

    return (
      <main className="page-main contact-page">
        <section className="contact-hero">
          <div className="contact-hero-copy">
            <p className="eyebrow">{storeName} · نحن هنا لأجلك</p>
            <h1>يسعدنا <em>تواصلك</em></h1>
            <p>فريق الحلم هنا لمساعدتك في اختيار عبايتك ومتابعة طلبك. اختاري الطريقة الأقرب إليك.</p>
          </div>
          <div className="contact-hero-mark" aria-hidden="true"><MessageCircle /><span>بكل حب</span></div>
        </section>

        {error && <div className="contact-empty admin-card"><AlertCircle size={22} /><p className="muted-copy">تعذر تحميل روابط التواصل: {error}</p></div>}
        {!error && hasContact ? (
          <section className="contact-methods">
            <div className="contact-section-heading"><p className="eyebrow">قنوات التواصل</p><h2>اختاري الطريقة الأقرب إليك</h2></div>
            <div className="contact-details">
            {settings?.contact_phone && (
              <a className="contact-card" href={`tel:${settings.contact_phone}`}>
                <span className="contact-card-icon"><Phone size={20} /></span>
                <span className="contact-card-copy"><b>اتصال هاتفي</b><small>{settings.contact_phone}</small></span>
                <ArrowLeft className="contact-card-arrow" size={17} />
              </a>
            )}

            {whatsappNumber && (
              <a className="contact-card" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                <span className="contact-card-icon"><MessageCircle size={20} /></span>
                <span className="contact-card-copy"><b>واتساب</b><small>راسلينا مباشرةً</small></span>
                <ArrowLeft className="contact-card-arrow" size={17} />
              </a>
            )}

            {settings?.contact_email && (
              <a className="contact-card" href={`mailto:${settings.contact_email}`}>
                <span className="contact-card-icon"><Mail size={20} /></span>
                <span className="contact-card-copy"><b>البريد الإلكتروني</b><small>{settings.contact_email}</small></span>
                <ArrowLeft className="contact-card-arrow" size={17} />
              </a>
            )}

            {settings?.instagram_url && (
              <a
                className="contact-card"
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="contact-card-icon"><Instagram size={20} /></span>
                <span className="contact-card-copy"><b>إنستغرام</b><small>تابعي حساب الحلم</small></span>
                <ArrowLeft className="contact-card-arrow" size={17} />
              </a>
            )}
            {settings?.facebook_url && (
              <a className="contact-card" href={settings.facebook_url} target="_blank" rel="noopener noreferrer">
                <span className="contact-card-icon"><Facebook size={20} /></span>
                <span className="contact-card-copy"><b>فيسبوك</b><small>زوري صفحة الحلم</small></span>
                <ArrowLeft className="contact-card-arrow" size={17} />
              </a>
            )}
            </div>
          </section>
        ) : !error ? (
          <div className="contact-empty admin-card">
            <AlertCircle size={22} />
            <p className="muted-copy">
              لم تُضف بيانات التواصل بعد. يمكنك تحديثها من لوحة الإدارة.
            </p>
          </div>
        ) : null}
        <ContactFaqs />
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
