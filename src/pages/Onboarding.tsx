import { useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { supabase } from '../database/supabase/client'

const input = 'w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg outline-none focus:border-amber-500'

export function Onboarding() {
  const { createBusiness, user } = useAuth()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await createBusiness(name.trim(), owner.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-br from-amber-100 to-orange-100 p-4">
      <form onSubmit={submit} className="grid w-full max-w-md gap-4 rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-black text-slate-800">Crea tu parque 🛝</h1>
        <p className="text-slate-500">Se crearán tarifas de ejemplo que puedes cambiar después.</p>
        <input className={input} required placeholder="Nombre del negocio" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="Tu nombre" value={owner} onChange={(e) => setOwner(e.target.value)} />
        {error && <p className="rounded-2xl bg-red-50 p-3 font-semibold text-red-600">{error}</p>}
        <button disabled={busy || !name.trim()} className="rounded-2xl bg-amber-500 py-4 text-xl font-black text-white disabled:opacity-50">Comenzar</button>
        <button type="button" onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-slate-400">
          Salir ({user?.email})
        </button>
      </form>
    </div>
  )
}
