import { useState } from 'react'
import { Btn, Pill } from '../../components/ui'
import { adminApi } from '../../features/admin/api'
import { useAsync } from '../../features/admin/useAsync'
import type { SaasPlan } from '../../types'
import { money } from '../../utils/format'

const input = 'w-full rounded-2xl border-2 border-mint-dark bg-white px-3 py-2 font-semibold text-ink outline-none focus:border-brand'
const label = 'grid gap-1 text-xs font-black text-brand/60'

type Draft = Record<'id' | 'name' | 'price' | 'currency' | 'devices' | 'sessions' | 'members' | 'features' | 'order', string> & { active: boolean; isNew: boolean }

const toDraft = (p?: SaasPlan, order = 1): Draft =>
  p
    ? {
        id: p.id, name: p.name, price: String(p.price_monthly), currency: p.currency,
        devices: p.max_devices?.toString() ?? '', sessions: p.max_sessions_month?.toString() ?? '', members: p.max_members?.toString() ?? '',
        features: p.features.join('\n'), order: String(p.sort_order), active: p.active, isNew: false,
      }
    : { id: '', name: '', price: '0', currency: 'COP', devices: '', sessions: '', members: '', features: '', order: String(order), active: true, isNew: true }

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

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-black text-brand/60">Suscripciones</div>
          <h1 className="text-3xl font-black text-brand">Planes SaaS</h1>
        </div>
        <Btn variant="sun" onClick={() => setDraft(toDraft(undefined, plans.length + 1))}>+ Nuevo plan</Btn>
      </div>
      {(error || msg) && <p className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error || msg}</p>}

      {draft && (
        <section className="grid gap-3 rounded-[28px] bg-white p-5 sm:grid-cols-4">
          <label className={label}>Código<input className={input} disabled={!draft.isNew} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="ej: premium" /></label>
          <label className={label}>Nombre<input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className={label}>Precio mensual<input className={input} inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label className={label}>Moneda<input className={input} maxLength={3} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} /></label>
          <label className={label}>Máx. dispositivos (vacío = ilimitado)<input className={input} inputMode="numeric" value={draft.devices} onChange={(e) => setDraft({ ...draft, devices: e.target.value.replace(/\D/g, '') })} /></label>
          <label className={label}>Máx. sesiones/mes<input className={input} inputMode="numeric" value={draft.sessions} onChange={(e) => setDraft({ ...draft, sessions: e.target.value.replace(/\D/g, '') })} /></label>
          <label className={label}>Máx. cuentas<input className={input} inputMode="numeric" value={draft.members} onChange={(e) => setDraft({ ...draft, members: e.target.value.replace(/\D/g, '') })} /></label>
          <label className={label}>Orden<input className={input} inputMode="numeric" value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value.replace(/\D/g, '') })} /></label>
          <label className={`${label} sm:col-span-4`}>Funciones (una por línea)<textarea className={`${input} min-h-24`} value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} /></label>
          <label className="flex items-center gap-2 font-bold sm:col-span-4"><input type="checkbox" className="size-5" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Disponible para asignar</label>
          <div className="flex gap-2 sm:col-span-4">
            <Btn variant="sun" onClick={save}>Guardar plan</Btn>
            <Btn variant="outline" onClick={() => setDraft(null)}>Cancelar</Btn>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const count = rows.filter((b) => b.saas_plan === p.id).length
          return (
            <div key={p.id} className={`flex flex-col gap-3 rounded-[28px] bg-mint p-5 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-brand">{p.name}</span>
                <Pill>{count} negocios</Pill>
              </div>
              <div className="text-3xl font-black text-ink">{money(p.price_monthly, p.currency)}<span className="text-sm text-brand/60"> /mes</span></div>
              <ul className="grid gap-1 text-sm font-bold text-slate-600">
                <li>📱 {fmtLimit(p.max_devices, 'dispositivos')}</li>
                <li>🎟 {fmtLimit(p.max_sessions_month, 'sesiones/mes')}</li>
                <li>👥 {fmtLimit(p.max_members, 'cuentas')}</li>
                {p.features.map((f) => <li key={f}>✓ {f}</li>)}
              </ul>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs font-bold text-brand/50">código: {p.id}</span>
                <Btn variant="outline" className="py-2" onClick={() => setDraft(toDraft(p))}>Editar</Btn>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
