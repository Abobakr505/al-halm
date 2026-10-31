export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  image_path?: string | null
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  fabric?: string | null
  price: number
  compare_at_price: number | null
  is_featured: boolean
  is_active: boolean
  category_id: string | null
  category?: Pick<Category, 'name' | 'slug' | 'description'> & {
    promotions?: import('./lib/promotions').Promotion[] | null
  } | null
  images?: { id?: string; image_url: string; storage_path?: string | null; alt_text: string | null; position: number }[]
  variants?: { id: string; size: string; color: string; stock: number }[]
}

export type OrderStatus =
  | 'received'
  | 'awaiting_deposit_review'
  | 'deposit_confirmed'
  | 'preparing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export const orderStatusLabels: Record<OrderStatus, string> = {
  received: 'تم استلام الطلب',
  awaiting_deposit_review: 'بانتظار مراجعة رسوم التوصيل',
  deposit_confirmed: 'تم تأكيد رسوم التوصيل',
  preparing: 'جاري تجهيز الطلب',
  shipped: 'تم شحن الطلب',
  out_for_delivery: 'الطلب في الطريق',
  delivered: 'تم تسليم الطلب',
  cancelled: 'تم إلغاء الطلب',
}
