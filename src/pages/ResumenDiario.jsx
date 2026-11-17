import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import Estado from '../components/Estado.jsx'
import { ESTADOS, formatoFecha, mensajeError } from '../utils.js'
import { useCambiosOrdenes } from '../hooks/useCambiosOrdenes.js'

const ESTADOS_RESUMEN = ['pendiente_diagnostico', 'en_reparacion', 'esperando_repuestos', 'listo_para_entregar']

export default function ResumenDiario() {
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase.from('ordenes_trabajo')
      .select('id, numero, estado, fecha_ingreso, motivo, vehiculos(patente, marca, modelo), clientes(nombre)')
      .order('fecha_ingreso', { ascending: true }).limit(1000)
    if (err) setError(mensajeError(err))
    else { setOrdenes(data || []); setError('') }
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useCambiosOrdenes(cargar)

  if (cargando) return <p className="cargando">Cargando resumen diario…</p>
  const conteos = Object.fromEntries(ESTADOS_RESUMEN.map((e) => [e, ordenes.filter((o) => o.estado === e).length]))
  const activas = ordenes.filter((o) => ESTADOS_RESUMEN.includes(o.estado))
  return <>
    <h1>Resumen diario del taller</h1>
    <p className="sub">Vista general de las órdenes de trabajo y su estado actual. Se actualiza cuando cambian las órdenes.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="metricas">
      {ESTADOS_RESUMEN.map((e) => <section className="metrica" key={e}><span>{ESTADOS[e]}</span><strong>{conteos[e]}</strong></section>)}
      <section className="metrica"><span>Entregados</span><strong>{ordenes.filter((o) => o.estado === 'entregado').length}</strong></section>
    </div>
    <section className="panel">
      <div className="encabezado-panel"><h2>Vehículos que requieren seguimiento</h2><Link to="/ordenes">Ver todas las órdenes</Link></div>
      <div className="tabla-scroll"><table><thead><tr><th>Orden</th><th>Vehículo</th><th>Cliente</th><th>Estado</th><th>Ingreso</th></tr></thead>
        <tbody>{activas.length === 0 ? <tr><td colSpan="5" className="vacio">No hay vehículos pendientes de atención.</td></tr> : activas.map((o) => <tr key={o.id}>
          <td><Link to={`/ordenes/${o.id}`}>#{o.numero}</Link></td><td>{o.vehiculos?.patente} · {o.vehiculos?.marca} {o.vehiculos?.modelo}</td><td>{o.clientes?.nombre}</td><td><Estado valor={o.estado} /></td><td>{formatoFecha(o.fecha_ingreso)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>
}
