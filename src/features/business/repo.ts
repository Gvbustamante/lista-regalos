import { db } from '../../database/local/db'
import type { Business, Plan } from '../../types'
import { nowIso, uuid } from '../../utils/id'
import { requestSync } from '../sync/engine'

export async function updateBusiness(id: string, patch: Partial<Omit<Business, 'id'>>) {
  await db.businesses.update(id, { ...patch, updated_at: nowIso(), _dirty: 1 })
  requestSync()
}

export async function savePlan(plan: Partial<Plan> & { business_id: string }) {
  const ts = nowIso()
  const existing = plan.id ? await db.plans.get(plan.id) : undefined
  const row: Plan = {
    id: existing?.id ?? uuid(),
    business_id: plan.business_id,
    name: plan.name ?? existing?.name ?? '',
    duration_minutes: plan.duration_minutes ?? existing?.duration_minutes ?? 30,
    price: plan.price ?? existing?.price ?? 0,
    is_extension: plan.is_extension ?? existing?.is_extension ?? false,
    active: plan.active ?? existing?.active ?? true,
    sort_order: plan.sort_order ?? existing?.sort_order ?? 99,
    created_at: existing?.created_at ?? ts,
    updated_at: ts,
    _dirty: 1,
  }
  await db.plans.put(row)
  requestSync()
}
