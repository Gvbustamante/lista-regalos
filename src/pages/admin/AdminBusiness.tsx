import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RangeFilter } from '../../components/RangeFilter'
import { Stat } from '../../components/Stat'
import { Btn, Pill, Ring, inputCls, labelCls } from '../../components/ui'
import { adminApi } from '../../features/admin/api'
import { useAsync } from '../../features/admin/useAsync'
import { useAuth } from '../../features/auth/AuthContext'
import { useRange } from '../../hooks/useRange'
import type { Business, Plan, Role, SaasPlan } from '../../types'
import { dateShort, duration, money, paymentLabel, time } from '../../utils/format'
import { StatusPill } from './AdminHome'

const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Dueño' },
  { value: 'admin', label: 'Administrador' },
  { value: 'employee', label: 'Empleado' },
]
type Tab = 'resumen' | 'cuentas' | 'tarifas' | 'sesiones'

export function AdminBusiness() {
  const { id = '' } = useParams()
  const { data, error, reload } = useAsync(
    () => Promise.all([adminApi.business(id), adminApi.saasPlans(), adminApi.overview().then((r) => r.find((x) => x.id === id) ?? null)]),
    [id],
  )
  const [tab, setTab] = useState<Tab>('resumen')

  if (error) return <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-600">{error}</p>
  if (!data) return <p className="p-10 text-center font-bold text-slate-400">Cargando…</p>
  const [biz, plans, stats] = data
  const plan = plans.find((p) => p.id === biz.saas_plan)
  const limit = plan?.max_sessions_month ?? null
  const used = stats?.sessions_month ?? 0

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-5 rounded-3xl bg-white border border-line shadow-card p-5 md:flex-row md:items-center">
        <Link to="/admin" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/70 text-xl font-extrabold text-slate-500" aria-label="Volver">✕</Link>
        <Ring progress={limit ? 1 - Math.min(1, used / limit) : 1} color={limit && used / limit > 0.9 ? '#ef4444' : '#ffe11c'} size={120} stroke={16}>
          <span className="text-center font-extrabold leading-tight text-brand">
            <span className="text-2xl">{used}</span>
            <br />
            <span className="text-xs text-slate-500">{limit ? `de ${limit}` : 'este mes'}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-500">Negocio</div>
          <h1 className="truncate text-2xl font-extrabold text-ink">{biz.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill status={biz.status} />
            <Pill>Plan {plan?.name ?? biz.saas_plan}</Pill>
            {biz.plan_expires_at && <Pill>Vence {dateShort(biz.plan_expires_at)}</Pill>}
            <Pill>{stats?.owner_email ?? 'sin dueño'}</Pill>
          </div>
        </div>
        <Btn
          variant={biz.status === 'active' ? 'danger' : 'sun'}
          onClick={async () => {
            const next = biz.status === 'active' ? 'suspended' : 'active'
            if (next === 'suspended' && !confirm(`¿Suspender "${biz.name}"? Perderán acceso a sus datos hasta reactivarlo.`)) return
            await adminApi.updateBusiness(biz.id, { status: next })
            await reload()
          }}
        >
          {biz.status === 'active' ? 'Suspender negocio' : '✓ Reactivar negocio'}
        </Btn>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="En el parque" value={stats?.active_now ?? 0} tone="amber" />
        <Stat label="Sesiones totales" value={stats?.sessions_total ?? 0} />
        <Stat label="Niños registrados" value={stats?.children ?? 0} />
        <Stat label="Ventas del mes" value={money(stats?.revenue_month ?? 0, biz.currency)} tone="emerald" />
        <Stat label="Ventas totales" value={money(stats?.revenue_total ?? 0, biz.currency)} tone="emerald" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['resumen', 'cuentas', 'tarifas', 'sesiones'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-sm font-semibold capitalize ${tab === t ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:text-ink'}`}>{t}</button>
        ))}
      </div>

      {tab === 'resumen' && <SummaryTab biz={biz} plans={plans} onSaved={reload} />}
      {tab === 'cuentas' && <MembersTab businessId={biz.id} maxMembers={plan?.max_members ?? null} />}
      {tab === 'tarifas' && <PlansTab biz={biz} />}
      {tab === 'sesiones' && <SessionsTab biz={biz} />}
    </div>
  )
}

