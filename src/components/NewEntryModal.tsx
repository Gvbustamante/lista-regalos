import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type FormEvent } from 'react'
import { db } from '../database/local/db'
import { useAuth } from '../features/auth/AuthContext'
import { createEntry } from '../features/sessions/repo'
import { usePlans } from '../hooks/useData'
import type { PaymentMethod } from '../types'
import { duration, money } from '../utils/format'
import { unlockAudio } from '../utils/sound'
import { Modal } from './Modal'
import { PaymentPicker } from './PaymentPicker'
import { Btn } from './ui'

const input = 'w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand'
const label = 'mb-1 block text-sm font-bold uppercase tracking-wide text-slate-500'

export function NewEntryModal({ onClose }: { onClose: () => void }) {
  const { business, user } = useAuth()
  const plans = usePlans(business?.id).filter((p) => p.active && !p.is_extension)
  const children = useLiveQuery(() => (business ? db.children.where('business_id').equals(business.id).toArray() : []), [business?.id]) ?? []

  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [phone, setPhone] = useState('')
  const [childId, setChildId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | 'custom' | null>(null)
  const [customMin, setCustomMin] = useState('45')
  const [price, setPrice] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (q.length < 2 || childId) return []
    return children.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5)
  }, [name, children, childId])

  const pickChild = (id: string) => {
    const c = children.find((x) => x.id === id)
    if (!c) return
    setChildId(c.id)
    setName(c.name)
    setAge(c.age?.toString() ?? '')
    setGuardian(c.guardian_name ?? '')
    setPhone(c.guardian_phone ?? '')
  }

  const selectPlan = (id: string | 'custom') => {
    setPlanId(id)
    const p = plans.find((x) => x.id === id)
    if (p) setPrice(String(p.price))
  }

  const minutes = planId === 'custom' ? Number(customMin) : (plans.find((p) => p.id === planId)?.duration_minutes ?? 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    unlockAudio()
    if (!business) return
    if (!name.trim()) return setError('Escribe el nombre del niño')
    if (!planId) return setError('Selecciona el tiempo')
    if (!Number.isFinite(minutes) || minutes <= 0) return setError('Minutos inválidos')
    const amount = Number(price || 0)
    if (!Number.isFinite(amount) || amount < 0) return setError('Precio inválido')
    const ageNum = age ? Number(age) : null
    if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 18)) return setError('Edad entre 0 y 18')

    setSaving(true)
    try {
      await createEntry({
        businessId: business.id,
        userId: user?.id ?? null,
        existingChildId: childId,
        child: { name, age: ageNum, guardian_name: guardian.trim() || null, guardian_phone: phone.trim() || null },
        planId: planId === 'custom' ? null : planId,
        minutes,
        price: amount,
        method,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <Modal title="Nueva entrada" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="relative">
            <label className={label} htmlFor="ne-name">Nombre del niño</label>
            <input
              id="ne-name"
              className={input}
              value={name}
              autoFocus
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value)
                setChildId(null)
              }}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pickChild(c.id)} className="flex w-full justify-between px-4 py-3 text-left hover:bg-brand-soft">
                      <span className="font-bold">{c.name}</span>
                      <span className="text-sm text-slate-500">{[c.age && `${c.age} años`, c.guardian_name].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {childId && <p className="mt-1 text-sm font-semibold text-emerald-600">✓ Cliente frecuente</p>}
          </div>
          <div>
            <label className={label} htmlFor="ne-age">Edad</label>
            <input id="ne-age" className={input} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className={label} htmlFor="ne-guardian">Acompañante</label>
            <input id="ne-guardian" className={input} value={guardian} onChange={(e) => setGuardian(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="ne-phone">Teléfono</label>
            <input id="ne-phone" className={input} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div>
          <span className={label}>Tiempo</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {plans.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => selectPlan(p.id)}
                className={`rounded-[22px] border-4 px-3 py-4 text-center text-brand ${planId === p.id ? 'border-brand bg-brand-soft' : 'border-mint-dark bg-mint-soft'}`}
              >
                <div className="text-xl font-black">{duration(p.duration_minutes).toUpperCase()}</div>
                <div className="text-sm font-semibold text-slate-500">{p.name} · {money(p.price, business?.currency)}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => selectPlan('custom')}
              className={`rounded-[22px] border-4 px-3 py-4 text-center text-brand ${planId === 'custom' ? 'border-brand bg-brand-soft' : 'border-mint-dark bg-mint-soft'}`}
            >
              <div className="text-xl font-black">PERSONALIZADO</div>
              <div className="text-sm font-semibold text-slate-500">Minutos a elección</div>
            </button>
          </div>
          {planId === 'custom' && (
            <div className="mt-3 max-w-48">
              <label className={label} htmlFor="ne-min">Minutos</label>
              <input id="ne-min" className={input} inputMode="numeric" value={customMin} onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, ''))} />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div>
            <label className={label} htmlFor="ne-price">Precio</label>
            <input id="ne-price" className={input} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
          </div>
          <div>
            <span className={label}>Método de pago</span>
            <PaymentPicker value={method} onChange={setMethod} />
          </div>
        </div>

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-semibold text-red-600">{error}</p>}

        <Btn variant="sun" disabled={saving} className="py-5 text-2xl">
          ▶ Iniciar tiempo
        </Btn>
      </form>
    </Modal>
  )
}
