import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { mensajeError, normalizarPatente, patenteValida } from '../utils.js'

const VACIO = { cliente_id: '', patente: '', marca: '', modelo: '', anio: '', kilometraje: '' }

// CU-02 y RF-04 a RF-06: registrar vehículos y asociarlos a su cliente.
export default function Vehiculos() {
  const { rol } = useAuth()
  const navegar = useNavigate()
  const puedeEditar = ['dueno', 'recepcion'].includes(rol)
  const [vehiculos, setVehiculos] = useState([])
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [form, setForm] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const [existente, setExistente] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const [v, c] = await Promise.all([
      supabase.from('vehiculos').select('*, clientes(nombre, telefono)').order('patente'),
      supabase.from('clientes').select('id, nombre, telefono').order('nombre'),
    ])
    if (v.error) setMensaje({ tipo: 'error', texto: mensajeError(v.error) })
    else setVehiculos(v.data)
    if (!c.error) setClientes(c.data)
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return vehiculos
    return vehiculos.filter((v) =>
      [v.patente, v.marca, v.modelo, v.clientes?.nombre ?? ''].some((t) => t.toLowerCase().includes(q))
    )
  }, [vehiculos, busqueda])

  const clientesFiltrados = useMemo(() => {
    const q = filtroCliente.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q))
  }, [clientes, filtroCliente])

  const abrirNuevo = () => {
    setForm(VACIO); setEditandoId(null); setErrores({}); setExistente(null); setFiltroCliente('')
    setMensaje({ tipo: '', texto: '' })
  }

  const abrirEdicion = (v) => {
    setForm({ cliente_id: v.cliente_id, patente: v.patente, marca: v.marca, modelo: v.modelo, anio: v.anio ?? '', kilometraje: v.kilometraje ?? '' })
    setEditandoId(v.id); setErrores({}); setExistente(null); setFiltroCliente('')
    setMensaje({ tipo: '', texto: '' })
  }

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    const nuevos = {}
    const anioMax = new Date().getFullYear() + 1
    if (!form.cliente_id) nuevos.cliente_id = 'Selecciona el cliente del vehículo.'
    if (!form.patente.trim()) nuevos.patente = 'Ingresa la patente.'
    else if (!patenteValida(form.patente)) nuevos.patente = 'Patente no válida (5 a 7 letras o números).'
    if (!form.marca.trim()) nuevos.marca = 'Ingresa la marca.'
    if (!form.modelo.trim()) nuevos.modelo = 'Ingresa el modelo.'
    if (form.anio !== '' && (!Number.isInteger(Number(form.anio)) || form.anio < 1950 || form.anio > anioMax))
      nuevos.anio = `El año debe estar entre 1950 y ${anioMax}.`
    if (form.kilometraje !== '' && (!Number.isInteger(Number(form.kilometraje)) || form.kilometraje < 0))
      nuevos.kilometraje = 'El kilometraje debe ser un número entero positivo.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    setGuardando(true)
    setExistente(null)
    const datos = {
      cliente_id: form.cliente_id,
      patente: normalizarPatente(form.patente),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      anio: form.anio === '' ? null : Number(form.anio),
      kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje),
    }
    const { error } = editandoId
      ? await supabase.from('vehiculos').update(datos).eq('id', editandoId)
      : await supabase.from('vehiculos').insert(datos)
    setGuardando(false)

    if (error) {
      if (error.code === '23505') {
        // CU-02, flujo alternativo 2: la patente ya existe.
        const { data } = await supabase.from('vehiculos').select('*, clientes(nombre)').eq('patente', datos.patente).maybeSingle()
        setExistente(data)
      } else {
        setMensaje({ tipo: 'error', texto: mensajeError(error) })
      }
      return
    }
    setMensaje({ tipo: 'ok', texto: editandoId ? 'Vehículo actualizado.' : 'Vehículo registrado correctamente.' })
    setForm(null); setEditandoId(null)
    cargar()
  }

  if (cargando) return <p className="cargando">Cargando…</p>

  return (
    <>
      <h1>Vehículos</h1>
      <p className="sub">Cada vehículo queda asociado a su cliente.</p>
      {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">{mensaje.texto}</p>}

      <div className="herramientas">
        <input type="search" placeholder="Buscar por patente, marca, modelo o cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar vehículo" />
        {puedeEditar && !form && <button className="btn btn-primario" onClick={abrirNuevo}>Nuevo vehículo</button>}
      </div>

      {form && (
        <form className="panel" onSubmit={guardar} noValidate>
          <h2>{editandoId ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
          <label htmlFor="filtro">Cliente *</label>
          <input id="filtro" type="search" placeholder="Escribe para buscar al cliente" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} />
          <select value={form.cliente_id} onChange={cambiar('cliente_id')} aria-label="Cliente del vehículo" className="separado">
            <option value="">Selecciona un cliente…</option>
            {clientesFiltrados.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.telefono}</option>)}
          </select>
          {clientesFiltrados.length === 0 && (
            <p className="campo-error">El cliente no está registrado. <Link to="/clientes">Regístralo en Clientes</Link>.</p>
          )}
          {errores.cliente_id && <p className="campo-error">{errores.cliente_id}</p>}

          <div className="form-grid">
            <div>
              <label htmlFor="patente">Patente *</label>
              <input id="patente" type="text" placeholder="ABCD12" value={form.patente} onChange={cambiar('patente')} />
              {errores.patente && <p className="campo-error">{errores.patente}</p>}
            </div>
            <div>
              <label htmlFor="marca">Marca *</label>
              <input id="marca" type="text" value={form.marca} onChange={cambiar('marca')} />
              {errores.marca && <p className="campo-error">{errores.marca}</p>}
            </div>
            <div>
              <label htmlFor="modelo">Modelo *</label>
              <input id="modelo" type="text" value={form.modelo} onChange={cambiar('modelo')} />
              {errores.modelo && <p className="campo-error">{errores.modelo}</p>}
            </div>
            <div>
              <label htmlFor="anio">Año</label>
              <input id="anio" type="number" inputMode="numeric" value={form.anio} onChange={cambiar('anio')} />
              {errores.anio && <p className="campo-error">{errores.anio}</p>}
            </div>
            <div>
              <label htmlFor="km">Kilometraje</label>
              <input id="km" type="number" inputMode="numeric" value={form.kilometraje} onChange={cambiar('kilometraje')} />
              {errores.kilometraje && <p className="campo-error">{errores.kilometraje}</p>}
            </div>
          </div>

          {existente && (
            <div className="aviso" role="alert">
              <strong>Esa patente ya está registrada.</strong>
              <p>{existente.patente} · {existente.marca} {existente.modelo} · Cliente: {existente.clientes?.nombre ?? '—'}</p>
              <button type="button" className="btn btn-claro" onClick={() => abrirEdicion(existente)}>Editar ese vehículo</button>
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
            <tr><th>Patente</th><th>Vehículo</th><th>Km</th><th>Cliente</th>{puedeEditar && <th>Acciones</th>}</tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={5} className="vacio">No hay vehículos que mostrar.</td></tr>}
            {visibles.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.patente}</strong></td>
                <td>{v.marca} {v.modelo}{v.anio ? ` (${v.anio})` : ''}</td>
                <td>{v.kilometraje != null ? v.kilometraje.toLocaleString('es-CL') : '—'}</td>
                <td>{v.clientes?.nombre ?? '—'}</td>
                {puedeEditar && (
                  <td className="celda-acciones">
                    <button className="btn btn-secundario btn-chico" onClick={() => abrirEdicion(v)}>Editar</button>
                    <button className="btn btn-primario btn-chico" onClick={() => navegar(`/ordenes/nueva?vehiculo=${v.id}`)}>Nueva orden</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
