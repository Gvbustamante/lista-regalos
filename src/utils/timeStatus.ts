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
  yellow: '#ffe11c',
  orange: '#fb923c',
  red: '#ef4444',
}

export const LEVEL_STYLES: Record<TimeLevel, { card: string; text: string; dot: string }> = {
  green: { card: 'ring-emerald-300', text: 'text-brand', dot: 'bg-emerald-500' },
  yellow: { card: 'ring-yellow-300', text: 'text-brand', dot: 'bg-yellow-400' },
  orange: { card: 'ring-orange-400', text: 'text-orange-500', dot: 'bg-orange-500' },
  red: { card: 'ring-red-400 animate-pulse-slow', text: 'text-red-500', dot: 'bg-red-500' },
}
