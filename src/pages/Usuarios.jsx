import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ROLES } from '../roles.js'

// Pantalla del dueño: asigna el perfil de cada persona y activa o desactiva cuentas (RNF-04).
export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo, created_at')
      .order('created_at')
    if (error) setMensaje({ tipo: 'error', texto: 'No se pudo cargar la lista de usuarios.' })
    else setUsuarios(data)
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const actualizar = async (usuario, cambios) => {
    setMensaje({ tipo: '', texto: '' })
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', usuario.id)
    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el cambio.' })
      return
    }
    setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, ...cambios } : u)))
    setMensaje({ tipo: 'ok', texto: `Cambio guardado para ${usuario.nombre}.` })
  }

  if (cargando) return <p className="cargando">Cargando…</p>

  return (
    <>
      <h1>Usuarios</h1>
      <p className="sub">
        Las cuentas se crean en Supabase (Authentication, Users). Aquí asignas el perfil de cada persona.
      </p>
      {mensaje.texto && (
        <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">
          {mensaje.texto}
        </p>
      )}
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Perfil</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const esYo = u.id === perfil.id
              return (
                <tr key={u.id}>
                  <td>
                    {u.nombre} {esYo && <span className="insignia">tú</span>}
                  </td>
                  <td>
                    <select
                      value={u.rol}
                      disabled={esYo}
                      onChange={(e) => actualizar(u, { rol: e.target.value })}
                      aria-label={`Perfil de ${u.nombre}`}
                    >
                      {Object.entries(ROLES).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.activo}
                      disabled={esYo}
                      onChange={(e) => actualizar(u, { activo: e.target.checked })}
                      aria-label={`Cuenta activa de ${u.nombre}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
