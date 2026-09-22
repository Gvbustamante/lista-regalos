export type Role = 'owner' | 'admin' | 'employee'
export type PaymentMethod = 'cash' | 'nequi' | 'daviplata' | 'card' | 'other'
export type SessionStatus = 'active' | 'completed' | 'cancelled'

/** Metadatos locales: 1 = cambio pendiente de subir a Supabase */
export interface SyncMeta {
  _dirty?: 0 | 1
  synced_at?: string
}

export interface Business extends SyncMeta {
  id: string
  name: string
  logo_url: string | null
  phone: string | null
  address: string | null
  currency: string
  alert_minutes: number
  sound_enabled: boolean
  public_token: string
  saas_plan: string
  status: 'active' | 'suspended'
  plan_expires_at: string | null
  parent_id: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Child extends SyncMeta {
  id: string
  business_id: string
  name: string
  age: number | null
  guardian_name: string | null
  guardian_phone: string | null
  created_at: string
  updated_at: string
}

export interface Plan extends SyncMeta {
  id: string
  business_id: string
  name: string
  duration_minutes: number
  price: number
  is_extension: boolean
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Session extends SyncMeta {
  id: string
  business_id: string
  child_id: string
  plan_id: string | null
  child_name: string
  duration_minutes: number
  price: number
  payment_method: PaymentMethod
  started_at: string
  expires_at: string
  status: SessionStatus
  finished_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Extension extends SyncMeta {
  id: string
  business_id: string
  session_id: string
  minutes: number
  price: number
  created_at: string
  updated_at: string
}

export interface Payment extends SyncMeta {
  id: string
  business_id: string
  session_id: string
  extension_id: string | null
  amount: number
  method: PaymentMethod
  created_at: string
  updated_at: string
}

export interface Membership {
  business_id: string
  user_id: string
  role: Role
}

export interface SaasPlan {
  id: string
  name: string
  price_monthly: number
  currency: string
  max_devices: number | null
  max_sessions_month: number | null
  max_members: number | null
  max_branches: number | null
  features: string[]
  sort_order: number
  active: boolean
  updated_at: string
}

export interface MemberRow {
  business_id: string
  user_id: string
  name: string | null
  email: string | null
  role: Role
  created_at: string
}

export interface AdminBusinessRow {
  id: string
  parent_id: string | null
  devices: number
  name: string
  phone: string | null
  address: string | null
  currency: string
  saas_plan: string
  status: 'active' | 'suspended'
  plan_expires_at: string | null
  created_at: string
  owner_email: string | null
  members: number
  children: number
  sessions_total: number
  sessions_month: number
  active_now: number
  revenue_month: number
  revenue_total: number
  last_activity: string | null
}

export type LimitKind = 'sessions' | 'members' | 'devices' | 'branches'

export interface Usage {
  root_id: string
  root_name: string
  plan_id: string
  plan_name: string
  plan_price: number
  plan_currency: string
  status: 'active' | 'suspended'
  plan_expires_at: string | null
  expired: boolean
  month_start: string
  limits: Record<LimitKind, number | null>
  used: Record<LimitKind, number>
  contact: { whatsapp: string | null; email: string | null }
  server_time: string
}

export interface PlanExtra {
  id: string
  root_id: string
  kind: LimitKind
  amount: number
  valid_until: string | null
  note: string | null
  created_at: string
}

export interface Device {
  id: string
  root_id: string
  business_id: string
  name: string | null
  last_seen_at: string
  created_at: string
}

export interface MyBusiness {
  id: string
  name: string
  parent_id: string | null
  role: Role
}
