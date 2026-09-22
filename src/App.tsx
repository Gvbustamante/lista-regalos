import type React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Plans } from './pages/Plans'
import { PublicRemote } from './pages/PublicRemote'
import { PublicScreen } from './pages/PublicScreen'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { AdminGate } from './pages/admin/AdminGate'
import { UsageProvider, useUsage } from './features/plan/UsageContext'
import { contactLinks } from './features/plan/limits'

function Gate() {
  const { loading, user, membership, business, needsOnline, isPlatformAdmin } = useAuth()

  if (loading) return <Splash text="Cargando…" />
  if (!user) return <Login />
  if (needsOnline) return <Splash text="Conéctate a internet para el primer ingreso en este dispositivo." />
  if (!membership) return isPlatformAdmin ? <Navigate to="/admin" replace /> : <Onboarding />
  if (!business) return <Splash text="Descargando datos del negocio…" />
  if (business.status === 'suspended')
    return (
      <Splash text={`La cuenta de "${business.name}" está suspendida. Comunícate con PlayTime para reactivarla.`}>
        {isPlatformAdmin && <a href="/admin" className="mt-4 inline-block font-extrabold text-brand underline">Ir al panel admin</a>}
      </Splash>
    )

  return (
    <UsageProvider>
      <DeviceGate>
        <Routes>
          <Route path="/pantalla" element={<PublicScreen />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="historial" element={<History />} />
            <Route path="reportes" element={<Reports />} />
            <Route path="tarifas" element={<Plans />} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </DeviceGate>
    </UsageProvider>
  )
}

/** Bloquea el dispositivo si el plan ya tiene todos sus dispositivos ocupados */
function DeviceGate({ children }: { children: React.ReactNode }) {
  const { deviceBlocked, retryDevice, usage } = useUsage()
  const { signOut } = useAuth()
  if (!deviceBlocked) return <>{children}</>
  const links = contactLinks(usage, 'Necesito más dispositivos.')
  return (
    <Splash text={`Este dispositivo no está autorizado: ${deviceBlocked}.`}>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Libera un dispositivo en Ajustes → Dispositivos desde una tablet ya autorizada, mejora tu plan o compra un extra.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button onClick={retryDevice} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">Reintentar</button>
        {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white">WhatsApp</a>}
        <button onClick={() => signOut().catch(() => {})} className="rounded-xl border border-line bg-white px-4 py-2 font-semibold text-ink">Cerrar sesión</button>
      </div>
    </Splash>
  )
}

function Splash({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
      <div>
        <img src="/icon.svg" alt="" className="mx-auto size-20 animate-pulse" />
        <p className="mx-auto mt-4 max-w-md text-lg font-semibold text-ink">{text}</p>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pantalla pública remota: no requiere sesión */}
        <Route path="/p/:token" element={<PublicRemote />} />
        <Route
          path="/admin/*"
          element={
            <AuthProvider>
              <AdminGate />
            </AuthProvider>
          }
        />
        <Route
          path="*"
          element={
            <AuthProvider>
              <Gate />
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
