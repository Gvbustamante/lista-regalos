import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY en .env')

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'playtime-auth' },
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