function SummaryTab({ biz, plans, onSaved }: { biz: Business; plans: SaasPlan[]; onSaved: () => Promise<void> }) {
  const [f, setF] = useState({
    name: biz.name,
    phone: biz.phone ?? '',
    address: biz.address ?? '',
    currency: biz.currency,
    saas_plan: biz.saas_plan,
    plan_expires_at: biz.plan_expires_at ? biz.plan_expires_at.slice(0, 10) : '',
  })
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => {
    adminApi.notes(biz.id).then(setNotes).catch(() => {})
  }, [biz.id])

  const save = async () => {
    try {
      await adminApi.updateBusiness(biz.id, {
        name: f.name.trim() || biz.name,
        phone: f.phone.trim() || null,
        address: f.address.trim() || null,
        currency: f.currency,
        saas_plan: f.saas_plan,
        plan_expires_at: f.plan_expires_at ? new Date(f.plan_expires_at + 'T23:59:59').toISOString() : null,
      })
      await adminApi.saveNotes(biz.id, notes)
      setMsg('✓ Guardado')
      await onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="grid content-start gap-4 rounded-3xl bg-white border border-line shadow-card p-5">
        <h2 className="text-base font-bold text-ink">Datos del negocio</h2>
        <label className={labelCls}>Nombre<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>Teléfono<input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className={labelCls}>Moneda<input className={inputCls} value={f.currency} maxLength={3} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></label>
        </div>
        <label className={labelCls}>Dirección<input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        <label className={labelCls}>Notas internas (solo tú las ves)
          <textarea className={`${inputCls} min-h-28`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pagos, acuerdos, contacto…" />
        </label>
      </section>

      <section className="grid content-start gap-4 rounded-3xl bg-white border border-line shadow-card p-5">
        <h2 className="text-base font-bold text-ink">Suscripción</h2>
        <div className="grid grid-cols-2 gap-3">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setF({ ...f, saas_plan: p.id })}
              className={`rounded-2xl border-2 p-3 text-left transition ${f.saas_plan === p.id ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-brand-line'} ${p.active ? '' : 'opacity-50'}`}
            >
              <div className="font-extrabold text-brand">{p.name}</div>
              <div className="text-sm font-bold text-slate-500">{money(p.price_monthly, p.currency)} / mes</div>
            </button>
          ))}
        </div>
        <label className={labelCls}>Plan vence el (opcional)
          <input type="date" className={inputCls} value={f.plan_expires_at} onChange={(e) => setF({ ...f, plan_expires_at: e.target.value })} />
        </label>
        <p className="text-sm font-medium text-slate-500">Creado el {new Date(biz.created_at).toLocaleDateString('es-CO')} · Enlace público /p/{biz.public_token.slice(0, 8)}…</p>
        <Btn variant="sun" onClick={save} className="py-4 text-lg">Guardar cambios</Btn>
        {msg && <p className="font-bold text-brand">{msg}</p>}
      </section>
    </div>
  )
}

function MembersTab({ businessId, maxMembers }: { businessId: string; maxMembers: number | null }) {
  const { user } = useAuth()
  const { data, error, reload } = useAsync(() => adminApi.members(businessId), [businessId])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [msg, setMsg] = useState('')

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setMsg('')
      await fn()
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
  }
  const members = data ?? []

  return (
    <section className="grid gap-4 rounded-3xl bg-white border border-line shadow-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">Cuentas del negocio</h2>
        <Pill>{members.length} {maxMembers ? `de ${maxMembers} permitidas` : 'cuentas'}</Pill>
      </div>
      {(error || msg) && <p className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error || msg}</p>}
      <ul className="grid gap-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3">
            <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-xl">👤</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold text-ink">{m.name || m.email || m.user_id.slice(0, 8)}</div>
              <div className="truncate text-sm font-medium text-slate-500">{m.email} · desde {dateShort(m.created_at)}</div>
            </div>
            <select
              value={m.role}
              onChange={(e) => act(() => adminApi.setRole(businessId, m.user_id, e.target.value as Role))}
              className="rounded-full border-2 border-line bg-canvas px-3 py-2 font-bold text-brand"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              onClick={() => confirm(`¿Quitar a ${m.email ?? 'esta cuenta'} del negocio?`) && act(() => adminApi.removeMember(businessId, m.user_id))}
              disabled={m.user_id === user?.id}
              className="rounded-full px-3 py-2 font-bold text-red-500 hover:bg-red-50 disabled:opacity-30"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void act(async () => {
            await adminApi.addMember(businessId, email, role)
            setEmail('')
          })
        }}
        className="flex flex-wrap gap-2"
      >
        <input type="email" required className={`${inputCls} min-w-60 flex-1`} placeholder="Correo de una cuenta registrada" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-full border-2 border-line bg-white px-4 font-bold text-brand">
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <Btn type="submit">+ Agregar cuenta</Btn>
      </form>
    </section>
  )
}

type Draft = { id?: string; name: string; minutes: string; price: string; is_extension: boolean; active: boolean }

