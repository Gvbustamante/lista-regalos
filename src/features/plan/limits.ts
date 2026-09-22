import type { LimitKind, Usage } from '../../types'

export const LIMIT_LABEL: Record<LimitKind, { title: string; unit: string }> = {
  sessions: { title: 'Entradas este mes', unit: 'entradas' },
  members: { title: 'Cuentas', unit: 'cuentas' },
  devices: { title: 'Dispositivos', unit: 'dispositivos' },
  branches: { title: 'Sedes', unit: 'sedes' },
}

export type BlockReason = 'suspended' | 'expired' | 'sessions'

/** Mensajes de error del servidor (PLAYTIME_*) a texto claro */
export function friendlyLimitError(msg: string): string | null {
  if (msg.includes('PLAYTIME_SESSION_LIMIT')) return 'Llegaste al límite de entradas de tu plan este mes.'
  if (msg.includes('PLAYTIME_PLAN_EXPIRED')) return 'Tu plan venció. Renuévalo para seguir registrando entradas.'
  if (msg.includes('PLAYTIME_MEMBER_LIMIT')) return 'Llegaste al límite de cuentas de tu plan.'
  if (msg.includes('PLAYTIME_DEVICE_LIMIT')) return 'Llegaste al límite de dispositivos de tu plan.'
  if (msg.includes('PLAYTIME_BRANCH_LIMIT')) return 'Llegaste al límite de sedes de tu plan.'
  return null
}

export function contactLinks(usage: Usage | null, reason: string) {
  const text = encodeURIComponent(`Hola, soy de "${usage?.root_name ?? ''}" (plan ${usage?.plan_name ?? ''}). ${reason} Quiero renovar, mejorar mi plan o comprar un extra.`)
  const wa = usage?.contact.whatsapp?.replace(/\D/g, '')
  return {
    whatsapp: wa ? `https://wa.me/${wa}?text=${text}` : null,
    email: usage?.contact.email ? `mailto:${usage.contact.email}?subject=${encodeURIComponent('Plan PlayTime')}&body=${text}` : null,
  }
}
