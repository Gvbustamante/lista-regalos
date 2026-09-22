import type { User } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { clearLocalData, db, getMeta, setMeta } from '../../database/local/db'
import { supabase, T } from '../../database/supabase/client'
import type { Business, Membership, MyBusiness, Role } from '../../types'
import { countPending, startSync, stopSync, syncNow } from '../sync/engine'

interface AuthValue {
  loading: boolean
  user: User | null
  membership: Membership | null
  business: Business | null
  canManage: boolean
  /** Super-admin de la plataforma (panel /admin) */
  isPlatformAdmin: boolean
  /** true si no hay internet y tampoco hay datos guardados para entrar */
  needsOnline: boolean
  /** Negocios y sedes a los que pertenece la cuenta */
  businesses: MyBusiness[]
  switchBusiness: (id: string) => Promise<void>
  reloadBusinesses: () => Promise<void>
  createBusiness: (name: string, ownerName: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

/** Todas las sedes/negocios de la cuenta (cache para usar sin internet) */
async function loadMemberships(user: User): Promise<MyBusiness[] | 'offline'> {
  const cacheKey = `memberships:${user.id}`
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from(T.members)
      .select('business_id, role, created_at, business:playtime_businesses(name, parent_id)')
      .eq('user_id', user.id)
      .order('created_at')
    if (!error) {
      type Row = { business_id: string; role: Role; business: { name: string; parent_id: string | null } | null }
      const list: MyBusiness[] = ((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.business_id,
        role: r.role,
        name: r.business?.name ?? 'Negocio',
        parent_id: r.business?.parent_id ?? null,
      }))
      await setMeta(cacheKey, list)
      return list
    }
  }
  const cached = await getMeta<MyBusiness[]>(cacheKey)
  if (cached !== undefined) return cached
  return 'offline'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [needsOnline, setNeedsOnline] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [businesses, setBusinesses] = useState<MyBusiness[]>([])
  const businessesRef = useRef<MyBusiness[]>([])
  businessesRef.current = businesses

  const business =
    useLiveQuery(() => (membership ? db.businesses.get(membership.business_id) : undefined), [membership?.business_id]) ??
    null

  const resolve = useCallback(async (u: User | null) => {
    setUser(u)
    if (!u) {
      setMembership(null)
      setBusinesses([])
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }
    const adminKey = `platformAdmin:${u.id}`
    if (navigator.onLine) {
      const { data, error } = await supabase.rpc('playtime_is_platform_admin')
      if (!error) await setMeta(adminKey, data === true)
    }
    setIsPlatformAdmin((await getMeta<boolean>(adminKey)) === true)
    const list = await loadMemberships(u)
    if (list === 'offline') {
      setNeedsOnline(true)
      setMembership(null)
    } else {
      setNeedsOnline(false)
      setBusinesses(list)
      const saved = await getMeta<string>(`current:${u.id}`)
      const pick = list.find((b) => b.id === saved) ?? list.find((b) => !b.parent_id) ?? list[0]
      setMembership(pick ? { business_id: pick.id, user_id: u.id, role: pick.role } : null)
    }
    setLoading(false)
  }, [])

  // Solo re-resolver cuando cambia la persona (evita reinicios dobles por eventos repetidos de Supabase)
  const lastUserId = useRef<string | null | undefined>(undefined)
  const resolveOnce = useCallback(
    (u: User | null) => {
      const id = u?.id ?? null
      if (lastUserId.current === id) return
      lastUserId.current = id
      void resolve(u)
    },
    [resolve],
  )

  useEffect(() => {
    // getSession lee localStorage: funciona sin internet
    supabase.auth.getSession().then(({ data }) => resolveOnce(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        // no llamar a Supabase dentro del callback (recomendación de supabase-js): diferir
        setTimeout(() => resolveOnce(session?.user ?? null), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [resolveOnce])

  // Primer ingreso sin internet: reintentar al volver la conexión
  useEffect(() => {
    if (!needsOnline) return
    const retry = () => {
      lastUserId.current = undefined
      return supabase.auth.getSession().then(({ data }) => resolveOnce(data.session?.user ?? null))
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [needsOnline, resolveOnce])

  // Depende del id (texto), no del objeto: no reinicia la sincronización por renders
  const activeBusinessId = membership?.business_id ?? null
  useEffect(() => {
    if (!activeBusinessId) return
    startSync(activeBusinessId)
  }, [activeBusinessId])
  useEffect(() => () => stopSync(), [])

  const switchBusiness = async (id: string) => {
    if (!user) return
    let b = businessesRef.current.find((x) => x.id === id)
    if (!b) {
      // lista desactualizada (p. ej. sede recién creada): recargar
      const list = await loadMemberships(user)
      if (list !== 'offline') {
        setBusinesses(list)
        b = list.find((x) => x.id === id)
      }
    }
    if (!b || id === membership?.business_id) return
    // Trae la ficha de la sede antes de cambiar, para que la pantalla no quede esperando
    if (!(await db.businesses.get(id))) {
      if (!navigator.onLine) throw new Error('Necesitas internet para abrir esta sede por primera vez en este dispositivo.')
      const { data, error } = await supabase.from(T.businesses).select('*').eq('id', id).single()
      if (error || !data) throw new Error(error?.message ?? 'No se pudo abrir la sede')
      const row = data as Record<string, unknown>
      for (const k in row) if (k.endsWith('_at') && typeof row[k] === 'string') row[k] = new Date(row[k] as string).toISOString()
      await db.businesses.put({ ...(row as unknown as Business), _dirty: 0 })
    }
    await setMeta(`current:${user.id}`, id)
    setMembership({ business_id: id, user_id: user.id, role: b.role })
  }

  const reloadBusinesses = async () => {
    if (!user) return
    const list = await loadMemberships(user)
    if (list !== 'offline') setBusinesses(list)
  }

  const createBusiness = async (name: string, ownerName: string) => {
    if (!user) throw new Error('Sesión no iniciada')
    const { data, error } = await supabase.rpc('playtime_create_business', { p_name: name, p_owner_name: ownerName })
    if (error) throw new Error(error.message)
    const id = data as string
    const list: MyBusiness[] = [...businesses, { id, name, parent_id: null, role: 'owner' }]
    setBusinesses(list)
    await setMeta(`memberships:${user.id}`, list)
    await setMeta(`current:${user.id}`, id)
    setMembership({ business_id: id, user_id: user.id, role: 'owner' })
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
    <Ctx.Provider value={{ loading, user, membership, business, canManage, isPlatformAdmin, needsOnline, businesses, switchBusiness, reloadBusinesses, createBusiness, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fuera de AuthProvider')
  return v
}
