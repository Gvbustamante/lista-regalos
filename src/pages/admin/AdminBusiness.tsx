import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RangeFilter } from '../../components/RangeFilter'
import { Stat } from '../../components/Stat'
import { Btn, Pill, Ring, inputCls, labelCls } from '../../components/ui'
import { adminApi } from '../../features/admin/api'
import { useAsync } from '../../features/admin/useAsync'
import { useAuth } from '../../features/auth/AuthContext'
import { useRange } from '../../hooks/useRange'
import type { AdminBusinessRow, Business, LimitKind, Plan, Role, SaasPlan, Usage } from '../../types'
import { LIMIT_LABEL } from '../../features/plan/limits'
import { dateShort, duration, money, paymentLabel, time } from '../../utils/format'
import { StatusPill } from './AdminHome'

const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Dueño' },
  { value: 'admin', label: 'Administrador' },
  { value: 'employee', label: 'Empleado' },
]
type Tab = 'resumen' | 'cuentas' | 'tarifas' | 'sesiones' | 'sedes' | 'extras' | 'dispositivos'

export function AdminBusiness() {
  const { id = '' } = useParams()
  const { data, error, reload } = useAsync(
    () => Promise.all([adminApi.business(id), adminApi.saasPlans(), adminApi.overview(), adminApi.usage(id)]),
    [id],
  )
  const [tab, setTab] = useState<Tab>('resumen')

  if (error) return <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-600">{error}</p>
  if (!data) return <p className="p-10 text-center font-bold text-slate-400">Cargando…</p>
  const [biz, plans, all, usage] = data
  const stats = all.find((x) => x.id === id) ?? null
  const branches = all.filter((x) => x.parent_id === id)
  const parent = biz.parent_id ? all.find((x) => x.id === biz.parent_id) : null
  const plan = plans.find((p) => p.id === usage.plan_id)
  const limit = usage.limits.sessions
  const used = usage.used.sessions

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-5 rounded-3xl bg-white border border-line shadow-card p-5 md:flex-row md:items-center">
        <Link to="/admin" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/70 text-xl font-extrabold text-slate-500" aria-label="Volver">✕</Link>
        <Ring progress={limit ? 1 - Math.min(1, used / limit) : 1} color={limit && used / limit > 0.9 ? '#ef4444' : '#ffe11c'} size={120} stroke={16}>
          <span className="text-center font-extrabold leading-tight text-brand">
            <span className="text-2xl">{used}</span>
            <br />
            <span className="text-xs text-slate-500">{limit ? `de ${limit} (org.)` : 'este mes'}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-500">
            {parent ? (
              <>Sede de <Link to={`/admin/negocios/${parent.id}`} className="font-semibold text-brand underline">{parent.name}</Link></>
            ) : (
              'Negocio principal'
            )}
          </div>
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
        {((parent ? ['resumen', 'cuentas', 'tarifas', 'sesiones'] : ['resumen', 'cuentas', 'tarifas', 'sesiones', 'sedes', 'extras', 'dispositivos']) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-sm font-semibold capitalize ${tab === t ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:text-ink'}`}>{t}</button>
        ))}
      </div>

      {tab === 'resumen' && (parent ? <SummaryTab biz={biz} plans={[]} onSaved={reload} /> : <SummaryTab biz={biz} plans={plans} onSaved={reload} />)}
      {tab === 'cuentas' && <MembersTab businessId={biz.id} maxMembers={usage.limits.members} />}
      {tab === 'tarifas' && <PlansTab biz={biz} />}
      {tab === 'sesiones' && <SessionsTab biz={biz} />}
      {tab === 'sedes' && <BranchesTab rootId={biz.id} branches={branches} onChanged={reload} />}
      {tab === 'extras' && <ExtrasTab rootId={biz.id} usage={usage} onChanged={reload} />}
      {tab === 'dispositivos' && <DevicesTab rootId={biz.id} all={all} onChanged={reload} />}
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
        {plans.length === 0 && <p className="text-sm text-slate-500">Las sedes usan el plan del negocio principal.</p>}
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

function BranchesTab({ rootId, branches, onChanged }: { rootId: string; branches: AdminBusinessRow[]; onChanged: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <section className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-bold text-ink">Sedes</h2>
      {branches.length === 0 && <p className="text-sm text-slate-500">Este negocio aún no tiene sedes adicionales.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {branches.map((b) => (
          <Link key={b.id} to={`/admin/negocios/${b.id}`} className="rounded-2xl border border-line p-4 hover:border-brand-line">
            <div className="font-semibold text-ink">📍 {b.name}</div>
            <div className="mt-1 text-sm text-slate-500">
              {b.active_now} en el parque · {b.sessions_month} entradas este mes · {money(b.revenue_month, b.currency)}
            </div>
          </Link>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await adminApi.createBranch(rootId, name.trim())
            setName('')
            setMsg('')
            await onChanged()
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Error')
          }
        }}
        className="flex flex-wrap gap-2"
      >
        <input required className={`${inputCls} min-w-52 flex-1`} placeholder="Nombre de la nueva sede" value={name} onChange={(e) => setName(e.target.value)} />
        <Btn type="submit">+ Crear sede</Btn>
      </form>
      <p className="text-xs text-slate-500">Como admin puedes crear sedes aunque el plan esté en su límite. Se copian las tarifas y los dueños/administradores.</p>
      {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
    </section>
  )
}

const KINDS: LimitKind[] = ['sessions', 'members', 'devices', 'branches']

function ExtrasTab({ rootId, usage, onChanged }: { rootId: string; usage: Usage; onChanged: () => Promise<void> }) {
  const { data, reload } = useAsync(() => adminApi.extras(rootId), [rootId])
  const [kind, setKind] = useState<LimitKind>('sessions')
  const [amount, setAmount] = useState('50')
  const [until, setUntil] = useState<'month' | 'forever' | 'date'>('month')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const validUntil = () => {
    if (until === 'forever') return null
    if (until === 'date') return date ? new Date(date + 'T23:59:59').toISOString() : null
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth() + 1, 1).toISOString()
  }
  const active = (x: { valid_until: string | null }) => !x.valid_until || Date.parse(x.valid_until) > Date.now()

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <section className="grid content-start gap-4 rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 className="text-base font-bold text-ink">Uso actual de la organización</h2>
        <div className="grid grid-cols-2 gap-3">
          {KINDS.map((k) => (
            <div key={k} className="rounded-2xl bg-canvas p-3">
              <div className="text-xs text-slate-500">{LIMIT_LABEL[k].title}</div>
              <div className="font-bold tabular-nums text-ink">
                {usage.used[k]} <span className="font-medium text-slate-400">/ {usage.limits[k] ?? '∞'}</span>
              </div>
            </div>
          ))}
        </div>
        <h2 className="mt-2 text-base font-bold text-ink">Agregar extra</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>Tipo
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as LimitKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{LIMIT_LABEL[k].unit}</option>)}
            </select>
          </label>
          <label className={labelCls}>Cantidad<input className={inputCls} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></label>
          <label className={`${labelCls} col-span-2`}>Vigencia
            <select className={inputCls} value={until} onChange={(e) => setUntil(e.target.value as typeof until)}>
              <option value="month">Hasta fin de este mes</option>
              <option value="forever">Permanente</option>
              <option value="date">Hasta una fecha</option>
            </select>
          </label>
          {until === 'date' && <label className={`${labelCls} col-span-2`}>Fecha<input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></label>}
          <label className={`${labelCls} col-span-2`}>Nota (pago, referencia…)<input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <Btn
          onClick={async () => {
            const n = Number(amount)
            if (!Number.isInteger(n) || n <= 0) return setMsg('Cantidad inválida')
            if (until === 'date' && !date) return setMsg('Elige la fecha')
            try {
              await adminApi.addExtra(rootId, kind, n, validUntil(), note.trim())
              setNote('')
              setMsg('')
              await reload()
              await onChanged()
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Error')
            }
          }}
        >
          + Agregar extra
        </Btn>
        {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
      </section>

      <section className="grid content-start gap-3 rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 className="text-base font-bold text-ink">Extras</h2>
        {(data ?? []).length === 0 && <p className="text-sm text-slate-500">Sin extras.</p>}
        <ul className="grid gap-2">
          {(data ?? []).map((x) => (
            <li key={x.id} className={`flex items-center gap-3 rounded-2xl border border-line p-3 ${active(x) ? '' : 'opacity-50'}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">+{x.amount} {LIMIT_LABEL[x.kind].unit}</div>
                <div className="truncate text-xs text-slate-500">
                  {x.valid_until ? `${active(x) ? 'Hasta' : 'Venció'} ${dateShort(x.valid_until)}` : 'Permanente'} · creado {dateShort(x.created_at)}
                  {x.note && ` · ${x.note}`}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('¿Eliminar este extra?')) return
                  await adminApi.removeExtra(x.id)
                  await reload()
                  await onChanged()
                }}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function DevicesTab({ rootId, all, onChanged }: { rootId: string; all: AdminBusinessRow[]; onChanged: () => Promise<void> }) {
  const { data, reload } = useAsync(() => adminApi.devices(rootId), [rootId])
  const nameOf = (id: string) => all.find((b) => b.id === id)?.name ?? ''
  return (
    <section className="grid gap-3 rounded-3xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-bold text-ink">Dispositivos autorizados</h2>
      {(data ?? []).length === 0 && <p className="text-sm text-slate-500">Ningún dispositivo registrado.</p>}
      <ul className="grid gap-2">
        {(data ?? []).map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="text-xl">📱</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{d.name || 'Dispositivo'}</div>
              <div className="text-xs text-slate-500">{nameOf(d.business_id)} · visto {dateShort(d.last_seen_at)} {time(d.last_seen_at)}</div>
            </div>
            <button
              onClick={async () => {
                if (!confirm('¿Quitar este dispositivo? Tendrá que volver a registrarse (si hay cupo).')) return
                await adminApi.removeDevice(d.id)
                await reload()
                await onChanged()
              }}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
