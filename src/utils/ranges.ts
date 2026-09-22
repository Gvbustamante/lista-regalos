export type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  week: 'Esta semana',
  month: 'Este mes',
  custom: 'Personalizado',
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Devuelve [desde, hasta) en hora local */
export function rangeBounds(key: RangeKey, customFrom?: string, customTo?: string): [Date, Date] {
  const today = startOfDay(new Date())
  switch (key) {
    case 'today':
      return [today, addDays(today, 1)]
    case 'yesterday':
      return [addDays(today, -1), today]
    case 'week': {
      const dow = (today.getDay() + 6) % 7 // lunes = 0
      return [addDays(today, -dow), addDays(today, 1)]
    }
    case 'month':
      return [new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1)]
    case 'custom': {
      const from = customFrom ? startOfDay(new Date(customFrom + 'T00:00')) : today
      const to = customTo ? addDays(startOfDay(new Date(customTo + 'T00:00')), 1) : addDays(today, 1)
      return [from, to]
    }
  }
}

export const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
