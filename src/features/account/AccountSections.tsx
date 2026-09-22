import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Btn, inputCls } from '../../components/ui'
import { LimitModal } from '../../components/LimitModal'
import { supabase, T } from '../../database/supabase/client'
import type { Device, LimitKind, MemberRow, Role } from '../../types'
import { dateShort, money, time } from '../../utils/format'
import { useAuth } from '../auth/AuthContext'
import { friendlyLimitError, LIMIT_LABEL } from '../plan/limits'
import { deviceId, useUsage } from '../plan/UsageContext'

const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', admin: 'Administrador', employee: 'Empleado' }
const errText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  return friendlyLimitError(m) ?? m
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Meter({ kind, used, limit }: { kind: LimitKind; used: number; limit: number | null }) {
  const ratio = limit ? Math.min(1, used / limit) : 0
  return (
    <div className="rounded-2xl bg-canvas p-3">
      <div className="text-xs text-slate-500">{LIMIT_LABEL[kind].title}</div>
      <div className="mt-0.5 font-bold tabular-nums text-ink">
        {used} <span className="font-medium text-slate-400">/ {limit ?? '∞'}</span>
      </div>
      {limit !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
          <div className={`h-full rounded-full ${ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      )}
    </div>
  )
}

export function PlanSection() {
  const { usage, sessionsUsed, block } = useUsage()
  const [open, setOpen] = useState(false)
  if (!usage) return null
  return (
    <Section title="Plan y uso" action={<Btn variant="outline" className="py-2 text-sm" onClick={() => setOpen(true)}>Mejorar o comprar extra</Btn>}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-extrabold text-ink">Plan {usage.plan_name}</span>
        <span className="text-slate-500">{money(usage.plan_price, usage.plan_currency)} / mes</span>
        {usage.plan_expires_at && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usage.expired ? 'bg-red-50 text-red-700' : 'bg-canvas text-slate-600'}`}>
            {usage.expired ? 'Venció' : 'Vence'} el {dateShort(usage.plan_expires_at)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meter kind="sessions" used={sessionsUsed} limit={usage.limits.sessions} />
        <Meter kind="members" used={usage.used.members} limit={usage.limits.members} />
        <Meter kind="devices" used={usage.used.devices} limit={usage.limits.devices} />
        <Meter kind="branches" used={usage.used.branches} limit={usage.limits.branches} />
      </div>
      <p className="text-xs text-slate-500">El contador de entradas vuelve a cero el primer día de cada mes. Los límites incluyen los extras que tengas activos.</p>
      {open && <LimitModal reason={block ?? 'sessions'} onClose={() => setOpen(false)} />}
    </Section>
  )
}

export function BranchesSection() {
  const { businesses, business, membership, switchBusiness, reloadBusinesses } = useAuth()
  const { usage, refresh } = useUsage()
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const rootId = usage?.root_id ?? business?.parent_id ?? business?.id
  const isOwner = businesses.find((b) => b.id === rootId)?.role === 'owner'
  const org = businesses.filter((b) => b.id === rootId || b.parent_id === rootId)
  const full = usage?.limits.branches != null && usage.used.branches >= usage.limits.branches

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!navigator.onLine) return setMsg('Necesitas internet para crear una sede.')
    const { data, error } = await supabase.rpc('playtime_create_branch', { p_root: rootId, p_name: name.trim() })
    if (error) return setMsg(errText(new Error(error.message)))
    setName('')
    setMsg('')
    await reloadBusinesses()
    await refresh()
    if (data && confirm('Sede creada. ¿Quieres cambiarte a ella ahora?')) {
      // la lista se recargó; cambiar tras el render
      setTimeout(() => void switchBusiness(data as string), 50)
    }
  }

  return (
    <Section title="Sedes">
      <ul className="grid gap-2">
        {org.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="text-xl">{b.parent_id ? '📍' : '🏢'}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{b.name}</div>
              <div className="text-xs text-slate-500">{b.parent_id ? 'Sede' : 'Principal'} · {ROLE_LABEL[b.role]}</div>
            </div>
            {b.id === membership?.business_id ? (
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">Actual</span>
            ) : (
              <button onClick={() => switchBusiness(b.id)} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">Cambiar</button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <input className={`${inputCls} min-w-52 flex-1`} placeholder="Nombre de la nueva sede" value={name} onChange={(e) => setName(e.target.value)} required />
          <Btn type="submit" disabled={!name.trim()}>{full ? '🔒 Nueva sede' : '+ Nueva sede'}</Btn>
        </form>
      )}
      {full && isOwner && <p className="text-sm text-amber-700">Tu plan ya usa todas sus sedes. Mejora tu plan o compra una sede extra para agregar otra.</p>}
      {msg && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{msg}</p>}
    </Section>
  )
}

export function TeamSection() {
  const { business, membership, user } = useAuth()
  const { refresh } = useUsage()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [msg, setMsg] = useState('')
  const isOwner = membership?.role === 'owner'

  const load = useCallback(async () => {
    if (!business || !navigator.onLine) return
    const { data } = await supabase.from(T.members).select('*').eq('business_id', business.id).order('created_at')
    setMembers((data ?? []) as MemberRow[])
  }, [business])
  useEffect(() => void load(), [load])

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (!navigator.onLine) return setMsg('Necesitas internet para cambiar el equipo.')
    const { error } = await fn()
    if (error) return setMsg(errText(new Error(error.message)))
    setMsg('')
    await load()
    await refresh()
  }

  if (!business) return null
  return (
    <Section title={`Equipo de ${business.name}`}>
      {!navigator.onLine && <p className="text-sm text-slate-500">Conéctate a internet para ver el equipo.</p>}
      <ul className="grid gap-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
            <span className="grid size-9 place-items-center rounded-full bg-brand-soft">👤</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{m.name || m.email}</div>
              <div className="truncate text-xs text-slate-500">{m.email}{m.user_id === user?.id && ' · tú'}</div>
            </div>
            {isOwner && m.user_id !== user?.id ? (
              <>
                <select
                  value={m.role}
                  onChange={(e) => act(() => supabase.from(T.members).update({ role: e.target.value }).eq('business_id', business.id).eq('user_id', m.user_id))}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold"
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <button
                  onClick={() => confirm(`¿Quitar a ${m.email}?`) && act(() => supabase.from(T.members).delete().eq('business_id', business.id).eq('user_id', m.user_id))}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
                >
                  Quitar
                </button>
              </>
            ) : (
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-slate-600">{ROLE_LABEL[m.role]}</span>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void act(async () => {
              const r = await supabase.rpc('playtime_add_member', { p_business_id: business.id, p_email: email, p_role: role })
              if (!r.error) setEmail('')
              return r
            })
          }}
          className="flex flex-wrap gap-2"
        >
          <input type="email" required className={`${inputCls} min-w-52 flex-1`} placeholder="Correo de la persona (ya registrada)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-xl border border-line bg-white px-3 font-semibold">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <Btn type="submit">Agregar</Btn>
        </form>
      )}
      {isOwner && <p className="text-xs text-slate-500">La persona primero crea su cuenta en PlayTime con su correo; luego la agregas aquí.</p>}
      {msg && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{msg}</p>}
    </Section>
  )
}

