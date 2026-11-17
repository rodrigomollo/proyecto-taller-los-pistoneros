import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { formatoFecha, mensajeError } from '../utils.js'

const pesos = (n) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export default function Pagos() {
  const [ordenes, setOrdenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState('')
  const [formularios, setFormularios] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('ordenes_trabajo')
      .select('id, numero, fecha_ingreso, estado, vehiculos(patente, marca, modelo), clientes(nombre), presupuestos(total), pagos(id, monto, medio, created_at)')
      .order('fecha_ingreso', { ascending: false }).limit(500)
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else {
      const lista = (data || []).map((o) => {
        const presupuesto = Array.isArray(o.presupuestos) ? (o.presupuestos[0] || null) : (o.presupuestos || null)
        const pagado = (o.pagos || []).reduce((s, p) => s + Number(p.monto), 0)
        return { ...o, presupuesto, pagado, saldo: presupuesto ? Math.max(0, Number(presupuesto.total) - pagado) : null }
      })
      setOrdenes(lista)
      setFormularios(Object.fromEntries(lista.map((o) => [o.id, { monto: String(o.saldo > 0 ? o.saldo : ''), medio: 'Efectivo' }])))
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ordenes.filter((o) => !q || [String(o.numero), o.vehiculos?.patente, o.clientes?.nombre].some((x) => (x || '').toLowerCase().includes(q)))
  }, [ordenes, busqueda])

  const cambiar = (id, campo, valor) => setFormularios((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))

  const registrar = async (orden) => {
    setMensaje({ tipo: '', texto: '' })
    const f = formularios[orden.id] || {}
    const monto = Number(f.monto)
    if (!orden.presupuesto) return setMensaje({ tipo: 'error', texto: `La orden #${orden.numero} todavía no tiene presupuesto.` })
    if (!Number.isSafeInteger(monto) || monto <= 0) return setMensaje({ tipo: 'error', texto: 'El monto debe ser un número entero mayor que cero.' })
    if (monto > orden.saldo) return setMensaje({ tipo: 'error', texto: 'El monto supera el saldo pendiente.' })
    setGuardando(orden.id)
    const { error } = await supabase.from('pagos').insert({ orden_id: orden.id, monto, medio: f.medio })
    setGuardando('')
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else { setMensaje({ tipo: 'ok', texto: `Pago de ${pesos(monto)} registrado para la orden #${orden.numero}.` }); cargar() }
  }

  if (cargando) return <p className="cargando">Cargando pagos…</p>

  return <>
    <h1>Pagos</h1>
    <p className="sub">Registra abonos y consulta el total pagado y el saldo pendiente de cada reparación.</p>
    {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">{mensaje.texto}</p>}
    <div className="herramientas"><input type="search" placeholder="Buscar por orden, patente o cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar pago" /></div>
    {visibles.length === 0 && <section className="panel vacio">No hay órdenes registradas.</section>}
    {visibles.map((o) => {
      const f = formularios[o.id] || { monto: '', medio: 'Efectivo' }
      return <section className="panel" key={o.id}>
        <h2>Orden #{o.numero}</h2>
        <p className="nota">{o.vehiculos?.patente || 'Sin patente'} · {o.clientes?.nombre || 'Cliente'}</p>
        <div className="resumen resumen-pago">
          <p>Presupuesto: <strong>{o.presupuesto ? pesos(o.presupuesto.total) : 'Sin presupuesto'}</strong></p>
          <p>Total pagado: <strong>{pesos(o.pagado)}</strong></p>
          <p className="total-final">Saldo pendiente: <strong>{o.saldo === null ? 'No disponible' : pesos(o.saldo)}</strong></p>
        </div>
        {o.pagos?.length > 0 && <div className="tabla-scroll tabla-pagos"><table>
          <thead><tr><th>Fecha</th><th>Medio</th><th>Monto</th></tr></thead>
          <tbody>{o.pagos.slice().sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).map((p) => <tr key={p.id}><td>{formatoFecha(p.created_at)}</td><td>{p.medio || 'No especificado'}</td><td>{pesos(p.monto)}</td></tr>)}</tbody>
        </table></div>}
        {!o.presupuesto ? <p className="aviso">Primero debes crear el presupuesto de esta orden.</p> : o.saldo <= 0 ? <p className="exito">El presupuesto está completamente pagado.</p> : <form onSubmit={(e) => { e.preventDefault(); registrar(o) }}>
          <div className="form-grid">
            <div><label htmlFor={`monto-${o.id}`}>Monto del pago (CLP)</label><input id={`monto-${o.id}`} type="number" min="1" max={o.saldo} step="1" value={f.monto} onChange={(e) => cambiar(o.id, 'monto', e.target.value)} required /></div>
            <div><label htmlFor={`medio-${o.id}`}>Medio de pago</label><select id={`medio-${o.id}`} value={f.medio} onChange={(e) => cambiar(o.id, 'medio', e.target.value)}><option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Crédito</option><option>Otro</option></select></div>
          </div>
          <div className="acciones"><button className="btn btn-primario" type="submit" disabled={guardando === o.id}>{guardando === o.id ? 'Registrando…' : 'Registrar pago'}</button></div>
        </form>}
      </section>
    })}
  </>
}
