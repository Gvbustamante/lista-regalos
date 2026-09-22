import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { Login } from '../Login'
import { AdminBusiness } from './AdminBusiness'
import { AdminHome } from './AdminHome'
import { AdminLayout } from './AdminLayout'
import { AdminSaasPlans } from './AdminSaasPlans'

export function AdminGate() {
  const { loading, user, isPlatformAdmin } = useAuth()
  if (loading) return <div className="grid min-h-dvh place-items-center bg-canvas font-extrabold text-brand">Cargando…</div>
  if (!user) return <Login />
  if (!isPlatformAdmin)
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
        <div className="rounded-3xl bg-white border border-line shadow-card p-8">
          <div className="text-5xl">🔒</div>
          <p className="mt-3 text-xl font-extrabold text-brand">Esta cuenta no es administradora de la plataforma</p>
          <a href="/" className="mt-4 inline-block font-extrabold text-brand underline">Ir a la app</a>
        </div>
      </div>
    )
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="negocios/:id" element={<AdminBusiness />} />
        <Route path="planes" element={<AdminSaasPlans />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
