-- Borra todo lo creado por schema.sql (solo para reiniciar en desarrollo).
drop trigger if exists al_crear_usuario on auth.users;
drop table if exists public.notificaciones, public.pagos, public.presupuestos, public.orden_repuestos,
  public.repuestos, public.avances, public.diagnosticos, public.ordenes_trabajo, public.vehiculos,
  public.clientes, public.perfiles cascade;
drop function if exists public.crear_perfil(), public.mi_rol(), public.orden_asignada(uuid),
  public.proteger_orden(), public.proteger_repuesto(), public.registrar_repuesto_orden(), public.validar_presupuesto_vs_pagos(), public.validar_pago(), public.tocar_updated_at();
drop type if exists estado_notificacion, estado_orden, rol_usuario;
