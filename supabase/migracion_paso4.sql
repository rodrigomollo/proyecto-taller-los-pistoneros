-- =====================================================================
-- Migración del paso 4: reportes, resumen diario y notificaciones.
-- Ejecutar UNA vez en Supabase SQL Editor para bases ya creadas.
-- Para instalaciones nuevas, los cambios también están en schema.sql.
-- =====================================================================

-- El canal aún está por definirse con el taller. Evitamos asumir WhatsApp.
alter table public.presupuestos add column if not exists costo_final bigint
  check (costo_final is null or costo_final >= 0);
alter table public.notificaciones alter column canal set default 'por_definir';
alter table public.notificaciones drop constraint if exists notificaciones_canal_check;
alter table public.notificaciones add constraint notificaciones_canal_check
  check (canal in ('por_definir','whatsapp','sms','correo','otro'));

create index if not exists notificaciones_orden_fecha_idx
  on public.notificaciones (orden_id, created_at desc);

-- Evita registrar un aviso para un cliente distinto al de la orden.
create or replace function public.validar_notificacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente
  from public.ordenes_trabajo
  where id = new.orden_id;
  if v_cliente is null then raise exception 'orden_no_registrada'; end if;
  if new.cliente_id is distinct from v_cliente then
    raise exception 'cliente_no_corresponde_a_orden';
  end if;
  return new;
end $$;

drop trigger if exists notificaciones_validar on public.notificaciones;
create trigger notificaciones_validar
before insert or update on public.notificaciones
for each row execute function public.validar_notificacion();

-- Los permisos RLS ya definidos en schema.sql se mantienen:
-- SELECT/INSERT/UPDATE: dueño y recepción. El envío externo no se automatiza.


-- Solo dueño/administración puede registrar el costo final y debe existir fecha de término.
create or replace function public.proteger_costo_final() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_fecha_termino timestamptz;
begin
  if new.costo_final is distinct from old.costo_final then
    if public.mi_rol() not in ('dueno','administracion') then
      raise exception 'solo_dueno_administracion_costo_final';
    end if;
    if new.costo_final is not null then
      select fecha_termino into v_fecha_termino from public.ordenes_trabajo where id = new.orden_id;
      if v_fecha_termino is null then raise exception 'costo_final_antes_de_termino'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists presupuestos_proteger_costo_final on public.presupuestos;
create trigger presupuestos_proteger_costo_final
before update on public.presupuestos
for each row execute function public.proteger_costo_final();
