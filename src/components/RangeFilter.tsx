import { RANGE_LABELS, type RangeKey } from '../utils/ranges'

interface Props {
  value: RangeKey
  onChange: (k: RangeKey) => void
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}

export function RangeFilter({ value, onChange, from, to, onFrom, onTo }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-full px-4 py-2 font-bold ${value === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 shadow-sm'}`}
        >
          {RANGE_LABELS[k]}
        </button>
      ))}
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2" aria-label="Desde" />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2" aria-label="Hasta" />
        </div>
      )}
    </div>
  )
}
