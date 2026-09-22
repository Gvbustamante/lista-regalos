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

export function Layout() {
  const { business } = useAuth()

  return (
    <div className="flex min-h-dvh bg-amber-50/60" onPointerDown={unlockAudio}>
      <aside className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center gap-2 border-r border-amber-100 bg-white py-4 md:flex lg:w-56 lg:items-stretch lg:px-3">
        <div className="mb-4 flex items-center justify-center gap-2 lg:justify-start lg:px-2">
          <img src="/icon.svg" alt="" className="size-10" />
          <span className="hidden text-xl font-black tracking-tight text-slate-800 lg:inline">PLAYTIME</span>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold lg:flex-row lg:gap-3 lg:px-3 lg:text-base ${isActive ? 'bg-amber-100 text-amber-900' : 'text-slate-500 hover:bg-slate-50'}`
            }
          >
            <span className="text-2xl">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <a
          href="/pantalla"
          target="_blank"
          rel="noreferrer"
          className="mt-auto flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 lg:flex-row lg:gap-3 lg:px-3 lg:text-base"
        >
          <span className="text-2xl">📺</span>
          Pantalla
        </a>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-amber-100 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-slate-800">{business?.name ?? 'PlayTime'}</div>
            <div className="text-sm font-semibold text-slate-500 first-letter:uppercase">{dateLong()}</div>
          </div>
          <SyncBadge />
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-amber-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center py-2 text-[11px] font-bold ${isActive ? 'text-amber-700' : 'text-slate-500'}`}
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
