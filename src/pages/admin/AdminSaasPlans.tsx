import { useEffect, useState } from 'react'
import { Btn, inputCls, labelCls, Pill } from '../../components/ui'
import { adminApi } from '../../features/admin/api'
import { useAsync } from '../../features/admin/useAsync'
import { useAuth } from '../../features/auth/AuthContext'
import type { SaasPlan } from '../../types'
import { money } from '../../utils/format'

type Draft = Record<'id' | 'name' | 'price' | 'currency' | 'devices' | 'sessions' | 'members' | 'branches' | 'features' | 'order', string> & { active: boolean; isNew: boolean }

const toDraft = (p?: SaasPlan, order = 1): Draft =>
  p
    ? {
        id: p.id, name: p.name, price: String(p.price_monthly), currency: p.currency,
        devices: p.max_devices?.toString() ?? '', sessions: p.max_sessions_month?.toString() ?? '', members: p.max_members?.toString() ?? '',
        branches: p.max_branches?.toString() ?? '', features: p.features.join('\n'), order: String(p.sort_order), active: p.active, isNew: false,
      }
    : { id: '', name: '', price: '0', currency: 'COP', devices: '', sessions: '', members: '', branches: '', features: '', order: String(order), active: true, isNew: true }

const limitOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))))
const fmtLimit = (v: number | null, unit: string) => (v == null ? `${unit} ilimitados` : `${v} ${unit}`)

