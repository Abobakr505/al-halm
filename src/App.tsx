import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { SiteFooter, SiteHeader, NotFoundPage } from './components/Common'
import { setPageMetadata } from './lib/seo'

const HomePage = lazy(() => import('./components/Storefront').then((module) => ({ default: module.HomePage })))
const ProductsPage = lazy(() => import('./components/Storefront').then((module) => ({ default: module.ProductsPage })))
const ProductDetailsPage = lazy(() => import('./components/Storefront').then((module) => ({ default: module.ProductDetailsPage })))
const CategoriesPage = lazy(() => import('./components/Storefront').then((module) => ({ default: module.CategoriesPage })))
const CartPage = lazy(() => import('./pages/CartCheckout').then((module) => ({ default: module.CartPage })))
const CheckoutPage = lazy(() => import('./pages/CartCheckout').then((module) => ({ default: module.CheckoutPage })))
const AuthPage = lazy(() => import('./pages/Account').then((module) => ({ default: module.AuthPage })))
const ResetPasswordPage = lazy(() => import('./pages/Account').then((module) => ({ default: module.ResetPasswordPage })))
const AccountPage = lazy(() => import('./pages/Account').then((module) => ({ default: module.AccountPage })))
const OrdersPage = lazy(() => import('./pages/Account').then((module) => ({ default: module.OrdersPage })))
const OrderDetailsPage = lazy(() => import('./pages/Account').then((module) => ({ default: module.OrderDetailsPage })))
const FavoritesPage = lazy(() => import('./pages/Account').then((module) => ({ default: module.FavoritesPage })))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const StoreInformation = lazy(() => import('./pages/StoreInformation'))

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const pages: Record<string, { title: string; description: string }> = {
      '/': { title: 'متجر الحلم | عبايات خليجية بتفاصيل تليق بك', description: 'تسوقي عبايات خليجية أنيقة بخامات مختارة وتفاصيل متقنة. اكتشفي أحدث تصاميم متجر الحلم واطلبي عبايتك أونلاين.' },
      '/products': { title: 'تسوقي العبايات | متجر الحلم', description: 'اكتشفي مجموعة عبايات الحلم، واختاري التصميم والخامة واللون والمقاس المناسب لك.' },
      '/search': { title: 'البحث عن عباية | متجر الحلم', description: 'ابحثي وتصفحي العبايات المتاحة من متجر الحلم.' },
      '/categories': { title: 'أقسام العبايات | متجر الحلم', description: 'تصفحي أقسام عبايات متجر الحلم واختاري التصميم الذي يناسب ذوقك.' },
      '/about': { title: 'قصتنا | متجر الحلم', description: 'تعرفي على حكاية متجر الحلم وشغفنا بتصميم عبايات تجمع الأناقة والراحة.' },
      '/contact': { title: 'تواصلي معنا | متجر الحلم', description: 'تواصلي مع متجر الحلم للاستفسار عن العبايات والطلبات والتوصيل.' },
      '/policies': { title: 'سياسات المتجر | متجر الحلم', description: 'اطلعي على سياسات الخصوصية والاستبدال والاسترجاع لدى متجر الحلم.' },
    }
    const page = pages[pathname]
    const privatePage = /^\/(admin|account|orders|favorites|cart|checkout|login|reset-password)/.test(pathname)
    setPageMetadata({
      title: page?.title || (pathname.startsWith('/products/') ? 'تفاصيل العباية | متجر الحلم' : 'متجر الحلم | عبايات بتفاصيل تليق بك'),
      description: page?.description || 'تصفحي عبايات متجر الحلم واكتشفي تصاميم أنيقة بتفاصيل مختارة بعناية.',
      url: `${window.location.origin}${pathname}`,
      noIndex: privatePage || !page && !pathname.startsWith('/products/'),
    })
  }, [pathname])

  return null
}

export default function App() {
  return <div className="app-shell">
    <SiteHeader />
    <RouteMetadata />
    <Suspense fallback={<main className="page-main"><div className="loading-message">جارٍ تحميل الصفحة…</div></main>}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/search" element={<ProductsPage />} />
      <Route path="/products/:slug" element={<ProductDetailsPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<OrderDetailsPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/about" element={<StoreInformation page="about" />} />
      <Route path="/contact" element={<StoreInformation page="contact" />} />
      <Route path="/policies" element={<StoreInformation page="policies" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    <SiteFooter />
  </div>
}
