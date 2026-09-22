import Dexie, { type Table } from 'dexie'
import type { Business, Child, Extension, Payment, Plan, Session } from '../../types'

export interface MetaRow {
  key: string
  value: unknown
}

class PlayTimeDB extends Dexie {
  businesses!: Table<Business, string>
  children!: Table<Child, string>
  plans!: Table<Plan, string>
  sessions!: Table<Session, string>
  extensions!: Table<Extension, string>
  payments!: Table<Payment, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('playtime')
    this.version(1).stores({
      businesses: 'id, _dirty',
      children: 'id, business_id, _dirty, name',
      plans: 'id, business_id, _dirty',
      sessions: 'id, business_id, _dirty, started_at, [business_id+status]',
      extensions: 'id, business_id, session_id, _dirty',
      payments: 'id, business_id, session_id, _dirty, created_at',
      meta: 'key',
    })
  }
}

export const db = new PlayTimeDB()

export type SyncTableName = 'businesses' | 'plans' | 'children' | 'sessions' | 'extensions' | 'payments'

export async function getMeta<V>(key: string): Promise<V | undefined> {
  return (await db.meta.get(key))?.value as V | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

export async function clearLocalData() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
