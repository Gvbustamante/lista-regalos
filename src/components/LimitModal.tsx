import { contactLinks, type BlockReason } from '../features/plan/limits'
import { useUsage } from '../features/plan/UsageContext'
import { dateShort } from '../utils/format'
import { Modal } from './Modal'

const TEXT: Record<BlockReason, { title: string; body: (n: number | null, exp: string | null) => string }> = {
  sessions: {
    title: 'Llegaste al límite de tu plan',
    body: (n) => `Tu plan incluye ${n ?? ''} entradas por mes y ya las usaste todas. No puedes registrar más entradas hasta que se renueve el mes, mejores tu plan o compres un extra.`,
  },
  expired: {
    title: 'Tu plan venció',
    body: (_n, exp) => `Tu plan venció${exp ? ` el ${dateShort(exp)}` : ''}. Renuévalo para seguir registrando entradas. Los niños que ya están en el parque siguen funcionando normal.`,
  },
  suspended: {
    title: 'Cuenta suspendida',
    body: () => 'Tu cuenta está suspendida. Comunícate con PlayTime para reactivarla.',
  },
}

export function LimitModal({ reason, onClose }: { reason: BlockReason; onClose: () => void }) {
  const { usage, sessionsLimit } = useUsage()
  const t = TEXT[reason]
  const links = contactLinks(usage, t.title + '.')

  return (
    <Modal title={t.title} onClose={onClose}>
      <div className="grid gap-5">
        <div className="grid size-16 place-items-center rounded-2xl bg-amber-50 text-4xl">🔒</div>
        <p className="text-slate-600">{t.body(sessionsLimit, usage?.plan_expires_at ?? null)}</p>
        {reason !== 'suspended' && (
          <ul className="grid gap-2">
            {[
              ['🔄', 'Renovar', reason === 'expired' ? 'Paga tu plan actual para reactivarlo.' : 'El contador vuelve a cero el primer día del próximo mes.'],
              ['⬆️', 'Mejorar plan', 'Pasa a un plan con más entradas, cuentas, dispositivos o sedes.'],
              ['➕', 'Comprar un extra', 'Suma entradas, cuentas o dispositivos sin cambiar de plan.'],
            ].map(([icon, title, desc]) => (
              <li key={title} className="flex gap-3 rounded-2xl border border-line p-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <div className="font-semibold text-ink">{title}</div>
                  <div className="text-sm text-slate-500">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {links.whatsapp && (
            <a href={links.whatsapp} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-500 px-5 py-3 text-center font-bold text-white hover:bg-emerald-600">
              Escribir por WhatsApp
            </a>
          )}
          {links.email && (
            <a href={links.email} className="rounded-2xl border border-line px-5 py-3 text-center font-bold text-ink hover:bg-canvas">
              Enviar correo
            </a>
          )}
          {!links.whatsapp && !links.email && <p className="text-sm text-slate-500 sm:col-span-2">Comunícate con PlayTime para activar tu cambio.</p>}
        </div>
      </div>
    </Modal>
  )
}
