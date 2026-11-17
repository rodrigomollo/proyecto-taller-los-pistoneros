-- =====================================================================
-- Migración del paso 3. Ejecutar UNA vez en Supabase SQL Editor si el
-- proyecto ya tiene aplicada la versión anterior de schema.sql.
-- Para instalaciones nuevas, schema.sql ya incluye estas funciones.
-- =====================================================================

create or replace function public.validar_presupuesto_vs_pagos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pagado bigint;
  v_total bigint;
begin
  perform 1 from public.ordenes_trabajo where id = new.orden_id for update;
  v_total := new.mano_obra + new.costo_repuestos - new.descuento;

  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos where orden_id = new.orden_id;

  if v_total < v_pagado then
    raise exception 'presupuesto_menor_a_pagos';
  end if;
  return new;
end;
$$;

drop trigger if exists presupuestos_validar_pagos on public.presupuestos;
create trigger presupuestos_validar_pagos
before insert or update on public.presupuestos
for each row execute function public.validar_presupuesto_vs_pagos();

create or replace function public.validar_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_pagado bigint;
begin
  perform 1 from public.ordenes_trabajo where id = new.orden_id for update;

  select total into v_total
  from public.presupuestos
  where orden_id = new.orden_id;

  if not found then
    raise exception 'pago_sin_presupuesto';
  end if;

  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos
  where orden_id = new.orden_id;

  if v_pagado + new.monto > v_total then
    raise exception 'pago_supera_saldo';
  end if;

  return new;
end;
$$;

drop trigger if exists pagos_validar_saldo on public.pagos;
create trigger pagos_validar_saldo
before insert on public.pagos
for each row execute function public.validar_pago();
