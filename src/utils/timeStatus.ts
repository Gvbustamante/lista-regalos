export type TimeLevel = 'green' | 'yellow' | 'orange' | 'red'

/** Verde >20 min · Amarillo 10–20 · Naranja <10 · Rojo terminado */
export function timeLevel(remainingMs: number): TimeLevel {
  const min = remainingMs / 60000
  if (remainingMs <= 0) return 'red'
  if (min < 10) return 'orange'
  if (min <= 20) return 'yellow'
  return 'green'
}

export const LEVEL_STYLES: Record<TimeLevel, { card: string; text: string; dot: string }> = {
  green: { card: 'border-emerald-400 bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  yellow: { card: 'border-yellow-400 bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  orange: { card: 'border-orange-500 bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
  red: { card: 'border-red-500 bg-red-50 animate-pulse-slow', text: 'text-red-600', dot: 'bg-red-500' },
}
