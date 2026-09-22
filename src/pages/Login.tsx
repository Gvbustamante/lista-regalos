import { useState, type FormEvent } from 'react'
import { supabase } from '../database/supabase/client'
import { inputCls } from '../components/ui'


export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!navigator.onLine) return setMsg({ ok: false, text: 'Necesitas internet para iniciar sesión la primera vez.' })
    setBusy(true)
    setMsg(null)
    const { data, error } =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message })
    if (mode === 'up' && !data.session) setMsg({ ok: true, text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-4">
      <form onSubmit={submit} className="grid w-full max-w-md gap-4 rounded-3xl border border-line bg-white p-8 shadow-card">
        <div className="text-center">
          <img src="/icon.svg" alt="" className="mx-auto size-20" />
          <h1 className="mt-2 text-2xl font-extrabold text-ink">PlayTime</h1>
          <p className="text-slate-500">Control de tiempo para mini parques</p>
        </div>
        <input className={inputCls} type="email" required placeholder="Correo" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" required minLength={6} placeholder="Contraseña" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        {msg && <p className={`rounded-2xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
        <button disabled={busy} className="rounded-2xl bg-brand py-4 text-xl font-extrabold text-white disabled:opacity-50">
          {mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <button type="button" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setMsg(null))} className="font-bold text-slate-500">
          {mode === 'in' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  )
}
