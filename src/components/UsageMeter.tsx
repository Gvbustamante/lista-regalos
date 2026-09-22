import { useUsage } from '../features/plan/UsageContext'
import { dateShort } from '../utils/format'

/** Barra de uso del plan (entradas del mes) con aviso al 80% */
export function UsageMeter({ onUpgrade }: { onUpgrade: () => void }) {
  const { usage, sessionsUsed, sessionsLimit, block } = useUsage()
  if (!usage) return null
  const ratio = sessionsLimit ? Math.min(1, sessionsUsed / sessionsLimit) : 0
  const warn = block || ratio >= 0.8
  const expSoon = usage.plan_expires_at && !usage.expired && Date.parse(usage.plan_expires_at) - Date.now() < 5 * 86400e3

  if (!sessionsLimit && !block && !expSoon) return null

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${block ? 'border-red-200 bg-red-50' : warn || expSoon ? 'border-amber-200 bg-amber-50' : 'border-line bg-white shadow-card'}`}>
      <div className="min-w-48 flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">
            Plan {usage.plan_name}
            {block === 'expired' && ' · vencido'}
            {expSoon && ` · vence el ${dateShort(usage.plan_expires_at!)}`}
          </span>
          {sessionsLimit !== null && (
            <span className="tabular-nums text-slate-600">
              {sessionsUsed} / {sessionsLimit} entradas este mes
            </span>
          )}
        </div>
        {sessionsLimit !== null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className={`h-full rounded-full ${block ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${ratio * 100}%` }} />
          </div>
        )}
      </div>
      {(warn || expSoon) && (
        <button onClick={onUpgrade} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90">
          {block ? 'Ver opciones' : 'Mejorar plan'}
        </button>
      )}
    </div>
  )
}
