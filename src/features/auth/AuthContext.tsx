import type { User } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearLocalData, db, getMeta, setMeta } from '../../database/local/db'
import { supabase, T } from '../../database/supabase/client'
import type { Business, Membership } from '../../types'
import { countPending, startSync, stopSync, syncNow } from '../sync/engine'

interface AuthValue {
  loading: boolean
  user: User | null
  membership: Membership | null
  business: Business | null
  canManage: boolean
  /** true si no hay internet y tampoco hay datos guardados para entrar */
  needsOnline: boolean
  createBusiness: (name: string, ownerName: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

async function loadMembership(user: User): Promise<Membership | null | 'offline'> {
  const cacheKey = `membership:${user.id}`
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from(T.members)
      .select('business_id, user_id, role')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!error) {
      await setMeta(cacheKey, data ?? null)
      return (data as Membership) ?? null
    }
  }
  const cached = await getMeta<Membership | null>(cacheKey)
  if (cached !== undefined) return cached
  return 'offline'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [needsOnline, setNeedsOnline] = useState(false)

  const business =
    useLiveQuery(() => (membership ? db.businesses.get(membership.business_id) : undefined), [membership?.business_id]) ??
    null

  const resolve = useCallback(async (u: User | null) => {
    setUser(u)
    if (!u) {
      setMembership(null)
      setLoading(false)
      return
    }
    const m = await loadMembership(u)
    if (m === 'offline') {
      setNeedsOnline(true)
      setMembership(null)
    } else {
      setNeedsOnline(false)
      setMembership(m)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // getSession lee localStorage: funciona sin internet
    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void resolve(session?.user ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [resolve])

  // Primer ingreso sin internet: reintentar al volver la conexión
  useEffect(() => {
    if (!needsOnline) return
    const retry = () => supabase.auth.getSession().then(({ data }) => resolve(data.session?.user ?? null))
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [needsOnline, resolve])

  useEffect(() => {
    if (!membership) return
    startSync(membership.business_id)
    return () => stopSync()
  }, [membership])

  const createBusiness = async (name: string, ownerName: string) => {
    if (!user) throw new Error('Sesión no iniciada')
    const { data, error } = await supabase.rpc('playtime_create_business', { p_name: name, p_owner_name: ownerName })
    if (error) throw new Error(error.message)
    const m: Membership = { business_id: data as string, user_id: user.id, role: 'owner' }
    await setMeta(`membership:${user.id}`, m)
    setMembership(m)
    await syncNow()
  }

  const signOut = async () => {
    const pending = await countPending()
    if (pending > 0 && !navigator.onLine) {
      throw new Error(`Hay ${pending} registros sin sincronizar. Conéctate a internet antes de cerrar sesión.`)
    }
    if (pending > 0) await syncNow()
    if ((await countPending()) > 0) throw new Error('No se pudieron sincronizar todos los registros. Intenta de nuevo.')
    stopSync()
    await supabase.auth.signOut()
    await clearLocalData()
  }

  const canManage = membership?.role === 'owner' || membership?.role === 'admin'

  return (
    <Ctx.Provider value={{ loading, user, membership, business, canManage, needsOnline, createBusiness, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}
