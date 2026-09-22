import type { PaymentMethod } from '../types'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
]

export const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m

const moneyFmt = new Map<string, Intl.NumberFormat>()
export function money(amount: number, currency = 'COP') {
  let f = moneyFmt.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 })
    moneyFmt.set(currency, f)
  }
  return f.format(amount)
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })

export const dateLong = (d = new Date()) =>
  d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  if (!m) return h === 1 ? '1 hora' : `${h} horas`
  return `${h}h ${m}m`
}

/** Cuenta regresiva: mm:ss o h:mm:ss */
export function countdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
