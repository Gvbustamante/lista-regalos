import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY en .env')

const REQUEST_TIMEOUT_MS = 20000

/** fetch con límite de tiempo: una petición colgada nunca bloquea la sincronización */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError')), REQUEST_TIMEOUT_MS)
  // respeta un signal externo si lo hay
  init?.signal?.addEventListener('abort', () => controller.abort(init.signal?.reason), { once: true })
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'playtime-auth' },
  global: { fetch: fetchWithTimeout },
})

/** Nombres de tablas en Supabase (prefijo playtime_ para no mezclar con otros proyectos) */
export const T = {
  businesses: 'playtime_businesses',
  members: 'playtime_members',
  children: 'playtime_children',
  plans: 'playtime_plans',
  sessions: 'playtime_sessions',
  extensions: 'playtime_extensions',
  payments: 'playtime_payments',
} as const
