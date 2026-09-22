import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'sun' | 'brand' | 'outline' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  sun: 'bg-sun text-brand shadow-[0_5px_0_var(--color-sun-dark)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_2px_0_var(--color-sun-dark)]',
  brand: 'bg-brand text-white shadow-[0_5px_0_var(--color-brand-dark)] hover:brightness-110 active:translate-y-[3px] active:shadow-[0_2px_0_var(--color-brand-dark)]',
  outline: 'border-2 border-brand-line bg-white/60 text-brand hover:bg-white',
  ghost: 'bg-white/70 text-brand hover:bg-white',
  danger: 'border-2 border-red-200 bg-white/60 text-red-600 hover:bg-white',
}

export function Btn({ variant = 'brand', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-full px-5 py-3 font-black transition disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}

/** Tarjeta menta redondeada */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] bg-mint p-5 ${className}`}>{children}</div>
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border-2 border-brand-line/60 bg-white/70 px-3 py-0.5 text-xs font-bold text-slate-600 ${className}`}>{children}</span>
}

/** Anillo de progreso (0..1) con contenido en el centro */
export function Ring({ progress, color, size = 120, stroke = 14, children }: { progress: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.min(1, Math.max(0, progress))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="var(--color-brand)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/** Dígitos tipo reloj de fichas: 07:12 */
export function FlipDigits({ text, size = 'md' }: { text: string; size?: 'xs' | 'md' | 'lg' }) {
  const box = {
    xs: 'h-5 w-4 text-xs rounded',
    md: 'h-14 w-11 text-4xl rounded-xl',
    lg: 'h-24 w-18 text-6xl rounded-2xl lg:h-28 lg:w-20 lg:text-7xl',
  }[size]
  return (
    <span className="inline-flex items-center gap-1" aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span
            key={i}
            className={`grid place-items-center bg-[linear-gradient(to_bottom,#f6f1ff_50%,#ffffff_50%)] font-black tabular-nums text-brand shadow-sm ring-1 ring-brand-line/50 ${box}`}
          >
            {ch}
          </span>
        ) : (
          <span key={i} className={`font-black text-brand ${size === 'xs' ? 'text-xs' : size === 'md' ? 'text-3xl' : 'text-5xl'}`}>
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
