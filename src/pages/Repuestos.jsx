import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { mensajeError } from '../utils.js'

const VACIO = { codigo: '', nombre: '', stock: '0', stock_minimo: '0', precio_unitario: '0' }
const pesos = (n) => Number(n || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export default function Repuestos() {
  const { rol } = useAuth()
  const [repuestos, setRepuestos] = useState([])
  const [form, setForm] = useState(VACIO)
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const puedeAdministrar = rol === 'dueno'
  const puedeAjustarStock = ['dueno', 'mecanico'].includes(rol)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('repuestos')
      .select('id, codigo, nombre, stock, stock_minimo, precio_unitario')
      .order('nombre')
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else setRepuestos(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return repuestos.filter((r) => `${r.codigo || ''} ${r.nombre}`.toLowerCase().includes(q))
  }, [repuestos, busqueda])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const limpiar = () => { setForm(VACIO); setEditando(null) }

  const guardar = async (e) => {
    e.preventDefault()
    setMensaje({ tipo: '', texto: '' })
    if (!form.nombre.trim()) return setMensaje({ tipo: 'error', texto: 'Ingresa el nombre del repuesto.' })
    const stock = Number(form.stock), minimo = Number(form.stock_minimo), precio = Number(form.precio_unitario)
    if (![stock, minimo, precio].every(Number.isSafeInteger) || stock < 0 || minimo < 0 || precio < 0)
      return setMensaje({ tipo: 'error', texto: 'Stock, stock mínimo y precio deben ser números enteros iguales o mayores que cero.' })
    setGuardando(true)
    const valores = { codigo: form.codigo.trim() || null, nombre: form.nombre.trim(), stock, stock_minimo: minimo, precio_unitario: precio }
    const resultado = editando
      ? await supabase.from('repuestos').update(valores).eq('id', editando)
      : await supabase.from('repuestos').insert(valores)
    setGuardando(false)
    if (resultado.error) setMensaje({ tipo: 'error', texto: mensajeError(resultado.error) })
    else { setMensaje({ tipo: 'ok', texto: editando ? 'Repuesto actualizado.' : 'Repuesto registrado.' }); limpiar(); cargar() }
  }

  const editar = (r) => {
    setEditando(r.id)
    setForm({ codigo: r.codigo || '', nombre: r.nombre, stock: String(r.stock), stock_minimo: String(r.stock_minimo), precio_unitario: String(r.precio_unitario) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ajustarStock = async (r, delta) => {
    const nuevo = r.stock + delta
    if (nuevo < 0) return
    const { error } = await supabase.from('repuestos').update({ stock: nuevo }).eq('id', r.id)
    if (error) setMensaje({ tipo: 'error', texto: mensajeError(error) })
    else { setMensaje({ tipo: 'ok', texto: `Stock de "${r.nombre}" actualizado.` }); cargar() }
  }

  if (cargando) return <p className="cargando">Cargando repuestos…</p>

  return <>
    <h1>Repuestos y stock</h1>
    <p className="sub">Consulta las existencias y controla los repuestos disponibles en bodega.</p>
    {mensaje.texto && <p className={mensaje.tipo === 'ok' ? 'exito' : 'error'} role="status">{mensaje.texto}</p>}

    {puedeAdministrar && <section className="panel">
      <h2>{editando ? 'Editar repuesto' : 'Registrar repuesto'}</h2>
      <form onSubmit={guardar}>
        <div className="form-grid">
          <div><label htmlFor="rep-codigo">Código (opcional)</label><input id="rep-codigo" name="codigo" value={form.codigo} onChange={cambiar} maxLength={40} /></div>
          <div><label htmlFor="rep-nombre">Nombre *</label><input id="rep-nombre" name="nombre" value={form.nombre} onChange={cambiar} required maxLength={120} /></div>
          <div><label htmlFor="rep-stock">Stock actual *</label><input id="rep-stock" name="stock" type="number" min="0" step="1" value={form.stock} onChange={cambiar} required /></div>
          <div><label htmlFor="rep-minimo">Stock mínimo *</label><input id="rep-minimo" name="stock_minimo" type="number" min="0" step="1" value={form.stock_minimo} onChange={cambiar} required /></div>
          <div><label htmlFor="rep-precio">Precio unitario (CLP) *</label><input id="rep-precio" name="precio_unitario" type="number" min="0" step="1" value={form.precio_unitario} onChange={cambiar} required /></div>
        </div>
        <div className="acciones">
          <button className="btn btn-primario" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar repuesto'}</button>
          {editando && <button className="btn btn-secundario" type="button" onClick={limpiar}>Cancelar edición</button>}
        </div>
      </form>
    </section>}

    <div className="herramientas"><input type="search" placeholder="Buscar por código o nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar repuesto" /></div>
    <div className="tabla-scroll"><table>
      <thead><tr><th>Código</th><th>Repuesto</th><th>Stock</th><th>Stock mínimo</th><th>Precio unitario</th><th>Estado</th>{(puedeAdministrar || puedeAjustarStock) && <th>Acciones</th>}</tr></thead>
      <tbody>
        {visibles.length === 0 && <tr><td colSpan={puedeAdministrar || puedeAjustarStock ? 7 : 6} className="vacio">No hay repuestos registrados.</td></tr>}
        {visibles.map((r) => <tr key={r.id}>
          <td>{r.codigo || '—'}</td><td><strong>{r.nombre}</strong></td><td>{r.stock}</td><td>{r.stock_minimo}</td><td>{pesos(r.precio_unitario)}</td>
          <td><span className={`insignia ${r.stock <= r.stock_minimo ? 'insignia-alerta' : 'insignia-ok'}`}>{r.stock <= r.stock_minimo ? 'Stock bajo' : 'Disponible'}</span></td>
          {(puedeAdministrar || puedeAjustarStock) && <td><div className="celda-acciones">
            {puedeAjustarStock && <><button className="btn btn-secundario btn-chico" onClick={() => ajustarStock(r, -1)} disabled={r.stock <= 0} aria-label={`Restar una unidad de ${r.nombre}`}>−</button><button className="btn btn-secundario btn-chico" onClick={() => ajustarStock(r, 1)} aria-label={`Sumar una unidad de ${r.nombre}`}>+</button></>}
            {puedeAdministrar && <button className="btn btn-secundario btn-chico" onClick={() => editar(r)}>Editar</button>}
          </div></td>}
        </tr>)}
      </tbody>
    </table></div>
    <p className="nota">El registro de repuestos utilizados en una orden descuenta automáticamente las unidades del stock disponible.</p>
  </>
}
