import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { ESTADOS, formatoFecha, mensajeError } from '../utils.js'

const pesos = (n) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const fechaLocal = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10) }

export default function Reportes() {
  const hoy = fechaLocal(new Date())
  const inicioMes = `${hoy.slice(0, 8)}01`
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoy)
  const [ordenes, setOrdenes] = useState([])
  const [repuestos, setRepuestos] = useState([])
  const [pagosPeriodo, setPagosPeriodo] = useState([])
  const [finales, setFinales] = useState({})
  const [guardandoFinal, setGuardandoFinal] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    const desdeIso = new Date(`${desde}T00:00:00`).toISOString()
    const hastaIso = new Date(`${hasta}T23:59:59.999`).toISOString()
    const [o, r, p] = await Promise.all([
      supabase.from('ordenes_trabajo').select('id, numero, estado, fecha_ingreso, fecha_termino, motivo, vehiculos(patente), clientes(nombre), presupuestos(total, mano_obra, costo_repuestos, descuento, costo_final), pagos(monto)').gte('fecha_ingreso', desdeIso).lte('fecha_ingreso', hastaIso).order('fecha_ingreso', { ascending: false }).limit(1000),
      supabase.from('orden_repuestos').select('orden_id, cantidad, precio_unitario, created_at, repuestos(nombre)').gte('created_at', desdeIso).lte('created_at', hastaIso),
      supabase.from('pagos').select('monto, created_at, orden_id').gte('created_at', desdeIso).lte('created_at', hastaIso)
    ])
    if (o.error) setError(mensajeError(o.error))
    else {
      setOrdenes(o.data || [])
      setFinales(Object.fromEntries((o.data || []).map((orden) => { const p = Array.isArray(orden.presupuestos) ? orden.presupuestos[0] : orden.presupuestos; return [orden.id, p?.costo_final == null ? '' : String(p.costo_final)] })))
    }
    if (r.error) setError((prev) => prev || mensajeError(r.error))
    else setRepuestos(r.data || [])
    if (p.error) setError((prev) => prev || mensajeError(p.error))
    else setPagosPeriodo(p.data || [])
    setCargando(false)
  }, [desde, hasta])
  useEffect(() => { if (desde && hasta && desde <= hasta) cargar(); else { setCargando(false); setError('La fecha inicial no puede ser posterior a la fecha final.') } }, [cargar, desde, hasta])

  const datos = useMemo(() => {
    const pagado = pagosPeriodo.reduce((s, p) => s + Number(p.monto), 0)
    const gastosRepuestos = repuestos.reduce((s, d) => s + Number(d.cantidad) * Number(d.precio_unitario || 0), 0)
    const saldo = ordenes.reduce((s, o) => {
      const p = Array.isArray(o.presupuestos) ? o.presupuestos[0] : o.presupuestos
      const abonado = (o.pagos || []).reduce((a, x) => a + Number(x.monto), 0)
      return s + (p ? Math.max(0, Number(p.total) - abonado) : 0)
    }, 0)
    const motivos = new Map()
    ordenes.forEach((o) => { const m = (o.motivo || 'Sin motivo especificado').trim(); motivos.set(m, (motivos.get(m) || 0) + 1) })
    const frecuentes = [...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const presupuestado = ordenes.reduce((s, o) => { const p = Array.isArray(o.presupuestos) ? o.presupuestos[0] : o.presupuestos; return s + Number(p?.total || 0) }, 0)
    const terminadas = ordenes.filter((o) => o.estado === 'entregado').length
    return { pagado, gastosRepuestos, saldo, frecuentes, presupuestado, terminadas }
  }, [ordenes, pagosPeriodo, repuestos])

  const guardarCostoFinal = async (orden) => {
    const valor = finales[orden.id] === '' ? null : Number(finales[orden.id])
    if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0)) return setError('El costo final debe ser un número entero mayor o igual que cero.')
    const presupuesto = Array.isArray(orden.presupuestos) ? orden.presupuestos[0] : orden.presupuestos
    if (!presupuesto) return setError('Primero debe existir un presupuesto para registrar el costo final.')
    setGuardandoFinal(orden.id); setError('')
    const { error: err } = await supabase.from('presupuestos').update({ costo_final: valor }).eq('orden_id', orden.id)
    setGuardandoFinal('')
    if (err) setError(mensajeError(err))
  }

  const gastoPorRepuesto = useMemo(() => {
    const m = new Map()
    repuestos.forEach((d) => { const nombre = d.repuestos?.nombre || 'Repuesto'; m.set(nombre, (m.get(nombre) || 0) + Number(d.cantidad) * Number(d.precio_unitario || 0)) })
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [repuestos])

  return <>
    <h1>Reportes y estadísticas</h1>
    <p className="sub">Órdenes según fecha de ingreso; ingresos y gastos según la fecha en que se registró cada pago o repuesto.</p>
    <section className="panel">
      <div className="form-grid">
        <div><label htmlFor="desde">Desde</label><input id="desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><label htmlFor="hasta">Hasta</label><input id="hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></div>
      </div>
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    {cargando ? <p className="cargando">Calculando reportes…</p> : <>
      <div className="metricas">
        <section className="metrica"><span>Órdenes ingresadas</span><strong>{ordenes.length}</strong></section>
        <section className="metrica"><span>Vehículos entregados</span><strong>{datos.terminadas}</strong></section>
        <section className="metrica"><span>Ingresos registrados</span><strong>{pesos(datos.pagado)}</strong></section>
        <section className="metrica"><span>Gastos en repuestos</span><strong>{pesos(datos.gastosRepuestos)}</strong></section>
        <section className="metrica"><span>Pagos pendientes</span><strong>{pesos(datos.saldo)}</strong></section>
        <section className="metrica"><span>Total presupuestado en órdenes</span><strong>{pesos(datos.presupuestado)}</strong></section>
      </div>
      <div className="reportes-grid">
        <section className="panel"><h2>Reparaciones frecuentes</h2><div className="tabla-scroll"><table><thead><tr><th>Motivo de ingreso</th><th>Cantidad</th></tr></thead><tbody>
          {datos.frecuentes.length ? datos.frecuentes.map(([m, n]) => <tr key={m}><td>{m}</td><td>{n}</td></tr>) : <tr><td colSpan="2" className="vacio">Sin datos para el período.</td></tr>}
        </tbody></table></div></section>
        <section className="panel"><h2>Gastos por repuesto</h2><div className="tabla-scroll"><table><thead><tr><th>Repuesto</th><th>Gasto</th></tr></thead><tbody>
          {gastoPorRepuesto.length ? gastoPorRepuesto.map(([n, v]) => <tr key={n}><td>{n}</td><td>{pesos(v)}</td></tr>) : <tr><td colSpan="2" className="vacio">Sin repuestos registrados.</td></tr>}
        </tbody></table></div></section>
      </div>
      <section className="panel"><h2>Detalle de órdenes y costos</h2><p className="nota">El presupuesto representa el costo estimado. El costo final se registra una vez terminada la reparación.</p><div className="tabla-scroll"><table><thead><tr><th>Orden</th><th>Vehículo</th><th>Estado</th><th>Costo estimado</th><th>Costo final registrado</th><th>Acción</th></tr></thead><tbody>
        {ordenes.length ? ordenes.map((o) => { const p = Array.isArray(o.presupuestos) ? o.presupuestos[0] : o.presupuestos; return <tr key={o.id}><td><Link to={`/ordenes/${o.id}`}>#{o.numero}</Link><div className="nota">{o.clientes?.nombre || '—'}</div></td><td>{o.vehiculos?.patente || '—'}</td><td>{ESTADOS[o.estado]}</td><td>{p ? pesos(p.total) : 'Sin presupuesto'}</td><td>{p && o.fecha_termino ? <input aria-label={`Costo final orden ${o.numero}`} type="number" min="0" step="1" value={finales[o.id] ?? ''} placeholder="Pendiente" onChange={(e) => setFinales((prev) => ({ ...prev, [o.id]: e.target.value }))} /> : p ? 'Pendiente de término' : '—'}</td><td>{p && o.fecha_termino && <button className="btn btn-primario btn-chico" disabled={guardandoFinal === o.id} onClick={() => guardarCostoFinal(o)}>{guardandoFinal === o.id ? 'Guardando…' : 'Guardar'}</button>}</td></tr> }) : <tr><td colSpan="6" className="vacio">No hay órdenes en el período seleccionado.</td></tr>}
      </tbody></table></div></section>
      <p className="nota">Los ingresos corresponden a pagos efectivamente registrados y los gastos en repuestos al valor de las piezas asociadas a las órdenes. El costo final es un dato que debe registrar el usuario cuando termina la reparación; no se infiere automáticamente del presupuesto.</p>
    </>}
  </>
}
