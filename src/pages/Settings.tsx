import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { updateBusiness } from '../features/business/repo'
import { syncNow } from '../features/sync/engine'
import { useSyncState } from '../features/sync/useSync'
import { playTimeUp } from '../utils/sound'
import { inputCls } from '../components/ui'

const CURRENCIES = ['COP', 'USD', 'MXN', 'PEN', 'CLP', 'ARS', 'EUR']

export function Settings() {
  const { business, canManage, user, membership, signOut, isPlatformAdmin } = useAuth()
  const sync = useSyncState()
  const [form, setForm] = useState({ name: '', phone: '', address: '', currency: 'COP', alert_minutes: '5', sound_enabled: true })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [qr, setQr] = useState('')

  useEffect(() => {
    if (!business) return
    setForm({
      name: business.name,
      phone: business.phone ?? '',
      address: business.address ?? '',
      currency: business.currency,
      alert_minutes: String(business.alert_minutes),
      sound_enabled: business.sound_enabled,
    })
  }, [business?.id, business?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const publicUrl = business ? `${location.origin}/p/${business.public_token}` : ''
  useEffect(() => {
    if (publicUrl) QRCode.toDataURL(publicUrl, { width: 280, margin: 1 }).then(setQr)
  }, [publicUrl])

  if (!business) return null

  const save = async () => {
    const alert = Number(form.alert_minutes)
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    if (!Number.isInteger(alert) || alert < 0 || alert > 60) return setError('Alerta entre 0 y 60 minutos')
    await updateBusiness(business.id, {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      currency: form.currency,
      alert_minutes: alert,
      sound_enabled: form.sound_enabled,
    })
    setError('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const logout = async () => {
    try {
      await signOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <h1 className="text-2xl font-extrabold text-ink">Ajustes</h1>

      <section className="grid gap-4 rounded-3xl bg-white border border-line shadow-card p-5 sm:grid-cols-2">
        <h2 className="text-base font-bold sm:col-span-2">Negocio</h2>
        <label className="grid gap-1.5 text-sm font-medium text-slate-600">Nombre
          <input className={inputCls} disabled={!canManage} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-600">Teléfono
          <input className={inputCls} disabled={!canManage} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-600 sm:col-span-2">Dirección
          <input className={inputCls} disabled={!canManage} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-600">Moneda
          <select className={inputCls} disabled={!canManage} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-600">Avisar cuando falten (minutos)
          <input className={inputCls} disabled={!canManage} inputMode="numeric" value={form.alert_minutes} onChange={(e) => setForm({ ...form, alert_minutes: e.target.value.replace(/\D/g, '') })} />
        </label>
        <div className="flex items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            <input type="checkbox" className="size-5" disabled={!canManage} checked={form.sound_enabled} onChange={(e) => setForm({ ...form, sound_enabled: e.target.checked })} />
            Sonido de alerta
          </label>
          <button onClick={playTimeUp} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">🔊 Probar sonido</button>
        </div>
        {error && <p className="font-semibold text-red-600 sm:col-span-2">{error}</p>}
        {canManage && (
          <button onClick={save} className="rounded-full bg-sun py-3 font-extrabold text-brand shadow-[0_5px_0_var(--color-sun-dark)] sm:col-span-2">
            {saved ? '✓ Guardado' : 'Guardar cambios'}
          </button>
        )}
      </section>

      <section className="grid gap-4 rounded-3xl bg-white border border-line shadow-card p-5 sm:grid-cols-[auto_1fr]">
        <h2 className="text-base font-bold sm:col-span-2">📺 Pantalla pública</h2>
        {qr && <img src={qr} alt="Código QR de la pantalla pública" className="size-44 rounded-2xl border" />}
        <div className="grid content-start gap-3">
          <p className="text-slate-600">Abre este enlace en una TV o tablet del parque. Solo muestra nombre y tiempo restante.</p>
          <code className="break-all rounded-xl bg-slate-100 p-3 text-sm">{publicUrl}</code>
          <div className="flex flex-wrap gap-2">
            <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-full bg-brand px-4 py-2 font-bold text-white">Abrir</a>
            <a href="/pantalla" target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2 font-bold">Abrir en este dispositivo (offline)</a>
            {canManage && (
              <button
                onClick={() => confirm('El enlace actual dejará de funcionar. ¿Continuar?') && updateBusiness(business.id, { public_token: crypto.randomUUID() })}
                className="rounded-full bg-white px-4 py-2 font-bold text-red-600"
              >
                Cambiar enlace
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl bg-white border border-line shadow-card p-5">
        <h2 className="text-base font-bold">Sincronización</h2>
        <p className="text-slate-600">
          {sync.online ? 'En línea' : 'Sin conexión — los datos se guardan en este dispositivo'} · Pendientes: <b>{sync.pending}</b>
          {sync.lastSyncAt && <> · Última: {new Date(sync.lastSyncAt).toLocaleTimeString('es-CO')}</>}
        </p>
        {sync.error && <p className="text-sm font-semibold text-brand">{sync.error}</p>}
        <button onClick={() => syncNow()} disabled={!sync.online || sync.syncing} className="w-fit rounded-full bg-brand px-4 py-2 font-bold text-white disabled:opacity-50">
          Sincronizar ahora
        </button>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white border border-line shadow-card p-5">
        <div className="text-slate-600">
          {user?.email} · <span className="font-bold capitalize">{membership?.role === 'owner' ? 'Dueño' : membership?.role === 'admin' ? 'Administrador' : 'Empleado'}</span>
        </div>
        <div className="flex gap-2">
          {isPlatformAdmin && <a href="/admin" className="rounded-full bg-brand px-4 py-2 font-extrabold text-white">🛡 Panel admin</a>}
          <button onClick={logout} className="rounded-full bg-red-50 px-4 py-2 font-bold text-red-600">Cerrar sesión</button>
        </div>
      </section>
    </div>
  )
}
