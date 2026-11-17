import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Protege una pantalla: exige sesión y, opcionalmente, uno de los roles indicados.
// Es una ayuda de navegación; los permisos reales los aplica RLS en la base de datos.
export default function ProtectedRoute({ roles, children }) {
  const { session, perfil, cargando } = useAuth()

  if (cargando || (session && !perfil)) return <p className="cargando">Cargando…</p>
  if (!session) return <Navigate to="/login" replace />
  if (roles && !roles.includes(perfil.rol)) return <Navigate to="/" replace />
  return children
}
