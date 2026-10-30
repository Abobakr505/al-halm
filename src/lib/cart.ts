export type CartLine = { variantId: string; quantity: number }

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

export function subscribeToCart(callback: () => void) {
  window.addEventListener(cartEvent, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(cartEvent, callback)
    window.removeEventListener('storage', callback)
  }
}
