import type { Plan, Session } from '../types'
import { countdown, duration, time } from '../utils/format'
import { LEVEL_STYLES, timeLevel } from '../utils/timeStatus'

export function SessionCard({ session, now, plan, onClick }: { session: Session; now: number; plan?: Plan; onClick: () => void }) {
  const remaining = Date.parse(session.expires_at) - now
  const level = timeLevel(remaining)
  const st = LEVEL_STYLES[level]
  const totalMin = Math.round((Date.parse(session.expires_at) - Date.parse(session.started_at)) / 60000)

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col rounded-3xl border-4 p-4 text-left shadow-sm transition active:scale-[0.98] ${st.card}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden>🧒</span>
        <span className="truncate text-xl font-black uppercase text-slate-800">{session.child_name}</span>
      </div>
      {level === 'red' ? (
        <div className="my-3 text-center">
          <div className="text-2xl font-black text-red-600">⏰ TIEMPO TERMINADO</div>
          <div className="text-sm font-semibold text-red-500">a las {time(session.expires_at)}</div>
        </div>
      ) : (
        <div className={`my-2 text-center font-mono text-5xl font-black tabular-nums lg:text-6xl ${st.text}`}>{countdown(remaining)}</div>
      )}
      <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>Entró {time(session.started_at)}</span>
        <span className="rounded-full bg-white/80 px-2 py-0.5">{plan && totalMin === session.duration_minutes ? `${plan.name} · ${duration(totalMin)}` : duration(totalMin)}</span>
      </div>
    </button>
  )
}
