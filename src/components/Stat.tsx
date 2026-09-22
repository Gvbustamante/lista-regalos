export function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'amber' | 'orange' | 'emerald' | 'sky' }) {
  const tones = {
    slate: 'text-slate-800',
    amber: 'text-amber-600',
    orange: 'text-orange-600',
    emerald: 'text-emerald-600',
    sky: 'text-sky-600',
  }
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 truncate text-2xl font-black tabular-nums lg:text-3xl ${tones[tone]}`}>{value}</div>
    </div>
  )
}
