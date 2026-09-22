import type { PaymentMethod } from '../types'
import { PAYMENT_METHODS } from '../utils/format'

export function PaymentPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {PAYMENT_METHODS.map((m) => (
        <button
          type="button"
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition ${value === m.value ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white text-slate-600 hover:border-brand-line'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
