import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES, modulosDe, nombreModulo } from '../roles.js'

export default function Layout() {
  const { perfil, cerrarSesion } = useAuth()
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="app">
      <header className="barra">
        <button className="btn-menu" onClick={() => setAbierto(!abierto)} aria-label="Abrir menú" aria-expanded={abierto}>
          ☰
        </button>
        <strong className="marca">Los Pistoneros</strong>
        <div className="usuario">
          <span className="usuario-nombre">{perfil.nombre}</span>
          <span className="insignia">{ROLES[perfil.rol]}</span>
          <button className="btn btn-claro" onClick={() => cerrarSesion()}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="cuerpo">
        <nav className={`menu ${abierto ? 'abierto' : ''}`} aria-label="Menú principal">
          {modulosDe(perfil.rol).map((m) => (
            <NavLink key={m.ruta} to={m.ruta} end={m.ruta === '/'} onClick={() => setAbierto(false)}>
              {nombreModulo(m, perfil.rol)}
            </NavLink>
          ))}
        </nav>
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
