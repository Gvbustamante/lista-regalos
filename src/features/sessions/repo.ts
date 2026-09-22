import { db } from '../../database/local/db'
import type { Child, Extension, Payment, PaymentMethod, Session } from '../../types'
import { nowIso, uuid } from '../../utils/id'
import { requestSync } from '../sync/engine'

export interface NewEntryInput {
  businessId: string
  userId: string | null
  existingChildId: string | null
  child: { name: string; age: number | null; guardian_name: string | null; guardian_phone: string | null }
  planId: string | null
  minutes: number
  price: number
  method: PaymentMethod
}

/** Registra niño + sesión + pago en una sola transacción local */
export async function createEntry(input: NewEntryInput): Promise<Session> {
  const ts = nowIso()
  const start = new Date()
  const session: Session = {
    id: uuid(),
    business_id: input.businessId,
    child_id: input.existingChildId ?? uuid(),
    plan_id: input.planId,
    child_name: input.child.name.trim(),
    duration_minutes: input.minutes,
    price: input.price,
    payment_method: input.method,
    started_at: start.toISOString(),
    expires_at: new Date(start.getTime() + input.minutes * 60000).toISOString(),
    status: 'active',
    finished_at: null,
    created_by: input.userId,
    created_at: ts,
    updated_at: ts,
    _dirty: 1,
  }
  const payment: Payment = {
    id: uuid(),
    business_id: input.businessId,
    session_id: session.id,
    extension_id: null,
    amount: input.price,
    method: input.method,
    created_at: ts,
    updated_at: ts,
    _dirty: 1,
  }

  await db.transaction('rw', db.children, db.sessions, db.payments, async () => {
    const existing = input.existingChildId ? await db.children.get(input.existingChildId) : undefined
    const child: Child = {
      id: session.child_id,
      business_id: input.businessId,
      name: input.child.name.trim(),
      age: input.child.age,
      guardian_name: input.child.guardian_name,
      guardian_phone: input.child.guardian_phone,
      created_at: existing?.created_at ?? ts,
      updated_at: ts,
      _dirty: 1,
    }
    await db.children.put(child)
    await db.sessions.add(session)
    await db.payments.add(payment)
  })
  requestSync()
  return session
}

/** Suma minutos. Si ya venció, el tiempo extra cuenta desde ahora. */
export async function extendSession(sessionId: string, minutes: number, price: number, method: PaymentMethod) {
  const ts = nowIso()
  await db.transaction('rw', db.sessions, db.extensions, db.payments, async () => {
    const s = await db.sessions.get(sessionId)
    if (!s || s.status !== 'active') throw new Error('La sesión ya no está activa')
    const base = Math.max(Date.parse(s.expires_at), Date.now())
    const ext: Extension = {
      id: uuid(),
      business_id: s.business_id,
      session_id: s.id,
      minutes,
      price,
      created_at: ts,
      updated_at: ts,
      _dirty: 1,
    }
    await db.extensions.add(ext)
    await db.payments.add({
      id: uuid(),
      business_id: s.business_id,
      session_id: s.id,
      extension_id: ext.id,
      amount: price,
      method,
      created_at: ts,
      updated_at: ts,
      _dirty: 1,
    })
    await db.sessions.update(s.id, {
      expires_at: new Date(base + minutes * 60000).toISOString(),
      updated_at: ts,
      _dirty: 1,
    })
  })
  requestSync()
}

async function close(sessionId: string, status: 'completed' | 'cancelled') {
  const ts = nowIso()
  await db.sessions.update(sessionId, { status, finished_at: ts, updated_at: ts, _dirty: 1 })
  requestSync()
}

export const finishSession = (id: string) => close(id, 'completed')
export const cancelSession = (id: string) => close(id, 'cancelled')