export function DevicesSection() {
  const { business, canManage, businesses } = useAuth()
  const { usage, refresh } = useUsage()
  const [devices, setDevices] = useState<Device[]>([])
  const [msg, setMsg] = useState('')
  const rootId = usage?.root_id

  const load = useCallback(async () => {
    if (!rootId || !navigator.onLine) return
    const { data } = await supabase.from('playtime_devices').select('*').eq('root_id', rootId).order('last_seen_at', { ascending: false })
    setDevices((data ?? []) as Device[])
  }, [rootId])
  useEffect(() => void load(), [load])

  if (!business) return null
  const here = deviceId()
  const nameOf = (id: string) => businesses.find((b) => b.id === id)?.name ?? ''

  return (
    <Section title="Dispositivos autorizados">
      <ul className="grid gap-2">
        {devices.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="text-xl">📱</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">
                {d.name || 'Dispositivo'} {d.id === here && <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">este</span>}
              </div>
              <div className="text-xs text-slate-500">{nameOf(d.business_id)} · visto {dateShort(d.last_seen_at)} {time(d.last_seen_at)}</div>
            </div>
            {canManage && d.id !== here && (
              <button
                onClick={async () => {
                  if (!confirm('¿Quitar este dispositivo? Dejará de poder usar la app.')) return
                  const { error } = await supabase.from('playtime_devices').delete().eq('id', d.id)
                  if (error) return setMsg(error.message)
                  await load()
                  await refresh()
                }}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Cada tablet o celular donde se inicia sesión ocupa un cupo de tu plan. Quita los que ya no uses.</p>
      {msg && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{msg}</p>}
    </Section>
  )
}

export function PasswordSection() {
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Section title="Cambiar contraseña">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = await supabase.auth.updateUser({ password: pw })
          setMsg(error ? { ok: false, text: error.message } : { ok: true, text: '✓ Contraseña actualizada' })
          if (!error) setPw('')
        }}
        className="flex flex-wrap gap-2"
      >
        <input type="password" minLength={6} required autoComplete="new-password" className={`${inputCls} min-w-52 flex-1`} placeholder="Nueva contraseña (mín. 6)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Btn type="submit" variant="outline">Guardar</Btn>
      </form>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
    </Section>
  )
}
