import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'sun' | 'brand' | 'outline' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  sun: 'bg-sun text-ink hover:bg-[#ffcf1f] shadow-sm',
  brand: 'bg-brand text-white hover:bg-brand-dark shadow-sm shadow-brand/20',
  outline: 'border border-line bg-white text-ink hover:bg-canvas',
  ghost: 'bg-transparent text-brand hover:bg-brand-soft',
  danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
}

export function Btn({ variant = 'brand', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-2xl px-5 py-3 font-bold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-white p-5 shadow-card ${className}`}>{children}</div>
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-slate-600 ${className}`}>{children}</span>
}

/** Anillo de progreso (0..1) con contenido en el centro */
export function Ring({ progress, color, size = 120, stroke = 10, children }: { progress: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(1, Math.max(0, progress))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/** Dígitos tipo reloj: 07:12 */
export function FlipDigits({ text, size = 'md' }: { text: string; size?: 'xs' | 'md' | 'lg' }) {
  const box = {
    xs: 'h-6 w-[18px] text-xs rounded-md',
    md: 'h-12 w-9 text-2xl rounded-lg',
    lg: 'h-20 w-14 text-5xl rounded-xl',
  }[size]
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className={`grid place-items-center bg-canvas font-bold tabular-nums text-ink ${box}`}>
            {ch}
          </span>
        ) : (
          <span key={i} className={`px-0.5 font-bold text-slate-400 ${size === 'xs' ? 'text-xs' : size === 'md' ? 'text-xl' : 'text-4xl'}`}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

/** Hora corta HH:MM (24h) para los dígitos */
export const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const inputCls =
  'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand-soft disabled:bg-canvas disabled:text-slate-500'
export const labelCls = 'grid gap-1.5 text-sm font-medium text-slate-600'
