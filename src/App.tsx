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

function Gate() {
  const { loading, user, membership, business, needsOnline } = useAuth()

  if (loading) return <Splash text="Cargando…" />
  if (!user) return <Login />
  if (needsOnline) return <Splash text="Conéctate a internet para el primer ingreso en este dispositivo." />
  if (!membership) return <Onboarding />
  if (!business) return <Splash text="Descargando datos del negocio…" />

  return (
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
  )
}

function Splash({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-amber-50 p-6 text-center">
      <div>
        <img src="/icon.svg" alt="" className="mx-auto size-20 animate-pulse" />
        <p className="mt-4 text-lg font-bold text-slate-600">{text}</p>
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
