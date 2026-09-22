export function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'amber' | 'orange' | 'emerald' | 'sky' }) {
  const tones = {
    slate: 'text-ink',
    amber: 'text-brand',
    orange: 'text-orange-600',
    emerald: 'text-emerald-600',
    sky: 'text-ink',
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-2xl font-bold tabular-nums lg:text-[28px] ${tones[tone]}`}>{value}</div>
    </div>
  )
}
