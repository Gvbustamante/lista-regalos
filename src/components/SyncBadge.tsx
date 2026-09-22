import { useSyncState } from '../features/sync/useSync'

const base = 'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold'

export function SyncBadge() {
  const s = useSyncState()

  if (!s.online)
    return (
      <div className={`${base} bg-ink text-white`} title="Los datos se guardan en este dispositivo">
        <span className="size-2 rounded-full bg-red-400" /> Sin conexión
        {s.pending > 0 && <span className="rounded-full bg-white/15 px-2">{s.pending} pendientes</span>}
      </div>
    )

  if (s.syncing)
    return (
      <div className={`${base} bg-brand-soft text-brand`}>
        <span className="hidden sm:inline">Sincronizando</span>
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white">
          <span className="block h-full bg-brand transition-all" style={{ width: `${s.progress}%` }} />
        </span>
        {s.progress}%
      </div>
    )

  if (s.error)
    return (
      <div className={`${base} bg-amber-50 text-amber-800`} title={s.error}>
        <span className="size-2 rounded-full bg-amber-500" /> Sin sincronizar{s.pending > 0 && ` (${s.pending})`}
      </div>
    )

  return (
    <div className={`${base} bg-emerald-50 text-emerald-700`} title={s.lastSyncAt ? `Última sincronización ${new Date(s.lastSyncAt).toLocaleTimeString()}` : ''}>
      <span className="size-2 rounded-full bg-emerald-500" />
      {s.pending > 0 ? `${s.pending} pendientes` : 'Sincronizado'}
    </div>
  )
}
