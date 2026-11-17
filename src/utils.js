// Utilidades compartidas: formato, validaciones y mensajes de error en español.

export const ESTADOS = {
  pendiente_diagnostico: 'Pendiente de diagnóstico',
  en_reparacion: 'En reparación',
  esperando_repuestos: 'Esperando repuestos',
  listo_para_entregar: 'Listo para entregar',
  entregado: 'Entregado',
}

export function formatoFecha(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
}

// Valor inicial para <input type="datetime-local"> (hora local, sin segundos).
export function ahoraLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export const normalizarTelefono = (t) => t.replace(/[\s\-()]/g, '')
export const telefonoValido = (t) => /^\+?\d{8,12}$/.test(normalizarTelefono(t))
export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
export const normalizarPatente = (p) => p.toUpperCase().replace(/[\s\-.]/g, '')
export const patenteValida = (p) => /^[A-Z0-9]{5,7}$/.test(normalizarPatente(p))

export function mensajeError(error) {
  const m = error?.message || ''
  if (error?.code === '23505') {
    if (m.includes('telefono')) return 'Ya existe un cliente con ese teléfono.'
    if (m.includes('patente')) return 'Ya existe un vehículo con esa patente.'
    return 'Ya existe un registro con esos datos.'
  }
  if (m.includes('solo_dueno_asigna_mecanico')) return 'Solo el dueño puede asignar mecánicos.'
  if (m.includes('recepcion_solo_registra_entrega')) return 'La recepción solo puede registrar la entrega del vehículo.'
  if (m.includes('mecanico_solo_cambia_estado')) return 'El mecánico solo puede cambiar el estado de la orden.'
  if (m.includes('mecanico_no_entrega_vehiculos')) return 'El mecánico no puede registrar la entrega.'
  if (m.includes('orden_no_lista_para_entrega')) return 'No se puede entregar: la orden no está en estado "Listo para entregar".'
  if (m.includes('vehiculo_no_registrado')) return 'El vehículo no está registrado.'
  if (m.includes('stock_insuficiente')) return 'No hay stock suficiente para registrar esa cantidad.'
  if (m.includes('repuesto_no_registrado')) return 'El repuesto seleccionado ya no está disponible.'
  if (m.includes('pago_sin_presupuesto')) return 'No se puede registrar un pago sin un presupuesto asociado.'
  if (m.includes('pago_supera_saldo')) return 'El pago supera el saldo pendiente de la orden.'
  if (m.includes('presupuesto_menor_a_pagos')) return 'El total del presupuesto no puede ser menor que los pagos ya registrados.'
  if (m.includes('solo_dueno_administracion_costo_final')) return 'Solo el dueño o administración puede registrar el costo final.'
  if (m.includes('costo_final_antes_de_termino')) return 'El costo final solo se puede registrar cuando la reparación tenga fecha de término.'
  if (error?.code === '42501' || m.includes('row-level security')) return 'No tienes permiso para realizar esta acción.'
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}
