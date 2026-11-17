import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import Estado from '../components/Estado.jsx'
import { useCambiosOrdenes } from '../hooks/useCambiosOrdenes.js'
import { ESTADOS, formatoFecha, mensajeError } from '../utils.js'

// RF-13, RF-16, RF-17: listado de órdenes con vista general por estado.
// El mecánico solo recibe sus órdenes asignadas (lo filtra la base de datos).
export default function Ordenes() {
  const { rol } = useAuth()
  const navegar = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('ordenes_trabajo')
      .select('id, numero, estado, fecha_ingreso, motivo, vehiculos(patente, marca, modelo), clientes(nombre), mecanico:perfiles!mecanico_id(nombre)')
      .order('fecha_ingreso', { ascending: false })
      .limit(500)
    if (err) setError(mensajeError(err))
    else { setOrdenes(data); setError('') }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useCambiosOrdenes(cargar)

  const conteo = useMemo(() => {
    const c = { todas: ordenes.length }
    Object.keys(ESTADOS).forEach((e) => { c[e] = ordenes.filter((o) => o.estado === e).length })
    return c
  }, [ordenes])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ordenes.filter((o) => {
      if (estado !== 'todas' && o.estado !== estado) return false
      if (!q) return true
      return [String(o.numero), o.vehiculos?.patente, o.vehiculos?.marca, o.vehiculos?.modelo, o.clientes?.nombre]
        .some((t) => (t ?? '').toLowerCase().includes(q))
    })
  }, [ordenes, estado, busqueda])

  if (cargando) return <p className="cargando">Cargando…</p>

  return (
    <>
      <h1>{rol === 'mecanico' ? 'Mis trabajos' : 'Órdenes de trabajo'}</h1>
      <p className="sub">Los cambios de estado se actualizan solos en pocos segundos.</p>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="herramientas">
        <input type="search" placeholder="Buscar por N°, patente, vehículo o cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar orden" />
        {['dueno', 'recepcion'].includes(rol) && <Link className="btn btn-primario enlace-btn" to="/ordenes/nueva">Nueva orden</Link>}
      </div>

      <div className="filtros" role="tablist" aria-label="Filtrar por estado">
        {[['todas', 'Todas'], ...Object.entries(ESTADOS)].map(([valor, texto]) => (
          <button key={valor} role="tab" aria-selected={estado === valor} className={`filtro ${estado === valor ? 'activo' : ''}`} onClick={() => setEstado(valor)}>
            {texto} <span className="contador">{conteo[valor]}</span>
          </button>
        ))}
      </div>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr><th>N°</th><th>Vehículo</th><th>Cliente</th><th>Estado</th><th>Mecánico</th><th>Ingreso</th></tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={6} className="vacio">No hay órdenes que mostrar.</td></tr>}
            {visibles.map((o) => (
              <tr key={o.id} className="fila-link" onClick={() => navegar(`/ordenes/${o.id}`)}>
                <td><Link to={`/ordenes/${o.id}`} onClick={(e) => e.stopPropagation()}><strong>#{o.numero}</strong></Link></td>
                <td>{o.vehiculos ? `${o.vehiculos.patente} · ${o.vehiculos.marca} ${o.vehiculos.modelo}` : '—'}</td>
                <td>{o.clientes?.nombre ?? '—'}</td>
                <td><Estado valor={o.estado} /></td>
                <td>{o.mecanico?.nombre ?? 'Sin asignar'}</td>
                <td>{formatoFecha(o.fecha_ingreso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
