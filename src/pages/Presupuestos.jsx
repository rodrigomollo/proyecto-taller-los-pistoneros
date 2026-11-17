import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { formatoFecha, mensajeError } from '../utils.js'

const pesos = (n) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const totalRepuestos = (detalles = []) => detalles.reduce((s, d) => s + Number(d.cantidad) * Number(d.precio_unitario || 0), 0)

export default function Presupuestos() {
  const { rol } = useAuth()
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState('')
  const [formularios, setFormularios] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const puedeEditar = ['dueno', 'recepcion', 'administracion'].includes(rol)

  const cargar = useCallback(async () => {
    const [o, d] = await Promise.all([
      supabase.from('ordenes_trabajo').select('id, numero, estado, fecha_ingreso, vehiculos(patente, marca, modelo), clientes(nombre), presupuestos(id, mano_obra, costo_repuestos, descuento, total, created_at)').order('fecha_ingreso', { ascending: false }).limit(500),
      supabase.from('orden_repuestos').select('orden_id, cantidad, precio_unitario')
    ])
    if (o.error) setMensaje({ tipo: 'error', texto: mensajeError(o.error) })
    else {
      const detalles = d.error ? [] : d.data || []
      const enriquecidas = (o.data || []).map((orden) => {
        const costoCalculado = totalRepuestos(detalles.filter((x) => x.orden_id === orden.id))
        const presupuesto = Array.isArray(orden.presupuestos) ? (orden.presupuestos[0] || null) : (orden.presupuestos || null)
        return { ...orden, costoCalculado, presupuesto }
      })
      setOrdenes(enriquecidas)
      setFormularios(Object.fromEntries(enriquecidas.map((o) => [o.id, {
        mano_obra: String(o.presupuesto?.mano_obra ?? 0),
        descuento: String(o.presupuesto?.descuento ?? 0),
      }])))
    }
    if (d.error) setMensaje({ tipo: 'error', texto: mensajeError(d.error) })
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ordenes.filter((o) => !q || [String(o.numero), o.vehiculos?.patente, o.vehiculos?.marca, o.vehiculos?.modelo, o.clientes?.nombre].some((x) => (x || '').toLowerCase().includes(q)))
  }, [ordenes, busqueda])

  const cambiar = (id, campo, valor) => setFormularios((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))

  const guardar = async (orden) => {
    setMensaje({ tipo: '', texto: '' })
    const f = formularios[orden.id] || {}
    const mano = Number(f.mano_obra), descuento = Number(f.descuento)
    const repuestos = orden.costoCalculado
    if (![mano, descuento].every(Number.isSafeInteger) || mano < 0 || descuento < 0)
      return setMensaje({ tipo: 'error', texto: 'La mano de obra y el descuento deben ser números enteros iguales o mayores que cero.' })
    if (descuento > mano + repuestos)
      return setMensaje({ tipo: 'error', texto: 'El descuento no puede superar el subtotal del presupuesto.' })
    setGuardando(orden.id)
    const valores = { orden_id: orden.id, mano_obra: mano, costo_repuestos: repuestos, descuento }
    const { error } = await supabase.from('presupuestos').upsert(valores, { onConflict: 'orden_id' })
    setGuardando('')
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else { setMensaje({ tipo: 'ok', texto: `Presupuesto de la orden #${orden.numero} guardado.` }); cargar() }
  }

  if (cargando) return <p className="cargando">Cargando presupuestos…</p>

  return <>
    <h1>Presupuestos</h1>
    <p className="sub">Los costos de repuestos se calculan desde los repuestos registrados en cada orden de trabajo.</p>
    {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">{mensaje.texto}</p>}
    <div className="herramientas"><input type="search" placeholder="Buscar por orden, patente o cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar presupuesto" /></div>
    {visibles.length === 0 && <section className="panel vacio">No hay órdenes registradas.</section>}
    {visibles.map((o) => {
      const f = formularios[o.id] || { mano_obra: '0', descuento: '0' }
      const mano = Number(f.mano_obra) || 0
      const descuento = Number(f.descuento) || 0
      const total = mano + o.costoCalculado - descuento
      return <section className="panel" key={o.id}>
        <div className="encabezado-panel">
          <div><h2>Orden #{o.numero}</h2><p className="nota">{o.vehiculos?.patente || 'Sin patente'} · {o.clientes?.nombre || 'Cliente'} · Ingreso: {formatoFecha(o.fecha_ingreso)}</p></div>
          <Link to={`/ordenes/${o.id}`}>Ver orden</Link>
        </div>
        <div className="form-grid">
          <div><label htmlFor={`mano-${o.id}`}>Mano de obra (CLP)</label><input id={`mano-${o.id}`} type="number" min="0" step="1" value={f.mano_obra} disabled={!puedeEditar} onChange={(e) => cambiar(o.id, 'mano_obra', e.target.value)} /></div>
          <div><label htmlFor={`repuestos-${o.id}`}>Repuestos utilizados (CLP)</label><input id={`repuestos-${o.id}`} type="text" value={pesos(o.costoCalculado)} disabled readOnly /></div>
          <div><label htmlFor={`descuento-${o.id}`}>Descuento (CLP)</label><input id={`descuento-${o.id}`} type="number" min="0" step="1" value={f.descuento} disabled={!puedeEditar} onChange={(e) => cambiar(o.id, 'descuento', e.target.value)} /></div>
        </div>
        <div className="resumen presupuesto-total"><p>Subtotal: <strong>{pesos(mano + o.costoCalculado)}</strong></p><p>Descuento: <strong>{pesos(descuento)}</strong></p><p className="total-final">Total del presupuesto: <strong>{pesos(total)}</strong></p></div>
        {o.presupuesto && <p className="nota">Última actualización: {formatoFecha(o.presupuesto.created_at)}</p>}
        {puedeEditar && <div className="acciones"><button className="btn btn-primario" disabled={guardando === o.id || total < 0 || descuento > mano + o.costoCalculado} onClick={() => guardar(o)}>{guardando === o.id ? 'Guardando…' : o.presupuesto ? 'Actualizar presupuesto' : 'Crear presupuesto'}</button></div>}
        {!puedeEditar && <p className="nota">Vista de consulta.</p>}
      </section>
    })}
  </>
}
