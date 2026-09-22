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
          className={`rounded-full border-2 px-2 py-3 text-sm font-bold ${value === m.value ? 'border-brand bg-brand text-white' : 'border-mint-dark bg-mint-soft text-slate-600'}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
