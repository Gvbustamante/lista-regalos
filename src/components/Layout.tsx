import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { dateLong } from '../utils/format'
import { unlockAudio } from '../utils/sound'
import { AlertWatcher } from './AlertWatcher'
import { SyncBadge } from './SyncBadge'

const NAV = [
  { to: '/', icon: '🏠', label: 'Inicio' },
  { to: '/historial', icon: '🎟', label: 'Historial' },
  { to: '/reportes', icon: '📊', label: 'Reportes' },
  { to: '/tarifas', icon: '⏱', label: 'Tarifas' },
  { to: '/configuracion', icon: '⚙', label: 'Ajustes' },
]

const side = (active: boolean) =>
  `flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-semibold transition lg:flex-row lg:gap-3 lg:px-3 lg:text-sm ${
    active ? 'bg-brand-soft text-brand' : 'text-slate-500 hover:bg-canvas hover:text-ink'
  }`

export function Layout() {
  const { business, isPlatformAdmin, businesses, switchBusiness } = useAuth()
  const rootName = (id: string | null) => businesses.find((b) => b.id === id)?.name

  return (
    <div className="flex min-h-dvh bg-canvas" onPointerDown={unlockAudio}>
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col gap-1 border-r border-line bg-white px-2 py-4 md:flex lg:w-60 lg:px-3">
        <div className="mb-4 flex items-center justify-center gap-2.5 lg:px-2">
          <img src="/mark.png" alt="" className="size-10 object-contain lg:hidden" />
          <img src="/logo.webp" alt="Full Time" className="hidden h-24 w-auto object-contain lg:block" />
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => side(isActive)}>
            <span className="text-xl leading-none">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="mt-auto grid gap-1">
          {isPlatformAdmin && (
            <NavLink to="/admin" className={({ isActive }) => side(isActive)}>
              <span className="text-xl leading-none">🛡</span>
              Admin
            </NavLink>
          )}
          <a href="/pantalla" target="_blank" rel="noreferrer" className={side(false)}>
            <span className="text-xl leading-none">📺</span>
            Pantalla
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0">
            {businesses.length > 1 && business ? (
              <select
                aria-label="Cambiar de sede"
                value={business.id}
                onChange={(e) => void switchBusiness(e.target.value)}
                className="-ml-1 max-w-[60vw] truncate rounded-lg bg-transparent px-1 py-0.5 text-base font-bold text-ink outline-none hover:bg-canvas"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.parent_id ? `${rootName(b.parent_id) ?? 'Principal'} · ${b.name}` : b.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="truncate text-base font-bold text-ink">{business?.name ?? 'Full Time'}</div>
            )}
            <div className="text-xs text-slate-500 first-letter:uppercase">{dateLong()}</div>
          </div>
          <SyncBadge />
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-brand' : 'text-slate-400'}`}
          >
            <span className="text-xl">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <AlertWatcher />
    </div>
  )
}
