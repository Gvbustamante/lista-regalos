import { useNow } from '../hooks/useNow'
import { countdown } from '../utils/format'
import { LEVEL_STYLES, timeLevel } from '../utils/timeStatus'

export interface BoardItem {
  id: string
  child_name: string
  expires_at: string
}

/** Vista pública: solo nombre + tiempo restante (sin datos privados) */
export function PublicBoard({ title, items, offsetMs = 0, notice }: { title: string; items: BoardItem[]; offsetMs?: number; notice?: string }) {
  const now = useNow() + offsetMs
  const sorted = [...items].sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at))

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  return (
    <div className="min-h-dvh bg-slate-900 p-6 text-white lg:p-10" onDoubleClick={fullscreen}>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-bold uppercase tracking-widest text-amber-400">{title}</div>
          <h1 className="text-4xl font-black lg:text-6xl">NIÑOS EN EL PARQUE</h1>
        </div>
        <button onClick={fullscreen} className="rounded-2xl bg-white/10 px-4 py-3 font-bold" aria-label="Pantalla completa">⛶</button>
      </header>
      {notice && <p className="mb-4 rounded-2xl bg-amber-500/20 p-3 font-bold text-amber-300">{notice}</p>}
      {sorted.length === 0 ? (
        <p className="mt-20 text-center text-3xl font-bold text-slate-500">🛝 El parque está libre</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => {
            const rem = Date.parse(s.expires_at) - now
            const lvl = timeLevel(rem)
            return (
              <div key={s.id} className="flex items-center justify-between gap-4 rounded-3xl bg-white/5 p-5 ring-4 ring-white/10">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`size-5 shrink-0 rounded-full ${LEVEL_STYLES[lvl].dot}`} />
                  <span className="truncate text-3xl font-black uppercase lg:text-4xl">{s.child_name}</span>
                </div>
                <span className={`shrink-0 font-mono text-4xl font-black tabular-nums lg:text-5xl ${lvl === 'red' ? 'text-red-400' : lvl === 'orange' ? 'text-orange-400' : lvl === 'yellow' ? 'text-yellow-300' : 'text-emerald-400'}`}>
                  {lvl === 'red' ? 'FIN' : countdown(rem)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
