export type Promotion = {
  id: string
  title: string
  description: string | null
  discount_percent: number
  image_url: string | null
}

type CategoryPromotionSource = {
  promotions?: Pick<Promotion, 'discount_percent'>[] | null
} | {
  promotions?: Pick<Promotion, 'discount_percent'>[] | null
}[] | null | undefined

export function categoryPromotions(
  category: CategoryPromotionSource,
): Pick<Promotion, 'discount_percent'>[] {
  const categories = Array.isArray(category) ? category : category ? [category] : []
  return categories.flatMap((item) => item.promotions ?? [])
}

export function promotionPrice(
  price: number,
  promotions?: Pick<Promotion, 'discount_percent'>[] | null,
) {
  const discount = promotions?.reduce(
    (best, promotion) => Math.max(best, Number(promotion.discount_percent) || 0),
    0,
  ) ?? 0
  return Math.round((price * (100 - Math.min(discount, 100)) / 100) * 100) / 100
}

export function promotionPercent(
  promotions?: Pick<Promotion, 'discount_percent'>[] | null,
) {
  return promotions?.reduce(
    (best, promotion) => Math.max(best, Number(promotion.discount_percent) || 0),
    0,
  ) ?? 0
}
