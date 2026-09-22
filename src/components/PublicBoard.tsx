import { useNow } from '../hooks/useNow'
import { countdown } from '../utils/format'
import { LEVEL_COLOR, timeLevel } from '../utils/timeStatus'
import { FlipDigits, Ring } from './ui'

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
  const clock = new Date(now)

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  return (
    <div className="min-h-dvh bg-mint-soft p-6 lg:p-10" onDoubleClick={fullscreen}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-lg font-black text-brand/60">{title}</div>
          <h1 className="text-4xl font-black text-brand lg:text-6xl">Niños en el parque</h1>
        </div>
        <div className="flex items-center gap-3">
          <FlipDigits text={`${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`} />
          <button onClick={fullscreen} className="grid size-14 place-items-center rounded-full bg-white text-2xl text-brand" aria-label="Pantalla completa">⛶</button>
        </div>
      </header>
      {notice && <p className="mb-4 rounded-full bg-sun px-5 py-3 font-black text-brand">{notice}</p>}
      {sorted.length === 0 ? (
        <p className="mt-20 text-center text-3xl font-black text-brand/40">🛝 El parque está libre</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => {
            const rem = Date.parse(s.expires_at) - now
            const lvl = timeLevel(rem)
            const start = s.started_at ? Date.parse(s.started_at) : null
            const progress = start ? 1 - Math.min(1, Math.max(0, (now - start) / (Date.parse(s.expires_at) - start))) : rem > 0 ? 1 : 0
            return (
              <div key={s.id} className="flex items-center gap-5 rounded-[32px] bg-mint p-5">
                <Ring progress={progress} color={LEVEL_COLOR[lvl]} size={110} stroke={14}>
                  <span className="text-5xl" aria-hidden>{lvl === 'red' ? '⏰' : '🧒'}</span>
                </Ring>
                <div className="min-w-0">
                  <div className="truncate text-3xl font-black text-ink lg:text-4xl">{s.child_name}</div>
                  <div className={`text-5xl font-black tabular-nums lg:text-6xl ${lvl === 'red' ? 'text-red-500' : lvl === 'orange' ? 'text-orange-500' : 'text-brand'}`}>
                    {lvl === 'red' ? '¡Fin!' : countdown(rem)}
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
