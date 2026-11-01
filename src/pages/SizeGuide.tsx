import { useState } from 'react'
import { ArrowLeft, Check, Ruler, ShieldCheck, Sparkles, Weight } from 'lucide-react'
import { Link } from 'react-router-dom'

type SizeRecommendation = {
  size: number
  fitNote: string
}

function getRecommendation(height: number, weight: number): SizeRecommendation {
  const size = height < 150 ? 50
    : height < 155 ? 52
      : height < 160 ? 54
        : height < 165 ? 56
          : height < 170 ? 58
            : 60
  const bmi = weight / ((height / 100) ** 2)

  return {
    size,
    fitNote: bmi >= 27
      ? 'لراحة أكبر، اختاري قصة واسعة أو راجعي قياسات الصدر والورك في وصف العباية.'
      : 'هذا المقاس مناسب كبداية للقصة العادية؛ راجعي قياسات القطعة إذا كنتِ تفضلين اتساعًا أكبر.',
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
          <p>خطوتان بسيطتان تساعدانكِ على اختيار طول العباية والعباية الأقرب لراحتك.</p>
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
              <p>استخدمي القياسات بالسنتيمتر والكيلوجرام.</p>
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
              <p className="size-guide-result-label">مقاس طول العباية المقترح</p>
              <div className="size-guide-size">{recommendation.size}<small>مقاس</small></div>
              <p className="size-guide-fit">{recommendation.fitNote}</p>
              <Link className="size-guide-shop-link" to="/products">تصفحي العبايات <ArrowLeft size={15} /></Link>
            </>
          ) : (
            <>
              <span className="size-guide-result-icon"><Ruler size={23} /></span>
              <h2>مقاسكِ المناسب<br />على بُعد خطوة</h2>
              <p>أدخلي الطول والوزن لتظهر لكِ توصية أولية تساعدكِ في الاختيار.</p>
            </>
          )}
        </div>
      </section>

      <section className="size-guide-notes">
        <div><span className="size-guide-note-number">١</span><p><b>الطول يحدد طول العباية</b><br />التوصية مبنية على مقاسات الطول الشائعة للعبايات.</p></div>
        <div><span className="size-guide-note-number">٢</span><p><b>الوزن يساعد في اختيار العباية</b><br />اختاري العباية التي تمنحكِ الراحة، فالموديلات تختلف في اتساعها.</p></div>
        <p className="size-guide-disclaimer">هذه التوصية استرشادية؛ تختلف المقاسات من تصميم لآخر. للحصول على أدق اختيار، راجعي قياسات العباية أو تواصلي معنا.</p>
      </section>
    </main>
  )
}
