import { useState } from 'react'
import { ArrowLeft, Check, Ruler, ShieldCheck, Sparkles, Weight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ABAYA_SIZE_OPTIONS, getAbayaSizeByBmi } from '../lib/sizes'

type SizeRecommendation = {
  size: ReturnType<typeof getAbayaSizeByBmi>
  fitNote: string
}

function getRecommendation(height: number, weight: number): SizeRecommendation {
  const bmi = weight / ((height / 100) ** 2)

  return {
    size: getAbayaSizeByBmi(bmi),
    fitNote: 'هذه توصية أولية مبنية على الطول والوزن. اختاري رقم طول العباية الأنسب لكِ، وراجعي وصف المنتج لاختلاف القصّات.',
  }
}

export default function SizeGuidePage() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const heightValue = Number(height)
  const weightValue = Number(weight)
  const validHeight = heightValue >= 100 && heightValue <= 220
  const validWeight = weightValue >= 25 && weightValue <= 250
  const recommendation = validHeight && validWeight
    ? getRecommendation(heightValue, weightValue)
    : null

  return (
    <main className="page-main size-guide-page">
      <section className="size-guide-hero">
        <div className="size-guide-copy">
          <p className="eyebrow"><Sparkles size={14} /> دليلك لإطلالة تليق بكِ</p>
          <h1>اعرفي <em>مقاسك</em></h1>
          <p>أدخلي طولكِ ووزنكِ لتحصلي على اقتراح مبدئي. يتكوّن المقاس من رقمين لطول العباية وحرف للتصنيف.</p>
          <div className="size-guide-promise"><ShieldCheck size={17} /> قياساتكِ لا تُحفظ أو تُشارك</div>
        </div>
        <div className="size-guide-mark" aria-hidden="true">
          <span className="size-guide-mark-ring"><Ruler size={37} strokeWidth={1.2} /></span>
          <span>تفاصيلكِ<br />تصنع الفرق</span>
        </div>
      </section>

      <section className="size-guide-content">
        <div className="size-guide-form-panel">
          <div className="size-guide-panel-heading">
            <span className="size-guide-step">١</span>
            <div>
              <h2>أدخلي قياساتكِ</h2>
              <p>الطول بالسنتيمتر والوزن بالكيلوجرام؛ نستخدمهما لاقتراح مجموعة مقاس مناسبة.</p>
            </div>
          </div>
          <div className="size-guide-fields">
            <label>
              <span><Ruler size={16} /> الطول <small>سم</small></span>
              <input
                type="number"
                min="100"
                max="220"
                step="1"
                inputMode="decimal"
                placeholder="مثال: 165"
                value={height}
                onChange={(event) => {
                  setHeight(event.target.value)
                  setSubmitted(false)
                }}
                aria-label="الطول بالسنتيمتر"
              />
            </label>
            <label>
              <span><Weight size={16} /> الوزن <small>كجم</small></span>
              <input
                type="number"
                min="25"
                max="250"
                step="0.1"
                inputMode="decimal"
                placeholder="مثال: 60"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value)
                  setSubmitted(false)
                }}
                aria-label="الوزن بالكيلوجرام"
              />
            </label>
          </div>
          <button
            className="button button-dark size-guide-button"
            type="button"
            onClick={() => setSubmitted(true)}
            disabled={!height || !weight}
          >
            اعرضي مقاسي <ArrowLeft size={16} />
          </button>
          {submitted && !recommendation && (
            <p className="size-guide-error" role="alert">تأكدي من إدخال طول بين 100 و220 سم ووزن بين 25 و250 كجم.</p>
          )}
          <p className="size-guide-privacy">لن نطلب منكِ أي بيانات أخرى.</p>
        </div>

        <div className={`size-guide-result${recommendation && submitted ? ' is-ready' : ''}`} aria-live="polite">
          {recommendation && submitted ? (
            <>
              <div className="size-guide-result-top"><span><Check size={15} /> توصيتنا لكِ</span><Sparkles size={18} /></div>
              <p className="size-guide-result-label">مجموعتكِ المقترحة</p>
              <div
                className="size-guide-recommendation"
                aria-label={`المقاس ${recommendation.size.lengths[0]}, ${recommendation.size.lengths[1]} / ${recommendation.size.label}`}
              >
                <span>{recommendation.size.lengths[0]}, {recommendation.size.lengths[1]}</span>
                <span className="size-guide-recommendation-divider">/</span>
                <strong>{recommendation.size.label}</strong>
              </div>
              <p className="size-guide-length-hint">اختاري الطول الأنسب لكِ من الرقمين.</p>
              <p className="size-guide-fit">{recommendation.fitNote}</p>
              <Link className="size-guide-shop-link !mt-4" to="/products">
                <span>تصفحي العبايات</span><ArrowLeft size={16} />
              </Link>
            </>
          ) : (
            <>
              <span className="size-guide-result-icon"><Ruler size={23} /></span>
              <h2>مقاسكِ المناسب<br />على بُعد خطوة</h2>
              <p>أدخلي طولكِ ووزنكِ، وسنقترح مجموعة مقاس تساعدكِ على بدء الاختيار.</p>
            </>
          )}
        </div>
      </section>

      <section className="size-guide-notes">
        <div><span className="size-guide-note-number">١</span><p><b>الرقمان لطول العباية</b><br />مثل 64 و66؛ اختاري الطول الأقرب لكِ ولطريقة ارتدائك.</p></div>
        <div><span className="size-guide-note-number">٢</span><p><b>الحرف لتصنيف المقاس</b><br />يقدّره الدليل استرشاديًا من الطول والوزن، وقد تختلف الملاءمة حسب قصة كل تصميم.</p></div>
        <div className="size-guide-size-chart-heading">
          <b>دليل المقاسات</b>
          <small>النطاقات تقريبية وتعتمد على مؤشر كتلة الجسم</small>
        </div>
        <div className="size-guide-size-chart" aria-label="المقاسات المتاحة">
          {ABAYA_SIZE_OPTIONS.map((size) => (
            <span key={size.value}>
              <b>{size.value}</b>
            </span>
          ))}
        </div>
        <p className="size-guide-disclaimer">الاقتراح استرشادي وليس ضمانًا لملاءمة المقاس؛ تختلف قياسات القصّات من عباية لأخرى. راجعي تفاصيل المنتج أو تواصلي معنا إذا احتجتِ مساعدة.</p>
      </section>
    </main>
  )
}