export function AdminSaasPlans() {
  const { data, error, reload } = useAsync(() => Promise.all([adminApi.saasPlans(), adminApi.overview()]), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState('')
  const [plans, rows] = data ?? [[], []]

  const save = async () => {
    if (!draft) return
    const id = draft.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!id || !draft.name.trim()) return setMsg('Escribe código y nombre')
    if (draft.isNew && plans.some((p) => p.id === id)) return setMsg('Ese código ya existe')
    try {
      await adminApi.saveSaasPlan({
        id,
        name: draft.name.trim(),
        price_monthly: Math.max(0, Number(draft.price) || 0),
        currency: draft.currency.trim().toUpperCase() || 'COP',
        max_devices: limitOrNull(draft.devices),
        max_sessions_month: limitOrNull(draft.sessions),
        max_members: limitOrNull(draft.members),
        max_branches: limitOrNull(draft.branches),
        features: draft.features.split('\n').map((f) => f.trim()).filter(Boolean),
        sort_order: Number(draft.order) || 0,
        active: draft.active,
      })
      setDraft(null)
      setMsg('')
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
  }

  const num = (k: keyof Draft, label: string) => (
    <label className={labelCls}>
      {label}
      <input className={inputCls} inputMode="numeric" placeholder="∞" value={draft![k] as string} onChange={(e) => setDraft({ ...draft!, [k]: e.target.value.replace(/\D/g, '') })} />
    </label>
  )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-500">Plataforma</div>
          <h1 className="text-2xl font-extrabold text-ink">Planes y configuración</h1>
        </div>
        <Btn onClick={() => setDraft(toDraft(undefined, plans.length + 1))}>+ Nuevo plan</Btn>
      </div>
      {(error || msg) && <p className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error || msg}</p>}

      {draft && (
        <section className="grid gap-3 rounded-3xl border border-line bg-white p-5 shadow-card sm:grid-cols-4">
          <label className={labelCls}>Código<input className={inputCls} disabled={!draft.isNew} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="ej: premium" /></label>
          <label className={labelCls}>Nombre<input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className={labelCls}>Precio mensual<input className={inputCls} inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label className={labelCls}>Moneda<input className={inputCls} maxLength={3} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></label>
          {num('sessions', 'Entradas por mes')}
          {num('members', 'Cuentas')}
          {num('devices', 'Dispositivos')}
          {num('branches', 'Sedes (incluye la principal)')}
          <p className="text-xs text-slate-500 sm:col-span-4">Deja un límite vacío para que sea ilimitado.</p>
          <label className={`${labelCls} sm:col-span-3`}>Funciones (una por línea)<textarea className={`${inputCls} min-h-24`} value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} /></label>
          <label className={labelCls}>Orden<input className={inputCls} inputMode="numeric" value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="flex items-center gap-2 font-semibold sm:col-span-4"><input type="checkbox" className="size-5" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Disponible para asignar</label>
          <div className="flex gap-2 sm:col-span-4">
            <Btn onClick={save}>Guardar plan</Btn>
            <Btn variant="outline" onClick={() => setDraft(null)}>Cancelar</Btn>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const count = rows.filter((b) => !b.parent_id && b.saas_plan === p.id).length
          return (
            <div key={p.id} className={`flex flex-col gap-3 rounded-3xl border border-line bg-white p-5 shadow-card ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-ink">{p.name}</span>
                <Pill>{count} negocios</Pill>
              </div>
              <div className="text-3xl font-extrabold text-ink">{money(p.price_monthly, p.currency)}<span className="text-sm font-medium text-slate-500"> /mes</span></div>
              <ul className="grid gap-1 text-sm text-slate-600">
                <li>🎟 {fmtLimit(p.max_sessions_month, 'entradas/mes')}</li>
                <li>👥 {fmtLimit(p.max_members, 'cuentas')}</li>
                <li>📱 {fmtLimit(p.max_devices, 'dispositivos')}</li>
                <li>📍 {fmtLimit(p.max_branches, 'sedes')}</li>
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-slate-400">código: {p.id}</span>
                <Btn variant="outline" className="py-2 text-sm" onClick={() => setDraft(toDraft(p))}>Editar</Btn>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ContactSettings />
        <PlatformAdmins />
      </div>
    </div>
  )
}

function ContactSettings() {
  const { data } = useAsync(() => adminApi.settings(), [])
  const [wa, setWa] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!data) return
    setWa(data.contact_whatsapp ?? '')
    setEmail(data.contact_email ?? '')
  }, [data])
  return (
    <section className="grid content-start gap-3 rounded-3xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-bold text-ink">Contacto para ventas</h2>
      <p className="text-sm text-slate-500">Aparece en la app cuando un negocio llega a su límite, para renovar, mejorar el plan o comprar un extra.</p>
      <label className={labelCls}>WhatsApp (con indicativo, ej. 573001234567)<input className={inputCls} inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} /></label>
      <label className={labelCls}>Correo<input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <Btn
        onClick={async () => {
          try {
            await adminApi.saveSettings({ contact_whatsapp: wa.replace(/[^\d+]/g, '') || null, contact_email: email.trim() || null })
            setMsg('✓ Guardado')
          } catch (e) {
            setMsg(e instanceof Error ? e.message : 'Error')
          }
        }}
      >
        Guardar contacto
      </Btn>
      {msg && <p className="text-sm font-semibold text-brand">{msg}</p>}
    </section>
  )
}

function PlatformAdmins() {
  const { user } = useAuth()
  const { data, reload } = useAsync(() => adminApi.admins(), [])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <section className="grid content-start gap-3 rounded-3xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-bold text-ink">Administradores de la plataforma</h2>
      <ul className="grid gap-2">
        {(data ?? []).map((a) => (
          <li key={a.email} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span>🛡</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{a.email}</span>
            {a.email !== user?.email?.toLowerCase() && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Quitar a ${a.email} como administrador?`)) return
                  await adminApi.removeAdmin(a.email)
                  await reload()
                }}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await adminApi.addAdmin(email)
            setEmail('')
            setMsg('')
            await reload()
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Error')
          }
        }}
        className="flex flex-wrap gap-2"
      >
        <input type="email" required className={`${inputCls} min-w-52 flex-1`} placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Btn type="submit">Agregar</Btn>
      </form>
      <p className="text-xs text-slate-500">La persona entra con su propia cuenta de Full Time (correo confirmado) y verá el panel en /admin.</p>
      {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
    </section>
  )
}
