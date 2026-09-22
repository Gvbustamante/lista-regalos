export type TimeLevel = 'green' | 'yellow' | 'orange' | 'red'

/** Verde >20 min · Amarillo 10–20 · Naranja <10 · Rojo terminado */
export function timeLevel(remainingMs: number): TimeLevel {
  const min = remainingMs / 60000
  if (remainingMs <= 0) return 'red'
  if (min < 10) return 'orange'
  if (min <= 20) return 'yellow'
  return 'green'
}

export const LEVEL_COLOR: Record<TimeLevel, string> = {
  green: '#22c55e',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
}

export const LEVEL_LABEL: Record<TimeLevel, string> = {
  green: 'A tiempo',
  yellow: 'Poco tiempo',
  orange: 'Por vencer',
  red: 'Terminado',
}

export const LEVEL_STYLES: Record<TimeLevel, { card: string; text: string; dot: string; badge: string }> = {
  green: { card: 'border-line', text: 'text-ink', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  yellow: { card: 'border-line', text: 'text-ink', dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700' },
  orange: { card: 'border-orange-300', text: 'text-orange-600', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700' },
  red: { card: 'border-red-400 animate-pulse-slow', text: 'text-red-600', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700' },
}
