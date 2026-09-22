import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

// Carga diferida: el panel principal abre rápido; el resto se descarga al entrar
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })))
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))
const Plans = lazy(() => import('./pages/Plans').then((m) => ({ default: m.Plans })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const PublicScreen = lazy(() => import('./pages/PublicScreen').then((m) => ({ default: m.PublicScreen })))
const PublicRemote = lazy(() => import('./pages/PublicRemote').then((m) => ({ default: m.PublicRemote })))
const AdminGate = lazy(() => import('./pages/admin/AdminGate').then((m) => ({ default: m.AdminGate })))
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './features/auth/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { UsageProvider, useUsage } from './features/plan/UsageContext'
import { contactLinks } from './features/plan/limits'

function Gate() {
  const { loading, user, membership, business, needsOnline, isPlatformAdmin } = useAuth()

  if (loading) return <Splash text="Cargando…" />
  if (!user) return <Login />
  if (needsOnline) return <Splash text="Conéctate a internet para el primer ingreso en este dispositivo." />
  if (!membership) return isPlatformAdmin ? <Navigate to="/admin" replace /> : <Onboarding />
  if (!business) return <LoadingBusiness />
  if (business.status === 'suspended')
    return (
      <Splash text={`La cuenta de "${business.name}" está suspendida. Comunícate con Full Time para reactivarla.`}>
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
function DeviceGate({ children }: { children: ReactNode }) {
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

/** Espera la ficha del negocio; si tarda, ofrece reintentar o volver a otra sede */
function LoadingBusiness() {
  const { businesses, membership, switchBusiness, signOut } = useAuth()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [membership?.business_id])
  const other = businesses.find((b) => b.id !== membership?.business_id)
  return (
    <Splash text={slow ? 'Está tardando más de lo normal…' : 'Descargando datos del negocio…'}>
      {slow && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={() => location.reload()} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">Reintentar</button>
          {other && (
            <button onClick={() => switchBusiness(other.id).catch(() => {})} className="rounded-xl border border-line bg-white px-4 py-2 font-semibold text-ink">
              Ir a {other.name}
            </button>
          )}
          <button onClick={() => signOut().catch(() => {})} className="rounded-xl px-4 py-2 font-semibold text-slate-500">Cerrar sesión</button>
        </div>
      )}
    </Splash>
  )
}

function Splash({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
      <div>
        <img src="/logo.webp" alt="Full Time" className="mx-auto h-40 w-auto animate-pulse" />
        <p className="mx-auto mt-4 max-w-md text-lg font-semibold text-ink">{text}</p>
        {children}
      </div>
    </div>
  )
}

const PageLoader = () => <div className="grid min-h-[50vh] place-items-center text-sm text-slate-400">Cargando…</div>

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
    </ErrorBoundary>
  )
}
