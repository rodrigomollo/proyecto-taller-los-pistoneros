import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { emailValido, mensajeError, normalizarTelefono, telefonoValido } from '../utils.js'

const VACIO = { nombre: '', telefono: '', email: '', direccion: '' }

// CU-01 y RF-01 a RF-03: registrar, buscar y modificar clientes.
export default function Clientes() {
  const { rol } = useAuth()
  const puedeEditar = ['dueno', 'recepcion'].includes(rol)
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const [existente, setExistente] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('clientes').select('*').order('nombre')
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else setClientes(data)
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q))
  }, [clientes, busqueda])

  const abrirNuevo = () => {
    setForm(VACIO)
    setEditandoId(null)
    setErrores({})
    setExistente(null)
    setMensaje({ tipo: '', texto: '' })
  }

  const abrirEdicion = (c) => {
    setForm({ nombre: c.nombre, telefono: c.telefono, email: c.email ?? '', direccion: c.direccion ?? '' })
    setEditandoId(c.id)
    setErrores({})
    setExistente(null)
    setMensaje({ tipo: '', texto: '' })
  }

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    const nuevos = {}
    if (!form.nombre.trim()) nuevos.nombre = 'Ingresa el nombre del cliente.'
    if (!form.telefono.trim()) nuevos.telefono = 'Ingresa el teléfono.'
    else if (!telefonoValido(form.telefono)) nuevos.telefono = 'Teléfono no válido. Usa solo números (8 a 12 dígitos).'
    if (form.email.trim() && !emailValido(form.email.trim())) nuevos.email = 'Correo no válido.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    setGuardando(true)
    setExistente(null)
    const datos = {
      nombre: form.nombre.trim(),
      telefono: normalizarTelefono(form.telefono),
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
    }
    const { error } = editandoId
      ? await supabase.from('clientes').update(datos).eq('id', editandoId)
      : await supabase.from('clientes').insert(datos)
    setGuardando(false)

    if (error) {
      if (error.code === '23505') {
        // CU-01, flujo alternativo 2: el teléfono ya está registrado.
        const { data } = await supabase.from('clientes').select('*').eq('telefono', datos.telefono).maybeSingle()
        setExistente(data)
      } else {
        setMensaje({ tipo: 'error', texto: mensajeError(error) })
      }
      return
    }
    setMensaje({ tipo: 'ok', texto: editandoId ? 'Cliente actualizado.' : 'Cliente registrado correctamente.' })
    setForm(null)
    setEditandoId(null)
    cargar()
  }

  if (cargando) return <p className="cargando">Cargando…</p>

  return (
    <>
      <h1>Clientes</h1>
      <p className="sub">Datos de contacto de los clientes del taller.</p>
      {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">{mensaje.texto}</p>}

      <div className="herramientas">
        <input type="search" placeholder="Buscar por nombre o teléfono" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar cliente" />
        {puedeEditar && !form && <button className="btn btn-primario" onClick={abrirNuevo}>Nuevo cliente</button>}
      </div>

      {form && (
        <form className="panel" onSubmit={guardar} noValidate>
          <h2>{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <div className="form-grid">
            <div>
              <label htmlFor="nombre">Nombre *</label>
              <input id="nombre" type="text" value={form.nombre} onChange={cambiar('nombre')} />
              {errores.nombre && <p className="campo-error">{errores.nombre}</p>}
            </div>
            <div>
              <label htmlFor="telefono">Teléfono *</label>
              <input id="telefono" type="tel" inputMode="tel" placeholder="+56912345678" value={form.telefono} onChange={cambiar('telefono')} />
              {errores.telefono && <p className="campo-error">{errores.telefono}</p>}
            </div>
            <div>
              <label htmlFor="email">Correo</label>
              <input id="email" type="email" value={form.email} onChange={cambiar('email')} />
              {errores.email && <p className="campo-error">{errores.email}</p>}
            </div>
            <div>
              <label htmlFor="direccion">Dirección</label>
              <input id="direccion" type="text" value={form.direccion} onChange={cambiar('direccion')} />
            </div>
          </div>

          {existente && (
            <div className="aviso" role="alert">
              <strong>Ese teléfono ya está registrado.</strong>
              <p>{existente.nombre} · {existente.telefono}{existente.email ? ` · ${existente.email}` : ''}</p>
              <button type="button" className="btn btn-claro" onClick={() => abrirEdicion(existente)}>Editar ese cliente</button>
            </div>
          )}

          <div className="acciones">
            <button className="btn btn-primario" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button className="btn btn-secundario" type="button" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Teléfono</th><th>Correo</th>{puedeEditar && <th>Acciones</th>}</tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={4} className="vacio">No hay clientes que mostrar.</td></tr>}
            {visibles.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.telefono}</td>
                <td>{c.email ?? '—'}</td>
                {puedeEditar && <td><button className="btn btn-secundario btn-chico" onClick={() => abrirEdicion(c)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
