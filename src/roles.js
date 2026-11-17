// Perfiles del sistema (RNF-04) y módulos visibles para cada uno.
export const ROLES = {
  dueno: 'Dueño / encargado',
  recepcion: 'Recepción',
  mecanico: 'Mecánico',
  administracion: 'Administración',
  pendiente: 'Sin rol asignado',
}

const TODOS = ['dueno', 'recepcion', 'mecanico', 'administracion']

// listo: false = módulo aún en construcción (se muestra una pantalla provisoria).
export const MODULOS = [
  { ruta: '/', nombre: 'Inicio', roles: TODOS, listo: true },
  { ruta: '/clientes', nombre: 'Clientes', roles: ['dueno', 'recepcion', 'administracion'], listo: true },
  { ruta: '/vehiculos', nombre: 'Vehículos', roles: ['dueno', 'recepcion', 'administracion'], listo: true },
  { ruta: '/ordenes', nombre: 'Órdenes de trabajo', nombreMecanico: 'Mis trabajos', roles: TODOS, listo: true },
  { ruta: '/repuestos', nombre: 'Repuestos y stock', roles: TODOS, listo: true },
  { ruta: '/presupuestos', nombre: 'Presupuestos', roles: ['dueno', 'recepcion', 'administracion'], listo: true },
  { ruta: '/pagos', nombre: 'Pagos', roles: ['dueno', 'administracion'], listo: true },
  { ruta: '/resumen-diario', nombre: 'Resumen diario', roles: ['dueno'], listo: true },
  { ruta: '/reportes', nombre: 'Reportes', roles: ['dueno', 'administracion'], listo: true },
  { ruta: '/notificaciones', nombre: 'Notificaciones', roles: ['dueno', 'recepcion'], listo: true },
  { ruta: '/usuarios', nombre: 'Usuarios', roles: ['dueno'], listo: true },
]

export function modulosDe(rol) {
  return MODULOS.filter((m) => m.roles.includes(rol))
}

export function nombreModulo(modulo, rol) {
  return rol === 'mecanico' && modulo.nombreMecanico ? modulo.nombreMecanico : modulo.nombre
}