function PlansTab({ biz }: { biz: Business }) {
  const { data, error, reload } = useAsync(() => adminApi.plans(biz.id), [biz.id])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState('')
  const plans = data ?? []

  const save = async () => {
    if (!draft) return
    const minutes = Number(draft.minutes)
    const price = Number(draft.price || 0)
    if (!draft.name.trim() || !Number.isInteger(minutes) || minutes <= 0 || !Number.isFinite(price) || price < 0) return setMsg('Revisa nombre, minutos y precio')
    try {
      const existing = plans.find((p) => p.id === draft.id)
      await adminApi.savePlan({
        id: draft.id,
        business_id: biz.id,
        name: draft.name.trim(),
        duration_minutes: minutes,
        price,
        is_extension: draft.is_extension,
        active: draft.active,
        sort_order: existing?.sort_order ?? plans.length + 1,
      })
      setDraft(null)
      setMsg('')
      await reload()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
  }
  const edit = (p?: Plan) =>
    setDraft(p ? { id: p.id, name: p.name, minutes: String(p.duration_minutes), price: String(p.price), is_extension: p.is_extension, active: p.active } : { name: '', minutes: '30', price: '', is_extension: false, active: true })

  return (
    <section className="grid gap-4 rounded-3xl bg-white border border-line shadow-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Tarifas del negocio</h2>
        <Btn onClick={() => edit()}>+ Nueva tarifa</Btn>
      </div>
      {(error || msg) && <p className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error || msg}</p>}
      {draft && (
        <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-[2fr_1fr_1fr]">
          <label className={labelCls}>Nombre<input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className={labelCls}>Minutos<input className={inputCls} inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value.replace(/\D/g, '') })} /></label>
          <label className={labelCls}>Precio<input className={inputCls} inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-5" checked={draft.is_extension} onChange={(e) => setDraft({ ...draft, is_extension: e.target.checked })} /> Extensión</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="size-5" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Activa</label>
          <div className="flex gap-2 sm:col-span-3">
            <Btn variant="sun" onClick={save}>Guardar</Btn>
            <Btn variant="outline" onClick={() => setDraft(null)}>Cancelar</Btn>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <button key={p.id} onClick={() => edit(p)} className={`rounded-2xl bg-white p-4 text-left hover:ring-4 hover:ring-brand-line ${p.active ? '' : 'opacity-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-ink">{p.name}</span>
              {p.is_extension && <Pill>Extensión</Pill>}
            </div>
            <div className="text-2xl font-extrabold text-brand">{duration(p.duration_minutes)}</div>
            <div className="font-bold text-slate-500">{money(p.price, biz.currency)}{!p.active && ' · inactiva'}</div>
          </button>
        ))}
      </div>
    </section>
  )
}

function SessionsTab({ biz }: { biz: Business }) {
  const r = useRange('today')
  const { data, error, loading } = useAsync(() => adminApi.sessions(biz.id, r.bounds[0], r.bounds[1]), [biz.id, r.bounds[0].getTime(), r.bounds[1].getTime()])
  const paid = useMemo(() => {
    const m = new Map<string, number>()
    data?.payments.forEach((p) => m.set(p.session_id, (m.get(p.session_id) ?? 0) + Number(p.amount)))
    return m
  }, [data])
  const valid = (data?.sessions ?? []).filter((s) => s.status !== 'cancelled')
  const total = valid.reduce((a, s) => a + (paid.get(s.id) ?? 0), 0)

  return (
    <section className="grid gap-4 rounded-3xl bg-white border border-line shadow-card p-5">
      <RangeFilter value={r.key} onChange={r.setKey} from={r.from} to={r.to} onFrom={r.setFrom} onTo={r.setTo} />
      <div className="flex flex-wrap gap-2">
        <Pill>{valid.length} entradas</Pill>
        <Pill>{money(total, biz.currency)}</Pill>
      </div>
      {error && <p className="rounded-2xl bg-red-50 p-3 font-bold text-red-600">{error}</p>}
      {loading && !data ? (
        <p className="font-bold text-slate-400">Cargando…</p>
      ) : (
        <ul className="grid gap-2">
          {(data?.sessions ?? []).map((s) => (
            <li key={s.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-white px-4 py-3 sm:grid-cols-[7rem_1fr_7rem_7rem_7rem]">
              <span className="font-bold text-slate-600">{dateShort(s.started_at)} {time(s.started_at)}</span>
              <span className="truncate font-extrabold text-ink">{s.child_name}</span>
              <span className="hidden font-bold text-slate-500 sm:block">{duration(Math.round((Date.parse(s.expires_at) - Date.parse(s.started_at)) / 60000))}</span>
              <span className="hidden font-bold text-slate-500 sm:block">{s.status === 'active' ? '🟢 En parque' : s.status === 'cancelled' ? 'Anulada' : paymentLabel(s.payment_method)}</span>
              <span className={`text-right font-extrabold ${s.status === 'cancelled' ? 'text-slate-300 line-through' : 'text-brand'}`}>{money(paid.get(s.id) ?? 0, biz.currency)}</span>
            </li>
          ))}
          {data?.sessions.length === 0 && <li className="p-6 text-center font-bold text-slate-400">Sin entradas en este periodo</li>}
        </ul>
      )}
    </section>
  )
}
