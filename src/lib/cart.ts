export type CartLine = { variantId: string; quantity: number }
export type CartAddResult = 'added' | 'unavailable' | 'stock-limit'

const storageKey = 'al-hulm-cart'
const cartEvent = 'al-hulm-cart-change'

export function readCart(): CartLine[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((line): line is CartLine =>
      typeof line?.variantId === 'string' &&
      Number.isInteger(line?.quantity) &&
      line.quantity > 0,
    )
  } catch {
    return []
  }
}

export function writeCart(lines: CartLine[]) {
  localStorage.setItem(storageKey, JSON.stringify(lines))
  window.dispatchEvent(new Event(cartEvent))
  window.dispatchEvent(new Event('al-hulm-cart-count-change'))
}

export function addCartVariant(variant: { id: string; stock: number }): CartAddResult {
  if (variant.stock < 1) return 'unavailable'

  const cart = readCart()
  const existingItem = cart.find((item) => item.variantId === variant.id)
  if ((existingItem?.quantity ?? 0) + 1 > variant.stock) return 'stock-limit'

  if (existingItem) existingItem.quantity += 1
  else cart.push({ variantId: variant.id, quantity: 1 })

  writeCart(cart)
  return 'added'
}

export function subscribeToCart(callback: () => void) {
  window.addEventListener(cartEvent, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(cartEvent, callback)
    window.removeEventListener('storage', callback)
  }
}
