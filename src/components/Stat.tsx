export function Stat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'amber' | 'orange' | 'emerald' | 'sky' }) {
  const tones = {
    slate: 'text-ink',
    amber: 'text-brand',
    orange: 'text-orange-500',
    emerald: 'text-emerald-600',
    sky: 'text-brand',
  }
  return (
    <div className="rounded-[24px] bg-mint p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-brand/60">{label}</div>
      <div className={`mt-1 truncate text-2xl font-black tabular-nums lg:text-3xl ${tones[tone]}`}>{value}</div>
    </div>
  )
}
