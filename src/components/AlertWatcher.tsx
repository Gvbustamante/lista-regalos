import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { useActiveSessions } from '../hooks/useData'
import { useNow } from '../hooks/useNow'
import { playTimeUp, playWarning } from '../utils/sound'
import { SessionModal } from './SessionModal'

/** Suena y muestra aviso cuando una sesión está por vencer o termina */
export function AlertWatcher() {
  const { business } = useAuth()
  const sessions = useActiveSessions(business?.id)
  const now = useNow()
  const fired = useRef(new Set<string>())
  const [banner, setBanner] = useState<{ id: string; name: string } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!business) return
    const warnMs = business.alert_minutes * 60000
    let up: { id: string; name: string } | null = null
    let warn = false
    for (const s of sessions) {
      const rem = Date.parse(s.expires_at) - now
      // La clave incluye expires_at: al extender, las alertas se rearman
      const kEnd = `${s.id}:${s.expires_at}:end`
      const kWarn = `${s.id}:${s.expires_at}:warn`
      if (rem <= 0 && !fired.current.has(kEnd)) {
        fired.current.add(kEnd)
        fired.current.add(kWarn)
        // Solo alarmar si venció hace poco (no al abrir la app horas después)
        if (rem > -60000) up = { id: s.id, name: s.child_name }
      } else if (warnMs > 0 && rem > 0 && rem <= warnMs && !fired.current.has(kWarn)) {
        fired.current.add(kWarn)
        if (rem > warnMs - 60000) warn = true
      }
    }
    if (up) {
      setBanner(up)
      if (business.sound_enabled) playTimeUp()
    } else if (warn && business.sound_enabled) playWarning()
  }, [now, sessions, business])

  return (
    <>
      {banner && (
        <div role="alert" className="fixed inset-x-3 top-3 z-40 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-red-200 bg-white p-3 pl-4 shadow-xl">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-2xl">⏰</span>
          <button className="min-w-0 flex-1 text-left" onClick={() => (setOpen(banner.id), setBanner(null))}>
            <div className="truncate font-bold text-ink">{banner.name}</div>
            <div className="text-sm text-red-600">Tiempo terminado · toca para gestionar</div>
          </button>
          <button onClick={() => setBanner(null)} className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-canvas" aria-label="Cerrar aviso">✕</button>
        </div>
      )}
      {open && <SessionModal sessionId={open} onClose={() => setOpen(null)} />}
    </>
  )
}
