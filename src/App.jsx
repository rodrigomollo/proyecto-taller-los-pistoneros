import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Clientes from './pages/Clientes.jsx'
import Vehiculos from './pages/Vehiculos.jsx'
import Ordenes from './pages/Ordenes.jsx'
import OrdenNueva from './pages/OrdenNueva.jsx'
import OrdenDetalle from './pages/OrdenDetalle.jsx'
import Repuestos from './pages/Repuestos.jsx'
import Presupuestos from './pages/Presupuestos.jsx'
import Pagos from './pages/Pagos.jsx'
import Reportes from './pages/Reportes.jsx'
import ResumenDiario from './pages/ResumenDiario.jsx'
import Notificaciones from './pages/Notificaciones.jsx'
import SinRol from './pages/SinRol.jsx'
import EnConstruccion from './pages/EnConstruccion.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { MODULOS, nombreModulo } from './roles.js'

// Pantallas ya construidas; el resto de los módulos muestra una pantalla provisoria.
const PAGINAS = {
  '/': Dashboard,
  '/usuarios': Usuarios,
  '/clientes': Clientes,
  '/vehiculos': Vehiculos,
  '/ordenes': Ordenes,
  '/repuestos': Repuestos,
  '/presupuestos': Presupuestos,
  '/pagos': Pagos,
  '/reportes': Reportes,
  '/resumen-diario': ResumenDiario,
  '/notificaciones': Notificaciones,
}
const TODOS = ['dueno', 'recepcion', 'mecanico', 'administracion']

export default function App() {
  const { perfil } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            {perfil?.rol === 'pendiente' ? <SinRol /> : <Layout />}
          </ProtectedRoute>
        }
      >
        {MODULOS.map((m) => {
          const Pagina = PAGINAS[m.ruta]
          return (
            <Route
              key={m.ruta}
              path={m.ruta}
              element={
                <ProtectedRoute roles={m.roles}>
                  {Pagina ? <Pagina /> : <EnConstruccion titulo={nombreModulo(m, perfil?.rol)} />}
                </ProtectedRoute>
              }
            />
          )
        })}
        <Route path="/ordenes/nueva" element={<ProtectedRoute roles={['dueno', 'recepcion']}><OrdenNueva /></ProtectedRoute>} />
        <Route path="/ordenes/:id" element={<ProtectedRoute roles={TODOS}><OrdenDetalle /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
