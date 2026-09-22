import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../database/local/db'
import { useAuth } from '../features/auth/AuthContext'
import { cancelSession, extendSession, finishSession } from '../features/sessions/repo'
import { usePlans } from '../hooks/useData'
import { useNow } from '../hooks/useNow'
import type { PaymentMethod } from '../types'
import { countdown, duration, money, paymentLabel, time } from '../utils/format'
import { LEVEL_COLOR, LEVEL_STYLES, timeLevel } from '../utils/timeStatus'
import { Btn, Ring } from './ui'
import { Modal } from './Modal'
import { PaymentPicker } from './PaymentPicker'

export function SessionModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { business } = useAuth()
  const now = useNow()
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const child = useLiveQuery(() => (session ? db.children.get(session.child_id) : undefined), [session?.child_id])
  const payments = useLiveQuery(() => db.payments.where('session_id').equals(sessionId).toArray(), [sessionId]) ?? []
  const plans = usePlans(business?.id).filter((p) => p.active)
  // Primero los planes marcados como "extensión", luego el resto
  const options = [...plans.filter((p) => p.is_extension), ...plans.filter((p) => !p.is_extension)]

  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')

  if (!session) return null
  const remaining = Date.parse(session.expires_at) - now
  const level = timeLevel(remaining)
  const active = session.status === 'active'
  const start = Date.parse(session.started_at)
  const elapsed = Math.min(1, Math.max(0, (now - start) / (Date.parse(session.expires_at) - start)))
  const paid = payments.reduce((a, p) => a + Number(p.amount), 0)

  const run = async (fn: () => Promise<void>, close = false) => {
    try {
      setError('')
      await fn()
      if (close) onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <Modal title={session.child_name} onClose={onClose} wide>
      {active && (
        <div className="mb-5 flex flex-col items-center gap-5 rounded-[28px] bg-mint p-5 sm:flex-row sm:justify-center sm:gap-10">
          <Ring progress={1 - elapsed} color={LEVEL_COLOR[level]} size={170} stroke={22}>
            <span className="text-7xl" aria-hidden>{level === 'red' ? '⏰' : '🧒'}</span>
          </Ring>
          <div className="text-center sm:text-left">
            {level === 'red' ? (
              <>
                <div className="text-3xl font-black text-red-500">¡Tiempo terminado!</div>
                <div className="font-bold text-red-400">Terminó a las {time(session.expires_at)}</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-brand/70">{session.child_name}</div>
                <div className={`text-7xl font-black tabular-nums leading-none ${LEVEL_STYLES[level].text}`}>{countdown(remaining)}</div>
                <div className="mt-1 font-bold text-slate-500">Termina a las {time(session.expires_at)}</div>
              </>
            )}
            <Btn variant="sun" className="mt-4 w-full py-4 text-xl" onClick={() => run(() => finishSession(session.id), true)}>
              ✓ ¡Listo, terminó!
            </Btn>
          </div>
        </div>
      )}

      <dl className="mb-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info k="Entrada" v={time(session.started_at)} />
        <Info k="Tiempo total" v={duration(Math.round((Date.parse(session.expires_at) - Date.parse(session.started_at)) / 60000))} />
        <Info k="Pagado" v={money(paid, business?.currency)} />
        <Info k="Pago" v={paymentLabel(session.payment_method)} />
        {child?.age != null && <Info k="Edad" v={`${child.age} años`} />}
        {child?.guardian_name && <Info k="Acompañante" v={child.guardian_name} />}
        {child?.guardian_phone && (
          <div className="rounded-2xl bg-mint-soft p-3">
            <dt className="text-xs font-bold uppercase text-brand/50">Teléfono</dt>
            <dd>
              <a className="font-bold text-brand underline" href={`tel:${child.guardian_phone}`}>{child.guardian_phone}</a>
            </dd>
          </div>
        )}
      </dl>

      {active && (
        <>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Extender tiempo</h3>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {options.map((p) => (
              <button
                key={p.id}
                onClick={() => run(() => extendSession(session.id, p.duration_minutes, Number(p.price), method))}
                className="rounded-[22px] border-2 border-brand-line bg-brand-soft px-3 py-3 text-center hover:border-brand"
              >
                <div className="text-xl font-black text-brand">+{duration(p.duration_minutes)}</div>
                <div className="text-sm font-semibold text-slate-500">{p.name} · {money(p.price, business?.currency)}</div>
              </button>
            ))}
          </div>
          <div className="mb-5">
            <PaymentPicker value={method} onChange={setMethod} />
          </div>

          {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">{error}</p>}

          {confirmCancel ? (
            <Btn variant="danger" className="w-full" onClick={() => run(() => cancelSession(session.id), true)}>
              ¿Seguro? Anular entrada
            </Btn>
          ) : (
            <Btn variant="outline" className="w-full" onClick={() => setConfirmCancel(true)}>
              Anular entrada
            </Btn>
          )}
        </>
      )}
    </Modal>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-mint-soft p-3">
      <dt className="text-xs font-bold uppercase text-brand/50">{k}</dt>
      <dd className="font-bold text-ink">{v}</dd>
    </div>
  )
}
