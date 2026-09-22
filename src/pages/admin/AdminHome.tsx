import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Stat } from '../../components/Stat'
import { Pill, Ring } from '../../components/ui'
import { adminApi } from '../../features/admin/api'
import { useAsync } from '../../features/admin/useAsync'
import type { AdminBusinessRow, SaasPlan } from '../../types'

type OrgRow = AdminBusinessRow & { sedes: number }
import { dateShort, money } from '../../utils/format'

export function StatusPill({ status }: { status: 'active' | 'suspended' }) {
  return status === 'active' ? (
    <Pill className="border-emerald-300 text-emerald-700">● Activo</Pill>
  ) : (
    <Pill className="border-red-300 text-red-600">● Suspendido</Pill>
  )
}

export function AdminHome() {
  const { data, error, loading, reload } = useAsync(() => Promise.all([adminApi.overview(), adminApi.saasPlans()]), [])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const [allRows, plans] = data ?? [[], []]
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
  // Agrupa sedes dentro de su negocio principal y suma sus números
  const rows = useMemo<OrgRow[]>(() => {
    const roots = allRows.filter((b) => !b.parent_id)
    return roots.map((r) => {
      const kids = allRows.filter((b) => b.parent_id === r.id)
      const sum = (k: 'active_now' | 'sessions_month' | 'revenue_month' | 'revenue_total' | 'devices' | 'children' | 'sessions_total') =>
        [r, ...kids].reduce((a, b) => a + Number(b[k]), 0)
      const last = [r, ...kids].map((b) => b.last_activity).filter(Boolean).sort().pop() ?? null
      return {
        ...r,
        sedes: kids.length,
        active_now: sum('active_now'),
        sessions_month: sum('sessions_month'),
        revenue_month: sum('revenue_month'),
        revenue_total: sum('revenue_total'),
        devices: sum('devices'),
        children: sum('children'),
        sessions_total: sum('sessions_total'),
        last_activity: last,
      }
    })
  }, [allRows])

  const filtered = rows.filter((b) => {
    const text = `${b.name} ${b.owner_email ?? ''} ${b.phone ?? ''}`.toLowerCase()
    if (q && !text.includes(q.toLowerCase())) return false
    if (filter === 'suspended') return b.status === 'suspended'
    if (filter !== 'all') return b.saas_plan === filter
    return true
  })

  const active = rows.filter((b) => b.status === 'active')
  const mrr = active.reduce((a, b) => a + Number(planById.get(b.saas_plan)?.price_monthly ?? 0), 0)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">Panel de plataforma</div>
          <h1 className="text-2xl font-extrabold text-ink">Negocios registrados</h1>
        </div>
        <button onClick={reload} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-canvas">↻ Actualizar</button>
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Negocios" value={rows.length} />
        <Stat label="Activos" value={active.length} tone="emerald" />
        <Stat label="Suspendidos" value={rows.length - active.length} tone="orange" />
        <Stat label="Niños ahora" value={rows.reduce((a, b) => a + b.active_now, 0)} tone="amber" />
        <Stat label="Sesiones del mes" value={rows.reduce((a, b) => a + b.sessions_month, 0)} />
        <Stat label="Ingreso mensual (planes)" value={money(mrr)} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {plans.map((p) => (
          <button key={p.id} onClick={() => setFilter(filter === p.id ? 'all' : p.id)} className={`rounded-2xl border p-4 text-left transition ${filter === p.id ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:text-ink'}`}>
            <div className="text-sm font-extrabold opacity-70">Plan {p.name}</div>
            <div className="text-3xl font-extrabold">{rows.filter((b) => b.saas_plan === p.id).length}</div>
            <div className="text-xs font-bold opacity-70">{money(p.price_monthly, p.currency)} / mes</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, correo o teléfono…"
          className="min-w-64 flex-1 rounded-xl border border-line bg-white px-5 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
        {[['all', 'Todos'], ['suspended', 'Suspendidos']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-3 text-sm font-semibold ${filter === k ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:text-ink'}`}>{l}</button>
        ))}
      </div>

      {loading && !data ? (
        <p className="p-10 text-center font-bold text-slate-400">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-3xl bg-white border border-line shadow-card p-10 text-center font-bold text-slate-400">No hay negocios con ese filtro</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => <BusinessCard key={b.id} b={b} plan={planById.get(b.saas_plan)} />)}
        </div>
      )}
    </div>
  )
}

function BusinessCard({ b, plan }: { b: OrgRow; plan?: SaasPlan }) {
  const limit = plan?.max_sessions_month ?? null
  const usage = limit ? b.sessions_month / limit : 0
  return (
    <Link to={`/admin/negocios/${b.id}`} className={`flex flex-col gap-4 rounded-3xl bg-white border border-line shadow-card p-5 transition hover:ring-4 hover:ring-brand-line ${b.status === 'suspended' ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">{b.name}</div>
          <div className="truncate text-sm font-medium text-slate-500">{b.owner_email ?? 'sin dueño'}</div>
        </div>
        <StatusPill status={b.status} />
      </div>
      <div className="flex items-center gap-4">
        <Ring progress={limit ? 1 - Math.min(1, usage) : 1} color={usage > 0.9 ? '#ef4444' : '#ffe11c'} size={84} stroke={11}>
          <span className="text-center text-xs font-extrabold leading-tight text-brand">
            {b.sessions_month}
            <br />
            <span className="text-[10px] text-slate-500">{limit ? `de ${limit}` : 'sesiones'}</span>
          </span>
        </Ring>
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium text-slate-500">Plan</dt>
          <dd className="font-extrabold text-brand">{plan?.name ?? b.saas_plan}</dd>
          <dt className="font-medium text-slate-500">En parque</dt>
          <dd className="font-extrabold">{b.active_now}</dd>
          <dt className="font-medium text-slate-500">Ventas mes</dt>
          <dd className="font-extrabold">{money(b.revenue_month, b.currency)}</dd>
          <dt className="font-medium text-slate-500">Sedes</dt>
          <dd className="font-extrabold">{b.sedes + 1}</dd>
          <dt className="font-medium text-slate-500">Dispositivos</dt>
          <dd className="font-extrabold">{b.devices}</dd>
        </dl>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Creado {dateShort(b.created_at)}</span>
        <span>{b.last_activity ? `Última actividad ${dateShort(b.last_activity)}` : 'Sin actividad'}</span>
      </div>
    </Link>
  )
}
