import { useNow } from '../hooks/useNow'
import { countdown } from '../utils/format'
import { LEVEL_COLOR, LEVEL_STYLES, timeLevel } from '../utils/timeStatus'
import { Ring } from './ui'

export interface BoardItem {
  id: string
  child_name: string
  started_at?: string
  expires_at: string
}

/** Vista pública: solo nombre + tiempo restante (sin datos privados) */
export function PublicBoard({ title, items, offsetMs = 0, notice }: { title: string; items: BoardItem[]; offsetMs?: number; notice?: string }) {
  const now = useNow() + offsetMs
  const sorted = [...items].sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at))
  const clock = new Date(now).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  return (
    <div className="min-h-dvh bg-canvas p-6 lg:p-12" onDoubleClick={fullscreen}>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo.webp" alt="Full Time" className="h-20 w-auto lg:h-28" />
          <div>
          <div className="text-lg font-medium text-slate-500">{title}</div>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink lg:text-6xl">Niños en el parque</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold tabular-nums text-slate-500 lg:text-4xl">{clock}</span>
          <button onClick={fullscreen} className="grid size-12 place-items-center rounded-xl border border-line bg-white text-xl text-slate-500" aria-label="Pantalla completa">⛶</button>
        </div>
      </header>
      {notice && <p className="mb-6 rounded-2xl bg-amber-50 px-5 py-3 font-semibold text-amber-800">{notice}</p>}
      {sorted.length === 0 ? (
        <p className="mt-24 text-center text-3xl font-semibold text-slate-400">🛝 El parque está libre</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => {
            const rem = Date.parse(s.expires_at) - now
            const lvl = timeLevel(rem)
            const start = s.started_at ? Date.parse(s.started_at) : null
            const progress = start ? 1 - Math.min(1, Math.max(0, (now - start) / (Date.parse(s.expires_at) - start))) : rem > 0 ? 1 : 0
            return (
              <div key={s.id} className={`flex items-center gap-6 rounded-3xl border-2 bg-white p-6 shadow-card ${LEVEL_STYLES[lvl].card}`}>
                <Ring progress={progress} color={LEVEL_COLOR[lvl]} size={96} stroke={10}>
                  <span className="text-4xl" aria-hidden>{lvl === 'red' ? '⏰' : '🧒'}</span>
                </Ring>
                <div className="min-w-0">
                  <div className="truncate text-[clamp(1.5rem,2.4vw,2.25rem)] font-bold text-ink">{s.child_name}</div>
                  <div className={`text-[clamp(2.25rem,4vw,3.75rem)] font-extrabold leading-tight tabular-nums tracking-tight ${LEVEL_STYLES[lvl].text}`}>
                    {lvl === 'red' ? 'Terminó' : countdown(rem)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
