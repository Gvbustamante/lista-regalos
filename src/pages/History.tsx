import { useMemo, useState } from 'react'
import { RangeFilter } from '../components/RangeFilter'
import { SessionModal } from '../components/SessionModal'
import { Stat } from '../components/Stat'
import { useAuth } from '../features/auth/AuthContext'
import { summarize } from '../features/sessions/stats'
import { useRangeData } from '../hooks/useData'
import { useRange } from '../hooks/useRange'
import { dateShort, duration, money, paymentLabel, time } from '../utils/format'

const STATUS = {
  active: { label: 'En el parque', cls: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Finalizada', cls: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Anulada', cls: 'bg-red-100 text-red-600' },
}

export function History() {
  const { business } = useAuth()
  const r = useRange('today')
  const data = useRangeData(business?.id, r.bounds[0], r.bounds[1])
  const sum = summarize(data)
  const [openId, setOpenId] = useState<string | null>(null)
  const multiDay = r.key !== 'today' && r.key !== 'yesterday'

  const rows = useMemo(() => {
    const paid = new Map<string, number>()
    const exts = new Map<string, number>()
    data?.payments.forEach((p) => paid.set(p.session_id, (paid.get(p.session_id) ?? 0) + Number(p.amount)))
    data?.extensions.forEach((e) => exts.set(e.session_id, (exts.get(e.session_id) ?? 0) + 1))
    return [...(data?.sessions ?? [])]
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((s) => ({
        s,
        paid: paid.get(s.id) ?? 0,
        exts: exts.get(s.id) ?? 0,
        minutes: Math.round((Date.parse(s.expires_at) - Date.parse(s.started_at)) / 60000),
      }))
  }, [data])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-3xl font-black text-brand">Historial</h1>
      <RangeFilter value={r.key} onChange={r.setKey} from={r.from} to={r.to} onFrom={r.setFrom} onTo={r.setTo} />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Entradas" value={sum.entries} />
        <Stat label="Extensiones" value={sum.extensionsCount} tone="sky" />
        <Stat label="Ingresos" value={money(sum.income, business?.currency)} tone="emerald" />
      </div>

      <div className="overflow-hidden rounded-[28px] bg-mint">
        {rows.length === 0 ? (
          <p className="p-10 text-center font-semibold text-slate-400">Sin entradas en este periodo</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map(({ s, paid, exts, minutes }) => (
              <li key={s.id}>
                <button onClick={() => setOpenId(s.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-brand-soft sm:grid-cols-[6rem_1fr_7rem_7rem_8rem_7rem]">
                  <span className="font-mono font-bold text-slate-500">
                    {multiDay && <span className="block text-xs">{dateShort(s.started_at)}</span>}
                    {time(s.started_at)}
                  </span>
                  <span className="truncate font-bold text-slate-800">{s.child_name}</span>
                  <span className="hidden text-slate-600 sm:block">
                    {duration(minutes)}
                    {exts > 0 && <span className="ml-1 text-xs font-bold text-sky-600">+{exts}</span>}
                  </span>
                  <span className="hidden text-slate-500 sm:block">{paymentLabel(s.payment_method)}</span>
                  <span className={`hidden rounded-full px-2 py-1 text-center text-xs font-bold sm:block ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
                  <span className={`text-right font-black ${s.status === 'cancelled' ? 'text-slate-300 line-through' : 'text-slate-800'}`}>{money(paid, business?.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {openId && <SessionModal sessionId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
