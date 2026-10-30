import { useEffect, useState } from 'react'
import { Mail, Phone } from 'lucide-react'
import { EmptyState, InfoPage } from '../components/Common'
import { supabase } from '../lib/supabase'

type StoreSettings = { store_name: string; about_text: string; contact_phone: string; contact_email: string; instagram_url: string; return_policy: string; privacy_policy: string }

export default function StoreInformation({ page }: { page: 'about' | 'contact' | 'policies' }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    supabase.from('store_settings').select('store_name,about_text,contact_phone,contact_email,instagram_url,return_policy,privacy_policy').eq('id', true).single().then(({ data, error: resultError }) => {
      if (resultError) setError(`تعذر تحميل بيانات المتجر: ${resultError.message}`)
      else setSettings(data)
    })
  }, [])
  if (!supabase) {
    const text = page === 'about'
      ? 'في الحلم، نختار القماش والقصّة والتطريز بعناية؛ لتكون عبايتك رفيقة أيامك الجميلة.'
      : page === 'contact' ? 'تواصلي معنا بعد ربط Supabase وإضافة بيانات التواصل من إعدادات المتجر.'
        : 'تُضبط سياسات الخصوصية والاستبدال من إعدادات المتجر.'
    return <InfoPage title={page === 'about' ? 'حكاية الحلم' : page === 'contact' ? 'يسعدنا تواصلك' : 'سياسات المتجر'} text={text} />
  }
  if (error) return <main className="page-main"><EmptyState title="تعذر تحميل الصفحة" message={error} /></main>
  if (!settings) return <main className="page-main"><EmptyState title="جارٍ تحميل المحتوى" message="لحظات من فضلك." /></main>
  if (page === 'about') return <InfoPage title="حكاية الحلم" text={settings.about_text} />
  if (page === 'contact') return <main className="page-main narrow-page"><div className="page-title"><p className="eyebrow">{settings.store_name}</p><h1>يسعدنا تواصلك</h1><p>فريق الحلم هنا لمساعدتك في اختيار عبايتك ومتابعة طلبك.</p></div><div className="contact-details">{settings.contact_phone && <a href={`tel:${settings.contact_phone}`}><Phone size={18} />{settings.contact_phone}</a>}{settings.contact_email && <a href={`mailto:${settings.contact_email}`}><Mail size={18} />{settings.contact_email}</a>}{settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer">حساب الحلم على إنستغرام</a>}</div>{!settings.contact_phone && !settings.contact_email && !settings.instagram_url && <p className="muted-copy">لم تُضف بيانات التواصل بعد. حدّثيها من لوحة الإدارة.</p>}</main>
  return <main className="page-main narrow-page"><div className="page-title"><p className="eyebrow">{settings.store_name}</p><h1>سياسات المتجر</h1></div><section className="admin-card policy-section"><h2>الاستبدال والاسترجاع</h2><p>{settings.return_policy}</p></section><section className="admin-card policy-section"><h2>الخصوصية</h2><p>{settings.privacy_policy}</p></section></main>
}
