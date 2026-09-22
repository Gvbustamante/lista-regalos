import { useMemo, useState } from 'react'
import { NewEntryModal } from '../components/NewEntryModal'
import { SessionCard } from '../components/SessionCard'
import { SessionModal } from '../components/SessionModal'
import { Stat } from '../components/Stat'
import { Btn } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { summarize } from '../features/sessions/stats'
import { useActiveSessions, usePlans, useRangeData } from '../hooks/useData'
import { useNow } from '../hooks/useNow'
import { useRange } from '../hooks/useRange'
import { duration, money } from '../utils/format'

export function Dashboard() {
  const { business } = useAuth()
  const now = useNow()
  const active = useActiveSessions(business?.id)
  const plans = usePlans(business?.id)
  const { bounds } = useRange('today')
  const today = summarize(useRangeData(business?.id, bounds[0], bounds[1]))
  const [newOpen, setNewOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const sorted = useMemo(() => [...active].sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at)), [active])
  const soon = active.filter((s) => {
    const r = Date.parse(s.expires_at) - now
    return r > 0 && r < 10 * 60000
  }).length
  const expired = active.filter((s) => Date.parse(s.expires_at) <= now).length
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="En el parque" value={active.length} tone="amber" />
        <Stat label="Entradas hoy" value={today.entries} />
        <Stat label="Por vencer" value={soon + expired} tone="orange" />
        <Stat label="Tiempo promedio" value={today.avgMinutes ? duration(today.avgMinutes) : '—'} tone="sky" />
        <Stat label="Ingresos hoy" value={money(today.income, business?.currency)} tone="emerald" />
      </div>

      <Btn variant="sun" onClick={() => setNewOpen(true)} className="mb-6 w-full py-5 text-2xl">
        + Nueva entrada
      </Btn>

      {sorted.length === 0 ? (
        <div className="rounded-[28px] border-4 border-dashed border-mint-dark bg-mint-soft p-12 text-center">
          <div className="text-6xl">🛝</div>
          <p className="mt-3 text-xl font-bold text-slate-500">No hay niños en el parque</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => (
            <SessionCard key={s.id} session={s} now={now} plan={s.plan_id ? planById.get(s.plan_id) : undefined} onClick={() => setOpenId(s.id)} />
          ))}
        </div>
      )}

      {newOpen && <NewEntryModal onClose={() => setNewOpen(false)} />}
      {openId && <SessionModal sessionId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
