import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient.js'
import { formatoFecha, mensajeError } from '../utils.js'

const CANALES = [{ value: 'por_definir', label: 'Por definir' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }, { value: 'correo', label: 'Correo electrónico' }, { value: 'otro', label: 'Otro medio' }]
const ESTADO = { preparada: 'Preparada', enviada: 'Enviada (registrada manualmente)', fallida: 'Fallida' }

export default function Notificaciones() {
  const [ordenes, setOrdenes] = useState([])
  const [historial, setHistorial] = useState([])
  const [seleccion, setSeleccion] = useState('')
  const [canal, setCanal] = useState('por_definir')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState({ tipo: '', texto: '' })

  const cargar = useCallback(async () => {
    const [o, n] = await Promise.all([
      supabase.from('ordenes_trabajo').select('id, numero, estado, vehiculos(patente, marca, modelo), clientes(id, nombre, telefono, email)').order('fecha_ingreso', { ascending: false }).limit(500),
      supabase.from('notificaciones').select('id, orden_id, canal, mensaje, estado, created_at, ordenes_trabajo(numero), clientes(nombre)').order('created_at', { ascending: false }).limit(100)
    ])
    if (o.error) setAviso({ tipo: 'error', texto: mensajeError(o.error) })
    else setOrdenes(o.data || [])
    if (n.error) setAviso({ tipo: 'error', texto: mensajeError(n.error) })
    else setHistorial(n.data || [])
    setCargando(false)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const orden = useMemo(() => ordenes.find((o) => o.id === seleccion), [ordenes, seleccion])
  const plantilla = (o) => `Hola ${o?.clientes?.nombre || ''}, te contactamos del Taller Los Pistoneros. Respecto de tu vehículo ${o?.vehiculos?.patente || ''} (orden #${o?.numero || ''}), el estado actual es: ${o?.estado?.replaceAll('_', ' ')}. Si tienes consultas, puedes comunicarte con nosotros.`
  const elegirOrden = (id) => { setSeleccion(id); const o = ordenes.find((x) => x.id === id); setMensaje(plantilla(o)) }

  const preparar = async (e) => {
    e.preventDefault(); setAviso({ tipo: '', texto: '' })
    if (!orden) return setAviso({ tipo: 'error', texto: 'Selecciona una orden de trabajo.' })
    if (!orden.clientes?.telefono && !orden.clientes?.email) return setAviso({ tipo: 'error', texto: 'El cliente no tiene teléfono ni correo registrado. Actualiza sus datos antes de preparar el aviso.' })
    if (!mensaje.trim()) return setAviso({ tipo: 'error', texto: 'Escribe el mensaje que deseas comunicar.' })
    setGuardando(true)
    const { error } = await supabase.from('notificaciones').insert({ orden_id: orden.id, cliente_id: orden.clientes.id, canal, mensaje: mensaje.trim(), estado: 'preparada' })
    setGuardando(false)
    if (error) setAviso({ tipo: 'error', texto: mensajeError(error) })
    else { setAviso({ tipo: 'ok', texto: 'Aviso guardado como preparado. Debes enviarlo manualmente por el canal elegido y luego registrar el resultado.' }); cargar() }
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(mensaje); setAviso({ tipo: 'ok', texto: 'Mensaje copiado. Puedes pegarlo en el canal de contacto elegido.' }) }
    catch { setAviso({ tipo: 'error', texto: 'No se pudo copiar automáticamente. Selecciona y copia el texto manualmente.' }) }
  }

  const copiarHistorial = async (texto) => {
    try { await navigator.clipboard.writeText(texto); setAviso({ tipo: 'ok', texto: 'Mensaje copiado.' }) }
    catch { setAviso({ tipo: 'error', texto: 'No se pudo copiar el mensaje.' }) }
  }

  const actualizarEstado = async (id, estado) => {
    if (estado === 'enviada' && !window.confirm('Confirma que el mensaje ya fue enviado al cliente fuera del sistema.')) return
    const { error } = await supabase.from('notificaciones').update({ estado }).eq('id', id)
    if (error) setAviso({ tipo: 'error', texto: mensajeError(error) })
    else { setAviso({ tipo: 'ok', texto: 'Resultado de la notificación actualizado.' }); cargar() }
  }

  if (cargando) return <p className="cargando">Cargando notificaciones…</p>
  return <>
    <h1>Notificaciones a clientes</h1>
    <p className="sub">Prepara avisos sobre avances importantes y vehículos listos para entregar (CU-15).</p>
    {aviso.texto && <p className={aviso.tipo === 'ok' ? 'exito' : 'error'} role="status">{aviso.texto}</p>}
    <section className="panel">
      <h2>Preparar un aviso</h2>
      <form onSubmit={preparar}>
        <label htmlFor="orden-notificacion">Orden de trabajo</label>
        <select id="orden-notificacion" value={seleccion} onChange={(e) => elegirOrden(e.target.value)} required>
          <option value="">Selecciona una orden</option>
          {ordenes.map((o) => <option key={o.id} value={o.id}>#{o.numero} · {o.vehiculos?.patente || 'Sin patente'} · {o.clientes?.nombre || 'Cliente'} · {o.estado.replaceAll('_', ' ')}</option>)}
        </select>
        {orden && <p className="nota">Contacto registrado: {orden.clientes?.telefono || 'Sin teléfono'} · {orden.clientes?.email || 'Sin correo'} · <Link to={`/ordenes/${orden.id}`}>Ver orden</Link></p>}
        <label htmlFor="canal-notificacion">Canal de contacto</label>
        <select id="canal-notificacion" value={canal} onChange={(e) => setCanal(e.target.value)}>{CANALES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <label htmlFor="mensaje-notificacion">Mensaje</label>
        <textarea id="mensaje-notificacion" rows="5" value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Escribe el aviso que recibirá el cliente." required />
        <div className="acciones"><button className="btn btn-secundario" type="button" onClick={copiar} disabled={!mensaje.trim()}>Copiar mensaje</button><button className="btn btn-primario" type="submit" disabled={guardando || !orden}>{guardando ? 'Guardando…' : 'Guardar aviso preparado'}</button></div>
        <p className="nota">El sistema no realiza el envío automático. El canal queda pendiente de definición con el taller. Después de enviar el mensaje manualmente, registra el resultado en el historial.</p>
      </form>
    </section>
    <section className="panel"><h2>Historial de notificaciones</h2><div className="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Orden</th><th>Cliente</th><th>Canal</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      {historial.length === 0 ? <tr><td colSpan="6" className="vacio">Todavía no hay notificaciones registradas.</td></tr> : historial.map((n) => <tr key={n.id}><td>{formatoFecha(n.created_at)}</td><td>#{n.ordenes_trabajo?.numero ?? '—'}</td><td>{n.clientes?.nombre ?? '—'}</td><td>{CANALES.find((c) => c.value === n.canal)?.label || n.canal}</td><td>{ESTADO[n.estado] || n.estado}</td><td className="celda-acciones">{n.estado !== 'enviada' && <><button className="btn btn-secundario btn-chico" onClick={() => copiarHistorial(n.mensaje)}>Copiar</button><button className="btn btn-primario btn-chico" onClick={() => actualizarEstado(n.id, 'enviada')}>Registrar envío</button><button className="btn btn-secundario btn-chico" onClick={() => actualizarEstado(n.id, 'fallida')}>Marcar fallida</button></>}</td></tr>)}
    </tbody></table></div></section>
  </>
}
