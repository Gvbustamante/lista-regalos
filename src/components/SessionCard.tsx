import type { Plan, Session } from '../types'
import { countdown, duration, time } from '../utils/format'
import { LEVEL_COLOR, LEVEL_LABEL, LEVEL_STYLES, timeLevel } from '../utils/timeStatus'
import { Ring } from './ui'

export function SessionCard({ session, now, plan, onClick }: { session: Session; now: number; plan?: Plan; onClick: () => void }) {
  const start = Date.parse(session.started_at)
  const end = Date.parse(session.expires_at)
  const remaining = end - now
  const level = timeLevel(remaining)
  const st = LEVEL_STYLES[level]
  const totalMin = Math.round((end - start) / 60000)
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)))

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-4 rounded-3xl border-2 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 active:scale-[0.98] ${st.card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-ink">{session.child_name}</div>
          <div className="text-sm text-slate-500">{plan && totalMin === session.duration_minutes ? `${plan.name} · ${duration(totalMin)}` : duration(totalMin)}</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${st.badge}`}>
          <span className={`size-1.5 rounded-full ${st.dot}`} />
          {LEVEL_LABEL[level]}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Ring progress={1 - elapsed} color={LEVEL_COLOR[level]} size={72} stroke={8}>
          <span className="text-2xl" aria-hidden>{level === 'red' ? '⏰' : '🧒'}</span>
        </Ring>
        {level === 'red' ? (
          <div>
            <div className="text-2xl font-extrabold text-red-600">Tiempo terminado</div>
            <div className="text-sm text-red-500">a las {time(session.expires_at)}</div>
          </div>
        ) : (
          <div className={`text-[clamp(2.25rem,4.5vw,3rem)] font-extrabold tabular-nums tracking-tight ${st.text}`}>{countdown(remaining)}</div>
        )}
      </div>

      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full" style={{ width: `${elapsed * 100}%`, background: LEVEL_COLOR[level] }} />
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium text-slate-500">
          <span>Entrada {time(session.started_at)}</span>
          <span>Salida {time(session.expires_at)}</span>
        </div>
      </div>
    </button>
  )
}
