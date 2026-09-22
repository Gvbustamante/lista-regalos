import type Dexie from 'dexie'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, getMeta, setMeta, type SyncTableName } from '../../database/local/db'
import { supabase, T } from '../../database/supabase/client'
import { friendlyLimitError } from '../plan/limits'

/**
 * Motor de sincronización offline-first.
 * - Toda escritura va primero a IndexedDB con _dirty = 1.
 * - PUSH: sube filas sucias (upsert por UUID generado en el cliente).
 * - PULL: baja filas con synced_at (hora del servidor) mayor al último cursor.
 * - Conflictos: gana el updated_at más reciente.
 */

// Orden importante: padres antes que hijos (claves foráneas)
const TABLES: { local: SyncTableName; remote: string }[] = [
  { local: 'businesses', remote: T.businesses },
  { local: 'plans', remote: T.plans },
  { local: 'children', remote: T.children },
  { local: 'sessions', remote: T.sessions },
  { local: 'extensions', remote: T.extensions },
  { local: 'payments', remote: T.payments },
]

const PAGE = 1000
const OVERLAP_MS = 5000

export interface SyncState {
  online: boolean
  syncing: boolean
  progress: number // 0..100
  pending: number
  lastSyncAt: string | null
  lastSynced: number // registros subidos en la última sincronización
  error: string | null
}

let state: SyncState = {
  online: navigator.onLine,
  syncing: false,
  progress: 0,
  pending: 0,
  lastSyncAt: null,
  lastSynced: 0,
  error: null,
}
const listeners = new Set<() => void>()

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const syncStore = {
  get: () => state,
  subscribe: (cb: () => void) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
}

let businessId: string | null = null
let running: Promise<void> | null = null
let again = false
let debounce: ReturnType<typeof setTimeout> | null = null
let interval: ReturnType<typeof setInterval> | null = null
let channel: RealtimeChannel | null = null

export async function countPending() {
  const counts = await Promise.all(TABLES.map((t) => db[t.local].where('_dirty').equals(1).count()))
  const pending = counts.reduce((a, b) => a + b, 0)
  set({ pending })
  return pending
}

/** Normaliza fechas del servidor (+00:00) a ISO con Z para comparar/indexar igual que las locales */
function normalize(row: Record<string, unknown>) {
  for (const k in row) {
    const v = row[k]
    if (k.endsWith('_at') && typeof v === 'string') row[k] = new Date(v).toISOString()
  }
  return row
}

const strip = <R extends Record<string, unknown>>(row: R) => {
  const { _dirty, synced_at, ...rest } = row
  void _dirty
  void synced_at
  return rest
}

async function push(t: (typeof TABLES)[number]): Promise<number> {
  const table = db[t.local] as unknown as Dexie.Table<Record<string, unknown>, string>
  const rows = await table.where('_dirty').equals(1).toArray()
  let done = 0
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    if (t.local === 'businesses') {
      // El negocio solo se crea por RPC; aquí solo se actualiza (no hay política INSERT)
      for (const r of chunk) {
        const { id, ...patch } = strip(r)
        const { error } = await supabase.from(t.remote).update(patch).eq('id', id as string)
        if (error) throw new Error(`${t.local}: ${error.message}`)
      }
    } else {
      const { error } = await supabase.from(t.remote).upsert(chunk.map(strip), { onConflict: 'id' })
      if (error) throw new Error(`${t.local}: ${error.message}`)
    }
    // Solo marcar limpio si no se modificó mientras subía
    await db.transaction('rw', table, async () => {
      for (const r of chunk) {
        const cur = await table.get(r.id as string)
        if (cur && cur.updated_at === r.updated_at) await table.update(r.id as string, { _dirty: 0 })
      }
    })
    done += chunk.length
  }
  return done
}

async function pull(t: (typeof TABLES)[number], bid: string) {
  const table = db[t.local] as unknown as Dexie.Table<Record<string, unknown>, string>
  const cursorKey = `cursor:${bid}:${t.local}`
  const cursor = await getMeta<string>(cursorKey)
  let from = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z'
  let maxSeen = cursor ?? null

  for (;;) {
    const q = supabase.from(t.remote).select('*').gte('synced_at', from).order('synced_at').limit(PAGE)
    const { data, error } = await (t.local === 'businesses' ? q.eq('id', bid) : q.eq('business_id', bid))
    if (error) throw new Error(`${t.local}: ${error.message}`)
    const rows = ((data ?? []) as Record<string, unknown>[]).map(normalize)

    await db.transaction('rw', table, async () => {
      for (const r of rows) {
        const local = await table.get(r.id as string)
        const localNewer =
          local?._dirty === 1 && Date.parse(local.updated_at as string) > Date.parse(r.updated_at as string)
        if (!localNewer) await table.put({ ...r, _dirty: 0 })
      }
    })

    if (rows.length) {
      const last = rows[rows.length - 1].synced_at as string // ya normalizado
      if (!maxSeen || Date.parse(last) > Date.parse(maxSeen)) maxSeen = last
      if (rows.length < PAGE || last === from) break
      from = last
    } else break
  }
  if (maxSeen) await setMeta(cursorKey, maxSeen)
}

async function run() {
  const bid = businessId
  if (!bid) return
  if (!navigator.onLine) {
    set({ online: false })
    await countPending()
    return
  }
  set({ syncing: true, progress: 0, error: null })
  const steps = TABLES.length * 2
  let step = 0
  let pushed = 0
  try {
    for (const t of TABLES) {
      pushed += await push(t)
      set({ progress: Math.round((++step / steps) * 100) })
    }
    for (const t of TABLES) {
      await pull(t, bid)
      set({ progress: Math.round((++step / steps) * 100) })
    }
    set({ lastSyncAt: new Date().toISOString(), lastSynced: pushed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    set({ error: friendlyLimitError(msg) ?? (/fetch|network/i.test(msg) ? 'Sin conexión con el servidor' : msg) })
  } finally {
    set({ syncing: false })
    await countPending()
  }
}

/** Ejecuta una sincronización (si ya hay una en curso, programa otra al terminar) */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = run().finally(() => {
    running = null
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

/** Llamar después de cada escritura local */
export function requestSync() {
  void countPending()
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), 600)
}

const onOnline = () => {
  set({ online: true })
  void syncNow()
}
const onOffline = () => set({ online: false })

export function startSync(bid: string) {
  stopSync()
  businessId = bid
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  interval = setInterval(() => void syncNow(), 30000)

  // Tiempo real: cambios de otros dispositivos disparan un pull
  channel = supabase.channel(`playtime-${bid}`)
  for (const t of TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: t.remote, filter: t.local === 'businesses' ? `id=eq.${bid}` : `business_id=eq.${bid}` },
      () => requestSync(),
    )
  }
  channel.subscribe()
  void syncNow()
}

export function stopSync() {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  if (interval) clearInterval(interval)
  if (channel) void supabase.removeChannel(channel)
  interval = null
  channel = null
  businessId = null
}
