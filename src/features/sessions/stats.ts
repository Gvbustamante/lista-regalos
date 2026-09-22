import type { RangeData } from '../../hooks/useData'

export function summarize(data: RangeData | undefined) {
  const sessions = (data?.sessions ?? []).filter((s) => s.status !== 'cancelled')
  const valid = new Set(sessions.map((s) => s.id))
  const extensions = (data?.extensions ?? []).filter((e) => valid.has(e.session_id))
  const payments = (data?.payments ?? []).filter((p) => valid.has(p.session_id))
  const totalMinutes = sessions.reduce((a, s) => a + (Date.parse(s.expires_at) - Date.parse(s.started_at)) / 60000, 0)
  return {
    sessions,
    extensions,
    payments,
    entries: sessions.length,
    extensionsCount: extensions.length,
    income: payments.reduce((a, p) => a + Number(p.amount), 0),
    totalMinutes: Math.round(totalMinutes),
    avgMinutes: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
    uniqueChildren: new Set(sessions.map((s) => s.child_id)).size,
  }
}
