import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { ahoraLocal, mensajeError } from '../utils.js'

// CU-03 y RF-06 a RF-09: crear una orden de trabajo para un vehículo registrado.
export default function OrdenNueva() {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const [vehiculos, setVehiculos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [vehiculoId, setVehiculoId] = useState(params.get('vehiculo') ?? '')
  const [fecha, setFecha] = useState(ahoraLocal())
  const [motivo, setMotivo] = useState('')
  const [problema, setProblema] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo, anio, kilometraje, cliente_id, clientes(nombre, telefono)')
      .order('patente')
      .then(({ data, error: err }) => {
        if (err) setError(mensajeError(err))
        else setVehiculos(data)
        setCargando(false)
      })
  }, [])

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return vehiculos
    return vehiculos.filter((v) =>
      [v.patente, v.marca, v.modelo, v.clientes?.nombre ?? ''].some((t) => t.toLowerCase().includes(q))
    )
  }, [vehiculos, filtro])

  const vehiculo = vehiculos.find((v) => v.id === vehiculoId)

  const guardar = async (e) => {
    e.preventDefault()
    const nuevos = {}
    if (!vehiculo) nuevos.vehiculo = 'Selecciona el vehículo que ingresa.'
    if (!fecha) nuevos.fecha = 'Indica la fecha de ingreso.'
    if (!motivo.trim()) nuevos.motivo = 'Describe el motivo de ingreso.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    setGuardando(true)
    const { data, error: err } = await supabase
      .from('ordenes_trabajo')
      .insert({
        vehiculo_id: vehiculo.id,
        cliente_id: vehiculo.cliente_id,
        fecha_ingreso: new Date(fecha).toISOString(),
        motivo: motivo.trim(),
        problema_informado: problema.trim() || null,
      })
      .select('id')
      .single()
    setGuardando(false)
    if (err) { setError(mensajeError(err)); return }
    navegar(`/ordenes/${data.id}`, { state: { creada: true } })
  }

  if (cargando) return <p className="cargando">Cargando…</p>

  return (
    <>
      <h1>Nueva orden de trabajo</h1>
      <p className="sub">Registra el ingreso de un vehículo al taller.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <form className="panel" onSubmit={guardar} noValidate>
        <label htmlFor="filtro">Vehículo *</label>
        <input id="filtro" type="search" placeholder="Escribe la patente o el nombre del cliente" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} aria-label="Vehículo que ingresa" className="separado">
          <option value="">Selecciona un vehículo…</option>
          {filtrados.map((v) => <option key={v.id} value={v.id}>{v.patente} · {v.marca} {v.modelo} · {v.clientes?.nombre}</option>)}
        </select>
        {filtrados.length === 0 && (
          <p className="campo-error">No se encontró el vehículo. <Link to="/vehiculos">Regístralo en Vehículos</Link> antes de crear la orden.</p>
        )}
        {errores.vehiculo && <p className="campo-error">{errores.vehiculo}</p>}

        {vehiculo && (
          <div className="resumen">
            <p><strong>{vehiculo.patente}</strong> · {vehiculo.marca} {vehiculo.modelo}{vehiculo.anio ? ` (${vehiculo.anio})` : ''}
              {vehiculo.kilometraje != null ? ` · ${vehiculo.kilometraje.toLocaleString('es-CL')} km` : ''}</p>
            <p>Cliente: <strong>{vehiculo.clientes?.nombre}</strong> · {vehiculo.clientes?.telefono}</p>
          </div>
        )}

        <label htmlFor="fecha">Fecha de ingreso *</label>
        <input id="fecha" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        {errores.fecha && <p className="campo-error">{errores.fecha}</p>}

        <label htmlFor="motivo">Motivo de ingreso *</label>
        <input id="motivo" type="text" placeholder="Ej: mantención de 50.000 km" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {errores.motivo && <p className="campo-error">{errores.motivo}</p>}

        <label htmlFor="problema">Problema informado por el cliente</label>
        <textarea id="problema" rows={3} value={problema} onChange={(e) => setProblema(e.target.value)} />

        <div className="acciones">
          <button className="btn btn-primario" type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear orden'}</button>
          <Link className="btn btn-secundario enlace-btn" to="/ordenes">Cancelar</Link>
        </div>
      </form>
    </>
  )
}
