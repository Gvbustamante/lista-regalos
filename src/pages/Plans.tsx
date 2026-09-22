import { useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { savePlan } from '../features/business/repo'
import { usePlans } from '../hooks/useData'
import type { Plan } from '../types'
import { duration, money } from '../utils/format'

const input = 'w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 outline-none focus:border-brand'

type Draft = { id?: string; name: string; minutes: string; price: string; is_extension: boolean }

export function Plans() {
  const { business, canManage } = useAuth()
  const plans = usePlans(business?.id)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  const edit = (p?: Plan) =>
    setDraft(p ? { id: p.id, name: p.name, minutes: String(p.duration_minutes), price: String(p.price), is_extension: p.is_extension } : { name: '', minutes: '30', price: '', is_extension: false })

  const save = async () => {
    if (!business || !draft) return
    const minutes = Number(draft.minutes)
    const price = Number(draft.price || 0)
    if (!draft.name.trim()) return setError('Escribe un nombre')
    if (!Number.isInteger(minutes) || minutes <= 0) return setError('Duración inválida')
    if (!Number.isFinite(price) || price < 0) return setError('Precio inválido')
    await savePlan({
      id: draft.id,
      business_id: business.id,
      name: draft.name.trim(),
      duration_minutes: minutes,
      price,
      is_extension: draft.is_extension,
      sort_order: draft.id ? undefined : plans.length + 1,
    })
    setDraft(null)
    setError('')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-black text-brand">Tarifas</h1>
        {canManage && (
          <button onClick={() => edit()} className="rounded-2xl bg-brand px-5 py-3 font-black text-white">+ Nuevo plan</button>
        )}
      </div>
      {!canManage && <p className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-600">Solo el dueño o un administrador puede cambiar tarifas.</p>}

      {draft && (
        <div className="mb-5 grid gap-3 rounded-[28px] bg-mint p-5 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="grid gap-1 text-sm font-bold text-slate-500">Nombre
            <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-500">Minutos
            <input className={input} inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-500">Precio
            <input className={input} inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })} />
          </label>
          <label className="flex items-center gap-2 font-semibold text-slate-700 sm:col-span-3">
            <input type="checkbox" className="size-5" checked={draft.is_extension} onChange={(e) => setDraft({ ...draft, is_extension: e.target.checked })} />
            Es un plan de extensión (solo para agregar tiempo)
          </label>
          {error && <p className="font-semibold text-red-600 sm:col-span-3">{error}</p>}
          <div className="flex gap-2 sm:col-span-3">
            <button onClick={save} className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white">Guardar</button>
            <button onClick={() => (setDraft(null), setError(''))} className="rounded-2xl bg-slate-100 px-5 py-3 font-bold text-slate-600">Cancelar</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] bg-mint">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Duración</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Estado</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-bold text-slate-800">
                  {p.name}
                  {p.is_extension && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">Extensión</span>}
                </td>
                <td className="px-4 py-3">{duration(p.duration_minutes)}</td>
                <td className="px-4 py-3 font-semibold">{money(p.price, business?.currency)}</td>
                <td className="px-4 py-3">{p.active ? 'Activo' : 'Inactivo'}</td>
                {canManage && (
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button onClick={() => edit(p)} className="mr-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">Editar</button>
                    <button onClick={() => savePlan({ id: p.id, business_id: p.business_id, active: !p.active })} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
