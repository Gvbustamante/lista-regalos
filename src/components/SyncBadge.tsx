import { useSyncState } from '../features/sync/useSync'

export function SyncBadge() {
  const s = useSyncState()

  if (!s.online)
    return (
      <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-sm font-bold text-white" title="Los datos se guardan en este dispositivo">
        <span className="size-2.5 rounded-full bg-red-400" /> OFFLINE
        {s.pending > 0 && <span className="rounded-full bg-white/20 px-2 text-xs">{s.pending} pendientes</span>}
      </div>
    )

  if (s.syncing)
    return (
      <div className="flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1.5 text-sm font-bold text-sky-700">
        <span className="hidden sm:inline">Sincronizando</span>
        <span className="h-2 w-16 overflow-hidden rounded-full bg-sky-200">
          <span className="block h-full bg-sky-500 transition-all" style={{ width: `${s.progress}%` }} />
        </span>
        {s.progress}%
      </div>
    )

  if (s.error)
    return (
      <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800" title={s.error}>
        <span className="size-2.5 rounded-full bg-amber-500" /> Sin sincronizar
        {s.pending > 0 && <span className="text-xs">({s.pending})</span>}
      </div>
    )

  return (
    <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700" title={s.lastSyncAt ? `Última sincronización ${new Date(s.lastSyncAt).toLocaleTimeString()}` : ''}>
      <span className="size-2.5 rounded-full bg-emerald-500" />
      {s.pending > 0 ? `${s.pending} pendientes` : s.lastSynced > 0 ? `✓ ${s.lastSynced} sincronizados` : 'En línea'}
    </div>
  )
}
