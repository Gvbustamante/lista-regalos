import { supabase, T } from '../../database/supabase/client'
import type { AdminBusinessRow, Business, Device, LimitKind, MemberRow, Payment, Plan, PlanExtra, Role, SaasPlan, Session, Usage } from '../../types'

/** Acceso online del super-admin (no usa la base local) */

const ok = <D>({ data, error }: { data: D; error: { message: string } | null }) => {
  if (error) throw new Error(error.message)
  return data
}
const now = () => new Date().toISOString()

export const adminApi = {
  overview: async () => ok(await supabase.rpc('playtime_admin_overview')) as AdminBusinessRow[],

  saasPlans: async () => ok(await supabase.from('playtime_saas_plans').select('*').order('sort_order')) as SaasPlan[],
  saveSaasPlan: async (p: Omit<SaasPlan, 'updated_at'>) =>
    ok(await supabase.from('playtime_saas_plans').upsert({ ...p, updated_at: now() })),

  business: async (id: string) => ok(await supabase.from(T.businesses).select('*').eq('id', id).single()) as Business,
  updateBusiness: async (id: string, patch: Partial<Business>) =>
    ok(await supabase.from(T.businesses).update({ ...patch, updated_at: now() }).eq('id', id)),

  notes: async (id: string) =>
    ((ok(await supabase.from('playtime_admin_notes').select('notes').eq('business_id', id).maybeSingle()) as { notes: string } | null)?.notes ?? ''),
  saveNotes: async (id: string, notes: string) =>
    ok(await supabase.from('playtime_admin_notes').upsert({ business_id: id, notes, updated_at: now() })),

  members: async (id: string) =>
    ok(await supabase.from(T.members).select('*').eq('business_id', id).order('created_at')) as MemberRow[],
  addMember: async (id: string, email: string, role: Role) =>
    ok(await supabase.rpc('playtime_add_member', { p_business_id: id, p_email: email, p_role: role })),
  setRole: async (id: string, userId: string, role: Role) =>
    ok(await supabase.from(T.members).update({ role }).eq('business_id', id).eq('user_id', userId)),
  removeMember: async (id: string, userId: string) =>
    ok(await supabase.from(T.members).delete().eq('business_id', id).eq('user_id', userId)),

  plans: async (id: string) =>
    ok(await supabase.from(T.plans).select('*').eq('business_id', id).order('sort_order')) as Plan[],
  savePlan: async (p: Partial<Plan> & { business_id: string }) =>
    ok(await supabase.from(T.plans).upsert({ ...p, id: p.id ?? crypto.randomUUID(), updated_at: now() })),

  usage: async (id: string) => ok(await supabase.rpc('playtime_usage', { p_business_id: id })) as Usage,

  extras: async (rootId: string) =>
    ok(await supabase.from('playtime_plan_extras').select('*').eq('root_id', rootId).order('created_at', { ascending: false })) as PlanExtra[],
  addExtra: async (rootId: string, kind: LimitKind, amount: number, validUntil: string | null, note: string) =>
    ok(await supabase.from('playtime_plan_extras').insert({ root_id: rootId, kind, amount, valid_until: validUntil, note: note || null })),
  removeExtra: async (id: string) => ok(await supabase.from('playtime_plan_extras').delete().eq('id', id)),

  devices: async (rootId: string) =>
    ok(await supabase.from('playtime_devices').select('*').eq('root_id', rootId).order('last_seen_at', { ascending: false })) as Device[],
  removeDevice: async (id: string) => ok(await supabase.from('playtime_devices').delete().eq('id', id)),

  createBranch: async (rootId: string, name: string) => ok(await supabase.rpc('playtime_create_branch', { p_root: rootId, p_name: name })) as string,

  settings: async () =>
    ok(await supabase.from('playtime_platform_settings').select('*').eq('id', 1).single()) as { contact_whatsapp: string | null; contact_email: string | null },
  saveSettings: async (p: { contact_whatsapp: string | null; contact_email: string | null }) =>
    ok(await supabase.from('playtime_platform_settings').update({ ...p, updated_at: now() }).eq('id', 1)),

  admins: async () => ok(await supabase.from('playtime_platform_admins').select('*').order('created_at')) as { email: string; created_at: string }[],
  addAdmin: async (email: string) => ok(await supabase.from('playtime_platform_admins').insert({ email: email.trim().toLowerCase() })),
  removeAdmin: async (email: string) => ok(await supabase.from('playtime_platform_admins').delete().eq('email', email)),

  sessions: async (id: string, from: Date, to: Date) => {
    const sessions = ok(
      await supabase
        .from(T.sessions)
        .select('*')
        .eq('business_id', id)
        .gte('started_at', from.toISOString())
        .lt('started_at', to.toISOString())
        .order('started_at', { ascending: false })
        .limit(1000),
    ) as Session[]
    const ids = sessions.map((s) => s.id)
    const payments = ids.length ? (ok(await supabase.from(T.payments).select('*').in('session_id', ids)) as Payment[]) : []
    return { sessions, payments }
  },
}
