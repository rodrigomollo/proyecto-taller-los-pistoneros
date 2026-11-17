import { useAuth } from '../context/AuthContext.jsx'

export default function SinRol() {
  const { perfil, cerrarSesion } = useAuth()
  return (
    <div className="login">
      <div className="tarjeta">
        <h1>Cuenta pendiente</h1>
        <p>
          Hola, {perfil.nombre}. Tu cuenta aún no tiene un perfil asignado. Pide al dueño del taller que te asigne uno y
          vuelve a ingresar.
        </p>
        <button className="btn btn-primario" onClick={() => cerrarSesion()}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
