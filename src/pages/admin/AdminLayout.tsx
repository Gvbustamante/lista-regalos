import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../../database/supabase/client'
import { useAuth } from '../../features/auth/AuthContext'

const pill = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 font-black transition ${isActive ? 'bg-brand text-white' : 'bg-white/70 text-brand hover:bg-white'}`

export function AdminLayout() {
  const { user, membership } = useAuth()
  return (
    <div className="min-h-dvh bg-mint-soft">
      <header className="sticky top-0 z-30 border-b border-mint-dark bg-mint/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="size-10" />
            <div>
              <div className="text-xl font-black text-brand">PlayTime Admin</div>
              <div className="text-xs font-bold text-brand/60">{user?.email}</div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/admin" end className={pill}>Negocios</NavLink>
            <NavLink to="/admin/planes" className={pill}>Planes SaaS</NavLink>
            {membership && <NavLink to="/" className={pill({ isActive: false })}>← Mi parque</NavLink>}
            <button onClick={() => supabase.auth.signOut()} className="rounded-full bg-white/70 px-4 py-2 font-black text-red-500 hover:bg-white">Salir</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
