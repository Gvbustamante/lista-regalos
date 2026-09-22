import type { Plan, Session } from '../types'
import { countdown, duration, time } from '../utils/format'
import { LEVEL_COLOR, LEVEL_STYLES, timeLevel } from '../utils/timeStatus'
import { FlipDigits, hhmm, Pill, Ring } from './ui'

export function SessionCard({ session, now, plan, onClick }: { session: Session; now: number; plan?: Plan; onClick: () => void }) {
  const start = Date.parse(session.started_at)
  const end = Date.parse(session.expires_at)
  const remaining = end - now
  const level = timeLevel(remaining)
  const totalMin = Math.round((end - start) / 60000)
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)))

  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-3 rounded-[28px] bg-mint p-4 text-left shadow-sm ring-4 transition active:scale-[0.98] ${LEVEL_STYLES[level].card}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xl font-black text-ink">{session.child_name}</span>
        <Pill>{plan && totalMin === session.duration_minutes ? plan.name : duration(totalMin)}</Pill>
      </div>

      <div className="flex items-center gap-4">
        <Ring progress={1 - elapsed} color={LEVEL_COLOR[level]} size={96} stroke={12}>
          <span className="text-4xl" aria-hidden>{level === 'red' ? '⏰' : '🧒'}</span>
        </Ring>
        <div className="min-w-0">
          {level === 'red' ? (
            <>
              <div className="text-2xl font-black leading-tight text-red-500">¡Tiempo terminado!</div>
              <div className="text-sm font-bold text-red-400">a las {time(session.expires_at)}</div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-brand/70">Tiempo restante</div>
              <div className={`font-black tabular-nums leading-none tracking-tight text-5xl ${LEVEL_STYLES[level].text}`}>{countdown(remaining)}</div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="shrink-0">
          <div className="mb-0.5 text-[10px] font-bold text-brand/60">Entrada</div>
          <FlipDigits text={hhmm(session.started_at)} size="xs" />
        </div>
        <div className="mb-1 h-3 flex-1 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-brand-line" style={{ width: `${elapsed * 100}%` }} />
        </div>
        <div className="shrink-0 text-right">
          <div className="mb-0.5 text-[10px] font-bold text-brand/60">Salida</div>
          <FlipDigits text={hhmm(session.expires_at)} size="xs" />
        </div>
      </div>
    </button>
  )
}
