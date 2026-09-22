import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../database/local/db'
import { useAuth } from '../features/auth/AuthContext'
import { cancelSession, extendSession, finishSession } from '../features/sessions/repo'
import { usePlans } from '../hooks/useData'
import { useNow } from '../hooks/useNow'
import type { PaymentMethod } from '../types'
import { countdown, duration, money, paymentLabel, time } from '../utils/format'
import { LEVEL_STYLES, timeLevel } from '../utils/timeStatus'
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
        <div className={`mb-5 rounded-3xl border-4 p-4 text-center ${LEVEL_STYLES[level].card}`}>
          {level === 'red' ? (
            <>
              <div className="text-3xl font-black text-red-600">🔴 TIEMPO TERMINADO</div>
              <div className="font-semibold text-red-500">Su tiempo terminó a las {time(session.expires_at)}</div>
            </>
          ) : (
            <>
              <div className={`font-mono text-6xl font-black tabular-nums ${LEVEL_STYLES[level].text}`}>{countdown(remaining)}</div>
              <div className="font-semibold text-slate-600">Termina a las {time(session.expires_at)}</div>
            </>
          )}
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
          <div className="rounded-2xl bg-slate-50 p-3">
            <dt className="text-xs font-bold uppercase text-slate-400">Teléfono</dt>
            <dd>
              <a className="font-bold text-sky-600 underline" href={`tel:${child.guardian_phone}`}>{child.guardian_phone}</a>
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
                className="rounded-2xl border-4 border-sky-200 bg-sky-50 px-3 py-3 text-center hover:border-sky-400"
              >
                <div className="text-xl font-black text-sky-800">+{duration(p.duration_minutes)}</div>
                <div className="text-sm font-semibold text-slate-500">{p.name} · {money(p.price, business?.currency)}</div>
              </button>
            ))}
          </div>
          <div className="mb-5">
            <PaymentPicker value={method} onChange={setMethod} />
          </div>

          {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <button onClick={() => run(() => finishSession(session.id), true)} className="rounded-3xl bg-slate-800 py-4 text-xl font-black text-white hover:bg-slate-900">
              ✓ FINALIZAR SESIÓN
            </button>
            {confirmCancel ? (
              <button onClick={() => run(() => cancelSession(session.id), true)} className="rounded-3xl bg-red-600 py-4 font-black text-white">
                ¿Seguro? Anular
              </button>
            ) : (
              <button onClick={() => setConfirmCancel(true)} className="rounded-3xl border-2 border-red-200 py-4 font-bold text-red-600">
                Anular entrada
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase text-slate-400">{k}</dt>
      <dd className="font-bold text-slate-800">{v}</dd>
    </div>
  )
}
