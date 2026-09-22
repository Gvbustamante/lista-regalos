import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db, getMeta, setMeta } from '../../database/local/db'
import { supabase } from '../../database/supabase/client'
import type { Usage } from '../../types'
import { useAuth } from '../auth/AuthContext'
import { useSyncState } from '../sync/useSync'
import type { BlockReason } from './limits'

interface UsageValue {
  usage: Usage | null
  /** Entradas del mes contando las creadas sin internet aún no subidas */
  sessionsUsed: number
  sessionsLimit: number | null
  block: BlockReason | null
  deviceBlocked: string | null
  refresh: () => Promise<void>
  retryDevice: () => Promise<void>
}

const Ctx = createContext<UsageValue | null>(null)

export function deviceId(): string {
  const key = 'playtime-device-id'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

export function deviceName() {
  const ua = navigator.userAgent
  const kind = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'Tablet' : /Mobile|iPhone/i.test(ua) ? 'Celular' : 'Computador'
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|Mac/i.test(ua) ? 'Apple' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : ''
  return `${kind} ${os}`.trim()
}

export function UsageProvider({ children }: { children: ReactNode }) {
  const { business } = useAuth()
  const bid = business?.id
  const sync = useSyncState()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [deviceBlocked, setDeviceBlocked] = useState<string | null>(null)
  const wasSyncing = useRef(false)

  const refresh = useCallback(async () => {
    if (!bid) return
    const key = `usage:${bid}`
    if (navigator.onLine) {
      const { data, error } = await supabase.rpc('playtime_usage', { p_business_id: bid })
      if (!error && data) {
        await setMeta(key, data)
        setUsage(data as Usage)
        return
      }
    }
    setUsage((await getMeta<Usage>(key)) ?? null)
  }, [bid])

  const retryDevice = useCallback(async () => {
    if (!bid) return
    const okKey = `device-ok:${bid}`
    if (!navigator.onLine) {
      // Sin internet: se permite si este dispositivo ya fue autorizado antes
      setDeviceBlocked((await getMeta<boolean>(okKey)) === false ? 'Este dispositivo no está autorizado.' : null)
      return
    }
    const { error } = await supabase.rpc('playtime_register_device', { p_business_id: bid, p_device_id: deviceId(), p_name: deviceName() })
    if (error?.message.includes('PLAYTIME_DEVICE_LIMIT')) {
      await setMeta(okKey, false)
      setDeviceBlocked(error.message.replace(/^PLAYTIME_DEVICE_LIMIT:\s*/, ''))
    } else if (!error) {
      await setMeta(okKey, true)
      setDeviceBlocked(null)
    }
  }, [bid])

  useEffect(() => {
    setUsage(null)
    void refresh()
    void retryDevice()
  }, [refresh, retryDevice])

  // Al terminar cada sincronización se actualiza el uso
  useEffect(() => {
    if (wasSyncing.current && !sync.syncing) void refresh()
    wasSyncing.current = sync.syncing
  }, [sync.syncing, refresh])

  const monthStart = usage?.month_start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const pendingThisMonth =
    useLiveQuery(
      () =>
        bid
          ? db.sessions
              .where('_dirty')
              .equals(1)
              .filter((s) => s.business_id === bid && s.status !== 'cancelled' && s.started_at >= monthStart && Date.parse(s.created_at) >= Date.parse(usage?.server_time ?? '1970-01-01'))
              .count()
          : 0,
      [bid, monthStart, usage?.server_time],
    ) ?? 0

  const sessionsUsed = (usage?.used.sessions ?? 0) + pendingThisMonth
  const sessionsLimit = usage?.limits.sessions ?? null
  let block: BlockReason | null = null
  if (usage?.status === 'suspended') block = 'suspended'
  else if (usage?.expired) block = 'expired'
  else if (sessionsLimit !== null && sessionsUsed >= sessionsLimit) block = 'sessions'

  return <Ctx.Provider value={{ usage, sessionsUsed, sessionsLimit, block, deviceBlocked, refresh, retryDevice }}>{children}</Ctx.Provider>
}

export function useUsage() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUsage fuera de UsageProvider')
  return v
}
