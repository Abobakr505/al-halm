import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'

/**
 * ScrollEffects
 * - ظهور تدريجي (Reveal) لكل العناصر الرئيسية تلقائيًا بدون تعديل بقية الملفات
 * - شريط تقدم التمرير + زر العودة للأعلى
 * - ظل للهيدر عند التمرير + Parallax لصورة الهيرو
 * - تأثير Ripple عند الضغط على الأزرار
 * - الصعود لأعلى الصفحة عند تغيير المسار
 */

type Dir = 'up' | 'zoom' | 'right' | 'left' | 'fade'

const RULES: [Dir, string][] = [
  ['up', '.section-heading, .page-title, .about-section-heading, .contact-section-heading, .products-toolbar-heading, .categories-page-heading, .product-toolbar, .contact-faq, .cart-summary, .order-summary, .about-cta > *, .about-quote > *, .newsletter > *, .story-copy > *, .about-hero-copy > *, .about-story-copy p, .detail-copy > *, .footer-main > div'],
  ['zoom', '.product-card, .category-card, .promotion-card, .about-values-grid article, .contact-card, .cart-item, .order-row, .favorite-row, .stat-card, .account-overview article, .orders-overview > div, .admin-card'],
  ['right', '.story-image, .about-hero-image, .product-gallery'],
  ['left', '.about-story-heading'],
  ['fade', '.faq-item, .trust-row > div, .timeline-item'],
]

export default function ScrollEffects() {
  const { pathname, hash } = useLocation()
  const [showTop, setShowTop] = useState(false)

  // الصعود لأعلى الصفحة عند تغيير المسار
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname, hash])

  // Reveal تلقائي
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          ;(entry.target as HTMLElement).setAttribute('data-in', '1')
          io.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )

    const tag = () => {
      RULES.forEach(([dir, selector]) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          if (el.dataset.rv) return
          if (el.closest('.admin-confirm-backdrop, .account-confirm-backdrop, .image-modal')) return
          el.dataset.rv = dir
          const parent = el.parentElement
          const siblings = parent ? [...parent.children].filter((c) => c.matches(selector)) : []
          const index = Math.max(0, siblings.indexOf(el))
          el.style.setProperty('--rv-delay', `${Math.min(index, 8) * 85}ms`)
          io.observe(el)
        })
      })
    }

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tag)
    }
    schedule()
    const mutation = new MutationObserver(schedule)
    mutation.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      mutation.disconnect()
      io.disconnect()
    }
  }, [])

  // التمرير: شريط التقدم، الهيدر، Parallax
  useEffect(() => {
    let ticking = false
    const update = () => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, y / max) : 0
      document.documentElement.style.setProperty('--scroll-progress', String(progress))
      document.documentElement.style.setProperty('--scroll-y', String(Math.min(y, 900)))
      document.querySelector('.site-header')?.classList.toggle('scrolled', y > 20)
      setShowTop(y > 650)
      ticking = false
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [pathname])

  // Ripple
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.button, .quick-add')
      if (!target || (target as HTMLButtonElement).disabled) return
      const rect = target.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.6
      const ripple = document.createElement('span')
      ripple.className = 'ripple'
      ripple.style.width = ripple.style.height = `${size}px`
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`
      target.appendChild(ripple)
      window.setTimeout(() => ripple.remove(), 700)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      <button
        type="button"
        className={`back-to-top${showTop ? ' show' : ''}`}
        aria-label="العودة للأعلى"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp size={18} />
      </button>
    </>
  )
}
