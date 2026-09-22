import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database/local/db'
import type { Extension, Payment, Plan, Session } from '../types'

const EMPTY: never[] = []

export function useActiveSessions(businessId: string | undefined): Session[] {
  return (
    useLiveQuery(
      () => (businessId ? db.sessions.where('[business_id+status]').equals([businessId, 'active']).toArray() : EMPTY),
      [businessId],
    ) ?? EMPTY
  )
}

export function usePlans(businessId: string | undefined): Plan[] {
  return (
    useLiveQuery(
      async () =>
        businessId
          ? (await db.plans.where('business_id').equals(businessId).toArray()).sort(
              (a, b) => a.sort_order - b.sort_order || a.duration_minutes - b.duration_minutes,
            )
          : EMPTY,
      [businessId],
    ) ?? EMPTY
  )
}

export interface RangeData {
  sessions: Session[]
  extensions: Extension[]
  payments: Payment[]
}

/** Sesiones iniciadas en [from, to) + sus extensiones y pagos */
export function useRangeData(businessId: string | undefined, from: Date, to: Date): RangeData | undefined {
  return useLiveQuery(async () => {
    if (!businessId) return { sessions: [], extensions: [], payments: [] }
    const sessions = await db.sessions
      .where('started_at')
      .between(from.toISOString(), to.toISOString(), true, false)
      .filter((s) => s.business_id === businessId)
      .toArray()
    const ids = sessions.map((s) => s.id)
    const [extensions, payments] = await Promise.all([
      db.extensions.where('session_id').anyOf(ids).toArray(),
      db.payments.where('session_id').anyOf(ids).toArray(),
    ])
    return { sessions, extensions, payments }
  }, [businessId, from.getTime(), to.getTime()])
}
