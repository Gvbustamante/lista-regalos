import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicBoard, type BoardItem } from '../components/PublicBoard'
import { supabase } from '../database/supabase/client'

interface BoardResponse {
  business: { name: string; logo_url: string | null }
  server_time: string
  sessions: BoardItem[]
}

/** Pantalla pública en otro dispositivo (TV/tablet) vía enlace o QR, sin iniciar sesión */
export function PublicRemote() {
  const { token } = useParams()
  const [data, setData] = useState<BoardResponse | null>(null)
  const [offset, setOffset] = useState(0)
  const [state, setState] = useState<'loading' | 'ok' | 'invalid' | 'offline'>('loading')

  useEffect(() => {
    let alive = true
    const load = async () => {
      const t0 = Date.now()
      const { data, error } = await supabase.rpc('playtime_public_board', { p_token: token })
      if (!alive) return
      if (error) return setState((s) => (s === 'loading' ? 'invalid' : 'offline'))
      if (!data) return setState('invalid')
      const res = data as BoardResponse
      // Corrige diferencia de reloj entre este dispositivo y el servidor
      setOffset(Date.parse(res.server_time) - (t0 + Date.now()) / 2)
      setData(res)
      setState('ok')
    }
    void load()
    const id = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token])

  if (state === 'loading') return <div className="grid min-h-dvh place-items-center bg-slate-900 text-2xl font-bold text-white">Cargando…</div>
  if (state === 'invalid' || !data)
    return <div className="grid min-h-dvh place-items-center bg-slate-900 p-6 text-center text-2xl font-bold text-white">Enlace no válido o sin conexión.</div>

  return (
    <PublicBoard
      title={data.business.name}
      items={data.sessions}
      offsetMs={offset}
      notice={state === 'offline' ? 'Sin conexión — mostrando últimos datos' : undefined}
    />
  )
}
