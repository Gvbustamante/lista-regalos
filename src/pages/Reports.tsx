import { useMemo } from 'react'
import { RangeFilter } from '../components/RangeFilter'
import { Stat } from '../components/Stat'
import { useAuth } from '../features/auth/AuthContext'
import { summarize } from '../features/sessions/stats'
import { usePlans, useRangeData } from '../hooks/useData'
import { useRange } from '../hooks/useRange'
import { money, paymentLabel } from '../utils/format'
import type { PaymentMethod } from '../types'

function Bars({ title, rows, fmt }: { title: string; rows: { label: string; value: number }[]; fmt: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-800">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-slate-400">Sin datos</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-3 text-sm">
              <span className="truncate font-semibold text-slate-600">{r.label}</span>
              <span className="h-5 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(r.value / max) * 100}%` }} />
              </span>
              <span className="text-right font-bold tabular-nums text-slate-800">{fmt(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Reports() {
  const { business } = useAuth()
  const r = useRange('week')
  const sum = summarize(useRangeData(business?.id, r.bounds[0], r.bounds[1]))
  const plans = usePlans(business?.id)
  const cur = business?.currency

  const { byDay, byHour, byPlan, byMethod } = useMemo(() => {
    const day = new Map<string, number>()
    const hour = new Map<number, number>()
    const plan = new Map<string, number>()
    const method = new Map<PaymentMethod, number>()
    const names = new Map(plans.map((p) => [p.id, p.name]))
    for (const p of sum.payments) {
      const k = new Date(p.created_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
      day.set(k, (day.get(k) ?? 0) + Number(p.amount))
      method.set(p.method, (method.get(p.method) ?? 0) + Number(p.amount))
    }
    for (const s of sum.sessions) {
      const h = new Date(s.started_at).getHours()
      hour.set(h, (hour.get(h) ?? 0) + 1)
      const n = s.plan_id ? (names.get(s.plan_id) ?? 'Plan') : 'Personalizado'
      plan.set(n, (plan.get(n) ?? 0) + 1)
    }
    return {
      byDay: [...day].map(([label, value]) => ({ label, value })),
      byHour: [...hour].sort((a, b) => a[0] - b[0]).map(([h, value]) => ({ label: `${h}:00`, value })),
      byPlan: [...plan].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })),
      byMethod: [...method].sort((a, b) => b[1] - a[1]).map(([m, value]) => ({ label: paymentLabel(m), value })),
    }
  }, [sum.payments, sum.sessions, plans])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-3xl font-black text-slate-800">Reportes</h1>
      <RangeFilter value={r.key} onChange={r.setKey} from={r.from} to={r.to} onFrom={r.setFrom} onTo={r.setTo} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Ingresos" value={money(sum.income, cur)} tone="emerald" />
        <Stat label="Entradas" value={sum.entries} />
        <Stat label="Extensiones" value={sum.extensionsCount} tone="sky" />
        <Stat label="Horas vendidas" value={(sum.totalMinutes / 60).toFixed(1)} tone="amber" />
        <Stat label="Niños distintos" value={sum.uniqueChildren} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Ingresos por día" rows={byDay} fmt={(v) => money(v, cur)} />
        <Bars title="Horas de mayor demanda" rows={byHour} fmt={(v) => `${v} entradas`} />
        <Bars title="Planes más usados" rows={byPlan} fmt={(v) => `${v}`} />
        <Bars title="Ingresos por método de pago" rows={byMethod} fmt={(v) => money(v, cur)} />
      </div>
    </div>
  )
}
