import { useSyncExternalStore } from 'react'

export type Promotion = {
  id: string
  title: string
  description: string | null
  discount_percent: number
  image_url: string | null
  starts_at: string
  ends_at: string | null
  is_active: boolean
}

export type PromotionSchedule = Pick<Promotion, 'discount_percent' | 'starts_at' | 'ends_at' | 'is_active'>
type CategoryPromotionSource = {
  promotions?: PromotionSchedule[] | null
} | {
  promotions?: PromotionSchedule[] | null
}[] | null | undefined

let promotionClock = Date.now()
const promotionClockListeners = new Set<() => void>()
let promotionClockTimer: ReturnType<typeof setInterval> | undefined

function subscribeToPromotionClock(listener: () => void) {
  promotionClockListeners.add(listener)
  if (!promotionClockTimer) {
    promotionClockTimer = setInterval(() => {
      promotionClock = Date.now()
      promotionClockListeners.forEach((notify) => notify())
    }, 10_000)
  }
  return () => {
    promotionClockListeners.delete(listener)
    if (promotionClockListeners.size === 0 && promotionClockTimer) {
      clearInterval(promotionClockTimer)
      promotionClockTimer = undefined
    }
  }
}

export function usePromotionClock() {
  return useSyncExternalStore(
    subscribeToPromotionClock,
    () => promotionClock,
    () => promotionClock,
  )
}

export function isPromotionActive(
  promotion: PromotionSchedule,
  now = Date.now(),
) {
  return promotion.is_active
    && new Date(promotion.starts_at).getTime() <= now
    && (promotion.ends_at === null || new Date(promotion.ends_at).getTime() > now)
}

export function categoryPromotions(
  category: CategoryPromotionSource,
  now = Date.now(),
): PromotionSchedule[] {
  const categories = Array.isArray(category) ? category : category ? [category] : []
  return categories.flatMap((item) => item.promotions ?? []).filter((promotion) =>
    isPromotionActive(promotion, now),
  )
}

export function promotionPrice(
  price: number,
  promotions?: PromotionSchedule[] | null,
  now = Date.now(),
) {
  const discount = promotions?.filter((promotion) => isPromotionActive(promotion, now)).reduce(
    (best, promotion) => Math.max(best, Number(promotion.discount_percent) || 0),
    0,
  ) ?? 0
  return Math.round((price * (100 - Math.min(discount, 100)) / 100) * 100) / 100
}

export function promotionPercent(
  promotions?: PromotionSchedule[] | null,
  now = Date.now(),
) {
  return promotions?.filter((promotion) => isPromotionActive(promotion, now)).reduce(
    (best, promotion) => Math.max(best, Number(promotion.discount_percent) || 0),
    0,
  ) ?? 0
}
