import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { SiteFooter, SiteHeader, InfoPage } from './components/Common'

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

export default function App() {
  return <div className="app-shell">
    <SiteHeader />
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
      <Route path="*" element={<InfoPage title="الصفحة غير موجودة" text="يبدو أن هذه الصفحة غير متاحة. عودي إلى متجر الحلم واكتشفي مجموعتنا." />} />
    </Routes>
    </Suspense>
    <SiteFooter />
  </div>
}
