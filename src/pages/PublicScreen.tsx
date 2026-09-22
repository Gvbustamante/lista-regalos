import { PublicBoard } from '../components/PublicBoard'
import { useAuth } from '../features/auth/AuthContext'
import { useActiveSessions } from '../hooks/useData'

/** Pantalla pública en el mismo dispositivo: lee la base local, funciona offline */
export function PublicScreen() {
  const { business } = useAuth()
  const sessions = useActiveSessions(business?.id)
  return <PublicBoard title={business?.name ?? ''} items={sessions.map(({ id, child_name, started_at, expires_at }) => ({ id, child_name, started_at, expires_at }))} />
}
