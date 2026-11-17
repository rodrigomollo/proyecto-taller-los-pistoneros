-- =====================================================================
-- Migración del paso 2. Ejecutar UNA vez en SQL Editor si ya habías
-- ejecutado schema.sql del paso 1. (schema.sql ya incluye estos cambios
-- para instalaciones nuevas.)
-- =====================================================================

-- 1) Todos los perfiles con sesión pueden ver el nombre de los mecánicos
--    (para mostrar quién tiene asignada cada orden).
create policy perfiles_ver_mecanicos on public.perfiles for select to authenticated
  using (rol = 'mecanico' and activo and public.mi_rol() is not null);

-- 2) RNF-06: la orden siempre queda ligada al cliente dueño del vehículo.
create function public.validar_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select cliente_id into new.cliente_id from public.vehiculos where id = new.vehiculo_id;
  if new.cliente_id is null then raise exception 'vehiculo_no_registrado'; end if;
  return new;
end $$;
create trigger ordenes_validar before insert on public.ordenes_trabajo
  for each row execute function public.validar_orden();

-- 3) La recepción solo puede cambiar el estado para registrar la entrega.
create or replace function public.proteger_orden() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rol rol_usuario := public.mi_rol();
begin
  if new.mecanico_id is distinct from old.mecanico_id and v_rol is distinct from 'dueno' then
    raise exception 'solo_dueno_asigna_mecanico';
  end if;
  if v_rol = 'recepcion' and new.estado is distinct from old.estado and new.estado <> 'entregado' then
    raise exception 'recepcion_solo_registra_entrega';
  end if;
  if v_rol = 'mecanico' then
    if (to_jsonb(new) - 'estado' - 'updated_at' - 'fecha_termino' - 'fecha_entrega')
       is distinct from (to_jsonb(old) - 'estado' - 'updated_at' - 'fecha_termino' - 'fecha_entrega') then
      raise exception 'mecanico_solo_cambia_estado';
    end if;
    if new.estado = 'entregado' then raise exception 'mecanico_no_entrega_vehiculos'; end if;
  end if;
  if new.estado is distinct from old.estado then
    if new.estado = 'listo_para_entregar' then new.fecha_termino := coalesce(old.fecha_termino, now()); end if;
    if new.estado = 'entregado' then
      if old.estado <> 'listo_para_entregar' then raise exception 'orden_no_lista_para_entrega'; end if;
      new.fecha_entrega := now();
    end if;
  end if;
  return new;
end $$;
