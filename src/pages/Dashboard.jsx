import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES, modulosDe, nombreModulo } from '../roles.js'

const DESCRIPCION = {
  dueno: 'Supervisas órdenes, revisas el resumen diario, reportes y administras a los usuarios.',
  recepcion: 'Registras clientes y vehículos, creas órdenes, preparas presupuestos y gestionas avisos a los clientes.',
  mecanico: 'Consultas tus trabajos asignados, registras diagnósticos, avances y repuestos utilizados.',
  administracion: 'Registras pagos, controlas saldos y consultas la información financiera.',
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const accesos = modulosDe(perfil.rol).filter((m) => m.ruta !== '/')

  return (
    <>
      <h1>Hola, {perfil.nombre}</h1>
      <p className="sub">
        Perfil: <strong>{ROLES[perfil.rol]}</strong>. {DESCRIPCION[perfil.rol]}
      </p>
      <div className="accesos">
        {accesos.map((m) => (
          <Link key={m.ruta} to={m.ruta} className="acceso">
            {nombreModulo(m, perfil.rol)}
          </Link>
        ))}
      </div>
    </>
  )
}
