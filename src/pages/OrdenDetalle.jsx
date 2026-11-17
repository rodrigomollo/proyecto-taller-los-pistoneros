import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import Estado from '../components/Estado.jsx'
import { useCambiosOrdenes } from '../hooks/useCambiosOrdenes.js'
import { ESTADOS, formatoFecha, mensajeError } from '../utils.js'

const SELECT_ORDEN =
  'id, numero, estado, fecha_ingreso, fecha_termino, fecha_entrega, motivo, problema_informado, mecanico_id, ' +
  'vehiculos(patente, marca, modelo, anio, kilometraje), clientes(nombre, telefono), mecanico:perfiles!mecanico_id(nombre)'

const DIAG_VACIO = { diagnostico: '', fallas: '', observaciones: '', trabajos_recomendados: '' }

// Detalle de una orden: asignación (CU-05), estado (CU-06), diagnóstico (CU-04),
// avances (CU-07) y entrega (CU-16).
export default function OrdenDetalle() {
  const { id } = useParams()
  const { state } = useLocation()
  const { rol, perfil } = useAuth()
  const [orden, setOrden] = useState(null)
  const [diagnosticos, setDiagnosticos] = useState([])
  const [avances, setAvances] = useState([])
  const [repuestosOrden, setRepuestosOrden] = useState([])
  const [repuestosDisponibles, setRepuestosDisponibles] = useState([])
  const [repuestoSel, setRepuestoSel] = useState('')
  const [cantidadRepuesto, setCantidadRepuesto] = useState('1')
  const [errorRepuesto, setErrorRepuesto] = useState('')
  const [mecanicos, setMecanicos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(state?.creada ? { tipo: 'ok', texto: 'Orden creada correctamente.' } : { tipo: '', texto: '' })
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [mecanicoSel, setMecanicoSel] = useState('')
  const [diag, setDiag] = useState(DIAG_VACIO)
  const [avance, setAvance] = useState('')
  const [errorDiag, setErrorDiag] = useState('')
  const [errorAvance, setErrorAvance] = useState('')

  const cargar = useCallback(async () => {
    const [o, d, a, r] = await Promise.all([
      supabase.from('ordenes_trabajo').select(SELECT_ORDEN).eq('id', id).maybeSingle(),
      supabase.from('diagnosticos').select('id, diagnostico, fallas, observaciones, trabajos_recomendados, created_at, autor:perfiles!autor_id(nombre)').eq('orden_id', id).order('created_at', { ascending: false }),
      supabase.from('avances').select('id, descripcion, created_at, autor:perfiles!autor_id(nombre)').eq('orden_id', id).order('created_at', { ascending: false }),
      supabase.from('orden_repuestos').select('id, cantidad, precio_unitario, created_at, repuestos(nombre, codigo)').eq('orden_id', id).order('created_at', { ascending: false }),
    ])
    if (o.error) setMensaje({ tipo: 'error', texto: mensajeError(o.error) })
    setOrden(o.data)
    if (o.data) { setNuevoEstado(o.data.estado); setMecanicoSel(o.data.mecanico_id || '') }
    if (!d.error) setDiagnosticos(d.data)
    if (!a.error) setAvances(a.data)
    if (!r.error) setRepuestosOrden(r.data || [])
    setCargando(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  useCambiosOrdenes(cargar)

  useEffect(() => {
    if (!['dueno', 'mecanico'].includes(rol)) return
    supabase.from('repuestos').select('id, nombre, codigo, stock, precio_unitario').gt('stock', 0).order('nombre')
      .then(({ data }) => setRepuestosDisponibles(data ?? []))
    if (rol !== 'dueno') return
    supabase.from('perfiles').select('id, nombre').eq('rol', 'mecanico').eq('activo', true).order('nombre')
      .then(({ data }) => setMecanicos(data ?? []))
  }, [rol])

  if (cargando) return <p className="cargando">Cargando…</p>
  if (!orden) return (
    <>
      <h1>Orden no encontrada</h1>
      <p className="sub">La orden no existe o no tienes permiso para verla. <Link to="/ordenes">Volver al listado</Link></p>
    </>
  )

  const esDueno = rol === 'dueno'
  const esMecanicoAsignado = rol === 'mecanico' && orden.mecanico_id === perfil.id
  const puedeRegistrar = (esDueno || esMecanicoAsignado) && orden.estado !== 'entregado'
  const puedeCambiarEstado = (esDueno || esMecanicoAsignado) && orden.estado !== 'entregado'
  const puedeEntregar = ['dueno', 'recepcion'].includes(rol) && orden.estado === 'listo_para_entregar'
  const estadosElegibles = Object.entries(ESTADOS).filter(([valor]) => valor !== 'entregado')

  const actualizarOrden = async (cambios, textoOk) => {
    setMensaje({ tipo: '', texto: '' })
    const { error } = await supabase.from('ordenes_trabajo').update(cambios).eq('id', orden.id)
    if (error) { setMensaje({ tipo: 'error', texto: mensajeError(error) }); return }
    setMensaje({ tipo: 'ok', texto: textoOk })
    cargar()
  }

  const guardarEstado = () => actualizarOrden({ estado: nuevoEstado }, 'Estado actualizado.')
  const guardarMecanico = () => actualizarOrden({ mecanico_id: mecanicoSel || null }, mecanicoSel ? 'Mecánico asignado.' : 'Asignación quitada.')
  const registrarEntrega = () => {
    if (window.confirm('¿Confirmas que el vehículo fue entregado al cliente?')) actualizarOrden({ estado: 'entregado' }, 'Entrega registrada.')
  }

  const guardarDiagnostico = async (e) => {
    e.preventDefault()
    if (!diag.diagnostico.trim()) { setErrorDiag('Escribe el diagnóstico.'); return }
    const { error } = await supabase.from('diagnosticos').insert({
      orden_id: orden.id,
      diagnostico: diag.diagnostico.trim(),
      fallas: diag.fallas.trim() || null,
      observaciones: diag.observaciones.trim() || null,
      trabajos_recomendados: diag.trabajos_recomendados.trim() || null,
    })
    if (error) { setErrorDiag(mensajeError(error)); return }
    setErrorDiag(''); setDiag(DIAG_VACIO); cargar()
  }

  const guardarAvance = async (e) => {
    e.preventDefault()
    if (!avance.trim()) { setErrorAvance('Describe el avance realizado.'); return }
    const { error } = await supabase.from('avances').insert({ orden_id: orden.id, descripcion: avance.trim() })
    if (error) { setErrorAvance(mensajeError(error)); return }
    setErrorAvance(''); setAvance(''); cargar()
  }

  const registrarRepuesto = async (e) => {
    e.preventDefault()
    const cantidad = Number(cantidadRepuesto)
    const seleccionado = repuestosDisponibles.find((r) => r.id === repuestoSel)
    if (!seleccionado) { setErrorRepuesto('Selecciona un repuesto disponible.'); return }
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) { setErrorRepuesto('La cantidad debe ser un número entero mayor que cero.'); return }
    if (cantidad > seleccionado.stock) { setErrorRepuesto(`Stock insuficiente. Disponible: ${seleccionado.stock}.`); return }
    const { error } = await supabase.from('orden_repuestos').insert({ orden_id: orden.id, repuesto_id: seleccionado.id, cantidad })
    if (error) { setErrorRepuesto(mensajeError(error)); return }
    setErrorRepuesto('')
    setRepuestoSel('')
    setCantidadRepuesto('1')
    cargar()
    const { data } = await supabase.from('repuestos').select('id, nombre, codigo, stock, precio_unitario').gt('stock', 0).order('nombre')
    setRepuestosDisponibles(data || [])
  }

  const cambiarDiag = (campo) => (e) => setDiag({ ...diag, [campo]: e.target.value })

  return (
    <>
      <p className="migas"><Link to="/ordenes">← Órdenes</Link></p>
      <h1>Orden #{orden.numero} <Estado valor={orden.estado} /></h1>
      {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">{mensaje.texto}</p>}

      <section className="panel">
        <h2>Datos de la orden</h2>
        <dl className="datos">
          <div><dt>Vehículo</dt><dd>{orden.vehiculos ? `${orden.vehiculos.patente} · ${orden.vehiculos.marca} ${orden.vehiculos.modelo}${orden.vehiculos.anio ? ` (${orden.vehiculos.anio})` : ''}` : '—'}</dd></div>
          <div><dt>Cliente</dt><dd>{orden.clientes ? `${orden.clientes.nombre} · ${orden.clientes.telefono}` : 'Reservado'}</dd></div>
          <div><dt>Mecánico</dt><dd>{orden.mecanico?.nombre ?? 'Sin asignar'}</dd></div>
          <div><dt>Ingreso</dt><dd>{formatoFecha(orden.fecha_ingreso)}</dd></div>
          <div><dt>Término</dt><dd>{formatoFecha(orden.fecha_termino)}</dd></div>
          <div><dt>Entrega</dt><dd>{formatoFecha(orden.fecha_entrega)}</dd></div>
          <div className="ancho"><dt>Motivo de ingreso</dt><dd>{orden.motivo}</dd></div>
          <div className="ancho"><dt>Problema informado</dt><dd>{orden.problema_informado || '—'}</dd></div>
        </dl>
      </section>

      {(esDueno || puedeCambiarEstado || puedeEntregar) && (
        <section className="panel">
          <h2>Gestión</h2>
          {esDueno && (
            <div className="fila-form">
              <label htmlFor="mecanico">Mecánico responsable</label>
              <select id="mecanico" value={mecanicoSel} onChange={(e) => setMecanicoSel(e.target.value)}>
                <option value="">Sin asignar</option>
                {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              {mecanicos.length === 0 && <p className="nota">No hay mecánicos registrados: la asignación queda pendiente.</p>}
              <button className="btn btn-claro" onClick={guardarMecanico}>Guardar asignación</button>
            </div>
          )}
          {puedeCambiarEstado && (
            <div className="fila-form">
              <label htmlFor="estado">Estado de la orden</label>
              <select id="estado" value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
                {estadosElegibles.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
              <button className="btn btn-claro" onClick={guardarEstado} disabled={nuevoEstado === orden.estado}>Actualizar estado</button>
            </div>
          )}
          {puedeEntregar && <button className="btn btn-primario" onClick={registrarEntrega}>Registrar entrega del vehículo</button>}
        </section>
      )}

      <section className="panel">
        <h2>Repuestos utilizados</h2>
        {repuestosOrden.length === 0 && <p className="nota">Aún no se han registrado repuestos en esta orden.</p>}
        {repuestosOrden.length > 0 && <div className="tabla-scroll"><table>
          <thead><tr><th>Repuesto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
          <tbody>{repuestosOrden.map((r) => <tr key={r.id}>
            <td>{r.repuestos?.nombre || 'Repuesto'}</td><td>{r.cantidad}</td>
            <td>{Number(r.precio_unitario || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</td>
            <td>{(Number(r.precio_unitario || 0) * r.cantidad).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</td>
          </tr>)}</tbody>
        </table></div>}
        {puedeRegistrar && <form onSubmit={registrarRepuesto}>
          <div className="form-grid">
            <div><label htmlFor="repuesto-orden">Repuesto disponible *</label><select id="repuesto-orden" value={repuestoSel} onChange={(e) => setRepuestoSel(e.target.value)} required>
              <option value="">Seleccionar repuesto</option>
              {repuestosDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre} · Stock: {r.stock}</option>)}
            </select></div>
            <div><label htmlFor="cantidad-repuesto">Cantidad *</label><input id="cantidad-repuesto" type="number" min="1" step="1" value={cantidadRepuesto} onChange={(e) => setCantidadRepuesto(e.target.value)} required /></div>
          </div>
          {errorRepuesto && <p className="campo-error" role="alert">{errorRepuesto}</p>}
          {repuestosDisponibles.length === 0 && <p className="nota">No hay repuestos con stock disponible.</p>}
          <div className="acciones"><button className="btn btn-primario" type="submit" disabled={repuestosDisponibles.length === 0}>Registrar repuesto utilizado</button></div>
        </form>}
      </section>

      <section className="panel">
        <h2>Diagnóstico</h2>
        {diagnosticos.length === 0 && <p className="nota">Aún no hay diagnóstico registrado.</p>}
        {diagnosticos.map((d) => (
          <article key={d.id} className="registro">
            <p className="meta">{formatoFecha(d.created_at)} · {d.autor?.nombre ?? 'Equipo del taller'}</p>
            <p><strong>Diagnóstico:</strong> {d.diagnostico}</p>
            {d.fallas && <p><strong>Fallas encontradas:</strong> {d.fallas}</p>}
            {d.observaciones && <p><strong>Observaciones:</strong> {d.observaciones}</p>}
            {d.trabajos_recomendados && <p><strong>Trabajos recomendados:</strong> {d.trabajos_recomendados}</p>}
          </article>
        ))}
        {puedeRegistrar && (
          <form onSubmit={guardarDiagnostico} noValidate>
            <label htmlFor="diagnostico">Diagnóstico *</label>
            <textarea id="diagnostico" rows={2} value={diag.diagnostico} onChange={cambiarDiag('diagnostico')} />
            <label htmlFor="fallas">Fallas encontradas</label>
            <textarea id="fallas" rows={2} value={diag.fallas} onChange={cambiarDiag('fallas')} />
            <label htmlFor="observaciones">Observaciones</label>
            <textarea id="observaciones" rows={2} value={diag.observaciones} onChange={cambiarDiag('observaciones')} />
            <label htmlFor="recomendados">Trabajos recomendados</label>
            <textarea id="recomendados" rows={2} value={diag.trabajos_recomendados} onChange={cambiarDiag('trabajos_recomendados')} />
            {errorDiag && <p className="campo-error">{errorDiag}</p>}
            <div className="acciones"><button className="btn btn-primario" type="submit">Guardar diagnóstico</button></div>
          </form>
        )}
      </section>

      <section className="panel">
        <h2>Avances de la reparación</h2>
        {avances.length === 0 && <p className="nota">Aún no hay avances registrados.</p>}
        {avances.map((a) => (
          <article key={a.id} className="registro">
            <p className="meta">{formatoFecha(a.created_at)} · {a.autor?.nombre ?? 'Equipo del taller'}</p>
            <p>{a.descripcion}</p>
          </article>
        ))}
        {puedeRegistrar && (
          <form onSubmit={guardarAvance} noValidate>
            <label htmlFor="avance">Nuevo avance *</label>
            <textarea id="avance" rows={2} placeholder="Ej: se cambió el filtro de aceite" value={avance} onChange={(e) => setAvance(e.target.value)} />
            {errorAvance && <p className="campo-error">{errorAvance}</p>}
            <div className="acciones"><button className="btn btn-primario" type="submit">Registrar avance</button></div>
          </form>
        )}
      </section>
    </>
  )
}
